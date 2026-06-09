import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { Resend } from 'resend'
import { processBill } from '@/lib/ocr/process'
import { processPO } from '@/lib/ocr/process-po'
import { splitPdf } from '@/lib/ocr/split-pdf'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/send-email'
import { getFileCategory, convertToPdf, SUPPORTED_TYPES_LABEL } from '@/lib/converters/to-pdf'

const FORWARD_TO      = 'billflowdev@gmail.com'
const FROM_ADDRESS    = 'Purchasomatic <notifications@purchasomatic.com>'

async function forwardUnknownEmail(payload: PostmarkPayload, toAddress: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email-webhook] RESEND_API_KEY not set — cannot forward unknown email')
    return
  }
  const resend = new Resend(key)
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #1A3D2B; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <span style="color: white; font-size: 15px; font-weight: 600;">Purchasomatic — Forwarded Email</span>
      </div>
      <div style="background: white; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        <table style="font-size: 13px; color: #374151; margin-bottom: 20px; border-collapse: collapse;">
          <tr><td style="padding: 3px 12px 3px 0; color: #6B7280; white-space: nowrap;">Sent to</td><td>${toAddress}</td></tr>
          <tr><td style="padding: 3px 12px 3px 0; color: #6B7280; white-space: nowrap;">From</td><td>${payload.From}${payload.FromName ? ` (${payload.FromName})` : ''}</td></tr>
          <tr><td style="padding: 3px 12px 3px 0; color: #6B7280; white-space: nowrap;">Subject</td><td>${payload.Subject ?? '(no subject)'}</td></tr>
          <tr><td style="padding: 3px 12px 3px 0; color: #6B7280; white-space: nowrap;">Date</td><td>${payload.Date ?? ''}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 0 0 20px;" />
        <div style="font-size: 14px; color: #111827; line-height: 1.6; white-space: pre-wrap;">${
          (payload.TextBody ?? '(no text body)').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }</div>
      </div>
    </div>
  `
  try {
    await resend.emails.send({
      from:    FROM_ADDRESS,
      to:      FORWARD_TO,
      subject: `Fwd: ${payload.Subject ?? '(no subject)'}`,
      html,
    })
    console.log(`[email-webhook] Forwarded unknown email from ${payload.From} (to: ${toAddress}) → ${FORWARD_TO}`)
  } catch (err) {
    console.error('[email-webhook] Forward via Resend failed:', err)
  }
}

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

  // If the address isn't a recognised capture address, forward and stop
  const toAddrLower = toAddress.toLowerCase()
  if (!toAddrLower.endsWith('-bills@purchasomatic.com') && !toAddrLower.endsWith('-pos@purchasomatic.com')) {
    await forwardUnknownEmail(payload, toAddress)
    return NextResponse.json({ skipped: true, reason: 'unknown_address_forwarded' })
  }

  // Determine document type from address suffix: {prefix}-bills@ or {prefix}-pos@
  const localPart = toAddress.split('@')[0].toLowerCase()
  let captureType: 'bill' | 'po' | null = null
  let companyPrefix = localPart
  let addressHasSuffix = false

  if (localPart.endsWith('-bills')) {
    captureType = 'bill'
    companyPrefix = localPart.slice(0, -6) // strip "-bills"
    addressHasSuffix = true
  } else if (localPart.endsWith('-pos')) {
    captureType = 'po'
    companyPrefix = localPart.slice(0, -4) // strip "-pos"
    addressHasSuffix = true
  } else {
    // Fallback: guess from subject/body
    const lc = (subject + ' ' + body).toLowerCase()
    captureType = lc.includes('purchase order') || lc.includes('order confirmation') ? 'po' : 'bill'
  }

  // Wrong document type detection (only when address suffix is explicit)
  if (addressHasSuffix) {
    const lc = (subject + ' ' + body).toLowerCase()
    const looksLikePO = lc.includes('purchase order') || lc.includes('order confirmation') || lc.includes('p.o. #') || lc.includes('po #')
    const looksLikeInvoice = lc.includes('invoice') || lc.includes('statement') || lc.includes('billing')

    if (captureType === 'bill' && looksLikePO && !looksLikeInvoice) {
      // PO sent to bills address
      const supabaseEarly = createServiceClient()
      const { data: co } = await supabaseEarly.from('companies').select('company_id, capture_email_prefix').eq('capture_email_prefix', companyPrefix).single()
      if (co) {
        const posAddr = `${co.capture_email_prefix}-pos@purchasomatic.com`
        await supabaseEarly.from('processing_log').insert({
          company_id: co.company_id,
          action: 'wrong_capture_address',
          actor: 'system',
          after_state: { from: payload.From, subject, correct_address: posAddr, detected_as: 'purchase_order' },
        })
        await sendNotification({
          companyId: co.company_id,
          event:     'wrong_capture_address',
          subject:   'Document sent to wrong address',
          body:      `A purchase order was sent to your bills address. Forward it to ${posAddr} instead. No credit was charged.`,
        })
      }
      console.warn(`[email-webhook] PO sent to bills address — rejected`)
      return NextResponse.json({ skipped: true, reason: 'wrong_capture_address_po_to_bills' })
    }

    if (captureType === 'po' && looksLikeInvoice && !looksLikePO) {
      // Invoice sent to PO address
      const supabaseEarly = createServiceClient()
      const { data: co } = await supabaseEarly.from('companies').select('company_id, capture_email_prefix').eq('capture_email_prefix', companyPrefix).single()
      if (co) {
        const billsAddr = `${co.capture_email_prefix}-bills@purchasomatic.com`
        await supabaseEarly.from('processing_log').insert({
          company_id: co.company_id,
          action: 'wrong_capture_address',
          actor: 'system',
          after_state: { from: payload.From, subject, correct_address: billsAddr, detected_as: 'invoice' },
        })
        await sendNotification({
          companyId: co.company_id,
          event:     'wrong_capture_address',
          subject:   'Document sent to wrong address',
          body:      `An invoice was sent to your PO address. Forward it to ${billsAddr} instead. No credit was charged.`,
        })
      }
      console.warn(`[email-webhook] Invoice sent to PO address — rejected`)
      return NextResponse.json({ skipped: true, reason: 'wrong_capture_address_invoice_to_pos' })
    }
  }

  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, capture_email_prefix, credit_balance, subscription_status')
    .eq('capture_email_prefix', companyPrefix)
    .single()

  if (!company) {
    console.warn(`[email-webhook] No company for prefix "${companyPrefix}"`)
    return NextResponse.json({ skipped: true, reason: 'unknown_recipient' })
  }

  if ((company.credit_balance ?? 0) <= 0 && company.subscription_status !== 'active') {
    await sendNotification({
      companyId: company.company_id,
      event:     'autopublish_disabled',
      subject:   'Invoice received but not processed — no credits remaining',
      body:      `An email from ${payload.From} arrived but could not be processed because your credit balance is zero and you do not have an active subscription. Subscribe at purchasomatic.com to continue — active subscribers are billed for overages on their next billing date. No charge was applied for this email.`,
    })
    console.warn(`[email-webhook] Rejected — company ${company.company_id} has 0 credits and no active subscription`)
    return NextResponse.json({ skipped: true, reason: 'no_credits' })
  }

  const allAttachments = payload.Attachments ?? []
  const supported   = allAttachments.filter(a => getFileCategory(a.ContentType, a.Name) !== 'unsupported')
  const unsupported = allAttachments.filter(a => getFileCategory(a.ContentType, a.Name) === 'unsupported')

  // Notify about any truly unsupported types (DOCX, PPTX, ZIP, etc.)
  if (unsupported.length > 0) {
    const fileList = unsupported.map(a => a.Name).join(', ')
    const exts = [...new Set(unsupported.map(a => {
      const parts = (a.Name ?? '').split('.')
      return parts.length > 1 ? parts.pop()!.toUpperCase() : 'unknown'
    }))].join(', ')

    await supabase.from('processing_log').insert({
      company_id:  company.company_id,
      action:      'unsupported_file_type',
      actor:       'system',
      after_state: { from: payload.From, subject, files: fileList, types: exts },
    })

    await sendNotification({
      companyId: company.company_id,
      event:     'pdf_unreadable',
      subject:   `Attachment could not be processed: ${exts}`,
      body:      `An email from ${payload.From} contained ${unsupported.length > 1 ? `${unsupported.length} attachments` : 'an attachment'} (${fileList}) that could not be converted. Purchasomatic can process ${SUPPORTED_TYPES_LABEL}. No credit was charged.`,
    })

    console.warn(`[email-webhook] Unsupported types (${exts}) from ${payload.From} — notified company ${company.company_id}`)
  }

  if (supported.length === 0) {
    // No attachments at all → silent skip; only attachments of wrong type already notified above
    return NextResponse.json({ skipped: true, reason: 'no_processable_attachments' })
  }

  const created: string[] = []
  const errors: string[] = []

  for (const attachment of supported) {
    const rawBytes = Buffer.from(attachment.Content, 'base64')

    // Convert to PDF if the attachment isn't already one
    let pdfBytes: Buffer
    try {
      pdfBytes = await convertToPdf(rawBytes, attachment.ContentType, attachment.Name)
    } catch (err) {
      console.error(`[email-webhook] Conversion failed for ${attachment.Name}:`, err)
      errors.push(attachment.Name)
      continue
    }

    // For bills only: detect and split multi-invoice PDF bundles (e.g. Gensco statement + invoices).
    // POs are always single documents — skip splitting.
    let pageBufs: Buffer[]
    if (captureType === 'bill') {
      try {
        pageBufs = await splitPdf(pdfBytes)
      } catch (err) {
        console.warn(`[email-webhook] splitPdf failed, treating as single PDF:`, err)
        pageBufs = [pdfBytes]
      }
    } else {
      pageBufs = [pdfBytes]
    }

    for (const pdfBytes of pageBufs) {
      const fingerprint = createHash('sha256').update(pdfBytes).digest('hex')

      // File fingerprint duplicate check — same PDF already received for this company.
      // Still upload and create the record so the user can "Process Anyway" from the Activity log.
      let isFingerprintDuplicate = false
      let originalDocId: string | null = null
      if (captureType === 'bill') {
        const { data: fpMatch } = await supabase
          .from('bills')
          .select('bill_id')
          .eq('company_id', company.company_id)
          .eq('file_fingerprint', fingerprint)
          .is('deleted_at', null)
          .neq('status', 'fingerprint_duplicate')
          .limit(1)
        if (fpMatch && fpMatch.length > 0) {
          isFingerprintDuplicate = true
          originalDocId = fpMatch[0].bill_id
        }
      } else {
        const { data: fpMatch } = await supabase
          .from('purchase_orders')
          .select('po_id')
          .eq('company_id', company.company_id)
          .eq('file_fingerprint', fingerprint)
          .is('deleted_at', null)
          .limit(1)
        if (fpMatch && fpMatch.length > 0) {
          isFingerprintDuplicate = true
          originalDocId = fpMatch[0].po_id
        }
      }

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
          po_id:            docId,
          company_id:       company.company_id,
          status:           'open',
          capture_source:   'email',
          pdf_url:          storagePath,
          file_fingerprint: fingerprint,
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
        const billStatus = isFingerprintDuplicate ? 'fingerprint_duplicate' : 'draft'
        const { error: insertErr } = await supabase.from('bills').insert({
          bill_id:          docId,
          company_id:       company.company_id,
          status:           billStatus,
          capture_source:   'email',
          pdf_url:          storagePath,
          file_fingerprint: fingerprint,
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
          action:        isFingerprintDuplicate ? 'fingerprint_duplicate' : 'captured',
          actor:         'system',
          after_state:   {
            capture_source: 'email', from: payload.From, subject, pdf_url: storagePath,
            ...(isFingerprintDuplicate ? { original_bill_id: originalDocId } : {}),
          },
        })

        if (!isFingerprintDuplicate) {
          try { await processBill(docId) } catch (err) {
            console.error(`[email-webhook] processBill threw (${docId}):`, err)
          }
        } else {
          console.warn(`[email-webhook] Fingerprint duplicate held (${docId}), matches ${originalDocId}`)
        }
      }

      created.push(docId)
    }
  }

  return NextResponse.json({ received: supported.length, created: created.length, errors: errors.length, ids: created })
}
