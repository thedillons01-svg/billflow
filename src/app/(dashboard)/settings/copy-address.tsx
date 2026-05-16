'use client'

export function CopyAddress({ address, label, helper }: { address: string; label: string; helper: string }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{label}</p>
      <div className="flex items-center gap-2">
        <code style={{
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 4, padding: '4px 10px',
          fontSize: 12, color: 'var(--color-text-primary)',
        }}>
          {address}
        </code>
        <button
          type="button"
          onClick={() => navigator?.clipboard?.writeText(address)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          title="Copy to clipboard"
        >
          <i className="ti ti-copy" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{helper}</p>
    </div>
  )
}
