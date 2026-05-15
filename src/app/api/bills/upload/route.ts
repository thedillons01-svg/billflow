import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
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
    .select('company_id')
    .single()

  if (!company) {
    return NextResponse.json({ error: 'No company found' }, { status: 400 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const created: string[] = []
  const errors: string[] = []

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      errors.push(file.name)
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
      const docId = randomUUID()
      const storagePath = `${company.company_id}/${docId}.pdf`

      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })

      if (uploadErr) {
        console.error(`[upload] Storage upload failed (${docId}):`, uploadErr.message)
        errors.push(file.name)
        continue
      }

      const { error: insertErr } = await supabase.from('bills').insert({
        bill_id:        docId,
        company_id:     company.company_id,
        status:         'draft',
        capture_source: 'upload',
        pdf_url:        storagePath,
      })

      if (insertErr) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
        errors.push(file.name)
        continue
      }

      await supabase.from('processing_log').insert({
        bill_id:       docId,
        document_type: 'bill',
        company_id:    company.company_id,
        action:        'captured',
        actor:         user.id,
        after_state:   { capture_source: 'upload', filename: file.name, pdf_url: storagePath },
      })

      try { await processBill(docId) } catch (err) {
        console.error(`[upload] processBill threw (${docId}):`, err)
      }

      created.push(docId)
    }
  }

  return NextResponse.json({ created: created.length, errors: errors.length, ids: created })
}
