# Purchasomatic — Design System & UI Specification

Read this file before writing any UI code. All visual decisions are made here. Do not invent colors, spacing, or component patterns — use what is defined in this document.

---

## 1. Color Tokens

### Brand Colors
```
--bf-green-dark:     #1A3D2B   /* Sidebar logo header, used sparingly */
--bf-green-mid:      #2DB87A   /* Primary action color — buttons, active tabs, badges, links */
--bf-green-light:    #EBF5EF   /* Sidebar nav background, active nav item fill */
--bf-green-border:   #C3DEC9   /* Sidebar border, green-tinted dividers */
--bf-green-page-bg:  #F7F9F8   /* Main content area background (very light green tint) */
```

### Status Colors
```
--bf-status-review-bg:    #FEF3C7   /* Amber — Needs Review badge background */
--bf-status-review-text:  #92400E   /* Amber — Needs Review badge text */
--bf-status-ready-bg:     #D1FAE5   /* Green — Ready badge background */
--bf-status-ready-text:   #065F46   /* Green — Ready badge text */
--bf-status-error-bg:     #FEE2E2   /* Red — Sync Error / Error badge background */
--bf-status-error-text:   #991B1B   /* Red — Sync Error / Error badge text */
--bf-status-pending-bg:   #EDE9FE   /* Purple — Pending Job Match badge background */
--bf-status-pending-text: #5B21B6   /* Purple — Pending Job Match badge text */
--bf-status-processing-bg: #DBEAFE  /* Blue — Processing badge background */
--bf-status-processing-text: #1E40AF /* Blue — Processing badge text */
```

### Neutral Colors
Use Tailwind/CSS variables for all neutral surfaces and text — never hardcode grays.
```
Background primary:    var(--color-background-primary)    /* White — cards, content areas */
Background secondary:  var(--color-background-secondary)  /* Off-white — table alternating rows, inputs */
Background tertiary:   var(--color-background-tertiary)   /* Light gray — page background fallback */
Text primary:          var(--color-text-primary)          /* Near-black — main content */
Text secondary:        var(--color-text-secondary)        /* Mid-gray — labels, metadata, subtitles */
Text tertiary:         var(--color-text-tertiary)         /* Light gray — placeholder, hints */
Border tertiary:       var(--color-border-tertiary)       /* Default borders — 0.5px */
Border secondary:      var(--color-border-secondary)      /* Emphasized borders — hover states */
```

### Inline Reason Colors (auto-publish hold reasons shown under vendor name in list)
```
Warning reason:  #D97706   /* Amber text — job match issues, configuration warnings */
Error reason:    #DC2626   /* Red text — sync errors, extraction failures */
Info reason:     #2563EB   /* Blue text — informational holds */
```

---

## 2. Typography

Font: system font stack via `font-sans`. Never import external fonts.

```
Page title:        16px, weight 500, color: text-primary
Page subtitle:     12px, weight 400, color: text-secondary
Section heading:   14px, weight 500, color: text-primary
Table header:      10px, weight 500, uppercase, letter-spacing: 0.06em, color: text-secondary
Table body:        13px, weight 400 (vendor name: 500), color: text-primary
Table metadata:    11px, weight 400, color: text-secondary  (invoice #, job name under vendor)
Form label:        12px, weight 500, color: text-secondary
Form input:        13px, weight 400, color: text-primary
Helper text:       11px, weight 400, color: text-secondary  (inline explanations under fields)
Badge text:        10px, weight 500
Reason text:       11px, weight 400  (auto-publish hold reason shown under vendor name)
Nav item:          12px, weight 400 (active: 500)
```

---

## 3. Layout & Spacing

### Page Shell
```
Sidebar width:    160px, fixed
Content area:     flex: 1, min-width: 0
Page background:  #F7F9F8 (bf-green-page-bg)
```

### Sidebar Structure
The sidebar has two distinct zones — never merge them:

**Zone 1 — Logo header (dark)**
```
Background:  #1A3D2B (bf-green-dark)
Padding:     14px 12px
Content:     Logo mark + "Purchasomatic" wordmark
Logo mark:   26x26px, background #2DB87A, border-radius 6px, white "B" at 11px/700
```

**Zone 2 — Navigation (light)**
```
Background:  #EBF5EF (bf-green-light)
Border-right: 0.5px solid #C3DEC9
Nav item padding: 7px 12px
Nav item height: ~32px
Icon size:   14px, Tabler outline icons, color inherits from text
Gap between icon and label: 8px
```

**Active nav item:**
```
Background:    #C3DEC9
Border-left:   2px solid #2DB87A
Color:         #1A3D2B
Font-weight:   500
```

**Inactive nav item:**
```
Color:  #5A8C6A (muted green — not gray, not full dark green)
Hover:  background #D9EDE0
```

**Footer (bottom of sidebar):**
```
Border-top:  0.5px solid #C3DEC9
Padding:     10px 12px
Content:     User email at 10px, color #5A8C6A
```

### Content Area
```
Page header:       background white, padding 14px 20px, border-bottom 0.5px
Tab bar:           background white, padding 0 20px, border-bottom 0.5px
Table/list area:   background white
Page bg:           #F7F9F8 shows between white cards
Card padding:      16px 20px
```

### Spacing Scale
```
4px   — between badge elements
6px   — between icon and small text
8px   — between icon and nav label, between small related elements
12px  — between form fields in a row
16px  — standard section gap, table row padding horizontal
20px  — page content horizontal padding
24px  — between major sections
```

---

## 4. Components

### 4.1 Sidebar Nav Item
```jsx
// Active
<div className="flex items-center gap-2 px-3 py-[7px] text-[#1A3D2B] font-medium text-xs bg-[#C3DEC9] border-l-2 border-[#2DB87A]">
  <i className="ti ti-file-invoice text-sm" />
  Bills
</div>

// Inactive
<div className="flex items-center gap-2 px-3 py-[7px] text-[#5A8C6A] text-xs hover:bg-[#D9EDE0] cursor-pointer">
  <i className="ti ti-home text-sm" />
  Home
</div>
```

### 4.2 Status Badges
Small pill badges shown in inbox list and on bill detail.
```
Border-radius: 4px (slightly rounded square, not pill)
Padding:       3px 8px
Font-size:     10px
Font-weight:   500
```

Use these exact classes or inline styles:
```
Needs Review:       bg #FEF3C7, text #92400E
Ready:              bg #D1FAE5, text #065F46
Sync Error:         bg #FEE2E2, text #991B1B
Pending Job Match:  bg #EDE9FE, text #5B21B6
Processing:         bg #DBEAFE, text #1E40AF
Published:          bg #D1FAE5, text #065F46
Draft:              bg var(--color-background-secondary), text var(--color-text-secondary)
```

### 4.3 Tab Bar
Tabs that switch between inbox views (Needs Review / Pending Job Match / Archive).
```
Container:    background white, border-bottom 0.5px solid border-tertiary, padding 0 20px
Tab item:     padding 10px 14px, font-size 12px, cursor pointer
Active tab:   color #1A3D2B, font-weight 500, border-bottom 2px solid #2DB87A, margin-bottom -1px
Inactive tab: color text-secondary, hover color text-primary
Count badge:  background #2DB87A, color white, font-size 9px, padding 1px 6px, border-radius 10px, margin-left 4px
```

### 4.4 Primary Button
```
Background:    #2DB87A
Color:         white
Font-size:     13px
Font-weight:   500
Padding:       7px 16px
Border-radius: 6px
Border:        none
Hover:         background #28A36E
Active:        background #1F8A5C
```

### 4.5 Secondary Button
```
Background:    white
Color:         text-primary
Font-size:     13px
Border:        0.5px solid border-secondary
Padding:       7px 16px
Border-radius: 6px
Hover:         background background-secondary
```

### 4.6 Destructive Button
```
Background:    white
Color:         #991B1B
Border:        0.5px solid #FCA5A5
Padding:       7px 16px
Border-radius: 6px
Hover:         background #FEE2E2
```

### 4.7 Inbox List Row
```
Layout:        CSS grid, columns defined per view (see Section 6)
Padding:       10px 20px
Border-bottom: 0.5px solid border-tertiary
Background:    alternating white / background-secondary
Hover:         background #F0FAF4 (very light green tint)
Cursor:        pointer
```

Vendor cell layout (stacked):
```
Line 1: vendor name — 13px, weight 500, text-primary
Line 2: invoice # or auto-publish reason — 11px, weight 400
        If reason: color based on reason type (warning #D97706, error #DC2626)
        If metadata: color text-secondary
```

### 4.8 Form Fields
```
Input/Select:
  Height:        36px
  Border:        0.5px solid border-secondary
  Border-radius: 6px
  Padding:       0 10px
  Font-size:     13px
  Background:    white
  Focus:         border-color #2DB87A, outline none, box-shadow 0 0 0 2px rgba(45,184,122,0.15)

Textarea:
  Min-height:    80px
  Same border/radius/padding as input
  Resize:        vertical only

Label:
  Font-size:     12px
  Font-weight:   500
  Color:         text-secondary
  Margin-bottom: 4px

Helper text (inline explanation below field):
  Font-size:     11px
  Color:         text-secondary
  Margin-top:    3px
  Line-height:   1.5
```

Every field must have helper text. This is a standing requirement, not optional.

### 4.9 Remember Prompt
Appears inline under a field immediately after user changes: GL Account (header or line), Class, Payment Account, Payment Method. Does NOT appear for Job, dates, amounts, reference fields.

```
Layout:       flex row, gap 8px, margin-top 4px
Text:         "Remember this for [Vendor Name]?" — 11px, text-secondary
Yes button:   11px, color #2DB87A, font-weight 500, cursor pointer, no border/bg
No button:    11px, color text-secondary, cursor pointer, no border/bg
Separator:    " / " between Yes and No
```

### 4.10 Field Source Badge
Small label shown on GL Account, Class, and Payment fields indicating where the value came from.
```
Layout:       inline, shown to the right of the field label or below it
Font-size:    10px
Font-weight:  500
Padding:      1px 6px
Border-radius: 3px

QB:       bg #DBEAFE, text #1E40AF      (value from QuickBooks vendor record)
Purchasomatic: bg #D1FAE5, text #065F46      (value set as Purchasomatic override)
Rule:     bg #EDE9FE, text #5B21B6      (applied by line item rule or stored mapping)
Manual:   bg #F3F4F6, text #374151      (set manually by user on this bill — hover: "Manually selected")
```

### 4.11 Apply to All Lines Confirmation Dialog
Triggered when user changes GL Account or Class at the header level.
```
Modal:        centered, max-width 400px, white bg, border-radius 8px, padding 20px 24px
Overlay:      rgba(0,0,0,0.35)
Title:        "Apply to all lines?" — 14px, weight 500
Body:         "Apply [Specific Value Name] to all [N] line items?" — 13px, text-secondary
              Show the exact value name and exact count — never generic
Buttons:      row, gap 8px, justify-content flex-end
              Cancel: secondary button
              Yes, Continue: primary button (#2DB87A)
```

### 4.12 Notification Bell
```
Position:     top-right of page header
Icon:         ti-bell, 18px, text-secondary
Badge:        absolute positioned, top-right of icon
              Background: #E53E3E, border-radius 50%, 10px diameter
              Border: 2px solid white (creates separation from icon)
              Number: 9px, white, font-weight 700
              Hidden when count is 0
```

### 4.13 QB Connection Status Indicator (QBD only)
```
Green dot:   connected and current — background #2DB87A
Yellow dot:  connected but overdue — background #F59E0B
Red dot:     heartbeat lost — background #DC2626
Dot size:    8px diameter, border-radius 50%
Label:       12px, text-secondary, margin-left 6px
```

---

## 5. Bill Review Screen Layout

The bill review screen is the most important UI in Purchasomatic. Get this right.

```
Layout:       two-column split, flex row, full viewport height minus sidebar/header
Left panel:   form, min-width 480px, max-width 560px, scrollable independently
Right panel:  PDF viewer, flex: 1, scrollable independently
Divider:      0.5px solid border-tertiary
```

### Left Panel — Form Sections

**Section headers** (INVOICE DETAILS, LINE ITEMS, PAYMENT):
```
Font-size:     10px
Font-weight:   500
Uppercase:     yes
Letter-spacing: 0.08em
Color:         text-secondary
Margin-bottom: 8px
Padding-top:   16px
Border-top:    0.5px solid border-tertiary (except first section)
```

**Totals reconciliation bar** — always visible, never hidden:
```
Layout:       flex row, justify-content space-between, padding 8px 0
Header total: "Invoice total: $324.09" — 12px, text-secondary
Line items sum: "Line items: $324.09" — 12px, text-secondary
Match state:  ✓ green checkmark when equal, ✗ red warning with difference amount when not equal
Position:     Between line items section and publish button — always visible
```

**Publish button area** (sticky at bottom of left panel):
```
Position:     sticky bottom-0, background white, border-top 0.5px solid border-tertiary
Padding:      12px 16px
Layout:       flex, justify-content space-between
Left side:    Delete button (destructive), Reprocess button (secondary)
Right side:   Publish to QuickBooks button (primary, #2DB87A)
```

### Right Panel — PDF Viewer
```
Background:   background-secondary
Empty state:  centered icon (ti-file, 48px, text-tertiary) + "No PDF attached" (14px, text-secondary) + helper text
```

---

## 6. Inbox List Column Layouts

### Bills Inbox
```css
grid-template-columns: 32px 1.8fr 0.9fr 0.7fr 0.9fr 0.9fr 80px
/* checkbox | vendor+reason | invoice# | date | job | total | status */
```

### Purchase Orders Inbox
```css
grid-template-columns: 32px 1.8fr 0.9fr 0.7fr 0.9fr 80px
/* checkbox | vendor | PO# | date | job | status */
```

---

## 7. Inline Explanations — Required Everywhere

Every field, toggle, and setting must have helper text. This reduces support volume and builds user confidence. Never skip this, even during initial implementation.

**Format:** A single sentence or two in plain English, 11px, text-secondary, directly below the field.

**Examples:**
- GL Account: "The expense account this vendor's invoices will post to in QuickBooks. Purchasomatic will use this as the default for all line items."
- Auto-publish: "When enabled, invoices from this vendor are automatically pushed to QuickBooks without review — as long as all eligibility checks pass."
- Hold for Job Match: "When on, bills from this vendor will wait in the Pending Job Match queue until a matching job is found in QuickBooks before publishing."
- Mark as Paid: "Bills will be published to QuickBooks already marked as paid, using the payment account and method set below. Use this for vendors you always pay by credit card on order."
- Capture Line Items: "Line item extraction is always on in Purchasomatic and included in the base credit cost. All invoice line items are captured automatically."
- Error notifications: "Error notifications cannot be turned off. If something goes wrong with an invoice, you need to know about it."

---

## 8. Empty States

Every list and inbox view needs a proper empty state.

**Inbox empty (the goal state):**
```
Icon:    ti-circle-check, 48px, #2DB87A
Title:   "You're all caught up" — 16px, weight 500, text-primary
Body:    "No invoices need your attention. Auto-publish is running in the background." — 13px, text-secondary
```

**No bills yet (new account):**
```
Icon:    ti-mail-forward, 48px, text-tertiary
Title:   "No invoices yet" — 16px, weight 500, text-primary
Body:    "Forward a vendor invoice to [prefix]-bills@purchasomatic.com to get started." — 13px, text-secondary
Action:  "View setup instructions" — link, #2DB87A
```

**No PDF attached:**
```
Icon:    ti-file, 48px, text-tertiary
Title:   "No PDF attached" — 14px, weight 500, text-secondary
Body:    "PDFs captured via email will appear here automatically." — 12px, text-tertiary
```

---

## 9. Page Header Pattern

Every page has a consistent header:
```
Background:    white
Padding:       14px 20px
Border-bottom: 0.5px solid border-tertiary
Layout:        flex, justify-content space-between, align-items center

Left side:
  Title:     16px, weight 500, text-primary
  Subtitle:  12px, weight 400, text-secondary, margin-top 2px

Right side:
  Primary action button (if applicable)
  Notification bell (on dashboard and inbox only)
```

---

## 10. Color Application Rules

- **#2DB87A** — primary actions only: buttons, active tab underline, active nav border, count badges, focus rings, checkmarks. Never use as a background for large areas.
- **#1A3D2B** — sidebar logo header only. Never use elsewhere.
- **#EBF5EF / #C3DEC9** — sidebar nav background and borders only.
- **#F7F9F8** — page background only. Content cards sit on this.
- Status colors (amber/red/green/purple/blue) — status badges and inline reason text only. Never use as button colors or general UI accents.
- All neutral surfaces, text, and borders: CSS variables only. Never hardcode grays.

---

## 11. Tabler Icons Reference

Use Tabler outline icons throughout. Never use filled variants. Common icons for Purchasomatic:

```
ti-home              — Home nav
ti-file-invoice      — Bills nav
ti-users             — Vendors nav
ti-clipboard-list    — Purchase Orders nav
ti-package           — Receiving nav
ti-chart-bar         — Job Profitability nav
ti-settings          — Settings nav
ti-bell              — Notification bell
ti-circle-check      — Success / all caught up
ti-mail-forward      — Email forwarding / empty state
ti-file              — No PDF attached
ti-external-link     — Open in new tab (vendor icon in bill review)
ti-refresh           — Reprocess / re-sync
ti-upload            — Upload document
ti-download          — Export / download
ti-trash             — Delete
ti-edit              — Edit
ti-copy              — Copy capture address
ti-circle-dot        — Connection status indicators
ti-clock             — Processing / pending
ti-alert-triangle    — Warning / error
ti-check             — Checkmark / match confirmed
ti-x                 — Delete line item
ti-plus              — Add line item
ti-chevron-down      — Dropdown indicator
ti-arrow-left        — Back navigation
ti-search            — Search
ti-filter            — Filter
```

---

## 12. What Not To Do

- No gradient backgrounds, drop shadows, or blur effects
- No dark sidebar throughout — dark green is logo header only
- No generic gray sidebar (the AutoEntry/current design problem)
- No all-caps text except table column headers
- No inline SVG icons — use Tabler icon font only
- No hardcoded gray hex values — use CSS variables
- No missing helper text — every field needs an explanation
- No generic confirmation dialogs — always show the specific value name and count
- No pill-shaped status badges — use slightly rounded squares (border-radius 4px)
- No color that isn't defined in this document
- Never hide the totals reconciliation bar on the bill review screen
- Never use #2DB87A as a background for large areas — accent use only
```

---
*Design version: 1.0 | May 2026*
