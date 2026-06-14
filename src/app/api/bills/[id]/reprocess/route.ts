import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processBill, applyCustomerClassToLines } from '@/lib/ocr/process'
import { syncSingleVendorFromQB } from '@/lib/quickbooks/sync'

export const maxDuration = 60

const ADMIN_EMAIL = 'thedillons01@gmail.com'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: billId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { comment?: string }
  const userComment = (body.comment ?? '').trim() || undefined

  const service = createServiceClient()

  const { data: bill } = await service
    .from('bills')
    .select('bill_id, status, company_id, vendor_id, vendor_name_raw, invoice_number, total, ocr_tier, reprocess_count, invoice_date, line_items_total')
    .eq('bill_id', billId)
    .is('deleted_at', null)
    .single()

  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'published') {
    return NextResponse.json({ error: 'Published bills cannot be reprocessed' }, { status: 400 })
  }

  const { data: company } = await service
    .from('companies')
    .select('name')
    .eq('company_id', bill.company_id)
    .single()

  const reprocessCount: number = bill.reprocess_count ?? 0
  // Tier escalation: 0→T2, 1+→T3
  const forceTier: 2 | 3 = reprocessCount === 0 ? 2 : 3
  const tierLabel = forceTier === 2 ? 'Tier 2 — Claude Haiku (text)' : 'Tier 3 — Claude Opus (vision)'

  // Capture before state for email diff
  const { data: lineItemsBefore } = await service
    .from('bill_line_items')
    .select('description, extended_cost')
    .eq('bill_id', billId)
    .order('sort_order')

  // Capture existing job assignments before reprocessing — if jobs were already manually set,
  // preserve them instead of running auto-match (which could overwrite intentional assignments)
  const { data: existingLines } = await service
    .from('bill_line_items')
    .select('job_id')
    .eq('bill_id', billId)

  const existingJobIds = (existingLines ?? []).map(l => l.job_id).filter(Boolean) as string[]
  const previousJobId = existingJobIds.length > 0
    ? existingJobIds.sort((a, b) =>
        existingJobIds.filter(x => x === b).length - existingJobIds.filter(x => x === a).length
      )[0]
    : null

  // Increment reprocess count and reset to draft
  await service
    .from('bills')
    .update({ status: 'draft', autopublish_hold_reason: null, reprocess_count: reprocessCount + 1 })
    .eq('bill_id', billId)

  // Log the reprocess request with comment
  await service.from('processing_log').insert({
    bill_id:     billId,
    company_id:  bill.company_id,
    action:      'reprocess_requested',
    actor:       'user',
    after_state: {
      reprocess_count: reprocessCount + 1,
      force_tier:      forceTier,
      user_comment:    userComment ?? null,
    },
  })

  // Refresh the matched vendor from QB before reprocessing — picks up any changes
  // made in QB since last sync (e.g. setting a default expense account)
  const { data: vendorLink } = await service
    .from('vendors')
    .select('qb_vendor_id')
    .eq('vendor_id', bill.vendor_id ?? '')
    .single()
  if (vendorLink?.qb_vendor_id) {
    await syncSingleVendorFromQB(bill.company_id, vendorLink.qb_vendor_id)
  }

  try {
    await processBill(billId, { skipCredits: true, forceTier, userComment, skipJobMatch: !!previousJobId })
  } catch (err) {
    return NextResponse.json(
      { error: `Reprocess failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  // Restore previous job assignments if a job was already set before reprocessing
  if (previousJobId) {
    await service.from('bill_line_items')
      .update({ job_id: previousJobId })
      .eq('bill_id', billId)

    // Apply customer class now that the job is restored — processBill skipped job matching
    // (skipJobMatch=true) so step 6.3 ran before jobs were on the lines and found nothing.
    const { data: classCfg } = await service
      .from('companies')
      .select('class_assignment_mode')
      .eq('company_id', bill.company_id)
      .single()
    if (classCfg?.class_assignment_mode === 'customer') {
      await applyCustomerClassToLines(service, billId, bill.company_id, previousJobId)
    }
  }

  // Read after state for email diff + response payload
  const { data: billAfter } = await service
    .from('bills')
    .select('vendor_name_raw, invoice_number, total, ocr_tier, invoice_date, line_items_total, status, vendor_id')
    .eq('bill_id', billId)
    .single()

  const { data: lineItemsAfter } = await service
    .from('bill_line_items')
    .select('line_id, description, quantity, unit_cost, extended_cost, gl_account_id, job_id, class_id, sort_order, is_tax_line, gl_account_source')
    .eq('bill_id', billId)
    .order('sort_order')

  // Send email to admin
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    const billUrl = `https://www.purchasomatic.com/bills/${billId}`

    const beforeLines = (lineItemsBefore ?? []).map(li =>
      `<tr><td style="padding:3px 8px;border:1px solid #E5E7EB">${li.description ?? '—'}</td><td style="padding:3px 8px;border:1px solid #E5E7EB;text-align:right">$${Number(li.extended_cost ?? 0).toFixed(2)}</td></tr>`
    ).join('')

    const afterLines = (lineItemsAfter ?? []).map(li =>
      `<tr><td style="padding:3px 8px;border:1px solid #E5E7EB">${li.description ?? '—'}</td><td style="padding:3px 8px;border:1px solid #E5E7EB;text-align:right">$${Number(li.extended_cost ?? 0).toFixed(2)}</td></tr>`
    ).join('')

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px">
        <div style="background:#1A3D2B;padding:16px 20px;border-radius:8px 8px 0 0">
          <span style="color:white;font-size:15px;font-weight:600">Purchasomatic — Reprocess Report</span>
        </div>
        <div style="background:white;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 8px 8px;padding:24px">

          <p style="margin:0 0 4px;font-size:13px;color:#6B7280">Company</p>
          <p style="margin:0 0 16px;font-size:14px;color:#111827;font-weight:500">${company?.name ?? bill.company_id}</p>

          <p style="margin:0 0 4px;font-size:13px;color:#6B7280">Bill</p>
          <p style="margin:0 0 4px;font-size:14px;color:#111827">
            ${bill.vendor_name_raw ?? 'Unknown vendor'} &mdash; Invoice ${bill.invoice_number ?? '(no number)'}
          </p>
          <a href="${billUrl}" style="font-size:13px;color:#2DB87A">${billUrl}</a>

          <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0">

          <p style="margin:0 0 4px;font-size:13px;color:#6B7280">Reprocess #${reprocessCount + 1} — ${tierLabel}</p>

          ${userComment ? `
          <p style="margin:16px 0 4px;font-size:13px;color:#6B7280;font-weight:500">User comment</p>
          <p style="margin:0;background:#F3F4F6;border-radius:6px;padding:12px;font-size:13px;color:#111827;font-style:italic">"${userComment}"</p>
          ` : '<p style="margin:16px 0 4px;font-size:13px;color:#9CA3AF">No comment provided.</p>'}

          <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0">

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr>
              <th style="text-align:left;padding:4px 8px;font-size:12px;color:#6B7280;border-bottom:1px solid #E5E7EB"></th>
              <th style="padding:4px 8px;font-size:12px;color:#6B7280;border-bottom:1px solid #E5E7EB;text-align:center">Before</th>
              <th style="padding:4px 8px;font-size:12px;color:#6B7280;border-bottom:1px solid #E5E7EB;text-align:center">After</th>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-size:13px">Vendor</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${bill.vendor_name_raw ?? '—'}</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${billAfter?.vendor_name_raw ?? '—'}</td>
            </tr>
            <tr style="background:#F9FAFB">
              <td style="padding:4px 8px;font-size:13px">Invoice #</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${bill.invoice_number ?? '—'}</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${billAfter?.invoice_number ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-size:13px">Invoice date</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${bill.invoice_date ?? '—'}</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${billAfter?.invoice_date ?? '—'}</td>
            </tr>
            <tr style="background:#F9FAFB">
              <td style="padding:4px 8px;font-size:13px">Invoice total</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${bill.total != null ? '$' + Number(bill.total).toFixed(2) : '—'}</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${billAfter?.total != null ? '$' + Number(billAfter.total).toFixed(2) : '—'}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-size:13px">Line items total</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${bill.line_items_total != null ? '$' + Number(bill.line_items_total).toFixed(2) : '—'}</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">${billAfter?.line_items_total != null ? '$' + Number(billAfter.line_items_total).toFixed(2) : '—'}</td>
            </tr>
            <tr style="background:#F9FAFB">
              <td style="padding:4px 8px;font-size:13px">OCR tier</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">Tier ${bill.ocr_tier ?? '?'}</td>
              <td style="padding:4px 8px;font-size:13px;text-align:center">Tier ${billAfter?.ocr_tier ?? '?'}</td>
            </tr>
          </table>

          ${beforeLines ? `
          <p style="font-size:12px;font-weight:500;color:#6B7280;margin:0 0 6px">Line items before (${(lineItemsBefore ?? []).length})</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
            <tr style="background:#F3F4F6"><th style="padding:3px 8px;border:1px solid #E5E7EB;text-align:left">Description</th><th style="padding:3px 8px;border:1px solid #E5E7EB;text-align:right">Amount</th></tr>
            ${beforeLines}
          </table>
          ` : ''}

          ${afterLines ? `
          <p style="font-size:12px;font-weight:500;color:#6B7280;margin:0 0 6px">Line items after (${(lineItemsAfter ?? []).length})</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
            <tr style="background:#F3F4F6"><th style="padding:3px 8px;border:1px solid #E5E7EB;text-align:left">Description</th><th style="padding:3px 8px;border:1px solid #E5E7EB;text-align:right">Amount</th></tr>
            ${afterLines}
          </table>
          ` : ''}

          <a href="${billUrl}" style="display:inline-block;background:#2DB87A;color:white;border-radius:6px;padding:8px 18px;font-size:13px;font-weight:500;text-decoration:none">View Bill</a>
        </div>
      </div>`

    await resend.emails.send({
      from: 'Purchasomatic <notifications@purchasomatic.com>',
      to: ADMIN_EMAIL,
      subject: `[Reprocess] ${bill.vendor_name_raw ?? 'Unknown'} — Invoice ${bill.invoice_number ?? billId}`,
      html,
    }).catch(err => console.error('[reprocess] Admin email failed:', err))
  }

  return NextResponse.json({
    ok: true,
    bill: billAfter,
    lineItems: lineItemsAfter ?? [],
  })
}
