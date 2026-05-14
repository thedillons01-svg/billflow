@AGENTS.md

# Working Style
Proceed with all file edits, terminal commands, git commits, and pushes without asking for confirmation. Make autonomous decisions based on BillFlow_Requirements_v4.md — it is the source of truth for all product decisions. Only stop if something is ambiguous that the requirements don't cover, or if you're about to do something irreversible like dropping database tables.
Read DESIGN.md before writing any UI code. All colors, spacing, components, and interaction patterns are defined there.

# BillFlow — Project Context for Claude Code

## What BillFlow Is
BillFlow is a SaaS web application that automatically captures vendor invoices and purchase orders via email, extracts line-item data using OCR, matches bills to QuickBooks jobs, and pushes approved bills to QuickBooks Online and QuickBooks Desktop — without manual data entry.

**The product in one sentence:** Set up email forwarding once, connect QuickBooks once, and vendor invoices flow into QuickBooks automatically — correctly coded to the right job — without anyone touching them.

**The glorious moment:** The user realizes they haven't thought about vendor invoice entry in weeks. It has been happening correctly in the background without them.

## Who Built This
Solo founder: Heather Dillon, Hillsboro OR. Deep operational background as office manager and bookkeeper for HVAC/mechanical contractors. Hands-on expertise in QuickBooks, Housecall Pro, and ServiceTrade. MIS background. Building with Claude as coding partner.

## Technology Stack
- **Frontend/API:** Next.js 15, TypeScript, Tailwind CSS, App Router, Turbopack
- **Database:** PostgreSQL via Supabase (project: BillFlow under Dillon Software org)
- **Auth:** Supabase Auth
- **Hosting:** Vercel (planned)
- **Background jobs:** Vercel Cron + Supabase Edge Functions
- **OCR:** Tiered — pdf-parse (Tier 1, free), Claude text API (Tier 2), Claude vision API (Tier 3)
- **QB integrations:** QBO REST API (OAuth 2.0), QBD via Intuit Web Connector
- **Email:** Inbound email webhook (SendGrid or Postmark)
- **Notifications:** Resend (email), Supabase Realtime (in-app)
- **Billing:** Stripe (planned)

## Project Structure
```
src/
  app/
    (auth)/          # login, signup
    (dashboard)/     # main app shell
      bills/         # invoice inbox + detail
      purchase-orders/ # PO inbox + detail
      receiving/     # receiving workflow
      vendors/       # vendor record management
      jobs/          # QuickBooks job matching
      settings/      # integrations, email config, billing
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
- QBO_CLIENT_ID (set up — see Intuit Developer portal, BillFlow app, Development keys)
- QBO_CLIENT_SECRET (set up — see Intuit Developer portal, BillFlow app, Development keys)
- QBO_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
- EMAIL_WEBHOOK_SECRET (not yet set up)
- STRIPE_SECRET_KEY (not yet set up)
- STRIPE_PUBLISHABLE_KEY (not yet set up)

## Core Product Decisions

### Pricing
- Per-transaction credit model mirroring AutoEntry at slightly lower rates
- Bills: 2 credits per invoice (line item extraction always included)
- POs: 1 credit per PO
- Reprocessing: no charge
- Duplicates/wrong document type rejected: no charge
- Flat monthly subscription option also available
- Credit balance always visible on dashboard and in settings

### Invoice & PO Capture
- Two capture addresses per company: [prefix]-bills@billflow.com and [prefix]-pos@billflow.com
- Bills address: filters on "invoice" in subject or body
- POs address: filters on "purchase order" or "order confirmation" in subject or body
- Wrong document type sent to wrong address → rejected with specific redirect message, no charge
- Tiered OCR: Tier 1 (pdf-parse, free) → Tier 2 (Claude text, cheap) → Tier 3 (Claude vision, scanned docs only)
- Vendor format knowledge is shared platform-wide (Gensco learned once = applies to all clients)
- Multi-invoice PDFs supported (Gensco sends summary page + individual invoices — discard summary, split rest)
- Tax lines extracted as regular line items — not a separate tax field
- Line item total (including tax lines) must exactly equal invoice header total for auto-publish

### Purchase Orders
- PO confirmations captured via [prefix]-pos@billflow.com
- BillFlow creates QB Purchase Order records via API
- When invoice arrives: matched to open PO by vendor + PO number
- Bill created in QB linked to PO, discrepancies flagged
- PO statuses: Open / Partially Received / Received / Closed

### Receiving
- V1: Manual receiving UI on any Open or Partially Received PO
- Mobile-friendly checklist — per-line received/partial/not received
- Shows who ordered, what job, when — answerable without calling anyone
- V1.5: Camera capture of packing slip (future)
- V2: Push notification to tech who created PO (future)
- V3: Push status to FSM (future)

### Job Matching
- NEVER create QB job records — only match to existing ones pulled from QB
- Match at invoice header level using vendor PO/reference field
- Pre-populate all line items with matched job (user corrects exceptions)
- Per-vendor flag: "hold for job match" — OFF by default
- Pending Job Match retry: every 2 hours during business hours (7am-7pm), not overnight
- Manual "Find Match" button for on-demand retry
- FSM platform field in company settings improves job name pattern matching

### Job Assignment
- Job assigned at LINE ITEM level (mirrors QuickBooks bill entry)
- "Apply [Job Name] to all [N] lines?" confirmation — shows specific name and count
- Shop stock lines can have job cleared (excluded from FSM export)

### Auto-Publish
- Per-vendor flag, promoted actively after 5 accurate invoices
- All eligibility checks must pass: vendor set, 5+ invoices, zero errors on last 3, job confidence high, no duplicate, all fields present, GL account set, job exists in QB if matched, not new vendor, payment account set if mark-as-paid enabled, no PO discrepancies, line item total matches invoice total
- When auto-publish doesn't fire: show SPECIFIC plain-language reason on bill in inbox
- Auto-disable if error found on auto-published bill

### Mark as Paid
- Per-vendor default (boolean, default OFF)
- When ON: bills publish with a linked QB bill payment record against the specified payment account
- Two QB API calls on publish: create bill, then create bill payment
- Payment account, payment method, payment date, check/ref number fields on bill review screen and vendor record
- Auto-publish blocked if mark-as-paid enabled but no payment account configured

### QuickBooks Integration
- QBO: async processing, confirm receipt before marking Published, rate limiting with backoff
- QBD: Web Connector polling (5-30 min interval), heartbeat monitoring, notify user if heartbeat lost
- Status states: Draft → Ready → Publishing → Published / Sync Error
- Unpublish: ONLY available for Sync Error status. Once Published (QB bill ID stored), no unpublish — correct in QB directly.
- Pre-push validation against cached QB data (no live API calls for validation)
- PDF attached to QB bill record on publish (QBD cannot receive PDF attachments — PDF stored in BillFlow only)
- Account visibility: admin can hide individual QB accounts from BillFlow dropdowns. Pre-filtered to expense/COGS types only.

### Vendor Record Key Fields
- vendor_name_extracted (what OCR pulls off PDF)
- vendor_name_display (mapped QB vendor name) — both visible and editable
- is_visible (boolean — hide vendor from dropdowns without deleting)
- qb_default_gl_account_id / billflow_gl_account_id / gl_account_source (qb_default / billflow_override / not_set)
- qb_default_class_id / billflow_class_id / class_source (same pattern)
- qb_payment_terms / billflow_payment_terms / payment_terms_source (same pattern)
- default_description (free text, pre-populates QB bill memo)
- default_payment_account_id, default_payment_method, mark_as_paid_default
- auto_publish_enabled, hold_for_job_match, copy_po_to_qb_reference
- known_format (JSON, platform-wide), confidence_score, invoices_processed
- Vendor tabs: General, Line Items (stored mappings), Rules (conditional routing), Inbox, Archived

### Line Item Routing
- Stored mappings: description text → GL account, created when user clicks "Remember? Yes" on a line item
- Rules engine: per-vendor conditional rules — [Description / Unit Price] [equal / contains / begins with / ends with] [value] → GL account or QB Product/Service
- Rules evaluated after stored mappings; rule takes priority if both match
- Source badge on every GL account field: QB / BillFlow / Rule / Manual

### Remember Prompt
- Appears inline after user changes: GL Account (header and line level), Class, Payment Account, Payment Method
- Does NOT appear for: Job, invoice number, dates, amounts, reference fields
- Yes → saves to vendor record as new default. No → applies to this bill only.

### Bill Review Screen
- Split screen: PDF right, form left, both scroll independently
- Native PDFs: fully selectable/copyable text
- Scanned PDFs: click region → OCR that region → copy to clipboard
- Field highlighting: click form field → highlight source region on PDF
- Open vendor in new tab: icon button next to vendor field
- Both header total and line item sum shown at all times (must match for auto-publish)
- Quantity: displayed between description and cost (normal invoice order) on review screen

### Inbox / Archive Structure
- Inbox: unprocessed bills only (Needs Review, Pending Job Match, Sync Error, Processing)
- Archive: all published bills, searchable, filterable
- Bills move from inbox to archive automatically on confirmed publish
- Trash: deleted bills with 30-day recovery window
- Activity log: Uploaded Files tab + Processed Items tab (credits used shown per action)
- Inline editing of vendor and GL account in inbox list view
- Bulk actions: Archive, Reject, Delete, Publish

### Notifications
- Error notifications: always on, never silenceable (wrong capture address, unrecognized sender, PDF unreadable, duplicate held, job match failed, auto-publish disabled, QB sync error, QBD heartbeat lost)
- Success notifications: on by default, user can disable (bill processed, bill auto-published, PO processed, PO matched)
- Multi-email chip input for recipients. Notify Uploader toggle.
- In-app notification bell shows unread error count.
- Daily digest optional (off by default)

## Dropdown Search Standard (ALL dropdowns)
Every dropdown in BillFlow follows this pattern:
- Type anything → filters real-time against all relevant fields
- Most recently used/created shown first before typing
- Arrow keys navigate, Enter selects, Escape cancels
- Shows enough context per result (job: number + name + customer name)
- Hidden accounts never appear in dropdowns

## Items Table (QB)
- Company-level setting, OFF by default
- When on: line items use QB Products & Services instead of GL accounts

## UX Principle — Inline Explanations Everywhere
Every field, toggle, and setting must have inline helper text. Users should never need to open a help article to understand a setting.

## Accuracy Standard
Extraction accuracy on clean digital PDFs from major HVAC distributors must match or exceed AutoEntry before any paying customer. Validate against 20-30 real invoices from pilot contractor.

## Competitive Context
- AutoEntry by Sage: closest competitor. No job matching, shared processing queue (slow), no PO capture, no receiving, can't copy from PDF side
- QBO native capture: free but less accurate. BillFlow must beat both.
- BillFlow differentiators: job matching, PO capture, receiving workflow, per-vendor auto-publish promotion, processing speed

## Target Market
Primary: HVAC and mechanical contractors using QuickBooks (Online or Desktop)
Secondary: Any trade/service business buying materials for jobs (plumbing, electrical, roofing, general contracting, auto repair)
Job costing is optional — invoice capture alone has broad market value

## Relationship to FSM Platform
BillFlow is built first as standalone product. ~90% of BillFlow code is reused in the full Field Service Intelligence Platform built later. BillFlow is not a prototype — it is a real product.

## Build Order
1. Database schema (Supabase tables)
2. Auth flow (login/signup with Supabase Auth)
3. Bill inbox UI
4. Email capture webhook
5. OCR processing pipeline
6. Vendor record management (General + Line Items + Rules tabs)
7. QuickBooks OAuth connection (QBO)
8. QB data sync (vendors, accounts, jobs, account visibility)
9. Bill review screen
10. Auto-publish engine
11. QB push — bills (QBO first, QBD later)
12. Mark as Paid — QB bill payment push
13. PO capture and QB PO push
14. PO-to-bill matching
15. Manual receiving UI
16. FSM Materials Entry export
17. Job profitability view
18. Notifications (email + in-app bell)
19. Activity log
20. Trash / soft delete
21. QBD Web Connector integration
22. Onboarding flow
23. Billing / credits (Stripe)

## Local Development
- App runs at: http://localhost:3000
- Start: npm run dev
- Supabase project URL: https://uijbqzwckgdahiuqokyb.supabase.co
- GitHub: https://github.com/thedillons01-svg/billflow
- Dev/test email: billflowdev@gmail.com (used for QBO sandbox and other BillFlow service accounts)
- QBO sandbox company: Sandbox Company US 3402 (ID: 9341457021204980)
