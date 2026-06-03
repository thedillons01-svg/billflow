'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'

export function POSplitShell({
  left,
  right,
}: {
  left: ReactNode
  right: ReactNode
}) {
  const leftRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(520)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftRef.current?.offsetWidth ?? leftWidth

    const onMove = (ev: MouseEvent) => {
      if (!leftRef.current) return
      const next = Math.min(860, Math.max(320, startWidth + (ev.clientX - startX)))
      leftRef.current.style.width = next + 'px'
    }

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setLeftWidth(Math.min(860, Math.max(320, startWidth + (ev.clientX - startX))))
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [leftWidth])

  return (
    <div className="flex" style={{ height: '100%' }}>
      {/* Left panel */}
      <div
        ref={leftRef}
        style={{
          width: leftWidth, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          height: '100%', minHeight: 0, overflow: 'hidden',
          background: 'white',
        }}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        style={{
          width: 5, flexShrink: 0, cursor: 'col-resize',
          background: 'var(--color-border-tertiary)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-border-tertiary)')}
      />

      {/* Right panel */}
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {right}
      </div>
    </div>
  )
}
