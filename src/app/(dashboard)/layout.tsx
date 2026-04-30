import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/sidebar-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav userEmail={user?.email ?? null} />
      <main className="flex-1 overflow-auto bg-[#F8F9FA]">
        {children}
      </main>
    </div>
  )
}
