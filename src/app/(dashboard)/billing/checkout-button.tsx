'use client'

export function CheckoutButton({ credits }: { credits: number }) {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits }),
    })
    const data = await res.json() as { url?: string; error?: string }
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error ?? 'Failed to start checkout')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: '#2DB87A', color: 'white',
        borderRadius: 6, padding: '7px 18px',
        fontSize: 13, fontWeight: 500,
        border: 'none', cursor: 'pointer',
      }}
    >
      Buy
    </button>
  )
}
