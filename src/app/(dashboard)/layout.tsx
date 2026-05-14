import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/sidebar-nav'
import { NotificationBell } from '@/components/notification-bell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Unread error notification count for the bell
  let unreadErrors = 0
  if (user) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('type', 'error')
    unreadErrors = count ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F7F9F8' }}>
      <SidebarNav userEmail={user?.email ?? null} />
      <main className="flex-1 overflow-auto" style={{ background: '#F7F9F8' }}>
        {children}
      </main>
      {/* Notification bell is portal-mounted on each page header — this slot is for global overlay */}
    </div>
  )
}
