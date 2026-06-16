import { createClient } from '@/lib/supabase/server'
import { disconnectQuickBooks, triggerQBSync, updateNotificationSettings, updateCompanySettings, updateCapturePrefix, updateCompanyDetails } from './actions'
import { SyncButton } from './sync-button'
import { CopyAddress } from './copy-address'
import { ClassTrackingToggle } from './class-tracking-toggle'
import { DirtyForm, DirtyFormGroup, SaveButton } from '@/components/dirty-form'
import { GuardedLink } from '@/components/guarded-link'

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
  class_tracking_enabled: boolean | null
  push_pos_to_qb: boolean | null
  fsm_platform: string | null
  notification_emails: string[] | null
  success_notifications: boolean | null
  daily_digest: boolean | null
  notify_uploader: boolean | null
  qb_ref_source: string | null
  default_due_date: string | null
  job_tagging_level: string | null
  auto_close_jobs_days: number | null
  show_field_tips: boolean | null
  push_pdf_to_qb: boolean | null
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

  const [{ data }, { data: qbdHeartbeat }] = await Promise.all([
    supabase
      .from('companies')
      .select('company_id, name, qb_connection_status, qb_realm_id, qb_type, qb_last_sync, capture_email_prefix, use_items_table, job_costing_enabled, class_tracking_enabled, push_pos_to_qb, fsm_platform, notification_emails, success_notifications, daily_digest, notify_uploader, qb_ref_source, default_due_date, job_tagging_level, auto_close_jobs_days, show_field_tips, push_pdf_to_qb, plan_name, credit_balance, stripe_customer_id')
      .single(),
    supabase
      .from('qbd_heartbeats')
      .select('last_heartbeat_at, connector_status')
      .single(),
  ])

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
        <DirtyFormGroup>
          {/* Status banners */}
          {qb_connected === 'true' && (
            <Banner type="success">QuickBooks connected successfully.</Banner>
          )}
          {qb_error && (
            <Banner type="error">{errorMessage(qb_error)}</Banner>
          )}

          {/* ── Company Details ───────────────────────────────────────── */}
          <Card title="Company Details" subtitle="Your company name as it appears in Purchasomatic.">
            <DirtyForm action={async (fd: FormData) => {
              'use server'
              if (!company) return
              await updateCompanyDetails(company.company_id, { name: fd.get('name') as string })
            }}>
              <div className="space-y-3">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={company?.name ?? ''}
                    placeholder="e.g. Smith HVAC Services"
                    style={{
                      width: '100%', height: 36,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 6, padding: '0 10px',
                      fontSize: 13,
                    }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Used as the display name throughout Purchasomatic and in email notifications.
                  </p>
                </div>
                <div className="flex justify-end">
                  <SaveButton>Save</SaveButton>
                </div>
              </div>
            </DirtyForm>
          </Card>

          {/* ── QuickBooks ─────────────────────────────────────────────── */}
          <Card title="QuickBooks Online" subtitle="Connect to sync vendors, jobs, and push bills automatically.">
            {(() => {
              const staleHours = 4
              const isStale = isQBConnected && company?.qb_last_sync
                ? (Date.now() - new Date(company.qb_last_sync).getTime()) > staleHours * 60 * 60 * 1000
                : isQBConnected && !company?.qb_last_sync
              return isStale ? (
                <div className="flex items-start gap-2 mb-4 px-3 py-2" style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6 }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: 13, color: '#D97706', marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#92400E' }}>
                    QuickBooks data is more than {staleHours} hours old — vendor and job lists may be out of date.
                    Run <strong>Sync Now</strong> to refresh.
                  </p>
                </div>
              ) : null
            })()}
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
                      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {company?.qb_last_sync
                          ? `Last synced: ${new Date(company.qb_last_sync).toLocaleString()}`
                          : 'Never synced — click Sync Now to populate vendor and job lists.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={async () => { 'use server'; if (company) await triggerQBSync(company.company_id) }}>
                      <SyncButton />
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
                  {/* Intuit-branded Connect to QuickBooks button — required for app review */}
                  <a
                    href="/api/quickbooks/connect"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: '#2CA01C', color: 'white',
                      borderRadius: 4, padding: '8px 16px',
                      fontSize: 14, fontWeight: 600, fontFamily: 'Arial, sans-serif',
                      textDecoration: 'none', letterSpacing: '0.01em',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="20" cy="20" r="20" fill="white"/>
                      <text x="20" y="27" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#2CA01C" fontFamily="Arial, sans-serif">Q</text>
                    </svg>
                    Connect to QuickBooks
                  </a>
                </>
              )}
            </div>
          </Card>

          {/* QBD */}
          {company?.qb_type === 'qbd' && (
            <Card title="QuickBooks Desktop" subtitle="Web Connector polls Purchasomatic every 5–30 minutes to sync bills.">
              <div className="space-y-4">
                {/* Heartbeat status */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const status = (qbdHeartbeat as { last_heartbeat_at: string | null; connector_status: string | null } | null)?.connector_status
                    const lastBeat = (qbdHeartbeat as { last_heartbeat_at: string | null; connector_status: string | null } | null)?.last_heartbeat_at
                    const dotColor = status === 'running' ? '#2DB87A' : status === 'overdue' ? '#F59E0B' : '#DC2626'
                    const label = status === 'running' ? 'Connected — polling normally' : status === 'overdue' ? 'Overdue — no recent heartbeat' : lastBeat ? 'Alert — connection lost' : 'Waiting for first connection'
                    return (
                      <>
                        <span style={{ display: 'block', width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</p>
                          {lastBeat && (
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                              Last heartbeat: {new Date(lastBeat).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
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
              </div>
            </Card>
          )}

          {/* ── Email Capture ──────────────────────────────────────────── */}
          <Card title="Email Capture" subtitle="Forward vendor emails to these addresses — Purchasomatic handles the rest.">
            <div className="space-y-4">
              {/* Prefix editor */}
              <DirtyForm action={async (fd: FormData) => {
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
                    <SaveButton>Save</SaveButton>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Lowercase letters, numbers, and hyphens only. Changing this will break any existing forwarding rules — update them in your email client too.
                  </p>
                </div>
              </DirtyForm>

              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 16 }} />

              <CopyAddress
                label="Bills address"
                address={billsAddress}
                helper="Forward any email with 'invoice' in the subject here. Invoices are captured and extracted automatically."
              />
              <CopyAddress
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
            <DirtyForm action={async (fd: FormData) => {
              'use server'
              if (!company) return
              await updateCompanySettings(company.company_id, {
                use_items_table: fd.get('use_items_table') === 'on',
                job_costing_enabled: fd.get('job_costing_enabled') === 'on',
                class_tracking_enabled: fd.get('class_tracking_enabled') === 'on',
                push_pos_to_qb: fd.get('push_pos_to_qb') === 'on',
                fsm_platform: fd.get('fsm_platform') as string || null,
                qb_ref_source: fd.get('qb_ref_source') as string || 'po_number',
                default_due_date: fd.get('default_due_date') as string || 'not_required',
                job_tagging_level: fd.get('job_tagging_level') as string || 'sub_customers_only',
                auto_close_jobs_days: fd.get('auto_close_jobs_days') ? Number(fd.get('auto_close_jobs_days')) : null,
                show_field_tips: fd.get('show_field_tips') === 'on',
                push_pdf_to_qb: fd.get('push_pdf_to_qb') === 'on',
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
                <ClassTrackingToggle defaultChecked={company?.class_tracking_enabled ?? false} />
                <Toggle
                  name="push_pos_to_qb"
                  defaultChecked={company?.push_pos_to_qb ?? true}
                  label="Push purchase orders to QuickBooks"
                  helper="When on, captured POs can be pushed to QuickBooks as Purchase Order records. Turn off if you want to use PO capture and receiving workflow in Purchasomatic only — without creating PO records in QuickBooks."
                />
                <Toggle
                  name="show_field_tips"
                  defaultChecked={company?.show_field_tips ?? true}
                  label="Show field tips"
                  helper="When on, explanatory text appears below each field on the bill and PO screens. When off, tips are hidden but still available by hovering the ⓘ icon next to the field label."
                />
                <Toggle
                  name="push_pdf_to_qb"
                  defaultChecked={company?.push_pdf_to_qb ?? true}
                  label="Attach PDF copies to QuickBooks bills"
                  helper="When on, the original invoice PDF is attached to the bill record in QuickBooks when published. Turn off if you don't need PDF copies in QB, or if attachment uploads are causing push errors."
                />
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Job tagging level
                  </label>
                  <select
                    name="job_tagging_level"
                    defaultValue={company?.job_tagging_level ?? 'sub_customers_only'}
                    style={{ width: '100%', height: 36, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 10px', fontSize: 13, color: 'var(--color-text-primary)', background: 'white' }}
                  >
                    <option value="sub_customers_only">Jobs / Sub-customers only</option>
                    <option value="customers_only">Customers only</option>
                    <option value="both">Both customers and sub-customers</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Controls which QuickBooks entities appear in job tagging dropdowns throughout the app. &ldquo;Jobs / Sub-customers only&rdquo; is correct for most contractors — your jobs are sub-customers under a parent customer in QuickBooks.
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Auto-close jobs after days of inactivity
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      name="auto_close_jobs_days"
                      defaultValue={company?.auto_close_jobs_days ?? ''}
                      placeholder="disabled"
                      min={1}
                      max={3650}
                      style={{ width: 100, height: 36, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 10px', fontSize: 13, color: 'var(--color-text-primary)', background: 'white' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>days (blank = disabled)</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Jobs with no bill, PO, or receiving activity for this many days are automatically closed and hidden from tagging dropdowns. Set to 0 to disable auto-close. Runs during each QB sync.
                  </p>
                </div>
                {company?.qb_type === 'qbd' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    QB Reference Number field source
                  </label>
                  <select
                    name="qb_ref_source"
                    defaultValue={company?.qb_ref_source ?? 'po_number'}
                    style={{
                      width: '100%', height: 36,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 6, padding: '0 10px',
                      fontSize: 13, color: 'var(--color-text-primary)',
                      background: 'white',
                    }}
                  >
                    <option value="po_number">PO / Reference number from invoice</option>
                    <option value="invoice_number">Invoice number</option>
                    <option value="blank">Leave blank</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    QuickBooks Desktop has a separate Ref No. field on bills. Controls what Purchasomatic puts there. Per-vendor &ldquo;Copy PO to QB reference&rdquo; toggle overrides this setting.
                  </p>
                </div>
                )}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Default due date
                  </label>
                  <select
                    name="default_due_date"
                    defaultValue={company?.default_due_date ?? 'not_required'}
                    style={{
                      width: '100%', height: 36,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 6, padding: '0 10px',
                      fontSize: 13, color: 'var(--color-text-primary)',
                      background: 'white',
                    }}
                  >
                    <option value="not_required">Not required — leave blank if not on invoice</option>
                    <option value="same_as_invoice_date">Same as invoice date</option>
                    <option value="from_payment_terms">Calculate from payment terms</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Applied when no due date is found on the invoice. &ldquo;Same as invoice date&rdquo; sets due date equal to the invoice date. &ldquo;Calculate from payment terms&rdquo; adds the vendor&apos;s payment term days to the invoice date. Per-vendor setting overrides this company default.
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Field service platform
                  </label>
                  <select
                    name="fsm_platform"
                    defaultValue={company?.fsm_platform ?? 'unknown'}
                    style={{
                      width: '100%', height: 36,
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 6, padding: '0 10px',
                      fontSize: 13, color: 'var(--color-text-primary)',
                      background: 'white',
                    }}
                  >
                    <option value="hcp">Housecall Pro</option>
                    <option value="workiz">Workiz</option>
                    <option value="servicetrade">ServiceTrade</option>
                    <option value="jobber">Jobber</option>
                    <option value="other">Other FSM</option>
                    <option value="unknown">Not using an FSM</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Helps Purchasomatic match job names from your work orders when job costing is enabled.
                  </p>
                </div>
                <div className="flex justify-end">
                  <SaveButton>Save</SaveButton>
                </div>
              </div>
            </DirtyForm>
          </Card>

          {/* ── Notifications ─────────────────────────────────────────── */}
          <Card title="Notifications" subtitle="Control when and where Purchasomatic sends alerts.">
            <DirtyForm action={async (fd: FormData) => {
              'use server'
              if (!company) return
              const rawEmails = fd.get('notification_emails') as string
              const emails = rawEmails.split(',').map(e => e.trim()).filter(Boolean)
              await updateNotificationSettings(company.company_id, {
                notification_emails: emails,
                success_notifications: fd.get('success_notifications') === 'on',
                daily_digest: fd.get('daily_digest') === 'on',
                notify_uploader: fd.get('notify_uploader') === 'on',
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
                <Toggle
                  name="notify_uploader"
                  defaultChecked={company?.notify_uploader ?? true}
                  label="Notify uploader"
                  helper="When on, the person who forwarded the email receives the result notification in addition to the recipients above. Useful when techs forward their own invoices."
                />
                <div className="flex justify-end">
                  <SaveButton>Save</SaveButton>
                </div>
              </div>
            </DirtyForm>
          </Card>

          {/* ── Account & Class Visibility ────────────────────────────── */}
          <GuardedLink href="/settings/account-visibility" style={{ display: 'block', width: '100%' }}>
            <div
              className="flex items-center justify-between"
              style={{
                background: 'white', border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8, padding: '16px 20px', cursor: 'pointer',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Account &amp; Class Visibility</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Hide individual GL accounts and classes from Purchasomatic dropdowns
                </p>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            </div>
          </GuardedLink>

          <GuardedLink href="/settings/rules" style={{ display: 'block', width: '100%' }}>
            <div
              className="flex items-center justify-between"
              style={{
                background: 'white', border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8, padding: '16px 20px', cursor: 'pointer',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Company Rules</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Assign GL accounts to line items by description or amount — applies across all vendors
                </p>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            </div>
          </GuardedLink>

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
                <GuardedLink
                  href="/billing"
                  style={{
                    display: 'inline-block',
                    background: '#2DB87A', color: 'white',
                    borderRadius: 6, padding: '7px 16px',
                    fontSize: 13, fontWeight: 500,
                  }}
                >
                  Purchase Credits
                </GuardedLink>
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                Credits never expire. Purchase bundles or upgrade to an unlimited monthly plan.
              </p>
            </div>
          </Card>
        </DirtyFormGroup>
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


function Toggle({ name, defaultChecked, label, helper }: { name: string; defaultChecked: boolean; label: string; helper: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{helper}</p>
      </div>
      <label className="relative" style={{ width: 36, height: 20, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}>
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="toggle-input sr-only" />
        <div className="toggle-track" />
        <div className="toggle-thumb" />
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
