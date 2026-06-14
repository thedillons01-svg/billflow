import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { syncAll } from '@/lib/quickbooks/sync'
import { tryMatchJob, applyCustomerClassToLines } from '@/lib/ocr/process'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: billId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bill } = await supabase
    .from('bills')
    .select('bill_id, company_id, vendor_po_reference, job_name_extracted, customer_name_extracted, status')
    .eq('bill_id', billId)
    .single()

  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'published') {
    return NextResponse.json({ error: 'Cannot match a published bill' }, { status: 400 })
  }

  // Use vendor_po_reference first, fall back to job_name_extracted (same logic as processBill)
  const matchRef = (bill.vendor_po_reference as string | null) ?? (bill.job_name_extracted as string | null)
  if (!matchRef) {
    return NextResponse.json({ matched: false, reason: 'No PO reference or job name on bill' })
  }

  // Sync jobs from QB before matching so newly created jobs are visible
  try {
    await syncAll(bill.company_id as string)
  } catch { /* non-fatal */ }

  const serviceClient = createServiceClient()
  const matched = await tryMatchJob(
    serviceClient,
    bill.bill_id as string,
    bill.company_id as string,
    matchRef,
    (bill.job_name_extracted as string | null) ?? undefined,
    (bill.customer_name_extracted as string | null) ?? undefined,
  )

  // Apply customer-class if company is in customer-mode and a job was matched
  if (matched) {
    const { data: companyCfg } = await serviceClient
      .from('companies')
      .select('class_assignment_mode')
      .eq('company_id', bill.company_id as string)
      .single()
    if (companyCfg?.class_assignment_mode === 'customer') {
      const { data: lineWithJob } = await serviceClient
        .from('bill_line_items')
        .select('job_id')
        .eq('bill_id', billId)
        .not('job_id', 'is', null)
        .limit(1)
        .maybeSingle()
      if (lineWithJob?.job_id) {
        await applyCustomerClassToLines(serviceClient, billId, bill.company_id as string, lineWithJob.job_id as string)
      }
    }
  }

  return NextResponse.json({ matched })
}
