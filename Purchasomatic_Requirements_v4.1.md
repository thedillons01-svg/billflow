# Purchasomatic — Requirements Updates v4.1
**Changes and additions since v4.0**
May 2026 — Confidential

**Note:** This document supplements BillFlow_Requirements_v4.md (the product is now named Purchasomatic). Read v4.0 first, then apply these updates. Where v4.1 conflicts with v4.0, v4.1 takes precedence.

---

## 1. Product Name Change
The product has been renamed from **BillFlow** to **Purchasomatic**.
- Domain: purchasomatic.com
- All references to "BillFlow" in code, UI, emails, and documentation should read "Purchasomatic"
- Dev/test email remains: billflowdev@gmail.com (do not rename this)
- GitHub repo and Supabase project names updated accordingly

---

## 2. QB Customer & Sub-Customer Hierarchy

### 2.1 Background
QuickBooks supports two levels of job tagging on transaction line items:
- **Customers** — top level (e.g. "Riverside Apartments LLC")
- **Sub-customers / Jobs** — children of customers (e.g. "Job 1052 — Roof Unit Replacement")

In QBO, users can tag to either level. In QBD, tagging was historically limited to sub-customers. Not all businesses use sub-customers — some tag directly to customers. PM must support both.

### 2.2 Company-Level Setting: Job Tagging Level
New company-level setting controls what appears in all job/customer tagging dropdowns:

| Option | Behavior |
|--------|----------|
| Jobs / Sub-customers only (default) | Only sub-customers appear in tagging dropdowns. Matches FSM contractor model. |
| Customers only | Only top-level customers appear. For businesses with no job hierarchy. |
| Both | Full hierarchy shown — customers and sub-customers together. |

### 2.3 Data Model Update — qb_jobs_cache
Add `parent_id` field to support hierarchy:
```
parent_id    text (nullable) — qb_customer_id of the parent customer, null if top-level
is_customer  boolean — true if this is a top-level customer, false if sub-customer/job
```

### 2.4 Tagging Dropdown Display
When Job Tagging Level is set to "Both," the dropdown shows hierarchy visually:
```
Riverside Apartments LLC
  └ Job 1052 — Roof Unit Replacement
  └ Job 1061 — Lobby HVAC
Smith Family
  └ Job 1047 — Smith Residence
```
Parent customers are selectable. Sub-customers are indented beneath their parent.

---

## 3. Job Status Management

### 3.1 Job Status Field
Add `status` field to `qb_jobs_cache`: `active` / `closed`. Default: active.

### 3.2 Manual Close
- Add "Close Job" action on the job list view
- Closed jobs are hidden from all tagging dropdowns and FSM export filters by default
- Add "Include closed jobs" toggle on FSM export and all job dropdowns for historical access

### 3.3 Auto-Close
New company-level setting: **Auto-close jobs after X days of inactivity**
- Default: 90 days
- Can be disabled entirely
- Inactivity = no bill line items, PO lines, or receiving records tagged to the job in X days
- Uses activity-based detection, not QB job status fields (which are unreliable)

### 3.4 Job Reopening
Two ways to reopen a closed job:

**From Closed Jobs view:**
- Accessible from the Jobs section in the sidebar
- Shows all closed jobs with close date and last activity date
- "Reopen" button on each row — moves job back to active status

**From tagging dropdowns:**
- When user types a job name that is closed, it appears at the bottom of search results with a "Closed" badge
- Shows "Reopen & Select" option — reopens the job and selects it in one action
- No need to navigate away from the bill review screen

---

## 4. FSM Materials Entry Export — Full Update

### 4.1 Content Selection
Replace bills-only export with multi-type export. Add checkboxes to export UI:

| Checkbox | Default | Description |
|----------|---------|-------------|
| Purchase Orders | ✓ checked | Include PO line items grouped by job |
| Receiving Records | ✓ checked | Include receiving records grouped by job |
| Invoiced Bills | ✓ checked | Include published bill line items grouped by job |

### 4.2 Updated Export Format
Group by job. Within each job, show separate labeled sections for each selected transaction type.

```
Job 1047 — Smith Residence — 4521 NE Hancock St

  PURCHASE ORDERS
    Gensco — PO-2026-1047 — Ordered May 19 by Jim Larsen
      TXV R-410A 2-Ton                    (x1)
      Run Capacitor 45/5 MFD 440V Round   (x2)
      Refrigerant R-410A 25 lb Cylinder   (x2)

  RECEIVING
    Gensco — PO-2026-1047 — Received May 22 by Heather Dillon
      TXV R-410A 2-Ton                    Received (x1)
      Run Capacitor 45/5 MFD 440V Round   Received (x2)
      Refrigerant R-410A 25 lb Cylinder   Not yet received

  INVOICED
    Gensco — Invoice #48502 — May 22
      Run Capacitor 45/5 MFD   $18.47   (x2)
      TXV R-410A 2-Ton         $67.22   (x1)

Job 1047 Total Invoiced Materials: $153.66
```

**Format rules:**
- If only one transaction type selected, omit section headers — just show that data
- PO section: no pricing if original PO had no pricing
- Receiving section: per-line received quantities and status (Received / Partially Received / Not yet received)
- Invoiced section: always shows pricing
- Tax lines excluded from all sections
- Lines with no job assignment excluded entirely
- Job total shown for invoiced materials only (not PO estimates or receiving)
- Receiving and invoicing are independent — do not exclude receiving records because an invoice exists, or vice versa

### 4.3 Updated Export Controls

| Control | Specification |
|---------|---------------|
| Include checkboxes | Purchase Orders / Receiving Records / Invoiced Bills — all checked by default |
| Date range | Default since last export. Manual date picker. |
| Filter by vendor | Searchable dropdown multiselect. Shows "All vendors" when nothing selected. Shows selected count when items chosen. Only vendors with transactions in date range shown. |
| Filter by job | Searchable dropdown multiselect. Most recently active jobs first. Shows job number + job name + customer name. Only jobs with transactions in date range shown. Quick filter: Last 30 days / Last 90 days / All time. |
| Include closed jobs | Toggle, off by default. When on: closed jobs appear in job filter. |
| Format | PDF and Excel |

### 4.4 Job Filter — Activity-Based
The job filter only shows jobs that have at least one transaction (bill line item, PO line, or receiving record) tagged to them within the selected date range. If no date range selected, shows all jobs with any transaction ever. This prevents the filter from becoming an unmanageably long list of all QB customers.

---

## 5. Company Settings Additions

New settings added to the Processing Defaults section:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Job Tagging Level | enum: jobs_only / customers_only / both | jobs_only | Controls what appears in job tagging dropdowns throughout the app |
| Auto-close jobs after inactivity | integer (days) or disabled | 90 days | Automatically closes jobs with no activity after this many days |

---

## 6. Build Order Additions
The following items are added to the build sequence after the original 23 steps:

24. QB customer/sub-customer hierarchy support (parent_id field, tagging level setting)
25. Job status management (close, auto-close, reopen)
26. FSM export update (multi-type content, updated controls, activity-based job filter)

---

## 7. Corrections to v4.0

### 7.1 Capture Email Addresses
All capture addresses use the Purchasomatic domain:
- `[prefix]-bills@purchasomatic.com`
- `[prefix]-pos@purchasomatic.com`

### 7.2 Pricing Tiers (Stripe)
Credit bundles currently configured in Stripe (test mode):
- Starter: 50 credits / $20 per month
- Basic: 100 credits / $40 per month
- Professional: 500 credits / $190 per month
- Business: 200 credits / $76 per month

Note: Pricing tiers should be reviewed before going live — the "per month" recurring model may need to be reconsidered vs one-time credit bundles.

---
*Document version: 4.1 | May 2026 | Confidential*
