import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { processBill } from '@/lib/ocr/process'
import { processPO } from '@/lib/ocr/process-po'
import { splitPdf } from '@/lib/ocr/split-pdf'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

type PostmarkAttachment = {
  Name: string
  Content: string
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

const STORAGE_BUCKET = 'bill-pdfs'

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('secret')
  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: PostmarkPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const subject = payload.Subject ?? ''
  const body = payload.TextBody ?? ''
  const toAddress =
    payload.OriginalRecipient ??
    payload.ToFull?.[0]?.Email ??
    payload.To ??
    ''

  // Determine document type from address suffix: {prefix}-bills@ or {prefix}-pos@
  const localPart = toAddress.split('@')[0].toLowerCase()
  let captureType: 'bill' | 'po' | null = null
  let companyPrefix = localPart

  if (localPart.endsWith('-bills')) {
    captureType = 'bill'
    companyPrefix = localPart.slice(0, -6) // strip "-bills"
  } else if (localPart.endsWith('-pos')) {
    captureType = 'po'
    companyPrefix = localPart.slice(0, -4) // strip "-pos"
  } else {
    // Fallback: guess from subject/body
    const lc = (subject + ' ' + body).toLowerCase()
    captureType = lc.includes('purchase order') || lc.includes('order confirmation') ? 'po' : 'bill'
  }

  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id')
    .eq('capture_email_prefix', companyPrefix)
    .single()

  if (!company) {
    console.warn(`[email-webhook] No company for prefix "${companyPrefix}"`)
    return NextResponse.json({ skipped: true, reason: 'unknown_recipient' })
  }

  const pdfs = (payload.Attachments ?? []).filter(isPdf)
  if (pdfs.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_pdf_attachments' })
  }

  const created: string[] = []
  const errors: string[] = []

  for (const attachment of pdfs) {
    const rawBytes = Buffer.from(attachment.Content, 'base64')

    // For bills only: detect and split multi-invoice PDF bundles (e.g. Gensco statement + invoices).
    // POs are always single documents — skip splitting.
    let pageBufs: Buffer[]
    if (captureType === 'bill') {
      try {
        pageBufs = await splitPdf(rawBytes)
      } catch (err) {
        console.warn(`[email-webhook] splitPdf failed, treating as single PDF:`, err)
        pageBufs = [rawBytes]
      }
    } else {
      pageBufs = [rawBytes]
    }

    for (const pdfBytes of pageBufs) {
      const docId = randomUUID()
      const storagePath = `${company.company_id}/${docId}.pdf`

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })

      if (uploadErr) {
        console.error(`[email-webhook] Storage upload failed (${docId}):`, uploadErr.message)
        errors.push(docId)
        continue
      }

      if (captureType === 'po') {
        // Create PO record
        const { error: insertErr } = await supabase.from('purchase_orders').insert({
          po_id:          docId,
          company_id:     company.company_id,
          status:         'open',
          capture_source: 'email',
          pdf_url:        storagePath,
        })

        if (insertErr) {
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
          errors.push(docId)
          continue
        }

        await supabase.from('processing_log').insert({
          document_id:   docId,
          document_type: 'po',
          company_id:    company.company_id,
          action:        'captured',
          actor:         'system',
          after_state:   { capture_source: 'email', from: payload.From, subject, pdf_url: storagePath },
        })

        try { await processPO(docId) } catch (err) {
          console.error(`[email-webhook] processPO threw (${docId}):`, err)
        }
      } else {
        // Create bill record
        const { error: insertErr } = await supabase.from('bills').insert({
          bill_id:        docId,
          company_id:     company.company_id,
          status:         'draft',
          capture_source: 'email',
          pdf_url:        storagePath,
        })

        if (insertErr) {
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
          errors.push(docId)
          continue
        }

        await supabase.from('processing_log').insert({
          bill_id:       docId,
          document_type: 'bill',
          company_id:    company.company_id,
          action:        'captured',
          actor:         'system',
          after_state:   { capture_source: 'email', from: payload.From, subject, pdf_url: storagePath },
        })

        try { await processBill(docId) } catch (err) {
          console.error(`[email-webhook] processBill threw (${docId}):`, err)
        }
      }

      created.push(docId)
    }
  }

  return NextResponse.json({ received: pdfs.length, created: created.length, errors: errors.length, ids: created })
}

function isPdf(att: PostmarkAttachment): boolean {
  const name = att.Name?.toLowerCase() ?? ''
  const type = att.ContentType?.toLowerCase() ?? ''
  return type === 'application/pdf' || name.endsWith('.pdf')
}
