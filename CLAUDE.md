@AGENTS.md

# BillFlow — Project Context for Claude Code

## What BillFlow Is
BillFlow is a SaaS web application that automatically captures vendor invoices via email, extracts line-item data using OCR, matches bills to QuickBooks jobs, and pushes approved bills to QuickBooks Online and QuickBooks Desktop — without manual data entry.

**The product in one sentence:** Set up email forwarding once, connect QuickBooks once, and vendor invoices flow into QuickBooks automatically — correctly coded to the right job — without anyone touching them.

**The glorious moment:** The user realizes they haven't thought about vendor invoice entry in weeks. It has been happening correctly in the background without them.

## Who Built This
Solo founder: Heather Dillon, Brownsville OR. Deep operational background as office manager and bookkeeper for HVAC/mechanical contractors. Hands-on expertise in QuickBooks, Housecall Pro, and ServiceTrade. MIS background. Building with Claude as coding partner.

## Technology Stack
- **Frontend/API:** Next.js 15, TypeScript, Tailwind CSS, App Router, Turbopack
- **Database:** PostgreSQL via Supabase (project: BillFlow under Dillon Software org)
- **Auth:** Supabase Auth
- **Hosting:** Vercel (planned)
- **Background jobs:** Vercel Cron + Supabase Edge Functions
- **OCR:** Tiered — pdf-parse (Tier 1, free), Claude text API (Tier 2), Claude vision API (Tier 3)
- **QB integrations:** QBO REST API (OAuth 2.0), QBD via Intuit Web Connector
- **Email:** Inbound email webhook (SendGrid or Postmark)
- **Notifications:** Resend

## Project Structure
```
src/
  app/
    (auth)/          # login, signup
    (dashboard)/     # main app shell
      bills/         # invoice inbox + detail
      jobs/          # QuickBooks job matching
      settings/      # integrations, email config
    api/
      webhooks/      # inbound email webhook
      quickbooks/    # QBO OAuth + sync
  lib/
    supabase/        # client.ts, server.ts, middleware
    ocr/             # invoice extraction logic
    quickbooks/      # QBO + QBD integration clients
  components/        # shared UI components
  types/             # TypeScript types / DB schema types
```

## Environment Variables (in .env.local)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase calls this "publishable key")
- SUPABASE_SERVICE_ROLE_KEY (Supabase calls this "secret key")
- QBO_CLIENT_ID (not yet set up)
- QBO_CLIENT_SECRET (not yet set up)
- QBO_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
- EMAIL_WEBHOOK_SECRET (not yet set up)

## Core Product Decisions

### Invoice Capture
- Capture email: [customizable]@billflow.com
- Forward rule filters emails containing "invoice" in subject or body only
- Tiered OCR: Tier 1 (pdf-parse, free) → Tier 2 (Claude text, cheap) → Tier 3 (Claude vision, scanned docs only)
- Vendor format knowledge is shared platform-wide (Gensco learned once = applies to all clients)
- Multi-invoice PDFs supported (Gensco sends summary page + individual invoices — discard summary, split rest)

### Job Matching
- NEVER create QB job records — only match to existing ones pulled from QB
- Match at invoice header level using vendor PO/reference field
- Pre-populate all line items with matched job (user corrects exceptions)
- Per-vendor flag: "hold for job match" — OFF by default (any vendor can be stock purchase)
- Pending Job Match retry: every 2 hours during business hours (7am-7pm), not overnight
- Manual "Find Match" button for on-demand retry
- FSM platform field in company settings improves job name pattern matching (HCP creates "Job 1047" etc.)

### Job Assignment
- Job assigned at LINE ITEM level (mirrors QuickBooks bill entry)
- One invoice header, multiple line items, each with independent job assignment
- "Apply to all lines" shortcut for common single-job case
- Shop stock lines can have job cleared (excluded from FSM export)

### Auto-Publish
- Per-vendor flag, promoted actively after 5 accurate invoices
- Eligibility checks: vendor set to auto-publish, 5+ invoices processed, zero errors on last 3, job match confidence high, no duplicate detected, all fields present, GL account set
- When auto-publish doesn't fire: show SPECIFIC plain-language reason on bill in inbox
- Auto-disable if error found on auto-published bill

### QuickBooks Integration
- QBO: async processing, confirm receipt before marking Published, rate limiting with backoff
- QBD: Web Connector polling (5-30 min interval), heartbeat monitoring, notify user if heartbeat lost
- Status states: Draft → Ready → Publishing → Published / Sync Error
- Unpublish: ONLY available for Sync Error status (bill never confirmed in QB). Once Published (QB bill ID stored), no unpublish — correct in QB directly.
- Pre-push validation against cached QB data (no live API calls for validation)
- PDF attached to QB bill record on publish (native PDFs only — QBD cannot receive PDF attachments)

### Vendor Record Key Fields
- vendor_name_extracted (what OCR pulls off PDF)
- vendor_name_display (mapped QB vendor name) — both visible and editable
- qb_default_gl_account_id (pulled from QB vendor record)
- billflow_gl_account_id (BillFlow override)
- gl_account_source enum: qb_default / billflow_override / not_set
- qb_default_class_id, billflow_class_id, class_source (same pattern)
- qb_payment_terms, billflow_payment_terms (same pattern)
- auto_publish_enabled (boolean)
- hold_for_job_match (boolean, default OFF)
- copy_po_to_qb_reference (boolean, default ON)
- known_format (JSON, platform-wide)
- confidence_score, invoices_processed

### QB Reference Number
- Per-vendor flag (default ON): copy vendor PO field text to QB Ref No field
- Editable by user on review screen even if blank on original invoice

### Class Tracking
- Only visible if QB company has class tracking enabled
- Completely generic — pull whatever classes contractor defined in QB
- Never required unless contractor explicitly enables "require class" setting
- Source priority: QB customer class for matched job > vendor default > blank
- Default on vendor record, "remember this" prompt on invoice review

### GL Account
- Source priority: QB vendor default > BillFlow override > blank
- Show source label ("From QuickBooks" or "Set in BillFlow")
- "Remember this" prompt on invoice review screen (same as AutoEntry)

### Bill Review Screen
- Split screen: PDF right, form left, both scroll independently
- Native PDFs: fully selectable/copyable text
- Scanned PDFs: click region → OCR that region → copy to clipboard
- Field highlighting: click form field → highlight source region on PDF
- Quantity: displayed between description and cost (normal invoice order) on review screen
- Job dropdown: type anything (job number, name, customer name) → filters real-time → most recently created first → arrow keys → Enter selects

### Inbox / Archive Structure
- Inbox: unprocessed bills only (Needs Review, Pending Job Match, Sync Error)
- Archive: all published bills, searchable, filterable
- Bills move from inbox to archive automatically on confirmed publish

### FSM Materials Entry Export
- Grouped by job
- Multiple vendors under same job header
- Per vendor section: vendor name, invoice number, date
- Line items: description, cost, quantity (quantity at END in parentheses, de-emphasized)
- No part numbers (FSMs don't have part number field)
- Job total per section
- Lines with no job assignment excluded entirely
- Export controls: date range, filter by vendor (multi-select), filter by job (multi-select)
- Formats: PDF and Excel

### Job Profitability View
- Pulls from QB (Cost by Job data via API)
- Default: jobs with transactions in last 30 days (activity-based, NOT QB job status which is unreliable)
- Shows: job number, customer name, revenue, material costs, gross profit, margin %
- Searchable by job number, name, customer name

### Notifications
- Default: silent when auto-publishing correctly
- Notify only when action required
- Daily digest optional (off by default)
- No per-invoice noise for auto-published bills

### Pricing
- Flat monthly subscription (not per-credit/usage)
- Exact pricing TBD

## Dropdown Search Standard (ALL dropdowns)
Every dropdown in BillFlow follows this pattern:
- Type anything → filters real-time against all relevant fields
- Most recently used/created shown first before typing
- Arrow keys navigate, Enter selects, Escape cancels
- Shows enough context per result (job: number + name + customer name)

## Items Table (QB)
- Company-level setting, OFF by default
- When on: line items use QB Products & Services instead of GL accounts
- For contractors using QB inventory/non-inventory items

## Accuracy Standard
Extraction accuracy on clean digital PDFs from major HVAC distributors must match or exceed AutoEntry before any paying customer. Validate against 20-30 real invoices from pilot contractor.

## Competitive Context
- AutoEntry by Sage: closest competitor. Works well but poor onboarding, no job matching, credit pricing, can't copy from PDF side
- QBO native capture: free but less accurate than AutoEntry. BillFlow must beat both.
- Market insight: AutoEntry is not well marketed. Most contractors don't know it exists. BillFlow goes to where contractors are (HVAC Facebook groups, QB ProAdvisors, distributor relationships).

## Target Market
Primary: HVAC and mechanical contractors using QuickBooks (Online or Desktop)
Secondary: Any trade/service business buying materials for jobs (plumbing, electrical, roofing, general contracting, auto repair)
Job costing is optional — invoice capture alone has broad market value

## Relationship to FSM Platform
BillFlow is built first as standalone product. ~90% of BillFlow code is reused in the full Field Service Intelligence Platform built later. BillFlow is not a prototype — it is a real product.

## What Comes Next (Build Order)
1. Database schema (Supabase tables)
2. Auth flow (login/signup with Supabase Auth)
3. Bill inbox UI
4. Email capture webhook
5. OCR processing pipeline
6. Vendor record management
7. QuickBooks OAuth connection (QBO)
8. QB data sync (vendors, accounts, jobs)
9. Bill review screen
10. Auto-publish engine
11. QB push (QBO first, QBD later)
12. FSM Materials Entry export
13. Job profitability view
14. QBD Web Connector integration
15. Onboarding flow

## Local Development
- App runs at: http://localhost:3000
- Start: npm run dev
- Supabase project URL: https://uijbqzwckgdahiuqokyb.supabase.co
- GitHub: https://github.com/thedillons01-svg/billflow
