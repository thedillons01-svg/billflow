// Shared job-matching logic used by bill OCR (process.ts), PO OCR (process-po.ts),
// and the post-sync retry pass (sync.ts) — kept in one place so a fix here applies
// everywhere instead of drifting across three near-identical copies.

export type CacheJob = {
  qb_job_id:     string
  job_number:    string | null
  job_name:      string | null
  customer_name?: string | null
  is_customer:   boolean
}

// Strip common label prefixes and extract numeric tokens from a reference string.
// Handles prefix stripping ("Job #52256" → "52256") and multiple references ("52256 and 52258").
// Year-like numbers (2000-2099) are excluded — they appear in PO numbers like
// "PO-2026-1061" and would cause false matches against jobs named "2026-*".
export function extractJobCandidates(raw: string): string[] {
  const s = raw.trim().toLowerCase()
  const candidates = new Set<string>([s])

  const stripped = s.replace(
    /^(job\s*[#\-]?\s*(no\.?\s*)?|work\s*order\s*[#\-]?\s*|wo\s*[#\-]?\s*|p\.?o\.?\s*[#\-]?\s*(no\.?\s*)?|order\s*[#\-]?\s*(no\.?\s*)?|ref\.?\s*[#:\-]?\s*|ticket\s*[#\-]?\s*|customer\s*[#:\-]?\s*|#\s*)/,
    ''
  ).trim()
  if (stripped && stripped !== s) candidates.add(stripped)

  for (const n of s.match(/\b\d{4,}\b/g) ?? []) {
    const num = parseInt(n, 10)
    if (num >= 2000 && num <= 2099) continue   // skip year-like numbers
    candidates.add(n)
  }

  return [...candidates].filter(Boolean)
}

// Split into words, dropping punctuation.
function tokenize(s: string): string[] {
  return s.split(/[^a-z0-9]+/i).filter(Boolean)
}

// True if every "meaningful" word (3+ chars) on the shorter side appears as a whole
// word on the longer side, regardless of order or words in between. Catches cases
// like a technician-written reference "Smith ABC" matching a job named
// "Smith House ABC" that plain substring containment misses. Requires at least 2
// meaningful words on the shorter side so a single common word can't cause a false match.
function wordSetMatch(a: string, b: string): boolean {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA]
  const meaningfulShorter = shorter.filter(t => t.length >= 3)
  if (meaningfulShorter.length < 2) return false

  const longerSet = new Set(longer)
  return meaningfulShorter.every(t => longerSet.has(t))
}

// Returns true if any candidate fuzzy-matches the job's number or name.
// customer_name is intentionally excluded — a customer-name match alone is not
// sufficient to identify a specific job. Customer matching is a separate fallback pass.
// Year-like job_numbers (2000-2099) are skipped for the "contained in" check to prevent
// a PO number like "PO-2026-1061" from matching a job named "2026-Riverside HVAC".
export function jobMatchesCandidates(job: CacheJob, candidates: string[]): boolean {
  const num  = job.job_number?.trim().toLowerCase()
  const name = job.job_name?.trim().toLowerCase()
  const numInt = num ? parseInt(num, 10) : NaN
  const numIsYear = !isNaN(numInt) && numInt >= 2000 && numInt <= 2099
  for (const c of candidates) {
    if (num === c || name === c) return true
    if (num && !numIsYear && num.length >= 4 && c.includes(num)) return true
    if (name && name.length >= 4 && (c.includes(name) || name.includes(c) || wordSetMatch(c, name))) return true
  }
  return false
}
