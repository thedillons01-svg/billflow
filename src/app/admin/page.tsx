import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { ImpersonateButton } from './ImpersonateButton'

export default async function AdminPage() {
  const supabase = createServiceClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, name, created_at, subscription_status, credit_balance, qb_type, company_members(user_id)')
    .order('created_at', { ascending: false })

  const rows = await Promise.all((companies ?? []).map(async (c) => {
    const userId = (c.company_members as { user_id: string }[])[0]?.user_id
    let email = ''
    if (userId) {
      const { data } = await supabase.auth.admin.getUserById(userId)
      email = data.user?.email ?? ''
    }
    const { count: billCount } = await supabase
      .from('bills').select('bill_id', { count: 'exact', head: true }).eq('company_id', c.company_id)
    const { count: dupCount } = await supabase
      .from('bills').select('bill_id', { count: 'exact', head: true })
      .eq('company_id', c.company_id).eq('status', 'fingerprint_duplicate')

    return { ...c, email, billCount: billCount ?? 0, dupCount: dupCount ?? 0 }
  }))

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Companies ({rows.length})</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#6b7280' }}>
            <th style={{ padding: '8px 12px' }}>Company</th>
            <th style={{ padding: '8px 12px' }}>Email</th>
            <th style={{ padding: '8px 12px' }}>QB</th>
            <th style={{ padding: '8px 12px' }}>Bills</th>
            <th style={{ padding: '8px 12px' }}>Duplicates</th>
            <th style={{ padding: '8px 12px' }}>Credits</th>
            <th style={{ padding: '8px 12px' }}>Status</th>
            <th style={{ padding: '8px 12px' }}>Signed up</th>
            <th style={{ padding: '8px 12px' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.company_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                <Link href={`/admin/${c.company_id}`} style={{ color: '#2DB87A', textDecoration: 'none' }}>
                  {c.name}
                </Link>
              </td>
              <td style={{ padding: '10px 12px', color: '#6b7280' }}>{c.email}</td>
              <td style={{ padding: '10px 12px', color: '#6b7280' }}>{c.qb_type ?? '—'}</td>
              <td style={{ padding: '10px 12px' }}>{c.billCount}</td>
              <td style={{ padding: '10px 12px', color: c.dupCount > 0 ? '#f59e0b' : '#9ca3af' }}>{c.dupCount}</td>
              <td style={{ padding: '10px 12px' }}>{c.credit_balance ?? 0}</td>
              <td style={{ padding: '10px 12px', color: '#6b7280' }}>{c.subscription_status ?? 'trial'}</td>
              <td style={{ padding: '10px 12px', color: '#9ca3af' }}>
                {new Date(c.created_at).toLocaleDateString()}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <ImpersonateButton email={c.email} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
        "Login as" copies a magic link to your clipboard — paste it into an incognito window.
      </p>
    </div>
  )
}
