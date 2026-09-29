import { createServiceClient } from '@/lib/supabase/service'
import { getResend, FROM_ADDRESS } from '@/lib/notifications/send-email'

const APP_URL = 'https://www.purchasomatic.com'

type DigestBill = {
  bill_id: string
  status: string
  invoice_number: string | null
  total: number | null
  vendor_name_raw: string | null
  autopublish_hold_reason: string | null
  qb_sync_error: string | null
  publish_method: string | null
  published_at: string | null
  created_at: string
  vendors: { vendor_name_display: string | null; auto_publish_enabled: boolean } | null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function vendorName(b: DigestBill): string {
  return b.vendors?.vendor_name_display ?? b.vendor_name_raw ?? 'Unknown vendor'
}

function billLabel(b: DigestBill): string {
  const inv = b.invoice_number ? `#${b.invoice_number}` : '(no invoice #)'
  const amt = b.total != null ? ` · $${Number(b.total).toFixed(2)}` : ''
  return `${vendorName(b)} ${inv}${amt}`
}

function attentionRow(b: DigestBill, reason: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #F3F4F6;">
        <a href="${APP_URL}/bills/${b.bill_id}" style="color: #111827; font-size: 13px; font-weight: 500; text-decoration: none;">${escapeHtml(billLabel(b))}</a>
        <div style="color: #6B7280; font-size: 12px; margin-top: 2px;">${escapeHtml(reason)}</div>
      </td>
    </tr>`
}

function section(title: string, inner: string): string {
  return `
    <p style="color: #111827; font-size: 13px; font-weight: 600; margin: 20px 0 6px;">${title}</p>
    ${inner}`
}

// Builds and sends one company's digest. Returns false when there was nothing to report,
// so quiet days don't produce an empty email.
export async function sendDailyDigestForCompany(companyId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('name, notification_emails, daily_digest')
    .eq('company_id', companyId)
    .single()

  const emails: string[] = company?.notification_emails ?? []
  if (!company?.daily_digest || emails.length === 0) return false

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const select = `
    bill_id, status, invoice_number, total, vendor_name_raw, autopublish_hold_reason,
    qb_sync_error, publish_method, published_at, created_at,
    vendors!bills_vendor_id_fkey ( vendor_name_display, auto_publish_enabled )
  `

  const [{ data: openData }, { data: publishedData }, { count: processedCount }] = await Promise.all([
    supabase.from('bills').select(select)
      .eq('company_id', companyId)
      .in('status', ['draft', 'ready', 'pending_job_match', 'sync_error'])
      .order('created_at', { ascending: true }),
    supabase.from('bills').select(select)
      .eq('company_id', companyId)
      .eq('status', 'published')
      .gt('published_at', since),
    supabase.from('bills').select('bill_id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gt('created_at', since),
  ])

  const open = (openData ?? []) as unknown as DigestBill[]
  const published = (publishedData ?? []) as unknown as DigestBill[]

  const syncErrors = open.filter(b => b.status === 'sync_error')
  // Held = the vendor is on auto-publish, so the user expects it posted, but it hasn't
  const held = open.filter(b => b.status !== 'sync_error' && b.vendors?.auto_publish_enabled)
  const awaitingReview = open.filter(b => b.status !== 'sync_error' && !b.vendors?.auto_publish_enabled)

  const autoCount = published.filter(b => b.publish_method === 'auto').length
  const manualCount = published.length - autoCount

  const attentionCount = syncErrors.length + held.length
  if (attentionCount === 0 && published.length === 0 && (processedCount ?? 0) === 0 && awaitingReview.length === 0) {
    return false
  }

  let html = ''

  if (attentionCount > 0) {
    const rows = [
      ...syncErrors.map(b => attentionRow(b, `QuickBooks sync failed: ${b.qb_sync_error ?? 'unknown error'}`)),
      ...held.map(b => attentionRow(b, b.autopublish_hold_reason ?? 'Held from auto-publish — open the bill to see why.')),
    ].join('')
    html += section(
      `⚠️ Needs your attention (${attentionCount})`,
      `<table style="width: 100%; border-collapse: collapse;">${rows}</table>`,
    )
  } else {
    html += section('✅ Nothing needs your attention', '<p style="color: #6B7280; font-size: 13px; margin: 0;">Every auto-publish vendor\'s bills went through.</p>')
  }

  const stat = (label: string, value: number) =>
    `<tr><td style="padding: 3px 0; color: #6B7280; font-size: 13px;">${label}</td><td style="padding: 3px 0; color: #111827; font-size: 13px; font-weight: 600; text-align: right;">${value}</td></tr>`

  html += section('Last 24 hours', `
    <table style="width: 100%; border-collapse: collapse;">
      ${stat('Bills captured', processedCount ?? 0)}
      ${stat('Posted to QuickBooks automatically', autoCount)}
      ${stat('Posted to QuickBooks manually', manualCount)}
      ${stat('Waiting for your review', awaitingReview.length)}
    </table>`)

  const subject = attentionCount > 0
    ? `Daily digest: ${attentionCount} bill${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention`
    : 'Daily digest: all clear'

  const htmlBody = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #1A3D2B; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <span style="color: white; font-size: 15px; font-weight: 600;">Purchasomatic daily digest</span>
      </div>
      <div style="background: white; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        <p style="color: #111827; font-size: 14px; margin: 0;">${escapeHtml(company.name ?? 'Your company')}</p>
        ${html}
        <a href="${APP_URL}/bills" style="display: inline-block; margin-top: 20px; background: #2DB87A; color: white; border-radius: 6px; padding: 8px 18px; font-size: 13px; font-weight: 500; text-decoration: none;">Open Bills</a>
        <p style="color: #9CA3AF; font-size: 11px; margin-top: 24px; margin-bottom: 0;">
          You are receiving this because the daily digest is on for your company.
          Manage notification settings in <a href="${APP_URL}/settings" style="color: #2DB87A;">Settings</a>.
        </p>
      </div>
    </div>
  `

  const resend = getResend()
  if (!resend) {
    console.warn('[digest] RESEND_API_KEY not set — skipping email')
    return false
  }

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: emails,
      subject: `[Purchasomatic] ${subject}`,
      html: htmlBody,
    })
    return true
  } catch (err) {
    console.error(`[digest] Resend send failed for company ${companyId}:`, err)
    return false
  }
}
