import { createClient } from '@/lib/supabase/server'
import { disconnectQuickBooks, triggerQBSync, updateNotificationSettings, updateCompanySettings, updateCapturePrefix } from './actions'

type Company = {
  company_id: string
  name: string
  qb_connection_status: string | null
  qb_realm_id: string | null
  qb_type: string | null
  qb_last_sync: string | null
  capture_email_prefix: string | null
  use_items_table: boolean | null
  job_costing_enabled: boolean | null
  fsm_platform: string | null
  notification_emails: string[] | null
  success_notifications: boolean | null
  daily_digest: boolean | null
  plan_name: string | null
  credit_balance: number | null
  stripe_customer_id: string | null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ qb_connected?: string; qb_error?: string; section?: string }>
}) {
  const { qb_connected, qb_error, section } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from('companies')
    .select('company_id, name, qb_connection_status, qb_realm_id, qb_type, qb_last_sync, capture_email_prefix, use_items_table, job_costing_enabled, fsm_platform, notification_emails, success_notifications, daily_digest, plan_name, credit_balance, stripe_customer_id')
    .single()

  const company = data as Company | null
  const isQBConnected = company?.qb_connection_status === 'connected'
  const billsAddress = `${company?.capture_email_prefix ?? company?.company_id?.slice(0, 8) ?? 'your-company'}-bills@purchasomatic.com`
  const posAddress = `${company?.capture_email_prefix ?? company?.company_id?.slice(0, 8) ?? 'your-company'}-pos@purchasomatic.com`

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex-none flex items-center justify-between px-5 py-[14px]"
        style={{ background: 'white', borderBottom: '0.5px solid var(--color-border-tertiary)' }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Settings</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Integrations, capture addresses, and account configuration
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-5">
        <div style={{ maxWidth: 700 }} className="space-y-5">
          {/* Status banners */}
          {qb_connected === 'true' && (
            <Banner type="success">QuickBooks connected successfully.</Banner>
          )}
          {qb_error && (
            <Banner type="error">{errorMessage(qb_error)}</Banner>
          )}

          {/* ── QuickBooks ─────────────────────────────────────────────── */}
          <Card title="QuickBooks Online" subtitle="Connect to sync vendors, jobs, and push bills automatically.">
            <div className="flex items-center justify-between gap-4">
              {isQBConnected ? (
                <>
                  <div className="flex items-center gap-3">
                    <span style={{ display: 'block', width: 10, height: 10, borderRadius: '50%', background: '#2DB87A' }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Connected</p>
                      {company?.qb_realm_id && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Company ID: {company.qb_realm_id}</p>
                      )}
                      {company?.qb_last_sync && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          Last synced: {new Date(company.qb_last_sync).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={async () => { 'use server'; if (company) await triggerQBSync(company.company_id) }}>
                      <BtnSecondary>Sync Now</BtnSecondary>
                    </form>
                    <form action={async () => { 'use server'; if (company) await disconnectQuickBooks(company.company_id) }}>
                      <BtnSecondary>Disconnect</BtnSecondary>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span style={{ display: 'block', width: 10, height: 10, borderRadius: '50%', background: 'var(--color-border-secondary)' }} />
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Not connected</p>
                  </div>
                  <a
                    href="/api/quickbooks/connect"
                    style={{
                      background: '#2DB87A', color: 'white',
                      borderRadius: 6, padding: '7px 16px',
                      fontSize: 13, fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Connect QuickBooks
                  </a>
                </>
              )}
            </div>
          </Card>

          {/* QBD */}
          {company?.qb_type === 'qbd' && (
            <Card title="QuickBooks Desktop" subtitle="Web Connector polls Purchasomatic every 5–30 minutes to sync bills.">
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Web Connector Config</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    Download and add to QuickBooks Web Connector to start syncing.
                  </p>
                </div>
                <a
                  href="/api/quickbooks/qbd-config"
                  style={{
                    background: 'white', color: 'var(--color-text-primary)',
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 6, padding: '7px 16px',
                    fontSize: 13, textDecoration: 'none',
                  }}
                >
                  Download .QWC
                </a>
              </div>
            </Card>
          )}

          {/* ── Email Capture ──────────────────────────────────────────── */}
          <Card title="Email Capture" subtitle="Forward vendor emails to these addresses — Purchasomatic handles the rest.">
            <div className="space-y-4">
              {/* Prefix editor */}
              <form action={async (fd: FormData) => {
                'use server'
                if (!company) return
                await updateCapturePrefix(company.company_id, fd.get('prefix') as string)
              }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Your capture address prefix
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="prefix"
                      defaultValue={company?.capture_email_prefix ?? ''}
                      placeholder="e.g. smithhvac"
                      style={{
                        width: 180, height: 36,
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 6, padding: '0 10px',
                        fontSize: 13,
                      }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>-bills@purchasomatic.com</span>
                    <BtnSecondary>Save</BtnSecondary>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Lowercase letters, numbers, and hyphens only. Changing this will break any existing forwarding rules — update them in your email client too.
                  </p>
                </div>
              </form>

              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 16 }} />

              <CaptureLine
                label="Bills address"
                address={billsAddress}
                helper="Forward any email with 'invoice' in the subject here. Invoices are captured and extracted automatically."
              />
              <CaptureLine
                label="PO address"
                address={posAddress}
                helper="Forward PO confirmations here. Purchasomatic creates the PO in QuickBooks automatically."
              />
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Setup instructions</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <strong>Gmail:</strong> Settings → See all settings → Filters and Blocked Addresses → Create a new filter. Set &quot;Has the words&quot; to &quot;invoice&quot;, then &quot;Forward it to&quot; your bills address.
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  <strong>Outlook:</strong> Settings → View all Outlook settings → Mail → Rules → Add new rule. Condition: Subject contains &quot;invoice&quot;. Action: Forward to your bills address.
                </p>
              </div>
            </div>
          </Card>

          {/* ── Processing Defaults ───────────────────────────────────── */}
          <Card title="Processing Defaults" subtitle="Control how bills are processed and what fields are used.">
            <form action={async (fd: FormData) => {
              'use server'
              if (!company) return
              await updateCompanySettings(company.company_id, {
                use_items_table: fd.get('use_items_table') === 'on',
                job_costing_enabled: fd.get('job_costing_enabled') === 'on',
              })
            }}>
              <div className="space-y-4">
                <Toggle
                  name="use_items_table"
                  defaultChecked={company?.use_items_table ?? false}
                  label="Use QB Items table"
                  helper="When on, line items use QuickBooks Products & Services instead of GL expense accounts. Default: off. Most contractors don't use this."
                />
                <Toggle
                  name="job_costing_enabled"
                  defaultChecked={company?.job_costing_enabled ?? false}
                  label="Job costing enabled"
                  helper="When on, job fields appear throughout Purchasomatic and invoices are matched to QuickBooks jobs. When off, job fields are hidden and Purchasomatic is invoice-capture only."
                />
                <div className="flex justify-end">
                  <BtnPrimary type="submit">Save</BtnPrimary>
                </div>
              </div>
            </form>
          </Card>

          {/* ── Notifications ─────────────────────────────────────────── */}
          <Card title="Notifications" subtitle="Control when and where Purchasomatic sends alerts.">
            <form action={async (fd: FormData) => {
              'use server'
              if (!company) return
              const rawEmails = fd.get('notification_emails') as string
              const emails = rawEmails.split(',').map(e => e.trim()).filter(Boolean)
              await updateNotificationSettings(company.company_id, {
                notification_emails: emails,
                success_notifications: fd.get('success_notifications') === 'on',
                daily_digest: fd.get('daily_digest') === 'on',
              })
            }}>
              <div className="space-y-4">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Notification email recipients
                  </label>
                  <input
                    type="text"
                    name="notification_emails"
                    defaultValue={(company?.notification_emails ?? []).join(', ')}
                    placeholder="you@example.com, team@example.com"
                    style={{
                      width: '100%', height: 36,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 6, padding: '0 10px',
                      fontSize: 13,
                    }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Comma-separated email addresses. Everyone on this list receives all notifications.
                  </p>
                </div>

                <div
                  style={{
                    background: '#FEF3C7', borderRadius: 6, padding: '10px 12px',
                    border: '0.5px solid #FDE68A',
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#92400E' }}>Error notifications — always on</p>
                  <p style={{ fontSize: 11, color: '#92400E', marginTop: 3 }}>
                    Error notifications cannot be turned off. If something goes wrong with an invoice — wrong capture address, PDF unreadable, QB sync failure, QBD heartbeat lost — you need to know about it.
                  </p>
                </div>

                <Toggle
                  name="success_notifications"
                  defaultChecked={company?.success_notifications ?? true}
                  label="Success notifications"
                  helper="Receive an email when a bill is successfully processed or auto-published. On by default. Turn off if your volume is high and you trust auto-publish."
                />
                <Toggle
                  name="daily_digest"
                  defaultChecked={company?.daily_digest ?? false}
                  label="Daily digest"
                  helper="Receive a daily summary of all activity instead of individual notifications. Off by default."
                />
                <div className="flex justify-end">
                  <BtnPrimary type="submit">Save</BtnPrimary>
                </div>
              </div>
            </form>
          </Card>

          {/* ── Billing & Credits ─────────────────────────────────────── */}
          <Card title="Billing & Credits" subtitle="Your current plan and credit balance.">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3" style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    Current plan: <span style={{ textTransform: 'capitalize' }}>{company?.plan_name ?? 'Free'}</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    Bills and POs cost 1 credit each. Reprocessing is free.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {company?.credit_balance ?? 0}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Credits remaining</p>
                </div>
                <a
                  href="/billing"
                  style={{
                    background: '#2DB87A', color: 'white',
                    borderRadius: 6, padding: '7px 16px',
                    fontSize: 13, fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  Purchase Credits
                </a>
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                Credits never expire. Purchase bundles or upgrade to an unlimited monthly plan.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Shared UI components ─────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{subtitle}</p>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {children}
      </div>
    </div>
  )
}

function Banner({ type, children }: { type: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 6, padding: '10px 14px', fontSize: 13,
      background: type === 'success' ? '#D1FAE5' : '#FEE2E2',
      color: type === 'success' ? '#065F46' : '#991B1B',
      border: `0.5px solid ${type === 'success' ? '#6EE7B7' : '#FCA5A5'}`,
    }}>
      {children}
    </div>
  )
}

function CaptureLine({ label, address, helper }: { label: string; address: string; helper: string }) {
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
          title="Copy"
        >
          <i className="ti ti-copy" style={{ fontSize: 14, color: 'var(--color-text-secondary)' }} />
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{helper}</p>
    </div>
  )
}

function Toggle({ name, defaultChecked, label, helper }: { name: string; defaultChecked: boolean; label: string; helper: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{helper}</p>
      </div>
      <label className="relative" style={{ width: 36, height: 20, flexShrink: 0, marginTop: 2 }}>
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="sr-only peer" />
        <div
          className="peer-checked:bg-[#2DB87A] peer-focus:ring-2 peer-focus:ring-[#2DB87A]/30"
          style={{
            position: 'absolute', inset: 0,
            background: 'var(--color-border-secondary)',
            borderRadius: 10,
            transition: 'background 0.2s',
          }}
        />
        <div
          className="peer-checked:translate-x-4"
          style={{
            position: 'absolute', top: 2, left: 2,
            width: 16, height: 16,
            background: 'white', borderRadius: '50%',
            transition: 'transform 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        />
      </label>
    </div>
  )
}

function BtnPrimary({ type, children }: { type?: 'submit' | 'button'; children: React.ReactNode }) {
  return (
    <button
      type={type ?? 'button'}
      style={{
        background: '#2DB87A', color: 'white',
        borderRadius: 6, padding: '7px 16px',
        fontSize: 13, fontWeight: 500,
        border: 'none', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function BtnSecondary({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      style={{
        background: 'white', color: 'var(--color-text-primary)',
        border: '0.5px solid var(--color-border-secondary)',
        borderRadius: 6, padding: '7px 16px',
        fontSize: 13, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    access_denied:         'QuickBooks authorization was cancelled.',
    missing_params:        'Invalid response from QuickBooks. Please try again.',
    invalid_state:         'Security check failed. Please try connecting again.',
    token_exchange_failed: 'QuickBooks token exchange failed. Check your app credentials.',
    storage_failed:        'Failed to save QuickBooks connection. Please try again.',
    no_company:            'No company found. Please contact support.',
  }
  return messages[code] ?? 'An error occurred connecting QuickBooks.'
}
