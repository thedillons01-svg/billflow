'use client'

export function POPdfPanel({
  pdfSignedUrl,
  vendorName,
  poNumber,
  poId,
}: {
  pdfSignedUrl: string | null
  vendorName: string
  poNumber: string | null
  poId: string
}) {
  const handleDownload = async () => {
    if (!pdfSignedUrl) return
    try {
      const res = await fetch(pdfSignedUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const vendor = vendorName.replace(/[^a-z0-9]/gi, '_')
      const po     = (poNumber ?? poId).replace(/[^a-z0-9]/gi, '_')
      a.download = `PO_${vendor}_${po}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* signed URL may have expired — user can refresh */ }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ background: 'var(--color-background-secondary)' }}>
      {pdfSignedUrl && (
        <div
          className="flex-none flex justify-end"
          style={{
            padding: '6px 10px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            background: 'white',
          }}
        >
          <button
            onClick={handleDownload}
            title="Download PDF"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'white', border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 6, padding: '4px 10px',
              fontSize: 12, color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <i className="ti ti-download" style={{ fontSize: 13 }} />
            Download
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {pdfSignedUrl ? (
          <iframe
            src={pdfSignedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Purchase Order PDF"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <i className="ti ti-clipboard-list" style={{ fontSize: 48, color: 'var(--color-text-tertiary)' }} />
              <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                No PDF attached
              </p>
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                PDFs captured via email will appear here automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
