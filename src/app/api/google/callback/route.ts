import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  const settingsUrl = new URL('/settings', req.url)

  if (error || !code) {
    settingsUrl.searchParams.set('gdrive_error', '1')
    return NextResponse.redirect(settingsUrl)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('[gdrive-callback] Token exchange failed:', await tokenRes.text())
    settingsUrl.searchParams.set('gdrive_error', '1')
    return NextResponse.redirect(settingsUrl)
  }

  const tokens = await tokenRes.json() as {
    access_token:  string
    refresh_token: string
    expires_in:    number
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const service = createServiceClient()
  const { data: membership } = await service
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    settingsUrl.searchParams.set('gdrive_error', '1')
    return NextResponse.redirect(settingsUrl)
  }

  await service
    .from('companies')
    .update({
      gdrive_enabled:          true,
      gdrive_access_token:     tokens.access_token,
      gdrive_refresh_token:    tokens.refresh_token,
      gdrive_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq('company_id', membership.company_id)

  settingsUrl.searchParams.set('gdrive_connected', '1')
  return NextResponse.redirect(settingsUrl)
}
