export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string // ISO yyyy-mm-dd
}

// Add new posts here — both the blog index and the sitemap pick them up automatically.
export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-import-purchase-orders-into-quickbooks',
    title: 'How to Import Purchase Orders into QuickBooks',
    description:
      'Manual steps for creating purchase orders in QuickBooks Online, and how to automate the entire process from vendor PO confirmation to QuickBooks record.',
    date: '2026-06-15',
  },
]
