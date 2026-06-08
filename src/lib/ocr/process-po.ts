import { createClient } from '@supabase/supabase-js'
import { extractTier1, hasTextLayer } from './tier1'
import { extractTier2 } from './tier2'
import { extractTier3 } from './tier3'
import type { ExtractionResult } from './types'
import { sendNotification } from '@/lib/notifications/send-email'
import { syncVendorsIfStale, syncJobsIfStale } from '@/lib/quickbooks/sync'
import { saveToStorage } from '@/lib/storage/save-to-storage'

// Generate normalized variants of a vendor name to handle punctuation differences
// e.g. "Gensco, Inc." → ["Gensco, Inc.", "Gensco Inc.", "Gensco Inc"]
function uniqueNameVariants(name: string): string[] {
  const variants = new Set<string>([name])
  const noComma = name.replace(/,/g, '')
  variants.add(noComma)
  variants.add(noComma.replace(/\./g, '').replace(/\s+/g, ' ').trim())
  return [...variants].filter(Boolean)
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STORAGE_BUCKET = 'bill-pdfs'

type SupabaseClient = ReturnType<typeof getServiceClient>

export async function processPO(poId: string): Promise<void> {
  const supabase = getServiceClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('po_id, company_id, pdf_url, status')
    .eq('po_id', poId)
    .single()

  if (!po) {
    console.error(`[ocr-po] PO not found (${poId})`)
    return
  }

  // Skip if already processed (e.g. duplicate trigger)
  if (po.status !== 'open') {
    console.warn(`[ocr-po] Skipping PO ${poId} — status is ${po.status}, expected open`)
    return
  }

  const { data: companyRow } = await supabase
    .from('companies')
    .select('name')
    .eq('company_id', po.company_id)
    .single()
  const companyName = companyRow?.name ?? undefined

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(po.pdf_url)

  if (downloadErr || !fileData) {
    const msg = `PDF download failed: ${downloadErr?.message ?? 'no data'}`
    console.error(`[ocr-po] ${poId}: ${msg}`)
    await supabase.from('purchase_orders').update({ qb_sync_error: msg }).eq('po_id', poId)
    return
  }

  const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

  let result: ExtractionResult
  let tier: number

  try {
    const extracted = await runTieredExtraction(pdfBuffer, companyName)
    result = extracted.result
    tier = extracted.tier
  } catch (err) {
    const msg = `Extraction failed: ${err instanceof Error ? err.message : String(err)}`
    console.error(`[ocr-po] PO extraction failed (${poId}):`, err)
    await supabase.from('purchase_orders').update({ qb_sync_error: msg }).eq('po_id', poId)
    return
  }

  // Update PO with extracted fields
  await supabase
    .from('purchase_orders')
    .update({
      vendor_name_raw:          result.vendor_name_raw,
      po_number:                result.invoice_number,
      order_date:               result.invoice_date,
      job_name_extracted:       result.job_name_extracted ?? null,
      customer_name_extracted:  result.customer_name_extracted ?? null,
    })
    .eq('po_id', poId)

  // Refresh vendor cache from QB if stale
  await syncVendorsIfStale(po.company_id)

  // Vendor matching — find existing vendor or create from QB cache match
  if (result.vendor_name_raw) {
    const vendorVariants = uniqueNameVariants(result.vendor_name_raw)
      .filter(v => !v.includes(',')) // commas are OR-condition separators in Supabase — strip them out
    const orCondition = vendorVariants
      .flatMap(v => [`vendor_name_extracted.ilike.${v}`, `vendor_name_display.ilike.${v}`])
      .join(',')
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_id')
      .eq('company_id', po.company_id)
      .or(orCondition)
      .limit(1)
      .single()

    if (vendor) {
      await supabase.from('purchase_orders').update({ vendor_id: vendor.vendor_id }).eq('po_id', poId)
    } else {
      // New vendor — try to match from QB cache first
      const { data: qbMatch } = await supabase
        .from('qb_vendors_cache')
        .select('qb_vendor_id, name, default_expense_account_id, payment_terms')
        .eq('company_id', po.company_id)
        .ilike('name', `%${result.vendor_name_raw}%`)
        .limit(1)
        .single()

      if (qbMatch) {
        const { data: created } = await supabase
          .from('vendors')
          .insert({
            company_id:               po.company_id,
            vendor_name_extracted:    result.vendor_name_raw,
            vendor_name_display:      qbMatch.name,
            qb_vendor_id:             qbMatch.qb_vendor_id,
            qb_vendor_name:           qbMatch.name,
            qb_default_gl_account_id: qbMatch.default_expense_account_id ?? null,
            gl_account_source:        qbMatch.default_expense_account_id ? 'qb_default' : 'not_set',
            qb_payment_terms:         qbMatch.payment_terms ?? null,
            payment_terms_source:     qbMatch.payment_terms ? 'qb_default' : 'not_set',
            copy_po_to_qb_reference:  true,
            is_visible:               true,
            auto_publish_enabled:     false,
            hold_for_job_match:       false,
            invoices_processed:       0,
          })
          .select('vendor_id')
          .single()

        if (created) {
          await supabase.from('purchase_orders').update({ vendor_id: created.vendor_id }).eq('po_id', poId)
        }
      } else {
        console.log(`[ocr-po] No QB cache match for "${result.vendor_name_raw}" (${poId}) — leaving unmatched`)
      }
    }
  }

  // Job matching — combine all available reference fields
  const matchedJobId = await tryMatchJobForPO(supabase, poId, po.company_id, {
    poNumber:         result.invoice_number,
    poReference:      result.vendor_po_reference,
    jobName:          result.job_name_extracted,
    customerName:     result.customer_name_extracted,
  })

  // Insert PO line items, propagating the matched job to every line
  await insertPOLineItems(supabase, poId, po.company_id, result.line_items, result.tax_amount, matchedJobId)

  // Deduct 1 credit for PO processing
  const { data: co } = await supabase
    .from('companies')
    .select('credit_balance')
    .eq('company_id', po.company_id)
    .single()

  const newBalance = Math.max(0, (co?.credit_balance ?? 0) - 1)
  await Promise.all([
    supabase.from('companies').update({ credit_balance: newBalance }).eq('company_id', po.company_id),
    supabase.from('credit_ledger').insert({
      company_id:  po.company_id,
      amount:      -1,
      description: `PO processed: ${result.vendor_name_raw ?? 'Unknown'} ${result.invoice_number ?? ''}`.trim(),
    }),
  ])

  await supabase.from('processing_log').insert({
    document_id:   poId,
    document_type: 'po',
    company_id:    po.company_id,
    action:        'ocr_complete',
    actor:         'system',
    credits_used:  1,
    after_state:   { tier, status: 'open', po_number: result.invoice_number },
  })

  console.log(`[ocr-po] PO ${poId} processed — tier ${tier}, ${result.line_items.length} line items`)

  // Send success notification
  await sendNotification({
    companyId:  po.company_id,
    event:      'po_processed',
    subject:    `PO processed: ${result.vendor_name_raw ?? 'Unknown vendor'}`,
    body:       `Purchase order ${result.invoice_number ?? '(no number)'} from ${result.vendor_name_raw ?? 'Unknown vendor'} was captured and is ready for review.`,
  })

  // Save to external storage (SFTP / Google Drive) if configured
  try {
    await saveToStorage(poId, 'po', po.company_id)
  } catch (err) {
    console.error(`[ocr-po] saveToStorage failed for PO ${poId}:`, err)
  }
}

// ---------------------------------------------------------------------------
// Job matching — same fuzzy logic as bill processing, but updates PO header
// ---------------------------------------------------------------------------

// Strip common label prefixes and extract numeric tokens from a reference string.
function extractCandidates(raw: string): string[] {
  const s = raw.trim().toLowerCase()
  const candidates = new Set<string>([s])

  const stripped = s.replace(
    /^(job\s*[#\-]?\s*(no\.?\s*)?|work\s*order\s*[#\-]?\s*|wo\s*[#\-]?\s*|p\.?o\.?\s*[#\-]?\s*(no\.?\s*)?|order\s*[#\-]?\s*(no\.?\s*)?|ref\.?\s*[#:\-]?\s*|ticket\s*[#\-]?\s*|customer\s*[#:\-]?\s*|#\s*)/,
    ''
  ).trim()
  if (stripped && stripped !== s) candidates.add(stripped)

  for (const n of s.match(/\b\d{4,}\b/g) ?? []) candidates.add(n)

  return [...candidates].filter(Boolean)
}

type CacheJob = {
  qb_job_id: string
  job_number: string | null
  job_name: string | null
  customer_name: string | null
  is_customer: boolean
}

// Returns true if any candidate fuzzy-matches the job's number, name, or parent customer name.
function jobMatchesCandidates(job: CacheJob, candidates: string[]): boolean {
  const num  = job.job_number?.trim().toLowerCase()
  const name = job.job_name?.trim().toLowerCase()
  const cust = job.customer_name?.trim().toLowerCase()
  for (const c of candidates) {
    if (num === c || name === c) return true
    if (num  && num.length  >= 4 && c.includes(num))                    return true
    if (name && name.length >= 4 && (c.includes(name) || name.includes(c))) return true
    if (cust && cust.length >= 4 && (c.includes(cust) || cust.includes(c))) return true
  }
  return false
}

// Returns true if any candidate fuzzy-matches the customer record's name.
function customerMatchesCandidates(customer: CacheJob, candidates: string[]): boolean {
  const name = (customer.job_name ?? customer.customer_name ?? '').trim().toLowerCase()
  if (!name || name.length < 3) return false
  for (const c of candidates) {
    if (name === c) return true
    if (name.length >= 4 && (c.includes(name) || name.includes(c))) return true
  }
  return false
}

async function tryMatchJobForPO(
  supabase: SupabaseClient,
  poId: string,
  companyId: string,
  fields: {
    poNumber: string | null
    poReference: string | null
    jobName: string | null
    customerName: string | null
  },
): Promise<string | null> {
  const allSources = [fields.poNumber, fields.poReference, fields.jobName, fields.customerName].filter(Boolean) as string[]
  if (!allSources.length) return null

  // Job candidates: PO number, reference, and job name field
  const jobSources = [fields.poNumber, fields.poReference, fields.jobName].filter(Boolean) as string[]
  const jobCandidates = [...new Set(jobSources.flatMap(extractCandidates))]

  // Customer candidates: customer name field, plus job name as fallback
  const custSources = [fields.customerName, fields.jobName].filter(Boolean) as string[]
  const custCandidates = [...new Set(custSources.flatMap(extractCandidates))]

  // Combined: all candidates for the broadest possible sweep
  const allCandidates = [...new Set([...jobCandidates, ...custCandidates])]

  let allRows: CacheJob[] | null = null

  const fetchRows = async () => {
    const { data } = await supabase
      .from('qb_jobs_cache')
      .select('qb_job_id, job_number, job_name, customer_name, is_customer')
      .eq('company_id', companyId)
    return (data ?? []) as CacheJob[]
  }

  allRows = await fetchRows()

  // 1. Try to match a sub-customer (job) using job-focused candidates first,
  //    then fall back to all candidates so customer_name on the row can help.
  const subCustomers = allRows.filter(r => !r.is_customer)
  let jobMatch = subCustomers.find(j => jobMatchesCandidates(j, jobCandidates))
              ?? subCustomers.find(j => jobMatchesCandidates(j, allCandidates))

  // Cache miss — sync once then retry
  if (!jobMatch) {
    await syncJobsIfStale(companyId)
    allRows = await fetchRows()
    const freshSubs = allRows.filter(r => !r.is_customer)
    jobMatch = freshSubs.find(j => jobMatchesCandidates(j, jobCandidates))
            ?? freshSubs.find(j => jobMatchesCandidates(j, allCandidates))
  }

  if (jobMatch) {
    await supabase
      .from('purchase_orders')
      .update({ job_id: jobMatch.qb_job_id })
      .eq('po_id', poId)
    console.log(`[ocr-po] PO ${poId} job-matched to ${jobMatch.qb_job_id}`)
    return jobMatch.qb_job_id
  }

  // 2. No job match — try to identify the customer so the UI can pre-populate the create form.
  if (custCandidates.length) {
    const customers = allRows.filter(r => r.is_customer)
    const custMatch = customers.find(c => customerMatchesCandidates(c, custCandidates))
    if (custMatch) {
      await supabase
        .from('purchase_orders')
        .update({ matched_customer_qb_id: custMatch.qb_job_id })
        .eq('po_id', poId)
      console.log(`[ocr-po] PO ${poId} customer-matched to ${custMatch.qb_job_id} — no job found yet`)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Tiered extraction — Tier 1 → Tier 2 → Tier 3 with PO-specific logic
// ---------------------------------------------------------------------------

async function runTieredExtraction(pdfBuffer: Buffer, companyName?: string): Promise<{ result: ExtractionResult; tier: number }> {
  const tier1 = await extractTier1(pdfBuffer)

  // No text layer → Tier 3 (vision)
  if (!hasTextLayer(tier1.rawText)) {
    console.log('[ocr-po] No text layer → Tier 3 (vision)')
    const tier3 = await extractTier3(pdfBuffer, undefined, 'po', companyName)
    return { result: { ...tier3, tier: 3 }, tier: 3 }
  }

  // Escalate Tier 1→2 if key header fields are missing or no line items found.
  const tier1Incomplete =
    tier1.invoice_number === null ||
    tier1.invoice_date === null ||
    tier1.line_items.length === 0

  if (tier1Incomplete) {
    console.log('[ocr-po] Tier 1 incomplete → Tier 2 (Claude Haiku)')
    const tier2 = await extractTier2(tier1.rawText, undefined, 'po', companyName)

    // Escalate Tier 2→3 only if still no line items
    if (tier2.line_items.length === 0) {
      console.log('[ocr-po] Tier 2 found no line items → Tier 3 (vision)')
      const tier3 = await extractTier3(pdfBuffer, undefined, 'po', companyName)
      return { result: { ...tier3, tier: 3 }, tier: 3 }
    }

    return { result: { ...tier2, tier: 2, raw_text: tier1.rawText }, tier: 2 }
  }

  console.log('[ocr-po] Tier 1 extraction complete')
  return { result: { ...tier1, tier: 1, raw_text: tier1.rawText }, tier: 1 }
}

// ---------------------------------------------------------------------------
// PO line item insertion — no GL account on PO lines
// ---------------------------------------------------------------------------

type LineItem = {
  description?: string | null
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
  sort_order?: number
}

const TAX_KEYWORDS = ['sales tax', 'tax', 'hst', 'gst', 'pst', 'qst', 'vat', 'excise tax']

function isTaxDescription(desc: string | null | undefined): boolean {
  if (!desc) return false
  const d = desc.toLowerCase().trim()
  return TAX_KEYWORDS.some(kw => d === kw || d.startsWith(kw + ' ') || d.endsWith(' ' + kw))
}

async function insertPOLineItems(
  supabase: SupabaseClient,
  poId: string,
  companyId: string,
  lineItems: LineItem[],
  taxAmount?: number | null,
  jobId?: string | null,
) {
  // Synthesize a tax line from tax_amount if the OCR captured tax as a scalar
  // and no line item already has a tax description
  const allItems = [...lineItems]
  const hasTaxLine = allItems.some(li => isTaxDescription(li.description))
  if (!hasTaxLine && taxAmount && taxAmount > 0) {
    allItems.push({
      description: 'Tax',
      quantity:    null,
      unit_price:  null,
      total:       taxAmount,
      sort_order:  allItems.length,
    })
  }

  if (!allItems.length) return
  await supabase.from('po_line_items').delete().eq('po_id', poId)
  await supabase.from('po_line_items').insert(
    allItems.map((li, i) => ({
      po_id:            poId,
      company_id:       companyId,
      description:      li.description ?? null,
      quantity_ordered: li.quantity ?? null,
      unit_cost:        li.unit_price ?? null,
      extended_cost:    li.total ?? null,
      is_tax_line:      isTaxDescription(li.description),
      sort_order:       li.sort_order ?? i,
      job_id:           jobId ?? null,
    }))
  )
}
