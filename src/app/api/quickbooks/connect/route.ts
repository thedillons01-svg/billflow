import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'

const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'

// Scopes required by Intuit app review: accounting + OpenID identity
const SCOPES = 'com.intuit.quickbooks.accounting openid profile email'

export async function GET() {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('company_id')
    .single()

  if (!company) {
    return NextResponse.redirect(
      new URL('/settings?qb_error=no_company', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }

  // CSRF state: companyId.randomNonce
  const nonce = randomBytes(16).toString('hex')
  const state = `${company.company_id}.${nonce}`

  // PKCE: generate code_verifier + code_challenge (S256)
  const codeVerifier  = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  const params = new URLSearchParams({
    client_id:             process.env.QBO_CLIENT_ID!,
    response_type:         'code',
    scope:                 SCOPES,
    redirect_uri:          process.env.QBO_REDIRECT_URI!,
    state,
    prompt:                'login',
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  })

  const response = NextResponse.redirect(`${INTUIT_AUTH_URL}?${params}`)

  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   600,
    path:     '/',
    sameSite: 'lax' as const,
  }

  response.cookies.set('qb_oauth_state',    state,        cookieOpts)
  response.cookies.set('qb_pkce_verifier',  codeVerifier, cookieOpts)

  return response
}
