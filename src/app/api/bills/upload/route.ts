import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processBill } from '@/lib/ocr/process'
import { splitPdf } from '@/lib/ocr/split-pdf'

export const maxDuration = 60

const STORAGE_BUCKET = 'bill-pdfs'

export async function POST(request: NextRequest) {
  // Authenticate user via session cookie
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: company } = await supabaseUser
    .from('companies')
    .select('company_id, credit_balance, subscription_status')
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 400 })
  }

  if ((company.credit_balance ?? 0) <= 0 && company.subscription_status !== 'active') {
    return NextResponse.json({ error: 'No credits remaining. Subscribe to continue processing invoices — active subscribers are billed for overages on their next billing date.' }, { status: 402 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const created: string[] = []
  const errors: string[] = []
  const errorDetails: string[] = []

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      errors.push(file.name)
      errorDetails.push(`${file.name}: not a PDF (type: ${file.type})`)
      continue
    }

    const rawBytes = Buffer.from(await file.arrayBuffer())

    let pageBufs: Buffer[]
    try {
      pageBufs = await splitPdf(rawBytes)
    } catch {
      pageBufs = [rawBytes]
    }

    for (const pdfBytes of pageBufs) {
      const fingerprint = createHash('sha256').update(pdfBytes).digest('hex')

      // Fingerprint duplicate check — same PDF already uploaded
      let isFingerprintDuplicate = false
      let originalDocId: string | null = null
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

      const docId = randomUUID()
      const storagePath = `${company.company_id}/${docId}.pdf`

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })

      if (uploadErr) {
        const msg = `${file.name}: storage upload failed — ${uploadErr.message}`
        console.error(`[upload] ${msg}`)
        errors.push(file.name)
        errorDetails.push(msg)
        continue
      }

      const billStatus = isFingerprintDuplicate ? 'fingerprint_duplicate' : 'draft'
      const { error: insertErr } = await supabase.from('bills').insert({
        bill_id:          docId,
        company_id:       company.company_id,
        status:           billStatus,
        capture_source:   'upload',
        pdf_url:          storagePath,
        file_fingerprint: fingerprint,
      })

      if (insertErr) {
        const msg = `${file.name}: DB insert failed — ${insertErr.message}`
        console.error(`[upload] ${msg}`)
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
        errors.push(file.name)
        errorDetails.push(msg)
        continue
      }

      await supabase.from('processing_log').insert({
        bill_id:       docId,
        document_type: 'bill',
        company_id:    company.company_id,
        action:        isFingerprintDuplicate ? 'fingerprint_duplicate' : 'captured',
        actor:         user.id,
        after_state:   {
          capture_source: 'upload', filename: file.name, pdf_url: storagePath,
          ...(isFingerprintDuplicate ? { original_bill_id: originalDocId } : {}),
        },
      })

      if (!isFingerprintDuplicate) {
        after(processBill(docId).catch(err => console.error(`[upload] processBill threw (${docId}):`, err)))
      } else {
        console.warn(`[upload] Fingerprint duplicate held (${docId}), matches ${originalDocId}`)
      }

      created.push(docId)
    }
  }

  return NextResponse.json({ created: created.length, errors: errors.length, ids: created, errorDetails })
}
