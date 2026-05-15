import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const FROM_ADDRESS = 'Purchasomatic <notifications@purchasomatic.com>'

export type NotificationEvent =
  | 'bill_processed'
  | 'bill_auto_published'
  | 'bill_sync_error'
  | 'po_processed'
  | 'po_matched'
  | 'job_match_failed'
  | 'autopublish_disabled'
  | 'qb_heartbeat_lost'
  | 'wrong_capture_address'
  | 'unrecognized_sender'

const ERROR_EVENTS: NotificationEvent[] = [
  'bill_sync_error',
  'job_match_failed',
  'autopublish_disabled',
  'qb_heartbeat_lost',
  'wrong_capture_address',
  'unrecognized_sender',
]

export async function sendNotification({
  companyId,
  event,
  subject,
  body,
  billId,
  poId,
}: {
  companyId: string
  event: NotificationEvent
  subject: string
  body: string
  billId?: string
  poId?: string
}): Promise<void> {
  const supabase = getServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('notification_emails, success_notifications, daily_digest')
    .eq('company_id', companyId)
    .single()

  if (!company) return

  const isError = ERROR_EVENTS.includes(event)

  // Error notifications are always sent; success notifications respect the toggle
  if (!isError && !company.success_notifications) {
    // Still create in-app notification even if email suppressed
    await insertInAppNotification(supabase, companyId, event, subject, body, billId, poId)
    return
  }

  // Always create in-app notification
  await insertInAppNotification(supabase, companyId, event, subject, body, billId, poId)

  const emails: string[] = company.notification_emails ?? []
  if (emails.length === 0) return

  const resend = getResend()
  if (!resend) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping email')
    return
  }

  const htmlBody = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #1A3D2B; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <span style="color: white; font-size: 15px; font-weight: 600;">Purchasomatic</span>
      </div>
      <div style="background: white; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        <p style="color: #111827; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${body.replace(/\n/g, '<br>')}</p>
        ${billId ? `<a href="https://www.purchasomatic.com/bills/${billId}" style="display: inline-block; background: #2DB87A; color: white; border-radius: 6px; padding: 8px 18px; font-size: 13px; font-weight: 500; text-decoration: none;">View Bill</a>` : ''}
        ${poId ? `<a href="https://www.purchasomatic.com/purchase-orders/${poId}" style="display: inline-block; background: #2DB87A; color: white; border-radius: 6px; padding: 8px 18px; font-size: 13px; font-weight: 500; text-decoration: none;">View PO</a>` : ''}
        <p style="color: #9CA3AF; font-size: 11px; margin-top: 24px; margin-bottom: 0;">
          You are receiving this because you are configured as a Purchasomatic notification recipient.
          Manage notification settings in <a href="https://www.purchasomatic.com/settings" style="color: #2DB87A;">Settings</a>.
        </p>
      </div>
    </div>
  `

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: emails,
      subject: `[Purchasomatic] ${subject}`,
      html: htmlBody,
    })
  } catch (err) {
    console.error('[notifications] Resend send failed:', err)
  }
}

async function insertInAppNotification(
  supabase: ReturnType<typeof getServiceClient>,
  companyId: string,
  event: NotificationEvent,
  subject: string,
  body: string,
  billId?: string,
  poId?: string,
): Promise<void> {
  const isError = ERROR_EVENTS.includes(event)
  await supabase.from('notifications').insert({
    company_id: companyId,
    type:       isError ? 'error' : 'success',
    title:      subject,
    body,
    bill_id:    billId ?? null,
    po_id:      poId ?? null,
    is_read:    false,
  })
}
