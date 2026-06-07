import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTier1, hasTextLayer } from '@/lib/ocr/tier1'
import { extractTier2 } from '@/lib/ocr/tier2'
import { extractTier3 } from '@/lib/ocr/tier3'
import { syncVendorsIfStale, syncJobsIfStale } from '@/lib/quickbooks/sync'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: po } = await service
    .from('purchase_orders')
    .select('po_id, company_id, pdf_url, status, vendor_id')
    .eq('po_id', poId)
    .is('deleted_at', null)
    .single()

  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })
  if (!po.pdf_url) return NextResponse.json({ error: 'No PDF attached to this PO' }, { status: 400 })

  // Download PDF
  const { data: fileData, error: downloadErr } = await service.storage
    .from('bill-pdfs')
    .download(po.pdf_url)

  if (downloadErr || !fileData) {
    return NextResponse.json({ error: `PDF download failed: ${downloadErr?.message ?? 'no data'}` }, { status: 500 })
  }

  const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

  // Run tiered extraction
  let result, tier: number
  try {
    const tier1 = await extractTier1(pdfBuffer)
    if (!hasTextLayer(tier1.rawText)) {
      const r = await extractTier3(pdfBuffer, undefined, 'po')
      result = r; tier = 3
    } else {
      const incomplete = !tier1.invoice_number || !tier1.invoice_date || tier1.line_items.length === 0
      if (incomplete) {
        const r = await extractTier2(tier1.rawText, undefined, 'po')
        result = r; tier = 2
      } else {
        result = { ...tier1 }; tier = 1
      }
    }
  } catch (err) {
    return NextResponse.json({ error: `Extraction failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }

  // Update PO with re-extracted header fields — no credit charge on reprocess
  await service
    .from('purchase_orders')
    .update({
      vendor_name_raw:         result.vendor_name_raw,
      po_number:               result.invoice_number,
      order_date:              result.invoice_date,
      job_name_extracted:      result.job_name_extracted ?? null,
      customer_name_extracted: result.customer_name_extracted ?? null,
      qb_sync_error:           null,
    })
    .eq('po_id', poId)

  // Vendor matching (only if not already matched)
  if (!po.vendor_id && result.vendor_name_raw) {
    await syncVendorsIfStale(po.company_id)
    const { data: vendor } = await service
      .from('vendors')
      .select('vendor_id')
      .eq('company_id', po.company_id)
      .or(`vendor_name_extracted.ilike.${result.vendor_name_raw},vendor_name_display.ilike.${result.vendor_name_raw}`)
      .limit(1)
      .single()
    if (vendor) {
      await service.from('purchase_orders').update({ vendor_id: vendor.vendor_id }).eq('po_id', poId)
    }
  }

  // Job matching
  const allSources = [result.invoice_number, result.vendor_po_reference, result.job_name_extracted, result.customer_name_extracted].filter(Boolean) as string[]
  let matchedJobId: string | null = null
  let matchedCustomerId: string | null = null

  if (allSources.length) {
    await syncJobsIfStale(po.company_id)
    const { data: allRows } = await service
      .from('qb_jobs_cache')
      .select('qb_job_id, job_number, job_name, customer_name, is_customer')
      .eq('company_id', po.company_id)

    const rows = allRows ?? []
    const candidates = [...new Set(allSources.map(s => s.toLowerCase().trim()))]

    const subMatch = rows.filter(r => !r.is_customer).find(j => {
      const num  = j.job_number?.toLowerCase()
      const name = j.job_name?.toLowerCase()
      const cust = j.customer_name?.toLowerCase()
      return candidates.some(c =>
        c === num || c === name ||
        (num  && num.length  >= 4 && c.includes(num)) ||
        (name && name.length >= 4 && (c.includes(name) || name.includes(c))) ||
        (cust && cust.length >= 4 && (c.includes(cust) || cust.includes(c)))
      )
    })

    if (subMatch) {
      matchedJobId = subMatch.qb_job_id
      await service.from('purchase_orders').update({ job_id: matchedJobId, matched_customer_qb_id: null }).eq('po_id', poId)
    } else {
      const custCandidates = [result.customer_name_extracted, result.job_name_extracted]
        .filter(Boolean).map(s => s!.toLowerCase().trim())
      const custMatch = rows.filter(r => r.is_customer).find(c => {
        const name = (c.job_name ?? c.customer_name ?? '').toLowerCase()
        return custCandidates.some(s => name === s || (name.length >= 4 && (s.includes(name) || name.includes(s))))
      })
      if (custMatch) {
        matchedCustomerId = custMatch.qb_job_id
        await service.from('purchase_orders').update({ matched_customer_qb_id: matchedCustomerId }).eq('po_id', poId)
      }
    }
  }

  // Replace line items
  const lineItems = result.line_items ?? []
  if (lineItems.length) {
    await service.from('po_line_items').delete().eq('po_id', poId)
    await service.from('po_line_items').insert(
      lineItems.map((li, i) => ({
        po_id:            poId,
        company_id:       po.company_id,
        description:      li.description ?? null,
        quantity_ordered: li.quantity ?? null,
        unit_cost:        li.unit_price ?? null,
        extended_cost:    li.total ?? null,
        is_tax_line:      false,
        sort_order:       li.sort_order ?? i,
        job_id:           matchedJobId ?? null,
      }))
    )
  }

  await service.from('processing_log').insert({
    document_id:   poId,
    document_type: 'po',
    company_id:    po.company_id,
    action:        'reprocess_complete',
    actor:         user.id,
    credits_used:  0,
    after_state:   {
      tier,
      job_name_extracted:      result.job_name_extracted,
      customer_name_extracted: result.customer_name_extracted,
      matched_job_id:          matchedJobId,
      matched_customer_id:     matchedCustomerId,
    },
  })

  return NextResponse.json({ ok: true, tier, matchedJobId, matchedCustomerId })
}
