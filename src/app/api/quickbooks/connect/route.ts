import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'

export async function GET() {
  const supabase = await createClient()

  // Get the user's company
  const { data: company } = await supabase
    .from('companies')
    .select('company_id')
    .single()

  if (!company) {
    return NextResponse.redirect(
      new URL('/settings?qb_error=no_company', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }

  // Build CSRF state: companyId.randomNonce
  const nonce = randomBytes(16).toString('hex')
  const state = `${company.company_id}.${nonce}`

  // Build Intuit authorization URL
  const params = new URLSearchParams({
    client_id:     process.env.QBO_CLIENT_ID!,
    response_type: 'code',
    scope:         'com.intuit.quickbooks.accounting',
    redirect_uri:  process.env.QBO_REDIRECT_URI!,
    state,
  })

  const response = NextResponse.redirect(`${INTUIT_AUTH_URL}?${params}`)

  // Store state in a short-lived HttpOnly cookie for CSRF verification
  response.cookies.set('qb_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600, // 10 minutes
    path:     '/',
    sameSite: 'lax',
  })

  return response
}
