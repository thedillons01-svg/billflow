# SEO log

## 2026-10-05
**Changed (invisible, master):** Article JSON-LD on all 4 posts now has publisher url + logo ImageObject and an image (Google Article rich-result fields).
**Visible, waiting on seo/visible (PR #3):** new post "How to Enter Vendor Bills in QuickBooks Desktop" with FAQ/JSON-LD, registered in posts.ts. After merge: add it to public/llms.txt key pages (invisible, do not link before it's live) and add its link to sitemap (automatic).
**Checks:** tsc and next build pass on master and seo/visible. Visibility check due ~2026-10-07.
**Backlog (top):**
1. After PR #3 merges: add new post to llms.txt.
2. Add QBD FAQ to home (visible, seo/visible).
3. Article on matching POs to bills in QuickBooks (next Monday 2026-10-12).
4. Visibility check 2026-10-07.
5. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-02
**Changed (invisible, master):**
- Page-level Open Graph on home, pricing, help, blog index and all 4 posts now includes siteName and the logo image (previously overridden to none).
- Home SoftwareApplication JSON-LD: added featureList and a separate free-trial Offer (25 credits, $0) alongside the $20 starting plan.
**Checks:** tsc and next build pass. Visibility check not due until ~2026-10-07.
**Visible changes waiting on seo/visible:** none (branch not created yet).
**Backlog (top):**
1. Monday 2026-10-05 article (visible, seo/visible): QuickBooks Desktop vendor bill / PDF invoice import + FAQ.
2. Add QBD FAQ to home (visible).
3. Article on matching POs to bills in QuickBooks.
4. Fix 9 pre-existing eslint errors in public pages.
5. Weekly visibility check on 2026-10-07.

## 2026-10-01
**Changed (invisible, master):**
- BreadcrumbList JSON-LD on all 4 blog posts (new src/app/blog/breadcrumb-jsonld.tsx).
- Site-wide default Open Graph (siteName, locale, logo image) and Twitter card in root layout. Note: pages that define their own openGraph override these defaults.
- sitemap.ts: replaced `new Date()` lastModified with fixed dates so the value only changes when content does.
**Checks:** tsc and next build pass. Visibility check skipped (done 2026-09-30; next due ~2026-10-07).
**Visible changes waiting on seo/visible:** none (branch not created yet).
**Backlog (top):**
1. Monday 2026-10-05 article (visible, seo/visible): QuickBooks Desktop vendor bill / PDF invoice import + FAQ.
2. Add QBD FAQ to home (visible) now that Pricing/Help say Desktop is supported.
3. Add og:image to page-level openGraph on home/pricing/blog posts (invisible).
4. Article on matching POs to bills in QuickBooks.
5. Fix 9 pre-existing eslint errors in public pages (visible-neutral but touches code).

## 2026-09-30 (first run)
**Checked:** metadata on all public pages, robots, sitemap, structured data, llms.txt (absent).
**Changed:**
- Fixed doubled title suffix ("Pricing — Purchasomatic | Purchasomatic") on pricing, help, privacy, terms.
- Added canonical URLs + Open Graph on home, pricing, help, blog index; canonical on privacy/terms; added meta descriptions to privacy/terms.
- Added canonical + OG to the two older posts (vendor-invoices, purchase-orders) that lacked them.
- Added Organization JSON-LD on home; FAQPage JSON-LD on pricing.
- Added public/llms.txt.
**Visibility check (4 searches):** purchasomatic.com did NOT appear for "import vendor invoices into QuickBooks Desktop automatically", "match purchase orders to vendor invoices QuickBooks automatically", or "automate job costing materials invoices QuickBooks contractor". Results were dominated by Intuit community/support threads, third-party AP-automation vendor blogs, and contractor-software blogs. Brand search "purchasomatic" shows only /help (and Samuel Purchas noise); home/pricing not shown.
**Open issue:** pricing FAQ and help page say QuickBooks Desktop is "in development", but code has a Web Connector implementation and blog/llms.txt say Desktop is supported. Owner should confirm and align copy.
**Lint:** 9 pre-existing eslint errors (react/no-unescaped-entities etc.) in public pages; not from this work. `next lint` isn't configured (script is `eslint`).
**Queued ideas:**
- Monday article: "Enter a vendor bill in QuickBooks Desktop" / QBD PDF invoice import (gap seen in search).
- Article on matching POs to bills in QuickBooks (manual steps + flags mismatches).
- BreadcrumbList on posts; add FAQ + canonical-style JSON-LD parity to the two older posts; image alt audit on home.
- Resolve the QBD copy conflict above, then add QBD FAQ to home.
- Re-run brand search next week to see whether home gets indexed.
