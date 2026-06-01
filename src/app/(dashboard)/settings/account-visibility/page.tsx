import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { toggleAccountVisibility, toggleClassVisibility } from '../actions'

export default async function AccountVisibilityPage() {
  const supabase = await createClient()

  const [{ data: qbAccounts }, { data: qbClasses }] = await Promise.all([
    supabase
      .from('qb_accounts_cache')
      .select('id, name, account_type, is_hidden')
      .in('account_type', ['Expense', 'Cost of Goods Sold'])
      .order('name'),
    supabase
      .from('qb_classes_cache')
      .select('id, name, is_hidden')
      .order('name'),
  ])

  const expenseAccounts = (qbAccounts ?? []) as { id: string; name: string | null; account_type: string | null; is_hidden: boolean }[]
  const qbClassList = (qbClasses ?? []) as { id: string; name: string | null; is_hidden: boolean }[]

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-none flex items-center gap-3 px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <Link
          href="/settings"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 12 }} />
          Settings
        </Link>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>/</span>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Account &amp; Class Visibility</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Hide individual QuickBooks accounts and classes from Purchasomatic dropdowns
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 700 }} className="space-y-5">

          {/* GL Account Visibility */}
          <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>GL Account Visibility</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Hidden accounts still exist in QuickBooks — they just won&apos;t appear in dropdowns here.
              </p>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {expenseAccounts.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  No QuickBooks accounts synced yet. Connect QuickBooks and run a sync from Settings.
                </p>
              ) : (
                <div className="space-y-1">
                  {expenseAccounts.map(account => (
                    <form
                      key={account.id}
                      action={toggleAccountVisibility.bind(null, account.id, !account.is_hidden)}
                    >
                      <div className="flex items-center justify-between py-2" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                        <div>
                          <p style={{ fontSize: 13, color: account.is_hidden ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', textDecoration: account.is_hidden ? 'line-through' : 'none' }}>
                            {account.name ?? account.id}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{account.account_type}</p>
                        </div>
                        <button
                          type="submit"
                          style={{
                            fontSize: 11, fontWeight: 500,
                            background: account.is_hidden ? 'var(--color-background-secondary)' : '#EBF5EF',
                            color: account.is_hidden ? 'var(--color-text-secondary)' : '#1A3D2B',
                            border: '0.5px solid var(--color-border-secondary)',
                            borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                          }}
                        >
                          {account.is_hidden ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    </form>
                  ))}
                  {expenseAccounts.every(a => !a.is_hidden) && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                      All accounts visible. Click Hide to remove an account from dropdowns.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Class Visibility */}
          {qbClassList.length > 0 && (
            <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>QB Class Visibility</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Hidden classes still exist in QuickBooks — they just won&apos;t appear in dropdowns here.
                </p>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div className="space-y-1">
                  {qbClassList.map(cls => (
                    <form
                      key={cls.id}
                      action={toggleClassVisibility.bind(null, cls.id, !cls.is_hidden)}
                    >
                      <div className="flex items-center justify-between py-2" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                        <p style={{ fontSize: 13, color: cls.is_hidden ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', textDecoration: cls.is_hidden ? 'line-through' : 'none' }}>
                          {cls.name ?? cls.id}
                        </p>
                        <button
                          type="submit"
                          style={{
                            fontSize: 11, fontWeight: 500,
                            background: cls.is_hidden ? 'var(--color-background-secondary)' : '#EBF5EF',
                            color: cls.is_hidden ? 'var(--color-text-secondary)' : '#1A3D2B',
                            border: '0.5px solid var(--color-border-secondary)',
                            borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                          }}
                        >
                          {cls.is_hidden ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    </form>
                  ))}
                  {qbClassList.every(c => !c.is_hidden) && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                      All classes visible. Click Hide to remove a class from dropdowns.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
