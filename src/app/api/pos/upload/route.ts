import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processPO } from '@/lib/ocr/process-po'

export const maxDuration = 60

const STORAGE_BUCKET = 'bill-pdfs'

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabaseUser
    .from('companies')
    .select('company_id, credit_balance, subscription_status')
    .single()
  if (!company) return NextResponse.json({ error: 'No company found' }, { status: 400 })

  if ((company.credit_balance ?? 0) <= 0 && company.subscription_status !== 'active') {
    return NextResponse.json({ error: 'No credits remaining. Subscribe to continue processing purchase orders — active subscribers are billed for overages on their next billing date.' }, { status: 402 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  if (!files || files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const supabase = createServiceClient()
  const created: string[] = []
  const errors: string[] = []
  const errorDetails: string[] = []

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      errors.push(file.name)
      errorDetails.push(`${file.name}: not a PDF`)
      continue
    }

    const rawBytes = Buffer.from(await file.arrayBuffer())
    const fingerprint = createHash('sha256').update(rawBytes).digest('hex')

    // Fingerprint duplicate check
    const { data: fpMatch } = await supabase
      .from('purchase_orders')
      .select('po_id')
      .eq('company_id', company.company_id)
      .eq('file_fingerprint', fingerprint)
      .is('deleted_at', null)
      .limit(1)

    if (fpMatch && fpMatch.length > 0) {
      errorDetails.push(`${file.name}: duplicate — already uploaded`)
      errors.push(file.name)
      continue
    }

    const poId = randomUUID()
    const storagePath = `${company.company_id}/${poId}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, rawBytes, { contentType: 'application/pdf', upsert: false })

    if (uploadErr) {
      errors.push(file.name)
      errorDetails.push(`${file.name}: storage upload failed — ${uploadErr.message}`)
      continue
    }

    const { error: insertErr } = await supabase.from('purchase_orders').insert({
      po_id:            poId,
      company_id:       company.company_id,
      status:           'open',
      capture_source:   'upload',
      pdf_url:          storagePath,
      file_fingerprint: fingerprint,
      vendor_name_raw:  file.name.replace(/\.pdf$/i, ''),
    })

    if (insertErr) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      errors.push(file.name)
      errorDetails.push(`${file.name}: DB insert failed — ${insertErr.message}`)
      continue
    }

    await supabase.from('processing_log').insert({
      document_id:   poId,
      document_type: 'po',
      company_id:    company.company_id,
      action:        'captured',
      actor:         user.id,
      after_state:   { capture_source: 'upload', filename: file.name, pdf_url: storagePath },
    })

    after(processPO(poId).catch(err => console.error(`[po-upload] processPO threw (${poId}):`, err)))
    created.push(poId)
  }

  return NextResponse.json({ created: created.length, errors: errors.length, ids: created, errorDetails })
}
