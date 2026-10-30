# SEO log

## 2026-10-30
**Changed (invisible, master):** Added quick answers on tax lines, remembered line coding and wrong-address rejection to llms.txt and llms-full.txt; sitemap lastModified bumped to 2026-10-30.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3.5 weeks). No new article (Friday).
**Checks:** tsc and next build pass.
**Visibility check:** not due (next 2026-11-04).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt and llms-full.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add FAQ sections to the two older posts; QBD FAQ on home (visible, seo/visible).

## 2026-10-29
**Changed (invisible, master):** Added a Mark as Paid quick answer (per-vendor, linked bill payment, off by default) to llms.txt and llms-full.txt; sitemap lastModified bumped to 2026-10-29.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3.5 weeks). No new article (Thursday).
**Checks:** npm ci, tsc and next build pass.
**Visibility check:** not due (last 2026-10-28; next 2026-11-04).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt and llms-full.txt.
2. Owner: verify site in Google Search Console and submit sitemap (site appears unindexed).
3. Add FAQ sections to the two older posts; QBD FAQ on home (visible, seo/visible).

## 2026-10-28
**Changed (invisible, master):** llms.txt Quick answers: added QuickBooks Desktop automatic entry (no CSV step), PO price/quantity mismatch flagging, and job matching (never creates jobs); sitemap lastModified bumped to 2026-10-28.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3 weeks). No new article (Wednesday).
**Visibility check (5 searches):** purchasomatic.com absent everywhere, including the brand search "purchasomatic" (no results at all, site still looks unindexed). "import vendor invoices into QuickBooks Desktop automatically": SaasAnt, Lido, Intuit community, commonsku; results say QBD has no built-in automation (CSV/IIF only), an open angle. "email vendor invoices to QuickBooks automatically bookkeeper": tailride, Gmail Payable add-on, n8n, Fiverr. "match purchase orders to invoices QuickBooks flag price mismatch": getply, Matchy Match, Zoho; QuickBooks has no native 3-way match. "automate job costing materials supplier invoices QuickBooks contractor": handoff, knowify, simpro, milner AP automation for contractors.
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt and llms-full.txt.
2. Owner: verify site in Google Search Console and submit sitemap (brand search returns nothing, so indexing is the main blocker).
3. Add FAQ sections to the two older posts; QBD FAQ on home (visible, seo/visible).
4. Next visibility check 2026-11-04.

## 2026-10-27
**Changed (invisible, master):** BlogPosting JSON-LD on all 4 posts now has inLanguage (en-US) and isPartOf (Blog entity linking to /blog).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3 weeks). No new Monday article.
**Checks:** npm ci, tsc and next build pass.
**Visibility check:** not due (next 2026-10-28).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt and llms-full.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add FAQ sections to the two older posts (visible, seo/visible); QBD FAQ on home.
4. Visibility check 2026-10-28.

## 2026-10-26
**Changed (invisible, master):** New public/llms-full.txt (workflow in four steps, features, pricing, quick answers, page list) for AI assistants; linked from llms.txt; '/llms-full.txt' added to publicMarketingPaths in src/proxy.ts (the one allowed line).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3 weeks). No new Monday article: PR #3 still has two unreviewed articles.
**Visibility check:** not due (last 2026-10-21; next 2026-10-28).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt and llms-full.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible); FAQ sections on the two older posts.
4. Fix 9 pre-existing eslint errors in public pages.
5. Visibility check 2026-10-28.

## 2026-10-23
**Changed (invisible, master):** robots.txt now has explicit allow rules for AI/search crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended) with the same app-route disallows as everyone else.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3 weeks).
**Visibility check:** not due (last 2026-10-21; next 2026-10-28).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible); FAQ sections on the two older posts.
4. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-22
**Changed (invisible, master):** llms.txt now lists all four monthly plans (Starter $20/50, Basic $40/100, Professional $76/200, Business $180/500 credits, with per-transaction rates, from the pricing source data); sitemap lastModified bumped to 2026-10-22.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3 weeks). No new article (Thursday).
**Visibility check:** not due (last 2026-10-21; next 2026-10-28).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible); FAQ sections on the two older posts.
4. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-21
**Changed (invisible, master):** Per-page Twitter card tags (title, description, image) on home, pricing, help, blog index and all 4 posts (previously only a site-wide image, no per-page title/description).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (~3 weeks). No new Monday article.
**Checks:** npm ci, tsc and next build pass.
**Visibility check (3 searches):** purchasomatic.com absent for "automatically create QuickBooks bills from emailed vendor invoices with job costing" (a Gmail-sidebar add-on listing appeared), "match purchase order to vendor bill QuickBooks Online discrepancies automatically" (ApprovalMax, Intuit community, Quartzy; sources say QBO has no native auto PO-to-bill match, which is an open angle for the PO article), and brand search "purchasomatic" (nothing; site still appears unindexed). Next check 2026-10-28.
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap (brand search still returns nothing).
3. Add QBD FAQ to home (visible, seo/visible); FAQ sections on the two older posts.
4. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-20
**Changed (invisible, master):** llms.txt Quick answers expanded (who it is for, QuickBooks Online, auto-publish safeguards, free trial); sitemap lastModified for marketing pages bumped to 2026-10-20.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (about 2 weeks). No new Monday article.
**Checks:** npm ci, tsc and next build pass.
**Visibility check:** not due (last 2026-10-14; next 2026-10-21).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible); FAQ sections on the two older posts.
4. Fix 9 pre-existing eslint errors in public pages.
5. Visibility check 2026-10-21.

## 2026-10-19
**Changed (invisible, master):** Home and site-default <title> shortened to ~66 chars ("Vendor Invoice & Purchase Order Capture for QuickBooks", was ~90 and truncating); home/default meta description rewritten to ~150 chars and now mentions QuickBooks Online and Desktop (was 190 chars, truncating).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged (two weeks). No new Monday article: PR #3 has two unmerged articles, adding more would pile up unreviewed content.
**Checks:** tsc and next build pass.
**Visibility check:** not due (last 2026-10-14; next ~2026-10-21).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console (a verification tag is already in layout) and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible); add FAQ sections to the two older posts so FAQPage JSON-LD can be added.
4. Fix 9 pre-existing eslint errors in public pages.
5. Visibility check 2026-10-21.

## 2026-10-16
**Changed (invisible, master):** BreadcrumbList JSON-LD added to /blog, /privacy and /terms; root layout now sets robots metadata with max-snippet/max-image-preview:large/max-video-preview (allows rich snippets and large previews).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged. Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check:** not due (last 2026-10-14; next ~2026-10-21).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible).
4. Fix 9 pre-existing eslint errors in public pages.
5. Monday 2026-10-19 article only if PR #3 merged or stalled.

## 2026-10-15
**Changed (invisible, master):** HowTo JSON-LD (3 guides: connect QuickBooks, email forwarding, first invoice) on /help, generated from the page's own content so it stays in sync. Image alt audit: all public images/video already fine.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Still unmerged. Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check:** not due (last 2026-10-14; next ~2026-10-21).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap.
3. Add QBD FAQ to home (visible, seo/visible).
4. Fix 9 pre-existing eslint errors in public pages.
5. Monday 2026-10-19 article only if PR #3 merged or stalled.

## 2026-10-14
**Changed (invisible, master):** Pricing page now has SoftwareApplication JSON-LD listing the free trial plus all four paid plans (built from the same plan data as the page); sitemap lastModified for marketing pages bumped to 2026-10-14.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Nothing new added; branch is one commit behind master (rebase when next adding to it).
**Checks:** tsc and next build pass.
**Visibility check (3 searches):** purchasomatic.com absent for "import vendor invoices into QuickBooks Desktop automatically" (SaasAnt, Lido, Intuit community, invoicedataextraction dominate; answers say QBD has no native automatic option, so a clear "automatic" angle is open), "automate job costing materials invoices QuickBooks contractor" (Udemy, coefficient, handoff, knowify, levelset), and brand search "purchasomatic" (no site pages at all; site appears still unindexed).
**Backlog (top):**
1. Owner: merge PR #3, then add both new posts to llms.txt.
2. Owner: verify site in Google Search Console and submit sitemap (brand search returns nothing).
3. Add QBD FAQ to home (visible, seo/visible).
4. Fix 9 pre-existing eslint errors in public pages.
5. Next Monday (2026-10-19) article only if PR #3 is merged or stalled; consider topic: inventory/job material costing workaround alternatives.

## 2026-10-13
**Changed (invisible, master):** Blog index title now keyword-specific ("QuickBooks Invoice, Bill and Purchase Order Guides"); VideoObject JSON-LD added to home for the demo video.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus PO-matching article (10-12). Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check:** not due (next ~2026-10-14).
**Backlog (top):**
1. After PR #3 merges: add both new posts to llms.txt.
2. Visibility check ~2026-10-14.
3. Add QBD FAQ to home (visible, seo/visible).
4. Owner: submit sitemap in Google Search Console.
5. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-12
**Changed (invisible, master):** mainEntityOfPage added to Article JSON-LD on the 2 posts missing it; Open Graph article publishedTime + author added on all 4 posts.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article (10-05) plus new Monday article "How to match vendor invoices to purchase orders in QuickBooks" with FAQ.
**Checks:** tsc and next build pass.
**Visibility check:** not due (next ~2026-10-14).
**Backlog (top):**
1. After PR #3 merges: add both new posts to llms.txt.
2. Add QBD FAQ to home (visible, seo/visible).
3. Owner: submit sitemap in Google Search Console.
4. Fix 9 pre-existing eslint errors in public pages.
5. Visibility check ~2026-10-14.

## 2026-10-09
**Changed (invisible, master):** Signup now has its own title/description/canonical/OG ("Sign up free: 25 trial credits, no card"); Login has title/description/canonical; forgot/reset-password pages set noindex; robots.txt now also disallows /admin and /forgot-password (new layout.tsx files in src/app/(auth)/{signup,login,forgot-password,reset-password}).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article, still unmerged. Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check:** not due (next ~2026-10-14).
**Backlog (top):**
1. After PR #3 merges: add new post to llms.txt.
2. Add QBD FAQ to home (visible, seo/visible).
3. Article on matching POs to bills in QuickBooks (Monday 2026-10-12).
4. Owner: submit sitemap in Google Search Console.
5. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-08
**Changed (invisible, master):** Organization JSON-LD on home now has a ContactPoint (support email); Open Graph tags added to /privacy and /terms; llms.txt quick answers expanded (scanned PDFs, duplicates, PO matching, done-for-you setup).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article, still unmerged. Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check:** not due (last 2026-10-07; next ~2026-10-14).
**Backlog (top):**
1. After PR #3 merges: add new post to llms.txt.
2. Add QBD FAQ to home (visible, seo/visible).
3. Article on matching POs to bills in QuickBooks (Monday 2026-10-12).
4. Owner: submit sitemap in Google Search Console.
5. Fix 9 pre-existing eslint errors in public pages.

## 2026-10-07
**Changed (invisible, master):** Help and Pricing page titles/descriptions rewritten to be keyword-specific (were "Help & Support" / "Pricing"); BreadcrumbList JSON-LD added to /help and /pricing (new PageBreadcrumbJsonLd in blog/breadcrumb-jsonld.tsx).
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article, still unmerged. Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check (3 searches):** purchasomatic.com absent for "email vendor invoices to QuickBooks automatically coded to job" (Tailride, Payable, n8n, Intuit forwarding dominate), "enter vendor bills in QuickBooks Desktop from PDF" (Intuit help, Lido, invoicedataextraction), and brand search "purchasomatic" (no site pages; engine suggests it's unknown). Site still appears unindexed: owner should verify in Search Console and submit sitemap.
**Backlog (top):**
1. After PR #3 merges: add new post to llms.txt.
2. Add QBD FAQ to home (visible, seo/visible).
3. Article on matching POs to bills in QuickBooks (Monday 2026-10-12).
4. Owner: submit sitemap in Google Search Console.
5. Fix 9 pre-existing eslint errors in public pages.
Next visibility check ~2026-10-14.

## 2026-10-06
**Changed (invisible, master):** WebSite JSON-LD on home; Blog + BlogPosting list JSON-LD on blog index; "Quick answers" section (what/how/cost/QBD/job costing) in public/llms.txt for AI search.
**Visible, waiting on seo/visible (PR #3):** QBD bill-entry article, still unmerged. Nothing new added.
**Checks:** tsc and next build pass.
**Visibility check (4 searches):** purchasomatic.com still absent for QBD email-PDF import, PO-to-invoice matching, and contractor job-coded bill entry; brand search "purchasomatic" shows no site pages at all (worse than 09-30, when /help appeared) - likely not indexed yet; suggest owner submit sitemap in Google Search Console. SERPs dominated by Intuit docs, n8n/automation workflow pages, third-party AP vendors.
**Backlog (top):**
1. After PR #3 merges: add new post to llms.txt.
2. Add QBD FAQ to home (visible, seo/visible).
3. Article on matching POs to bills in QuickBooks (Monday 2026-10-12).
4. Owner: verify site in Google Search Console and submit sitemap.
5. Fix 9 pre-existing eslint errors in public pages.
Next visibility check ~2026-10-13.

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
