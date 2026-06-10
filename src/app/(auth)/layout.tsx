import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(to right, #1A3D2B, #2DB87A)' }} />
      {children}
      <footer style={{ marginTop: 40, display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/privacy" style={{ fontSize: 12, color: '#9CA3AF', textDecoration: 'none' }}>Privacy Policy</Link>
        <Link href="/terms"   style={{ fontSize: 12, color: '#9CA3AF', textDecoration: 'none' }}>Terms of Service</Link>
        <a href="mailto:support@purchasomatic.com" style={{ fontSize: 12, color: '#9CA3AF', textDecoration: 'none' }}>support@purchasomatic.com</a>
      </footer>
    </div>
  )
}
