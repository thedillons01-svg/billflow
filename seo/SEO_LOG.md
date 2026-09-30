# SEO log

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
