import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function settingsRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/settings', request.nextUrl.origin)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code    = searchParams.get('code')
  const state   = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const error   = searchParams.get('error')

  if (error) {
    return settingsRedirect(request, { qb_error: 'access_denied' })
  }

  if (!code || !state || !realmId) {
    return settingsRedirect(request, { qb_error: 'missing_params' })
  }

  // Verify CSRF state against cookie
  const storedState = request.cookies.get('qb_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return settingsRedirect(request, { qb_error: 'invalid_state' })
  }

  // Extract company_id from state (format: companyId.nonce)
  const companyId = state.split('.')[0]

  // Exchange authorization code for tokens
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    console.error('QBO token exchange failed:', await tokenRes.text())
    return settingsRedirect(request, { qb_error: 'token_exchange_failed' })
  }

  const tokens = await tokenRes.json() as {
    access_token:  string
    refresh_token: string
    expires_in:    number
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Persist tokens to the company record
  const supabase = await createClient()
  const { error: dbError } = await supabase
    .from('companies')
    .update({
      qb_realm_id:          realmId,
      qb_access_token:      tokens.access_token,
      qb_refresh_token:     tokens.refresh_token,
      qb_token_expires_at:  expiresAt,
      qb_connection_status: 'connected',
      qb_type:              'qbo',
    })
    .eq('company_id', companyId)

  if (dbError) {
    console.error('Failed to store QB tokens:', dbError)
    return settingsRedirect(request, { qb_error: 'storage_failed' })
  }

  // Clear the state cookie and redirect to settings
  const response = settingsRedirect(request, { qb_connected: 'true' })
  response.cookies.delete('qb_oauth_state')
  return response
}
