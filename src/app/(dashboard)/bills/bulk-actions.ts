'use server'

export async function bulkPublish(billIds: string[]): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const billId of billIds) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/quickbooks/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId }),
      })
      if (res.ok) {
        success++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { success, failed }
}
