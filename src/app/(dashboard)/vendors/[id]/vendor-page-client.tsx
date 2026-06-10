'use client'

import { type ReactNode } from 'react'
import { useGuardedNavigate } from '@/components/unsaved-guard'

type Tab = { id: string; label: string; count?: number }

function VendorHeader({ vendorName, ocrName, id, tabs, currentTab, from }: {
  vendorName: string
  ocrName?: string | null
  id: string
  tabs: Tab[]
  currentTab: string
  from?: string
}) {
  const navigate = useGuardedNavigate()

  const backHref  = from === 'bills' ? '/bills'
                  : from?.startsWith('/') ? from
                  : '/vendors'
  const backLabel = from === 'bills'           ? 'Back to Bills'
                  : from?.startsWith('/bills/') ? 'Back to Bill'
                  : 'Back to Vendors'

  return (
    <>
      <div
        className="flex-none px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <button
          onClick={() => navigate(backHref)}
          className="flex items-center gap-1 mb-2"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          {backLabel}
        </button>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {vendorName}
          </h1>
          {ocrName && ocrName !== vendorName && (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              OCR name: {ocrName}
            </p>
          )}
        </div>
      </div>

      <div
        className="flex-none flex items-end px-5"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => navigate(`/vendors/${id}?tab=${t.id}`)}
            className="flex items-center gap-1.5"
            style={{
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: currentTab === t.id ? 500 : 400,
              color: currentTab === t.id ? '#1A3D2B' : 'var(--color-text-secondary)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: currentTab === t.id ? '2px solid #2DB87A' : '2px solid transparent',
              marginBottom: -1,
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ background: '#2DB87A', color: 'white', fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 10 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

export function VendorPageClient({ vendorName, ocrName, id, tabs, currentTab, from, children }: {
  vendorName: string
  ocrName?: string | null
  id: string
  tabs: Tab[]
  currentTab: string
  from?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col h-full">
      <VendorHeader
        vendorName={vendorName}
        ocrName={ocrName}
        id={id}
        tabs={tabs}
        currentTab={currentTab}
        from={from}
      />
      <div className="flex-1 overflow-auto px-5 py-5">
        {children}
      </div>
    </div>
  )
}
