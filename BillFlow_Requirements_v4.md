# BillFlow — Product Requirements Document v4.0
**Automated Vendor Invoice Capture, PO Management & Job Costing for QuickBooks**
May 2026 — Confidential

**The Product in One Sentence:** Set up email forwarding once, connect QuickBooks once, and vendor invoices flow into QuickBooks automatically — correctly coded to the right job — without anyone touching them.

---

## 1. Product Philosophy

### 1.1 The Core Problem
Small businesses that buy materials for jobs receive vendor invoices by email as PDFs. That PDF contains perfectly structured data. A human then opens QuickBooks and types all of it in again by hand. Every FSM and accounting platform is completely blind to this data. The same double-entry problem exists in HVAC, plumbing, electrical, roofing, general contracting, auto repair, and any trade or service business buying materials for jobs.

The same double-entry problem exists for purchase orders — vendors email PO confirmations that never make it into QuickBooks because entering them requires QB access that the people doing the ordering don't have.

### 1.2 The Existing Partial Solution — AutoEntry by Sage
AutoEntry solves invoice capture and QuickBooks push. Gaps BillFlow fills:
- AutoEntry is not well marketed. Most contractors don't know it exists.
- AutoEntry uses per-document credit pricing. BillFlow uses per-transaction pricing at lower rates, with no charge for reprocessing.
- AutoEntry does not match invoices to QuickBooks jobs. The job field is always blank.
- Auto-publish is buried in vendor settings. Most users never find it and do manual review forever.
- You cannot copy text from the PDF side of the AutoEntry review screen.
- AutoEntry was designed for accountants managing multiple clients, not direct contractor use.
- AutoEntry processes invoices in a shared queue — can take many minutes. BillFlow processes on arrival, typically under 30 seconds for clean digital PDFs.
- AutoEntry has no purchase order capture or PO-to-bill matching.
- AutoEntry has no receiving workflow.

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
Job costing is entirely optional. Company-level setting: job_costing_enabled (boolean, default false).
- When OFF: job fields hidden throughout the app, job matching skipped, FSM export not shown, PO capture still available
- When ON: full job matching, line-item job assignment, FSM Materials Entry export active
- Surfaced prominently during onboarding so the contractor makes a deliberate choice

### 1.7 Pricing Model
BillFlow uses per-transaction credit pricing, mirroring AutoEntry at slightly lower rates.
- Credits purchased in bundles; flat monthly subscription option also available
- Bills: 2 credits per invoice (line item extraction always included)
- POs: 1 credit per PO
- Reprocessing: no charge — same document, user asking for better extraction or re-applying defaults
- Duplicate detected and rejected: no charge
- Wrong document type rejected: no charge
- Credit balance visible on dashboard and in settings at all times

### 1.8 UX Design Principle — Inline Explanations Everywhere
Every field, toggle, and setting in BillFlow must have inline helper text explaining what it does, what happens when it's on vs off, and any consequences worth knowing. Users should never need to open a help article to understand a setting. This is a standing design requirement, not optional polish. It directly reduces support volume and builds user confidence.

---

## 2. How BillFlow Works — Complete User Journey

### 2.1 Setup (One Time)
Onboarding is a guided sequence that does not end until the user has successfully processed their first invoice end to end.

| Step | Description |
|------|-------------|
| Step 1: Connect QuickBooks | QBO: OAuth flow. QBD: Web Connector setup guide with step-by-step screenshots. BillFlow immediately pulls: vendor list with QB default GL accounts and payment terms, chart of accounts, job/project list with customer names, customer list, class list if enabled. |
| Step 2: Set up email forwarding | BillFlow generates two capture addresses: [prefix]-bills@billflow.com and [prefix]-pos@billflow.com. Prefix is customizable. Instructions for Gmail and Outlook with screenshots. User sets up forwarding rules and sends test emails to confirm both work. |
| Step 3: Process first invoice | User forwards a real vendor invoice. Onboarding not complete until a bill has successfully landed in QuickBooks. |
| Step 4: Set vendor defaults | After first invoice confirmed accurate, prompt to confirm default GL account. "Remember this for future invoices" prompt. |
| Step 5: Enable auto-publish | After 5 invoices from a vendor with no errors, prominent inline prompt: "Enable auto-publish?" One tap to enable. Not buried in settings. |
| Step 6: Job costing setup (if enabled) | Contractor identifies FSM platform (HCP, Workiz, ServiceTrade, Jobber, other, unknown). Improves job name pattern matching. |

### 2.2 The Ongoing Workflow
- Vendor emails invoice → bills forwarding rule catches it → user never sees the email
- BillFlow captures PDF, extracts data, matches to QB job (if enabled), validates all fields
- If auto-publish eligible: bill pushed to QB automatically, PDF attached, user not notified unless daily digest enabled
- If any condition fails: bill appears in inbox with specific plain-language reason
- User checks inbox periodically — most days empty or near-empty
- PO confirmations follow the same path through the PO capture address

### 2.3 Hold for Job Match Flag
Per-vendor flag. When ON: bills without confident job match go to Pending Job Match and wait. When OFF: bills process regardless of job match status. Default: OFF. Only visible when job_costing_enabled is ON.

---

## 3. Invoice Capture & OCR Processing

### 3.1 Capture Addresses
BillFlow generates two capture email addresses per company:

| Address | Purpose | Filter |
|---------|---------|--------|
| [prefix]-bills@billflow.com | Vendor invoices | Subject or body contains "invoice" |
| [prefix]-pos@billflow.com | PO confirmations | Subject or body contains "purchase order" or "order confirmation" |

Wrong document type handling: If a document is detected as the wrong type for its address, it is rejected with a specific plain-language notification: "A purchase order was sent to your bills address. Forward it to [prefix]-pos@billflow.com instead." No credit charged.

Size limit: 30MB per email.

### 3.2 Capture Methods

| Feature | Specification |
|---------|---------------|
| Email forwarding (primary) | Automatic forwarding rule catches emails. One-time setup, runs forever. |
| Manual email forward | User manually forwards any invoice or PO email to the appropriate capture address. |
| Manual PDF upload | Drag-and-drop in BillFlow interface. Document type selected on upload. |

### 3.3 OCR Processing Architecture
Accuracy is the Launch Gate. Extraction accuracy on clean digital PDFs from major distributors must match or exceed AutoEntry before any paying customer.

| Tier | Trigger | Method | Cost |
|------|---------|--------|------|
| Tier 1 | PDF has text layer (majority) | pdf-parse library + pattern matching | Free |
| Tier 2 | Tier 1 confidence low | Claude API text prompt | ~$0.003/invoice |
| Tier 3 | Scanned image PDF | Claude vision API | ~$0.01/invoice |

Blended cost target: under $0.01 per invoice (70% T1, 20% T2, 10% T3).

Processing speed: BillFlow processes each document immediately on receipt via webhook. No shared queue. Clean digital PDFs typically processed in under 30 seconds.

Processing status shown in inbox while in flight: Received → Extracting → Matching → Ready for Review / Auto-publishing → Published

QB Items table support: Company-level setting, OFF by default. When on: line item form shows Item field (QB Products & Services) instead of GL account.

### 3.4 Multi-Invoice PDF Handling

| Feature | Specification |
|---------|---------------|
| Detection | Count distinct invoice numbers. If more than one: split. |
| Summary page detection | First page lists invoice numbers/totals but has no line items: discard it. Gensco is a known example. |
| Platform-wide vendor learning | Vendor formats shared across ALL BillFlow clients. Gensco learned from one client applies to all. |

### 3.5 Fields Extracted Per Invoice
- Vendor name
- Invoice number (combined with vendor for duplicate detection — never invoice number alone)
- Invoice date
- Due date (if present)
- PO number / reference field (primary input for job matching)
- Invoice total, subtotal, tax amount (as separate header fields for reconciliation)
- Line items: description, quantity, unit cost, extended cost (part number extracted if present)
- Tax lines: extracted as regular line items — description, amount, require GL account assignment like any other line item. Multiple tax lines per invoice supported.

### 3.6 Line Item Total Reconciliation
The sum of all extracted line items (including tax lines) must exactly equal the extracted invoice header total before auto-publish is allowed. Both totals displayed prominently on the bill review screen at all times.

If totals do not match exactly: auto-publish blocked with specific reason: "Auto-publish held: line item total ($298.45) does not match invoice total ($302.05) — difference of $3.60, possible extraction error."

### 3.7 Duplicate Detection
Two independent duplicate checks:
1. File fingerprint duplicate — same PDF submitted twice, detected at ingest before OCR. Warning in Activity log with "Process Anyway" option. No credit charged.
2. Invoice number + vendor duplicate — same vendor + same invoice number within configurable date window (default 5 days). Warning on bill in inbox. User can override.

### 3.8 Reprocess
Available on any unpublished bill. BillFlow silently checks whether vendor defaults have changed since last processing.
- If defaults changed: re-applies vendor defaults to existing extracted data without re-running OCR. No charge.
- If defaults have not changed: re-runs OCR pipeline at next tier for better extraction. No charge.

---

## 4. Purchase Order Capture

### 4.1 The PO Problem
Contractors don't enter purchase orders in QuickBooks because the people doing the ordering (techs, project managers) don't have QB access. So PO functionality in QB goes unused even though it enables proper accrual accounting and bill-to-PO matching.

BillFlow solves this by capturing PO confirmations through the same email pipeline used for invoices. When a vendor emails a PO confirmation, it is forwarded to the PO capture address. BillFlow creates the PO in QuickBooks automatically. When the invoice arrives later, BillFlow matches it to the open PO and creates a linked bill.

### 4.2 PO Capture Flow
1. Tech or PM places order with vendor
2. Vendor emails PO confirmation → forwarded to [prefix]-pos@billflow.com automatically
3. BillFlow extracts PO data, creates PO record in QB via API
4. PO appears in BillFlow PO inbox with status: Open
5. When vendor invoice arrives → BillFlow matches invoice to open PO by vendor + PO number
6. Bill created in QB linked to the PO — closes or partially closes the PO
7. Discrepancies between PO and invoice flagged for review

### 4.3 Fields Extracted Per PO
- Vendor name
- PO number
- Order date
- Expected delivery date (if present)
- Job / reference (same matching logic as invoices)
- Line items: description, quantity, estimated unit cost, extended cost

### 4.4 PO Status States
- Open — PO in QB, waiting for invoice
- Partially Received — invoice arrived covering some but not all lines
- Received — invoice matched and bill created, all lines covered
- Closed — manually closed by user

### 4.5 PO-to-Bill Matching
When a bill arrives and a matching open PO is found (vendor + PO number match):
- Bill pre-populated with PO line items for comparison
- Quantity and amount discrepancies flagged inline per line item
- User reviews discrepancies before publishing
- On publish: bill created in QB linked to the PO

Discrepancy handling:
- Amount higher than PO → flag, show difference, require acknowledgment before auto-publish
- Items on bill not on PO → flag as unmatched lines, require manual GL account assignment
- Partial invoice against open PO → PO stays open, status → Partially Received

Auto-publish blocked if unresolved PO discrepancies exist: "Auto-publish held: invoice amount exceeds PO amount by $47.20 — requires review."

### 4.6 PO Inbox
- Open POs — default view, all POs awaiting invoices
- Partially Received — POs with some lines invoiced
- All POs — complete list with status

---

## 5. Receiving

### 5.1 The Receiving Problem
When materials arrive, the person at the office doesn't know what was ordered, who ordered it, or which job it was for — because the people who placed the orders are out on job sites. BillFlow answers "who ordered this and why" instantly by linking the delivery to the open PO.

### 5.2 V1 — Manual Receiving
Manual receiving is available on any Open or Partially Received PO.

| Feature | Specification |
|---------|---------------|
| Access | Open PO → Receive button. Mobile-friendly interface. |
| Display | Shows vendor, job, who created the PO, date ordered — answerable instantly without calling anyone |
| Per-line actions | Mark as fully received, partially received (enter quantity), or not received |
| Discrepancy notes | Optional notes field per line for damage or substitutions |
| Result | PO status updated. All lines received → Received. Partial → Partially Received. |

### 5.3 Future Phases
- V1.5: Camera capture of packing slip on mobile. OCR reads it and pre-fills the receiving checklist. Primary use case: delivery driver at the door, 60-second receiving flow.
- V2: Push notification to the technician who created the PO when their order arrives.
- V3: Push receiving status to FSM platform. Update job status to show parts on hand.

---

## 6. QuickBooks Job Matching

### 6.1 Critical Design Decision
BillFlow NEVER creates job or project records in QuickBooks. FSM platforms create QB job records through their own sync. BillFlow only matches invoices to existing QB jobs.

### 6.2 Matching Logic

| Scenario | Behavior |
|----------|----------|
| FSM job naming pattern known | Apply FSM-specific pattern (HCP: "Job 1047", etc.) for higher confidence |
| PO field exact/high-confidence match | High confidence. Pre-populate all line items. Eligible for auto-publish. |
| PO field fuzzy match | Medium-high confidence. Pre-populate all lines. Show confidence indicator. |
| PO field multiple references | Fuzzy match per line item. Give user best-guess starting point. |
| No PO field or no match | Behavior per vendor's hold-for-job-match flag |
| Job not yet in QuickBooks | Pending Job Match. Retry every 2 hours during business hours (7am–7pm local), not overnight or weekends. Manual "Find Match" button. |
| QB reference number | Per-vendor flag (default ON): copy PO text to QB Ref No field |

QB job status fields are unreliable — FSMs never update them. BillFlow uses activity-based filtering instead.

### 6.3 Line Item Job Assignment

| Feature | Specification |
|---------|---------------|
| Pre-population | Header-level match pre-populates all line items |
| Apply to all lines | Change job on one line → "Apply [Job Name] to all [N] lines?" confirmation showing specific name and count |
| Individual line override | Change any line without affecting others |
| Shop stock / no job | Clear job on any line. Still posts to QB without job tag. Excluded from FSM export. |
| Class tag per line | Only visible if QB has class tracking enabled. Generic. Never required unless contractor enables "Require class" setting. Source priority: QB customer class > vendor default > blank. |

---

## 7. The Bill Review Screen

### 7.1 Layout

| Feature | Specification |
|---------|---------------|
| Split screen | PDF right, form left. Both scroll independently. |
| Native PDFs | Fully selectable/copyable text. Solves AutoEntry's copy-from-PDF frustration. |
| Scanned PDFs | Click region → OCR that region → copy to clipboard |
| Field highlighting | Click form field → highlight source region on PDF |
| Keyboard navigation | Tab between fields, Enter confirms and advances |
| Swap panels | Button to swap PDF and form sides |
| Invoice history | Button to see previous invoices from same vendor |
| Open vendor in new tab | Icon button next to vendor field — opens vendor record in a new browser tab without leaving the bill review screen. Allows editing vendor defaults mid-review without losing place. |

### 7.2 Header Fields

| Field | Specification |
|-------|---------------|
| Vendor | Pre-populated. If new/low confidence: searchable dropdown with quick-add. "Remember this match" prompt. |
| Invoice number | Pre-populated. Duplicate detection triggers warning. |
| Invoice date | Pre-populated. Matches QB company date format setting. |
| Due date | Pre-populated if found. Editable. Can be blank. |
| Invoice total | Pre-populated from header. Read-only. Both header total and line item sum shown at all times. |
| Vendor PO / reference | Pre-populated. Editable. Shown prominently. Copied to QB Ref No if flag on. |
| Description / Memo | Pre-populated with vendor name. Editable. Becomes QB bill memo field. |
| Type | Bill or Credit Note radio selection |
| GL Account (header) | Sets default for all line items. Changing triggers "Apply [Account Name] to all [N] lines?" confirmation. Remember prompt shown after confirming. |
| Mark as Paid | Toggle. Inherits from vendor default. When ON: payment account, payment method, and payment date fields appear. |
| Payment Account | QB bank or credit card account. Pre-populated from vendor default. Editable. |
| Payment Method | Check, ACH, Credit Card, Other. Pre-populated from vendor default. |
| Payment Date | Defaults to invoice date. Editable. |
| Check / Ref Number | Optional. Shown only when payment method is Check or ACH. |

### 7.3 Line Item Fields

| Field | Specification |
|-------|---------------|
| Description | Pre-populated. Part number included if extracted. Editable. |
| Quantity | Between description and cost on review screen (normal invoice order). At end of line in FSM export only. |
| Unit cost | Pre-populated. Editable. |
| Extended cost | Auto-recalculates when quantity or unit cost changes. |
| Job / project | Pre-populated from match. Never required to publish. Type-to-filter dropdown. Most recently created first. Arrow keys + Enter to navigate/select. Shows: job number + name + customer name. |
| GL account | Pre-populated from vendor default, stored mapping, or rule. Source badge shown. "Remember this" prompt when user changes it manually. |
| Class | Only if class tracking enabled. Optional. "Remember this" prompt on change. |
| Add line item | Button to manually add a new line item |
| Delete line item | X button on each line |

Tax lines are treated as regular line items — extracted with description and amount, require GL account assignment, included in line item total reconciliation. Multiple tax lines per invoice supported.

### 7.4 Field Source Badges
Every field that has a source shows a badge:
- QB — value came from QuickBooks vendor record
- BillFlow — value set as BillFlow override on vendor record
- Rule — value applied by a line item routing rule or stored mapping
- Manual — value set manually by user on this bill (hover shows "Manually selected")

### 7.5 Remember Prompt Behavior
The "Remember? Yes / No" prompt appears inline under a field after the user changes a value. Appears for: GL Account (header and line level), Class, Payment Account, Payment Method. Does NOT appear for: Job, invoice number, dates, amounts, or reference fields.

Clicking Yes saves to the vendor record as the new default. Clicking No applies to this bill only.

### 7.6 Apply to All Lines
When a user changes a header-level field (GL Account, Class):
- Confirmation: "Apply [Specific Value] to all [N] lines?"
- No, Cancel / Yes, Continue
- After confirming: individual line overrides still possible

### 7.7 Auto-Publish Hold Reasons (Specific, Not Generic)
- "Auto-publish held: job match confidence too low — PO field says '1047 and stock items', needs manual line item assignment"
- "Auto-publish held: new vendor, first invoice requires review"
- "Auto-publish held: possible duplicate — Invoice #48291 from Johnstone Supply already exists in QuickBooks"
- "Auto-publish held: GL account not set for this vendor"
- "Auto-publish held: job '1052' not yet in QuickBooks — waiting for job to sync from FSM"
- "Auto-publish held: payment account required — vendor is set to Mark as Paid but no payment account configured"
- "Auto-publish held: PO discrepancy — invoice amount exceeds PO amount by $47.20, requires review"
- "Auto-publish held: line item total ($298.45) does not match invoice total ($302.05) — difference of $3.60"

### 7.8 Publish Actions

| Feature | Specification |
|---------|---------------|
| Publish to QuickBooks | Primary action. Pre-push validation against cached QB data. Async push, PDF attached, status updated on QB confirmation. If Mark as Paid: two API calls — create bill then create linked bill payment. |
| Bill status states | Draft → Ready → Publishing → Published / Sync Error |
| Unpublish | ONLY available for Sync Error status. Once Published (QB bill ID stored) — no unpublish. Correct in QB directly. |
| Pre-push validation | Vendor in QB, GL account in QB, job in QB if assigned, no duplicate, all required fields, class if required, payment account if mark-as-paid, line item total matches invoice total. All against cache. |
| Delete | Available on any unpublished bill. Moves to Trash. No credit refunded. |
| Reprocess | Re-runs OCR or re-applies vendor defaults. No credit charged. |

---

## 8. Auto-Publish System

### 8.1 Eligibility Checks (All Must Pass)
1. Vendor is set to auto-publish
2. Minimum 5 invoices processed from this vendor
3. Zero extraction errors on last 3 invoices from this vendor
4. Job match confidence above threshold (or hold-for-job-match OFF and no job required)
5. No duplicate invoice number + vendor combination detected
6. All required fields extracted successfully
7. GL account for vendor is set
8. Job exists in QB if a job was matched
9. Not a new vendor (first invoice always goes to inbox)
10. If vendor has Mark as Paid enabled: payment account must be set
11. If PO match exists: no unresolved discrepancies between bill and PO
12. Line item total exactly equals extracted invoice total

### 8.2 Auto-Publish Promotion

| Feature | Specification |
|---------|---------------|
| Eligibility prompt | After 5 accurate invoices: prominent inline prompt in inbox. Not buried in settings. |
| One-tap enable | Active immediately. No navigation to settings required. |
| Per-vendor control | Configured independently per vendor |
| Auto-disable on errors | Auto-publish disabled if error found on auto-published bill. User notified with specific reason. |

---

## 9. QuickBooks Integration

### 9.1 QuickBooks Online (QBO)

| Feature | Specification |
|---------|---------------|
| Connection | OAuth 2.0. Refresh tokens stored securely. Access tokens refreshed automatically. |
| Data pulled | Vendor list (with QB default GL accounts and payment terms), chart of accounts, customer list, job/project list, class list if enabled, open PO list. Jobs refreshed every 15 min. Vendors/accounts refreshed hourly. |
| Bills pushed | Vendor, invoice number, date, due date, Ref No, line items (description, quantity, unit cost, GL account or QB item, job/class per line), total. PDF attached after confirmation. |
| Bill payment pushed | If Mark as Paid: bill payment record created and linked to bill, against specified payment account, for payment date specified. |
| POs pushed | Vendor, PO number, date, line items, job tag. Created as QB Purchase Order records. |
| Async processing | All QBO API calls in background. Rate limiting with exponential backoff. |
| Sync confirmation | Query QB after push to confirm bill exists with QB bill ID. Do not mark Published until confirmed. |

### 9.2 QuickBooks Desktop (QBD)

| Feature | Specification |
|---------|---------------|
| Connection | Intuit Web Connector. Polls BillFlow every 5–30 minutes (contractor-configured). |
| Status | Queued for Sync → Syncing → Published / Sync Error |
| Heartbeat monitoring | Every successful poll records timestamp. If no heartbeat for 2x expected interval: notify user. Auto-clears when connection resumes. |
| Status indicator | Persistent in BillFlow UI: green / yellow / red |
| PDF attachment | Cannot attach PDF to QBD bill record (known QBD limitation). PDF stored in BillFlow. |

### 9.3 QB Account & Class Visibility Management
When QB accounts sync, all accounts are pulled. The company admin controls which are visible in BillFlow dropdowns:
- Automatically pre-filtered to expense and COGS type accounts only (income, equity, liability accounts never shown for bill coding)
- Within that filtered set, individual accounts can be hidden from dropdowns
- Hidden accounts still exist in QB — hidden from BillFlow UI only
- Re-Sync QuickBooks Data button pulls any new accounts added in QB
- Same visibility management available for QB Classes

---

## 10. Inbox & Bill Status Management

### 10.1 Dashboard Home
The BillFlow home screen shows document type cards:

| Card | Shows |
|------|-------|
| Bills | Inbox count, Archived count, Rejected count, Processing count. Direct links to each view. |
| Purchase Orders | Open count, Partially Received count, Rejected count. Direct links. |

QB connection status visible on dashboard. Credit balance visible on dashboard. In-app notification bell shows unread error count.

### 10.2 Bills — Two-Area Architecture

| Area | Contains |
|------|----------|
| Inbox | Unprocessed only: Needs Review, Pending Job Match, Sync Error, Processing. Should be empty or near-empty most days. |
| Archive | All published bills. Searchable, filterable by date/vendor/job/status. Bills auto-move here on confirmed publish. |

### 10.3 Inbox Views
- Needs Review (default): New bills, auto-publish failures with specific reason, Sync Error bills
- Pending Job Match: Bills waiting for QB job to appear. Retry every 2 hours during business hours.
- All Inbox: All unarchived bills

### 10.4 Inbox List View
Columns: Checkbox, Status indicator, Processing status (spinner while in flight), Date, Vendor Name (with open-vendor-in-new-tab icon), Invoice #, Job, GL Account, Total, Paid indicator, Actions

Inline editing: Vendor Account and GL Account editable directly in the list row without opening the bill.

Bulk actions: Select multiple bills → Actions menu → Archive, Reject, Delete, Publish

### 10.5 Activity Log
Two tabs:
- Uploaded Files: Date, user, upload method (email/browser), filename, file size, file status. Duplicate file detection shown inline with "Process Anyway" option.
- Processed Items: Doc ID, user, last action, date, status badge, details (action taken + credits used), source file link. Every action permanently recorded.

### 10.6 Trash
Deleted bills go to Trash with 30-day recovery window. Bills can be restored to inbox during the recovery window. No credit refunded on deletion.

### 10.7 Notifications

| Scenario | Behavior |
|----------|----------|
| Auto-publish working correctly | Silent. Silence is success. |
| Success notifications | On by default. User can disable. |
| Error notifications | Always on. Cannot be disabled. |
| Daily digest | Optional, off by default |
| In-app notification bell | Shows unread error count. |

Error notifications (always on, never silenceable): document sent to wrong capture address, unrecognized sender, PDF unreadable, duplicate detected and held, job match failed after retry exhausted, auto-publish disabled due to error, QB sync error, QBD heartbeat lost.

Success notifications (on by default, can be disabled): bill successfully processed, bill auto-published, PO processed, PO matched to incoming bill.

Notification recipients: Multi-email chip input (multiple addresses). Notify Uploader toggle. Separate recipient lists for errors vs success optional.

---

## 11. Vendor Record

### 11.1 General Tab

| Field | Description |
|-------|-------------|
| vendor_name_extracted | Name as OCR reads it off the PDF. Visible and editable. |
| vendor_name_display | Mapped QB vendor name. Both name fields shown so user sees the mapping. |
| is_visible | Boolean. When OFF: vendor hidden from all dropdowns without being deleted. |
| qb_default_gl_account_id | From QB vendor record |
| billflow_gl_account_id | BillFlow override |
| gl_account_source | enum: qb_default / billflow_override / not_set. Source label shown in UI. |
| qb_default_class_id, billflow_class_id, class_source | Same pattern as GL account |
| qb_payment_terms, billflow_payment_terms, payment_terms_source | Same pattern |
| default_description | Free text. Pre-populates the QB bill memo field for all invoices from this vendor. |
| default_payment_account_id | QB bank or credit card account for Mark as Paid. |
| default_payment_method | enum: check / ach / credit_card / other |
| mark_as_paid_default | Boolean. Default OFF. When ON: bills default to Mark as Paid. |
| auto_publish_enabled | Boolean |
| hold_for_job_match | Boolean. Default OFF. Only relevant when job_costing_enabled is ON. |
| copy_po_to_qb_reference | Boolean. Default ON. |
| known_format | JSON. System-maintained. Platform-wide (shared across all clients). |
| confidence_score / confidence_display | High / Medium / Low. Based on % of last 20 invoices published without correction. |
| invoices_processed | Count |
| last_invoice_date | Date |
| email_domains | Array. Used to pre-identify vendor before OCR. |

### 11.2 Line Items Tab — Stored Line Item Mappings
Shows all remembered line item GL account assignments for this vendor. Each entry: description text → GL account. Created automatically when user clicks "Remember? Yes" on a line item GL account change.

On future invoices: if a line item description matches a stored mapping, that GL account is pre-populated automatically. Source badge shows "Rule."

Users can view, edit, and delete stored mappings on this tab.

### 11.3 Rules Tab — Conditional Line Item Routing
Per-vendor rules engine for more complex GL account routing.

Rule structure:
1. Rule name
2. When a line item is captured and matches: ALL / ANY of the following conditions
3. Conditions: [Field] [Operator] [Value]
   - Fields: Description, Unit Price
   - Operators: equal, contains, begins with, ends with
4. Then map to: [GL Account] or [QB Product/Service]
5. Priority order (drag to reorder when multiple rules could match)

Use cases for HVAC:
- When description contains "refrigerant" → map to Refrigerants expense account
- When description begins with "CEN-" → map to Small Parts Materials
- When unit price greater than $500 → map to Major Equipment
- When description contains "sales tax" → map to Sales Tax Expense

Rules evaluated after stored line item mappings. If both match, rule takes priority.

### 11.4 Inbox Tab
Shows all bills currently in inbox for this vendor. Direct access without navigating back to main inbox.

### 11.5 Archived Tab
Shows all published bills for this vendor. Searchable and filterable by date and invoice number.

---

## 12. Company Settings

### 12.1 Company Details
- Company name, billing email
- QB connection type (QBO / QBD), connection status, connect/disconnect button
- QBD Web Connector status indicator (green/yellow/red) if QBD
- Last QB sync timestamp, Re-Sync QuickBooks Data button

### 12.2 Capture Email
- Bills capture address ([prefix]-bills@billflow.com) with Copy button
- POs capture address ([prefix]-pos@billflow.com) with Copy button
- Prefix editable (must be unique across BillFlow)
- Forwarding setup instructions for Gmail and Outlook
- Notify Uploader toggle

### 12.3 Processing Defaults
- Reference field mapping: what populates QB Ref No field (Invoice Number / PO Number / blank)
- Default due date behavior (Not Required / calculate from payment terms)
- QB Items table toggle (OFF by default)
- Job costing enabled toggle
- FSM platform selection (when job costing enabled)

### 12.4 Account & Class Visibility
- Expense/COGS accounts list from QB — toggle visibility per account
- Class list from QB (if enabled) — toggle visibility per class
- Hidden accounts/classes still exist in QB; hidden from BillFlow dropdowns only
- Re-Sync QuickBooks Data button

### 12.5 Notifications
- Notification email recipients (multi-chip input)
- Success notifications toggle (on by default)
- Error notifications always on — no toggle, with inline explanation of why
- Daily digest toggle (off by default)

### 12.6 Billing & Credits
- Current plan, credit balance, credits used this period
- Transaction history
- Purchase credits / upgrade plan

---

## 13. FSM Materials Entry Export
Only available when job_costing_enabled is ON.

### 13.1 The Problem
No FSM platform supports importing vendor invoice line items as job costs. This export makes manual FSM entry as fast as possible. V1 solution: export file. Direct FSM API writes planned for a later phase.

### 13.2 Export Format
```
Job 1047 — Johnson Mechanical — 123 SE Stark St
  Johnstone Supply — Invoice #48291 — March 15, 2026
    Run Capacitor 45/5 MFD   $18.47   (x1)
    Contactor 24V 40A   $22.13   (x1)
  Wesco — Invoice #W-009341 — March 15, 2026
    Wire 12/2 Romex 250ft   $94.50   (x1)
Job 1047 Total Materials: $134.10
Job 1052 — Riverside Apartments — 4521 NE Broadway
  Johnstone Supply — Invoice #48291 — March 15, 2026
    TXV R410A 2-ton   $67.22   (x1)
Job 1052 Total Materials: $67.22
```

### 13.3 Format Decisions
- Grouped by job. Multiple vendors under one job header.
- Line items: description, cost, quantity. No part number column.
- Quantity at END of line in parentheses, de-emphasized.
- Lines with no job assignment excluded entirely.
- Tax lines excluded from FSM export.

### 13.4 Export Controls
- Date range: default since last export. Last export date tracked automatically.
- Filter by vendor (multi-select)
- Filter by job (multi-select)
- Scope: Published bills only
- Formats: PDF and Excel

---

## 14. Job Profitability View

| Feature | Specification |
|---------|---------------|
| Data source | QB Cost by Job report via API. BillFlow does not maintain parallel calculation. |
| Display | Job number, name, customer name, revenue, material costs, gross profit, margin % |
| Default filter | Jobs with any transaction in last 30 days (activity-based — QB job status fields are unreliable) |
| Date range | Current month, last month, last 90 days, custom, all time |
| V2 | Labor costs from GPS clock-in data added when BillFlow is part of full FSM platform |

---

## 15. Technical Architecture & Data Model

### 15.1 Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend & API | Next.js 15, TypeScript, Tailwind CSS, App Router, Turbopack |
| Database | PostgreSQL via Supabase. Multi-tenant with company_id on all records. |
| Authentication | Supabase Auth. Email/password. |
| File storage | Supabase Storage. Organized by company_id/document_id. |
| Background jobs | Vercel Cron (scheduled). Supabase Edge Functions (event-driven). |
| Email capture | Inbound webhook (SendGrid or Postmark) |
| OCR | Tiered: pdf-parse → Claude API text → Claude vision API |
| QB integrations | QBO: REST API with OAuth 2.0. QBD: Intuit Web Connector. |
| Notifications | Resend (email). Supabase Realtime (in-app). |
| Hosting | Vercel |

### 15.2 Key Data Model Tables

#### companies
```
company_id              uuid, primary key
name                    text
qb_type                 enum: qbo / qbd
qb_connection_status    text
qb_last_sync            timestamp
capture_email_prefix    text (unique)
fsm_platform            enum: hcp / workiz / servicetrade / jobber / other / unknown
job_costing_enabled     boolean, default false
use_items_table         boolean, default false
created_at              timestamp
```

#### vendors
```
vendor_id                    uuid, primary key
company_id                   uuid, foreign key → companies
vendor_name_extracted         text
vendor_name_display           text
qb_vendor_id                  text
qb_vendor_name                text
is_visible                    boolean, default true
qb_default_gl_account_id      text
billflow_gl_account_id        text
gl_account_source             enum: qb_default / billflow_override / not_set
qb_default_class_id           text
billflow_class_id             text
class_source                  enum: qb_default / billflow_override / not_set
qb_payment_terms              text
billflow_payment_terms        text
payment_terms_source          enum: qb_default / billflow_override / not_set
default_description           text
default_payment_account_id    text
default_payment_method        enum: check / ach / credit_card / other
mark_as_paid_default          boolean, default false
auto_publish_enabled          boolean, default false
hold_for_job_match            boolean, default false
copy_po_to_qb_reference       boolean, default true
invoices_processed            integer, default 0
confidence_score              decimal (0.00-1.00)
confidence_display            enum: high / medium / low
known_format                  jsonb
email_domains                 text[]
last_invoice_date             date
created_at                    timestamp
```

#### vendor_line_item_mappings
```
id                  uuid, primary key
vendor_id           uuid, foreign key → vendors
company_id          uuid, foreign key → companies
description_text    text
gl_account_id       text
qb_item_id          text (nullable)
created_at          timestamp
```

#### vendor_line_item_rules
```
id                  uuid, primary key
vendor_id           uuid, foreign key → vendors
company_id          uuid, foreign key → companies
rule_name           text
match_type          enum: all / any
conditions          jsonb
gl_account_id       text (nullable)
qb_item_id          text (nullable)
priority            integer
created_at          timestamp
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
line_items_total        decimal(10,2)
vendor_po_reference     text
qb_reference_number     text
description             text
status                  enum: draft / ready / publishing / published / sync_error
publish_method          enum: manual / auto
qb_bill_id              text
qb_sync_status          text
qb_sync_error           text
autopublish_hold_reason text
mark_as_paid            boolean, default false
payment_account_id      text
payment_method          enum: check / ach / credit_card / other
payment_date            date
payment_ref_number      text
qb_payment_id           text
pdf_url                 text
capture_source          enum: email / upload
deleted_at              timestamp (soft delete — Trash)
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
gl_account_id           text
gl_account_source       enum: qb_default / billflow_override / rule / stored_mapping / manual
qb_item_id              text (nullable)
job_id                  text (nullable)
class_id                text (nullable)
is_tax_line             boolean, default false
extraction_confidence   decimal(0.00-1.00)
sort_order              integer
```

#### purchase_orders
```
po_id                   uuid, primary key
company_id              uuid, foreign key → companies
vendor_id               uuid, foreign key → vendors
po_number               text
order_date              date
expected_delivery_date  date
job_id                  text (nullable)
status                  enum: open / partially_received / received / closed
qb_po_id                text
pdf_url                 text
capture_source          enum: email / upload
created_by              uuid (user_id)
created_at              timestamp
```

#### po_line_items
```
line_id                 uuid, primary key
po_id                   uuid, foreign key → purchase_orders
company_id              uuid, foreign key → companies
description             text
quantity_ordered        decimal(10,4)
quantity_received       decimal(10,4), default 0
unit_cost               decimal(10,2)
extended_cost           decimal(10,2)
gl_account_id           text
job_id                  text (nullable)
sort_order              integer
```

#### receiving_records
```
id                      uuid, primary key
po_id                   uuid, foreign key → purchase_orders
company_id              uuid, foreign key → companies
received_by             uuid (user_id)
received_at             timestamp
notes                   text
line_items              jsonb
```

#### qb_accounts_visibility
```
id                      uuid, primary key
company_id              uuid, foreign key → companies
qb_account_id           text
is_visible              boolean, default true
```

#### qb_classes_visibility
```
id                      uuid, primary key
company_id              uuid, foreign key → companies
qb_class_id             text
is_visible              boolean, default true
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
document_id             uuid (bill_id or po_id)
document_type           enum: bill / po
action                  text
actor                   text (user_id or 'system')
credits_used            integer
timestamp               timestamp
before_state            jsonb
after_state             jsonb
-- Append-only. Never deleted.
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
company_id              uuid, primary key
last_heartbeat_at       timestamp
last_sync_at            timestamp
connector_status        enum: running / overdue / alert
```

### 15.3 Dropdown Search Standard (ALL Dropdowns)
Every dropdown in BillFlow follows this pattern:
- Type anything → real-time filter against all relevant fields
- Most recently created/used items shown first before typing
- Arrow keys navigate, Enter selects, Escape cancels
- Each result shows enough context: job dropdown shows job number + job name + customer name
- Accounts filtered by visibility settings (hidden accounts never appear)

### 15.4 Build Order
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

---

## 16. Accuracy Standard
Validate against 20-30 real vendor invoices from pilot contractor covering multiple vendors (Johnstone Supply, Wesco, Ferguson, Gensco). Process each through BillFlow and through QBO native capture. BillFlow must win on accuracy before launch.

---

## 17. Relationship to FSM Platform
BillFlow is built first as standalone product. ~90% of BillFlow code is reused in the full Field Service Intelligence Platform built later. BillFlow is not a prototype — it is a real product.

---

## 18. Future Phases (Post-Launch)
- V1.5: Mobile camera capture of packing slips for receiving
- V2: Push notifications to technicians when their orders arrive. Direct FSM API writes for vendor invoice job cost import.
- V3: Push receiving status to FSM. Update job status to show parts on hand. Labor costs in job profitability view from GPS clock-in data.
- Later: Full Field Service Intelligence Platform (scheduling, dispatching, full job management)

---
*Document version: 4.0 | May 2026 | Confidential*
