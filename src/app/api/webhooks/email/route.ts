import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { processBill } from '@/lib/ocr/process'
import { processPO } from '@/lib/ocr/process-po'
import { splitPdf } from '@/lib/ocr/split-pdf'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/send-email'

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
    .select('company_id, capture_email_prefix')
    .eq('capture_email_prefix', companyPrefix)
    .single()

  if (!company) {
    console.warn(`[email-webhook] No company for prefix "${companyPrefix}"`)
    return NextResponse.json({ skipped: true, reason: 'unknown_recipient' })
  }

  const pdfs = (payload.Attachments ?? []).filter(isPdf)
  const nonPdfs = (payload.Attachments ?? []).filter(a => !isPdf(a))

  if (pdfs.length === 0) {
    if (nonPdfs.length > 0) {
      // Attachments were present but none were PDFs — notify the user
      const fileList = nonPdfs.map(a => a.Name).join(', ')
      const exts = [...new Set(nonPdfs.map(a => {
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
        subject:   `Unsupported file type: ${exts}`,
        body:      `An email from ${payload.From} contained ${nonPdfs.length > 1 ? `${nonPdfs.length} attachments` : 'an attachment'} (${fileList}) that could not be processed. Purchasomatic only accepts PDF files. Ask your vendor to send invoices as PDFs, or export the file to PDF before forwarding it. No credit was charged.`,
      })

      console.warn(`[email-webhook] Unsupported attachment types (${exts}) from ${payload.From} — notified company ${company.company_id}`)
    }
    // No attachments at all — silent skip (plain-text email forwards are normal)
    return NextResponse.json({ skipped: true, reason: 'no_pdf_attachments' })
  }

  // If there are also non-PDF attachments alongside valid PDFs, notify separately
  if (nonPdfs.length > 0) {
    const fileList = nonPdfs.map(a => a.Name).join(', ')
    const exts = [...new Set(nonPdfs.map(a => {
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
      subject:   `Attachment skipped: ${exts}`,
      body:      `An email from ${payload.From} contained a mix of file types. The PDF(s) were processed normally, but ${nonPdfs.length > 1 ? `${nonPdfs.length} attachments` : 'one attachment'} (${fileList}) could not be processed because Purchasomatic only accepts PDF files. No credit was charged for the skipped file(s).`,
    })

    console.warn(`[email-webhook] Mixed attachments — PDFs processed, unsupported (${exts}) skipped, company ${company.company_id}`)
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

  return NextResponse.json({ received: pdfs.length, created: created.length, errors: errors.length, ids: created })
}

function isPdf(att: PostmarkAttachment): boolean {
  const name = att.Name?.toLowerCase() ?? ''
  const type = att.ContentType?.toLowerCase() ?? ''
  return type === 'application/pdf' || name.endsWith('.pdf')
}
