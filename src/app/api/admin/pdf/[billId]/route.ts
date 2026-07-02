import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'thedillons01@gmail.com'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { billId } = await params
  const admin = createServiceClient()

  const { data: bill } = await admin
    .from('bills')
    .select('pdf_url')
    .eq('bill_id', billId)
    .single()

  if (!bill?.pdf_url) {
    return NextResponse.json({ error: 'No PDF found' }, { status: 404 })
  }

  const { data: file, error } = await admin.storage.from('bill-pdfs').download(bill.pdf_url)

  if (error || !file) {
    return NextResponse.json({ error: 'Failed to download PDF' }, { status: 500 })
  }

  const buffer = await file.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
