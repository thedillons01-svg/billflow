// Prints one personalized drop-in flyer PDF per business in a lead list.
//   node marketing/print-dropin-flyers.mjs marketing/leads/albany-hvac-2026-09-29.csv
// Skips rows whose drop_in column is "no" (home-based businesses).
// Output: marketing/print/<lead-list-name>/<company>.pdf
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node marketing/print-dropin-flyers.mjs <leads.csv>')
  process.exit(1)
}

// Minimal CSV parser — handles quoted fields with commas
function parseCsv(text) {
  const rows = []
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const cells = []
    let cur = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && line[i + 1] === '"' && quoted) { cur += '"'; i++ }
      else if (ch === '"') quoted = !quoted
      else if (ch === ',' && !quoted) { cells.push(cur); cur = '' }
      else cur += ch
    }
    cells.push(cur)
    rows.push(cells)
  }
  const [header, ...body] = rows
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const leads = parseCsv(readFileSync(csvPath, 'utf8')).filter(l => l.drop_in !== 'no')
const outDir = join(here, 'print', basename(csvPath, '.csv'))
mkdirSync(outDir, { recursive: true })

const template = pathToFileURL(resolve(here, 'hvac-dropin-flyer.html')).href
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()

for (const lead of leads) {
  const town = lead.city.replace(/\s+OR\b.*$/, '').trim()
  const url = `${template}?company=${encodeURIComponent(lead.company_name)}&city=${encodeURIComponent(town)}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const file = join(outDir, `${lead.company_name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`)
  await page.pdf({ path: file, format: 'Letter', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  console.log(`✓ ${lead.company_name} → ${file}`)
}

// One combined PDF (a page per business) for printing everything in one go
await page.goto(template, { waitUntil: 'networkidle' })
await page.evaluate((rows) => {
  const tpl = document.querySelector('.sheet')
  for (const r of rows) {
    const s = tpl.cloneNode(true)
    s.querySelector('#company').textContent = r.company
    s.querySelector('#city').textContent = r.town
    s.style.breakAfter = 'page'
    tpl.parentNode.appendChild(s)
  }
  tpl.remove()
  document.body.style.display = 'block'
}, leads.map(l => ({ company: l.company_name, town: l.city.replace(/\s+OR\b.*$/, '').trim() })))
await page.evaluate(() => document.fonts.ready)
const all = join(outDir, `_ALL-${leads.length}-flyers.pdf`)
await page.pdf({ path: all, format: 'Letter', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
console.log(`✓ combined → ${all}`)

await browser.close()
