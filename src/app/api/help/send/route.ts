import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSms } from '@/lib/notifications/send-sms'

const FROM_ADDRESS = 'Purchasomatic <notifications@purchasomatic.com>'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { message?: string; pageUrl?: string }
  const message = (body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  if (message.length > 2000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

  const service = createServiceClient()

  const { data: membership } = await service
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const { data: company } = membership
    ? await service.from('companies').select('name').eq('company_id', membership.company_id).single()
    : { data: null }

  await service.from('help_messages').insert({
    company_id: membership?.company_id ?? null,
    user_id: user.id,
    user_email: user.email,
    message,
    page_url: body.pageUrl ?? null,
  })

  const companyName = company?.name ?? 'Unknown company'
  const smsBody = `Purchasomatic help message from ${user.email} (${companyName}): ${message.slice(0, 300)}`
  await sendSms(smsBody)

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    try {
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: [process.env.ADMIN_EMAIL ?? 'thedillons01@gmail.com'],
        subject: `Help message from ${companyName}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <div style="background: #1A3D2B; padding: 16px 20px; border-radius: 8px 8px 0 0;">
              <span style="color: white; font-size: 15px; font-weight: 600;">Help message</span>
            </div>
            <div style="background: white; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
              <table style="font-size: 14px; color: #111827; border-collapse: collapse; width: 100%; margin-bottom: 16px;">
                <tr><td style="padding: 4px 0; color: #6B7280; width: 100px;">Company</td><td style="padding: 4px 0; font-weight: 500;">${companyName}</td></tr>
                <tr><td style="padding: 4px 0; color: #6B7280;">User</td><td style="padding: 4px 0;">${user.email}</td></tr>
                <tr><td style="padding: 4px 0; color: #6B7280;">Page</td><td style="padding: 4px 0;">${body.pageUrl ?? 'n/a'}</td></tr>
              </table>
              <p style="color: #111827; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message.replace(/</g, '&lt;')}</p>
            </div>
          </div>
        `,
      })
    } catch (err) {
      console.error('[help] Resend send failed:', err)
    }
  }

  return NextResponse.json({ success: true })
}
