import { createClient } from '@/lib/supabase/server'

const QBO_BASE_URL = process.env.QBO_BASE_URL ?? 'https://sandbox-quickbooks.api.intuit.com'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

async function refreshAccessToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

export async function getQBClient(companyId: string) {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('qb_realm_id, qb_access_token, qb_refresh_token, qb_token_expires_at, qb_connection_status')
    .eq('company_id', companyId)
    .single()

  if (!company?.qb_access_token || company.qb_connection_status !== 'connected') {
    throw new Error('QuickBooks not connected')
  }

  let { qb_access_token: accessToken, qb_refresh_token: refreshToken, qb_token_expires_at: expiresAt, qb_realm_id: realmId } = company

  // Refresh if expiring within 5 minutes
  if (new Date(expiresAt as string).getTime() - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(refreshToken as string)
    accessToken = newTokens.access_token
    refreshToken = newTokens.refresh_token
    const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
    await supabase
      .from('companies')
      .update({ qb_access_token: accessToken, qb_refresh_token: refreshToken, qb_token_expires_at: newExpiresAt })
      .eq('company_id', companyId)
  }

  async function qbQuery(query: string) {
    const url = new URL(`${QBO_BASE_URL}/v3/company/${realmId}/query`)
    url.searchParams.set('query', query)
    url.searchParams.set('minorversion', '65')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`QBO query failed (${res.status}): ${await res.text()}`)
    return res.json()
  }

  async function qbFetchAll<T>(entity: string, baseQuery: string): Promise<T[]> {
    const results: T[] = []
    let start = 1
    const max = 1000
    while (true) {
      const data = await qbQuery(`${baseQuery} STARTPOSITION ${start} MAXRESULTS ${max}`)
      const items: T[] = data.QueryResponse?.[entity] ?? []
      results.push(...items)
      if (items.length < max) break
      start += max
    }
    return results
  }

  return { qbFetchAll, realmId }
}
