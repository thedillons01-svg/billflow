import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/sidebar-nav'
import { DashboardProviders } from './providers'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let notifications: {
    id: string
    type: 'error' | 'success' | 'info'
    title: string
    body: string | null
    is_read: boolean
    created_at: string
    bill_id: string | null
  }[] = []

  if (user) {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, is_read, created_at, bill_id')
      .order('created_at', { ascending: false })
      .limit(30)
    notifications = (data ?? []) as typeof notifications
  }

  const unreadErrors = notifications.filter(n => !n.is_read && n.type === 'error').length

  const { data: company } = await supabase
    .from('companies')
    .select('job_costing_enabled')
    .limit(1)
    .maybeSingle()

  // Redirect to onboarding if user has no company, except when already there
  const hdrs = await headers()
  const pathname = hdrs.get('x-pathname') ?? ''
  if (!company && !pathname.startsWith('/onboarding')) redirect('/onboarding')

  const jobCostingEnabled = company?.job_costing_enabled ?? false

  return (
    <DashboardProviders>
      <div className="flex h-screen overflow-hidden" style={{ background: '#F4F6F8' }}>
        <SidebarNav
          userEmail={user?.email ?? null}
          notifications={notifications}
          unreadCount={unreadErrors}
          jobCostingEnabled={jobCostingEnabled}
        />
        <main className="flex-1 overflow-auto" style={{ background: '#F4F6F8' }}>
          {children}
        </main>
      </div>
    </DashboardProviders>
  )
}
