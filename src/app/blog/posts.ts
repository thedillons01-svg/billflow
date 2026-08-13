export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string // ISO yyyy-mm-dd
}

// Add new posts here — both the blog index and the sitemap pick them up automatically.
export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-import-vendor-bills-quickbooks',
    title: 'How to Import Vendor Bills into QuickBooks Online',
    description:
      'There are 3 ways to import vendor bills into QuickBooks Online — but only one automatically matches them to the right job. Learn which option is right for your trades business.',
    date: '2026-08-07',
  },
  {
    slug: 'how-to-import-purchase-orders-into-quickbooks',
    title: 'How to Import Purchase Orders into QuickBooks',
    description:
      'Manual steps for creating purchase orders in QuickBooks Online, and how to automate the entire process from vendor PO confirmation to QuickBooks record.',
    date: '2026-06-15',
  },
  {
    slug: 'how-to-import-vendor-invoices-into-quickbooks',
    title: 'How to Import Vendor Invoices into QuickBooks',
    description:
      'Manual steps for entering vendor bills in QuickBooks Online, and how to automate invoice capture and line-item entry from your inbox to a QuickBooks bill.',
    date: '2026-07-26',
  },
]
