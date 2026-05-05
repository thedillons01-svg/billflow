import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { processBill } from '@/lib/ocr/process'

// Increase Vercel function timeout — large PDFs need time to upload
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Postmark inbound payload shape (only fields we use)
// ---------------------------------------------------------------------------

type PostmarkAttachment = {
  Name: string
  Content: string       // base64-encoded
  ContentType: string
  ContentLength: number
}

type PostmarkPayload = {
  MessageID: string
  From: string
  FromName: string
  To: string
  OriginalRecipient?: string
  ToFull?: Array<{ Email: string; Name: string }>
  Subject: string
  TextBody?: string
  HtmlBody?: string
  Date: string
  Attachments?: PostmarkAttachment[]
}

// ---------------------------------------------------------------------------
// Supabase service-role client — bypasses RLS for server-side processing
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STORAGE_BUCKET = 'bill-pdfs'

// ---------------------------------------------------------------------------
// POST /api/webhooks/email
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Verify shared secret passed as a query param.
  //    Webhook URL: /api/webhooks/email?secret=<EMAIL_WEBHOOK_SECRET>
  const token = request.nextUrl.searchParams.get('secret')
  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let payload: PostmarkPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Email filtering: subject or body must contain "invoice" (case-insensitive).
  //    Per spec: forward rule fires on "invoice" — not "bill", not "statement".
  const subject = payload.Subject ?? ''
  const bodyText = (payload.TextBody ?? '') + (payload.HtmlBody ?? '')
  if (!/invoice/i.test(subject) && !/invoice/i.test(bodyText)) {
    return NextResponse.json({ skipped: true, reason: 'no_invoice_keyword' })
  }

  // 4. Resolve company from the capture address prefix (e.g. "acme" → acme@billflow.com)
  const toAddress =
    payload.OriginalRecipient ??
    payload.ToFull?.[0]?.Email ??
    payload.To ??
    ''
  const prefix = toAddress.split('@')[0].toLowerCase()

  const supabase = getServiceClient()

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('company_id')
    .eq('capture_email_prefix', prefix)
    .single()

  if (companyErr || !company) {
    // Not our address — return 200 so Postmark doesn't retry
    console.warn(`[email-webhook] No company for prefix "${prefix}"`)
    return NextResponse.json({ skipped: true, reason: 'unknown_recipient' })
  }

  // 5. Filter to PDF attachments
  const pdfs = (payload.Attachments ?? []).filter(isPdf)

  if (pdfs.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_pdf_attachments' })
  }

  // 6. Process each PDF: store → create bill record → log
  const created: string[] = []
  const errors: string[] = []

  for (const attachment of pdfs) {
    const billId = randomUUID()
    const storagePath = `${company.company_id}/${billId}.pdf`

    // Decode and upload
    const pdfBytes = Buffer.from(attachment.Content, 'base64')

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadErr) {
      console.error(`[email-webhook] Storage upload failed (${billId}):`, uploadErr.message)
      errors.push(billId)
      continue
    }

    // Create bill record
    const { error: insertErr } = await supabase.from('bills').insert({
      bill_id:        billId,
      company_id:     company.company_id,
      status:         'draft',
      capture_source: 'email',
      pdf_url:        storagePath,
    })

    if (insertErr) {
      console.error(`[email-webhook] Bill insert failed (${billId}):`, insertErr.message)
      // Clean up the orphaned file so storage stays consistent
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      errors.push(billId)
      continue
    }

    // Append-only processing log entry
    await supabase.from('processing_log').insert({
      bill_id:     billId,
      action:      'captured',
      actor:       'system',
      after_state: {
        status:          'draft',
        capture_source:  'email',
        from_email:      payload.From,
        from_name:       payload.FromName,
        subject,
        postmark_msg_id: payload.MessageID,
        attachment_name: attachment.Name,
        pdf_url:         storagePath,
      },
    })

    // Await OCR inline — must complete before response returns or Vercel may terminate the function
    try {
      await processBill(billId)
    } catch (err) {
      console.error(`[email-webhook] processBill threw (${billId}):`, err)
    }

    created.push(billId)
  }

  return NextResponse.json({
    received: pdfs.length,
    created:  created.length,
    errors:   errors.length,
    bill_ids: created,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPdf(att: PostmarkAttachment): boolean {
  const name = att.Name?.toLowerCase() ?? ''
  const type = att.ContentType?.toLowerCase() ?? ''
  return type === 'application/pdf' || name.endsWith('.pdf')
}
