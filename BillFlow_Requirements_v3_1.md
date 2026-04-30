# BillFlow — Product Requirements Document v3.0
**Automated Vendor Invoice Capture & Job Costing for QuickBooks**
April 2026 — Confidential

**The Product in One Sentence:** Set up email forwarding once, connect QuickBooks once, and vendor invoices flow into QuickBooks automatically — correctly coded to the right job — without anyone touching them.

---

## 1. Product Philosophy

### 1.1 The Core Problem
Small businesses that buy materials for jobs receive vendor invoices by email as PDFs. That PDF contains perfectly structured data. A human then opens QuickBooks and types all of it in again by hand. Every FSM and accounting platform is completely blind to this data. The same double-entry problem exists in HVAC, plumbing, electrical, roofing, general contracting, auto repair, and any trade or service business buying materials for jobs.

### 1.2 The Existing Partial Solution — AutoEntry by Sage
AutoEntry solves invoice capture and QuickBooks push. Gaps BillFlow fills:
- AutoEntry is not well marketed. Most contractors don't know it exists.
- Credit-based pricing creates billing anxiety. BillFlow uses flat monthly pricing.
- AutoEntry does not match invoices to QuickBooks jobs. The job field is always blank.
- Auto-publish is buried in vendor settings. Most users never find it and do manual review forever.
- You cannot copy text from the PDF side of the AutoEntry review screen.
- AutoEntry was designed for accountants managing multiple clients, not direct contractor use.

### 1.3 The Glorious Moment
> The user realizes they have not thought about vendor invoice entry in weeks. It has been happening correctly in the background without them. They open QuickBooks and the bills are there, coded to the right jobs, with the original PDFs attached. They did not touch any of it.

**The goal is not a faster review process. The goal is no review process for the majority of transactions.**

### 1.4 Target Markets
- **Primary:** HVAC and mechanical contractors using QuickBooks Online or Desktop, 2–10 techs
- **Secondary:** Any trade/service business buying materials for jobs (plumbing, electrical, roofing, auto repair, general contracting)
- Job costing is optional — invoice capture alone has broad market value

### 1.5 The 90/90 Rule
- 90% of invoices are for a single job
- 90% of invoices from known vendors can be matched to a QB job with high confidence from the vendor PO field
- ~81% of all invoices should auto-publish without human review once the vendor is configured

### 1.6 Job Costing Toggle
Job costing is entirely optional. Company-level setting: `job_costing_enabled` (boolean, default false).
- When OFF: job fields hidden throughout the app, job matching skipped, FSM export not shown
- When ON: full job matching, line-item job assignment, FSM Materials Entry export active
- Surfaced prominently during onboarding so the contractor makes a deliberate choice
- Hold-for-job-match vendor flag handles vendor-level nuance — no separate vendor-level job costing toggle needed

---

## 2. How BillFlow Works — Complete User Journey

### 2.1 Setup (One Time)
Onboarding is a guided sequence that does not end until the user has successfully processed their first invoice end to end.

| Step | Description |
|------|-------------|
| Step 1: Connect QuickBooks | QBO: OAuth flow. QBD: Web Connector setup guide. BillFlow pulls: vendor list with QB default GL accounts and payment terms, chart of accounts, job/project list with customer names, customer list, class list if enabled. |
| Step 2: Set up email forwarding | BillFlow generates [customizable]@billflow.com capture address. Forwarding rule filters on "invoice" in subject or body only — not "bill", not "statement". |
| Step 3: Process first invoice | User forwards a real vendor invoice. Onboarding not complete until a bill has successfully landed in QuickBooks. |
| Step 4: Set vendor defaults | After first invoice confirmed accurate, prompt to confirm default GL account. "Remember this for future invoices" prompt. |
| Step 5: Enable auto-publish | After 5 invoices from a vendor with no errors, prominent prompt: "Enable auto-publish?" One tap to enable. |
| Step 6: Job costing setup (if enabled) | Contractor identifies FSM platform (HCP, Workiz, ServiceTrade, Jobber, other, unknown). Improves job name pattern matching. |

### 2.2 The Ongoing Workflow
- Vendor emails invoice → forwarding rule catches it → user never sees the email
- BillFlow captures PDF, extracts data, matches to QB job (if job costing enabled), validates all fields
- If auto-publish eligible: bill pushed to QB automatically, PDF attached, user not notified (unless daily digest enabled)
- If any condition fails: bill appears in inbox with specific plain-language reason
- User checks inbox periodically — most days empty or near-empty

### 2.3 Hold for Job Match Flag
Per-vendor flag. When ON: bills without confident job match go to Pending Job Match and wait. When OFF: bills process regardless of job match status. Default: OFF. Only visible when job_costing_enabled is ON.

---

## 3. Invoice Capture & OCR Processing

### 3.1 Capture Methods

| Feature | Specification |
|---------|---------------|
| Email forwarding (primary) | Automatic forwarding rule catches vendor invoice emails |
| Manual email forward | User manually forwards to capture address |
| Manual PDF upload | Drag-and-drop in BillFlow interface |
| Capture email address | [customizable]@billflow.com |
| Email filtering | Forward only when subject or body contains "invoice" |
| Size limit | 30MB per email |

### 3.2 OCR Processing Architecture
⚠️ **Accuracy is the Launch Gate.** Extraction accuracy on clean digital PDFs from major distributors must match or exceed AutoEntry before any paying customer.

| Tier | Trigger | Method | Cost |
|------|---------|--------|------|
| Tier 1 | PDF has text layer (majority) | pdf-parse library + pattern matching | Free |
| Tier 2 | Tier 1 works but confidence low | Claude API text prompt | ~$0.003/invoice |
| Tier 3 | Scanned image PDF | Claude vision API | ~$0.01/invoice |

Blended cost target: under $0.01 per invoice (70% T1, 20% T2, 10% T3).

**QB Items table support:** Company-level setting, OFF by default. When on: line item form shows Item field (QB Products & Services) instead of GL account.

### 3.3 Multi-Invoice PDF Handling

| Feature | Specification |
|---------|---------------|
| Detection | Count distinct invoice numbers. If more than one: split. |
| Summary page detection | First page lists invoice numbers/totals matching subsequent pages but has no line items: discard it. Gensco is a known example. |
| Platform-wide vendor learning | Vendor formats shared across ALL BillFlow clients. Gensco's format learned from one client applies to all. |

### 3.4 Fields Extracted Per Invoice
- Vendor name
- Invoice number (combined with vendor for duplicate detection — never invoice number alone)
- Invoice date
- Due date (if present)
- PO number / reference field (primary input for job matching)
- Invoice total, subtotal, tax amount
- Line items: description, quantity, unit cost, extended cost (part number extracted if present but not required)

---

## 4. QuickBooks Job Matching

### 4.1 Critical Design Decision
**BillFlow NEVER creates job or project records in QuickBooks.** FSM platforms create QB job records through their own sync. If BillFlow also created QB records it would break FSM sync. BillFlow only matches invoices to existing QB jobs.

### 4.2 Matching Logic

| Scenario | Behavior |
|----------|----------|
| FSM job naming pattern known | Apply FSM-specific pattern (HCP creates "Job 1047", etc.) for higher confidence matching |
| PO field exact/high-confidence match | High confidence. Pre-populate all line items. Eligible for auto-publish. |
| PO field fuzzy match | Medium-high confidence. Pre-populate all lines. Show confidence indicator. |
| PO field multiple references | Fuzzy match per line item. Give user best-guess starting point. |
| No PO field or no match | Behavior per vendor's hold-for-job-match flag |
| Job not yet in QuickBooks | Pending Job Match status. Retry every 2 hours during business hours (7am–7pm local), not overnight or weekends. Manual "Find Match" button. |
| QB reference number | Per-vendor flag (default ON): copy PO text to QB Ref No field |

QB job status fields are unreliable — FSMs never update them. BillFlow uses activity-based filtering instead.

### 4.3 Line Item Job Assignment

| Feature | Specification |
|---------|---------------|
| Pre-population | Header-level match pre-populates all line items |
| Apply to all lines | Change job on one line → "Apply to all lines?" prompt |
| Individual line override | Change any line without affecting others |
| Shop stock / no job | Clear job on any line. Still posts to QB without job tag. Excluded from FSM export. |
| Class tag per line | Only visible if QB has class tracking enabled. Generic — whatever contractor defined in QB. Never required unless contractor enables "Require class" setting. Source priority: QB customer class > vendor default > blank. |

---

## 5. The Bill Review Screen

### 5.1 Layout

| Feature | Specification |
|---------|---------------|
| Split screen | PDF right, form left. Both scroll independently. |
| Native PDFs | Fully selectable/copyable text. Solves AutoEntry's copy-from-PDF frustration. |
| Scanned PDFs | Click region → OCR that region → copy to clipboard |
| Field highlighting | Click form field → highlight source region on PDF |
| Keyboard navigation | Tab between fields, Enter confirms and advances |

### 5.2 Header Fields

| Field | Specification |
|-------|---------------|
| Vendor | Pre-populated. If new/low confidence: searchable dropdown with quick-add. "Remember this match" prompt. |
| Invoice number | Pre-populated. Duplicate detection: same vendor + same invoice number within 5 days before/after triggers warning. |
| Invoice date | Pre-populated. Matches QB company date format setting. |
| Due date | Pre-populated if found. Editable. Can be blank. |
| Invoice total | Pre-populated. Read-only. Discrepancy warning if line items don't sum to total. |
| Vendor PO / reference | Pre-populated. Editable. Shown prominently. Copied to QB Ref No if flag on. |

### 5.3 Line Item Fields

| Field | Specification |
|-------|---------------|
| Description | Pre-populated. Part number included if extracted. |
| Quantity | Between description and cost on review screen (normal invoice order). At end of line in FSM export only. |
| Unit cost | Pre-populated. Editable. |
| Extended cost | Auto-recalculates when quantity or unit cost changes. |
| Job / project | Pre-populated from match. Never required to publish. Type-to-filter dropdown. Most recently created first. Arrow keys + Enter to navigate/select. Shows: job number + name + customer name. |
| GL account | Pre-populated from vendor default. "Remember this" prompt on change. |
| Class | Only if class tracking enabled. Optional. "Remember this" prompt on change. |

### 5.4 Auto-Publish Hold Reasons (Specific, Not Generic)
- "Auto-publish held: job match confidence too low — PO field says '1047 and stock items', needs manual line item assignment"
- "Auto-publish held: new vendor, first invoice requires review"
- "Auto-publish held: possible duplicate — Invoice #48291 from Johnstone Supply already exists in QuickBooks"
- "Auto-publish held: GL account not set for this vendor"
- "Auto-publish held: job '1052' not yet in QuickBooks — waiting for job to sync from FSM"

### 5.5 Publish Actions

| Feature | Specification |
|---------|---------------|
| Publish to QuickBooks | Primary action. Pre-push validation against cached QB data (no live API calls). Async push, PDF attached, status updated on QB confirmation. |
| Bill status states | Draft → Ready → Publishing → Published / Sync Error |
| Unpublish | ONLY available for Sync Error status (bill never confirmed in QB). Once Published (QB bill ID stored) — no unpublish. Correct in QB directly. |
| Pre-push validation | Vendor in QB, GL account in QB, job in QB if assigned, no duplicate, all required fields, class if required. All against cache. |

---

## 6. Auto-Publish System

### 6.1 Eligibility Checks (All Must Pass)
1. Vendor is set to auto-publish
2. Minimum 5 invoices processed from this vendor
3. Zero extraction errors on last 3 invoices from this vendor
4. Job match confidence above threshold (or hold-for-job-match OFF and no job required)
5. No duplicate invoice number + vendor combination detected
6. All required fields extracted successfully
7. GL account for vendor is set
8. Job exists in QB if a job was matched
9. Not a new vendor (first invoice always goes to inbox)

### 6.2 Auto-Publish Promotion

| Feature | Specification |
|---------|---------------|
| Eligibility prompt | After 5 accurate invoices: prominent inline prompt in inbox. Not buried in settings. |
| One-tap enable | Active immediately. No navigation to settings required. |
| Per-vendor control | Configured independently per vendor |
| Auto-disable on errors | Auto-publish disabled automatically if error found on auto-published bill. User notified with specific reason. |

---

## 7. QuickBooks Integration

### 7.1 QuickBooks Online (QBO)

| Feature | Specification |
|---------|---------------|
| Connection | OAuth 2.0. Refresh tokens stored securely. Access tokens refreshed automatically. |
| Data pulled | Vendor list (with QB default GL accounts and payment terms), chart of accounts, customer list, job/project list, class list if enabled. Jobs refreshed every 15 min. Vendors/accounts refreshed hourly. |
| Bills pushed | Vendor, invoice number, date, due date, Ref No, line items (description, quantity, unit cost, GL account or QB item, job/class per line), total. PDF attached after confirmation. |
| Async processing | All QBO API calls in background. Rate limiting with exponential backoff. |
| Sync confirmation | Query QB after push to confirm bill exists with QB bill ID. Do not mark Published until confirmed. |

### 7.2 QuickBooks Desktop (QBD)

| Feature | Specification |
|---------|---------------|
| Connection | Intuit Web Connector. Polls BillFlow every 5–30 minutes (contractor-configured). |
| Status | Queued for Sync → Syncing → Published / Sync Error |
| Heartbeat monitoring | Every successful poll records timestamp. If no heartbeat for 2x expected interval: notify user. Auto-clears when connection resumes. |
| Status indicator | Persistent in BillFlow UI: green / yellow / red |
| PDF attachment | Cannot attach PDF to QBD bill record (known QBD limitation). PDF stored in BillFlow. |

---

## 8. Inbox & Bill Status Management

### 8.1 Two-Area Architecture

| Area | Contains |
|------|----------|
| Inbox | Unprocessed only: Needs Review, Pending Job Match, Sync Error. Should be empty or near-empty most days. |
| Archive | All published bills. Searchable, filterable. Bills auto-move here on confirmed publish. |

### 8.2 Inbox Views
- **Needs Review** (default): New bills, auto-publish failures with specific reason, Sync Error bills
- **Pending Job Match**: Bills waiting for QB job to appear. Retry every 2 hours during business hours.
- **All Inbox**: All unarchived bills

### 8.3 Notifications

| Scenario | Behavior |
|----------|----------|
| Auto-publish working correctly | Silent. Silence is success. |
| Daily digest | Optional, off by default |
| Action required | Immediate: Needs Review bill, Sync Error, QBD heartbeat lost, new vendor |
| Manual upload | Confirmation when processing completes: "Invoice from Johnstone Supply ($847.23) published to QuickBooks" |

---

## 9. Vendor Record

| Field | Description |
|-------|-------------|
| vendor_name_extracted | Name as OCR reads it off the PDF. Visible and editable. |
| vendor_name_display | Mapped QB vendor name. Visible and editable. Both shown so user sees the mapping. |
| qb_default_gl_account_id | From QB vendor record |
| billflow_gl_account_id | BillFlow override |
| gl_account_source | enum: qb_default / billflow_override / not_set. Source label shown in UI. |
| qb_default_class_id, billflow_class_id, class_source | Same pattern as GL account |
| qb_payment_terms, billflow_payment_terms, payment_terms_source | Same pattern |
| auto_publish_enabled | Boolean |
| hold_for_job_match | Boolean. Default OFF. Only relevant when job_costing_enabled is ON. |
| copy_po_to_qb_reference | Boolean. Default ON. |
| known_format | JSON. System-maintained. Platform-wide (shared across all clients). |
| confidence_score / confidence_display | High / Medium / Low. Based on % of last 20 invoices published without correction. |
| invoices_processed | Count |
| last_invoice_date | Date |
| email_domains | Array. Used to pre-identify vendor before OCR. |

---

## 10. FSM Materials Entry Export
Only available when job_costing_enabled is ON.

### 10.1 The Problem
No FSM platform supports importing vendor invoice line items as job costs. This export makes manual FSM entry as fast as possible. V1 solution: export file. Direct FSM API writes planned for later phase.

### 10.2 Export Format
```
Job 1047 — Johnson Mechanical — 123 SE Stark St
  Johnstone Supply — Invoice #48291 — March 15, 2026
    Run Capacitor 45/5 MFD   $18.47   (x1)
    Contactor 24V 40A   $22.13   (x1)
  Wesco — Invoice #W-009341 — March 15, 2026
    Wire 12/2 Romex 250ft   $94.50   (x1)
Job 1047 Total Materials: $134.10
──────────────────────────────
Job 1052 — Riverside Apartments — 4521 NE Broadway
  Johnstone Supply — Invoice #48291 — March 15, 2026
    TXV R410A 2-ton   $67.22   (x1)
Job 1052 Total Materials: $67.22
```

### 10.3 Format Decisions
- Grouped by job. Multiple vendors under one job header.
- Line items: description, cost, quantity. No part number column (FSMs don't have this field).
- Quantity at END of line in parentheses, de-emphasized. (Normal position on review screen — end position is export-only.)
- Lines with no job assignment excluded entirely.

### 10.4 Export Controls
- Date range: default since last export. Last export date tracked automatically.
- Filter by vendor (multi-select)
- Filter by job (multi-select)
- Scope: Published bills only
- Formats: PDF and Excel

---

## 11. Job Profitability View

| Feature | Specification |
|---------|---------------|
| Data source | QB Cost by Job report via API. BillFlow does not maintain parallel calculation. |
| Display | Job number, name, customer name, revenue, material costs, gross profit, margin % |
| Default filter | Jobs with any transaction in last 30 days (activity-based — QB job status fields are unreliable) |
| Date range | Current month, last month, last 90 days, custom, all time |
| V2 | Labor costs from GPS clock-in data added when BillFlow is part of full FSM platform |

---

## 12. Technical Architecture & Data Model

### 12.1 Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend & API | Next.js 15, TypeScript, Tailwind CSS, App Router, Turbopack |
| Database | PostgreSQL via Supabase. Multi-tenant with company_id on all records. |
| Authentication | Supabase Auth. Email/password. |
| File storage | Supabase Storage. Organized by company_id/bill_id. |
| Background jobs | Vercel Cron (scheduled). Supabase Edge Functions (event-driven). |
| Email capture | Inbound webhook (SendGrid or Postmark) |
| OCR | Tiered: pdf-parse → Claude API text → Claude vision API |
| QB integrations | QBO: REST API with OAuth 2.0. QBD: Intuit Web Connector. |
| Notifications | Resend (email). Supabase Realtime (in-app). |
| Hosting | Vercel |

### 12.2 Key Data Model Tables

#### companies
```
company_id          uuid, primary key
name                text
qb_type             enum: qbo / qbd
qb_connection_status text
qb_last_sync        timestamp
capture_email_prefix text (unique)
fsm_platform        enum: hcp / workiz / servicetrade / jobber / other / unknown
job_costing_enabled boolean, default false
created_at          timestamp
```

#### vendors
```
vendor_id                   uuid, primary key
company_id                  uuid, foreign key → companies
vendor_name_extracted        text  (name as OCR reads off PDF)
vendor_name_display          text  (mapped QB vendor name)
qb_vendor_id                 text  (QB internal ID, not shown to user)
qb_vendor_name               text
qb_default_gl_account_id     text
billflow_gl_account_id       text
gl_account_source            enum: qb_default / billflow_override / not_set
qb_default_class_id          text
billflow_class_id            text
class_source                 enum: qb_default / billflow_override / not_set
qb_payment_terms             text
billflow_payment_terms       text
payment_terms_source         enum: qb_default / billflow_override / not_set
auto_publish_enabled         boolean, default false
hold_for_job_match           boolean, default false
copy_po_to_qb_reference      boolean, default true
invoices_processed           integer, default 0
confidence_score             decimal (0.00–1.00)
confidence_display           enum: high / medium / low
known_format                 jsonb
email_domains                text[]
last_invoice_date            date
created_at                   timestamp
```

#### bills
```
bill_id                 uuid, primary key
company_id              uuid, foreign key → companies
vendor_id               uuid, foreign key → vendors
invoice_number          text
invoice_date            date
due_date                date
total                   decimal(10,2)
vendor_po_reference     text
qb_reference_number     text
status                  enum: draft / ready / publishing / published / sync_error
publish_method          enum: manual / auto
qb_bill_id              text  (stored once QB confirms — never mark Published without this)
qb_sync_status          text
qb_sync_error           text
autopublish_hold_reason text
pdf_url                 text
capture_source          enum: email / upload
created_at              timestamp
```

#### bill_line_items
```
line_id                 uuid, primary key
bill_id                 uuid, foreign key → bills
company_id              uuid, foreign key → companies
description             text
quantity                decimal(10,4)
unit_cost               decimal(10,2)
extended_cost           decimal(10,2)
gl_account_id           text  (QB GL account ID)
qb_item_id              text  (nullable — for Items table mode)
job_id                  text  (QB job/project ID — nullable)
class_id                text  (QB class ID — nullable)
extraction_confidence   decimal(0.00–1.00)
sort_order              integer
```

#### qb_jobs_cache
```
id                      uuid, primary key
company_id              uuid, foreign key → companies
qb_job_id               text
job_name                text
job_number              text
customer_name           text
customer_id             text
qb_class_id             text
last_transaction_date   date
cached_at               timestamp
```

#### qb_vendors_cache
```
id                      uuid, primary key
company_id              uuid
qb_vendor_id            text
name                    text
default_expense_account_id text
payment_terms           text
cached_at               timestamp
```

#### qb_accounts_cache
```
id                      uuid, primary key
company_id              uuid
qb_account_id           text
name                    text
account_type            text
account_sub_type        text
cached_at               timestamp
```

#### qb_classes_cache
```
id                      uuid, primary key
company_id              uuid
qb_class_id             text
name                    text
cached_at               timestamp
```

#### processing_log
```
id                      uuid, primary key
bill_id                 uuid
action                  text
actor                   text  (user_id or 'system')
timestamp               timestamp
before_state            jsonb
after_state             jsonb
-- Append-only. Never deleted. Every action on every bill permanently recorded.
```

#### exports
```
id                      uuid, primary key
company_id              uuid
export_date             timestamp
date_range_start        date
date_range_end          date
vendor_filter           text[]
job_filter              text[]
bill_ids_included       uuid[]
format                  enum: pdf / excel
```

#### qbd_heartbeats
```
company_id              uuid, primary key (one row per company)
last_heartbeat_at       timestamp
last_sync_at            timestamp
connector_status        enum: running / overdue / alert
```

### 12.3 Dropdown Search Standard (ALL Dropdowns)
Every dropdown in BillFlow follows this pattern:
- Type anything → real-time filter against all relevant fields
- Most recently created/used items shown first before typing
- Arrow keys navigate, Enter selects, Escape cancels
- Each result shows enough context: job dropdown shows job number + job name + customer name

### 12.4 Build Order
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

---

## 13. Accuracy Standard
Validate against 20–30 real vendor invoices from pilot contractor covering multiple vendors (Johnstone Supply, Wesco, Ferguson, Gensco). Process each through BillFlow and through QBO native capture. **BillFlow must win on accuracy before launch.**

---

## 14. Relationship to FSM Platform
BillFlow is built first as standalone product. ~90% of BillFlow code is reused in the full Field Service Intelligence Platform built later. BillFlow is not a prototype — it is a real product.

---
*Document version: 3.0 | April 2026 | Confidential*
