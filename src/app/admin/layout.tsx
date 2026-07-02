import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'thedillons01@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) redirect('/home')

  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/admin" style={{ color: '#2DB87A', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>← Admin</a>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>Purchasomatic internal</span>
      </div>
      {children}
    </div>
  )
}
