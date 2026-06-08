/**
 * Fetches Intuit's OpenID Connect discovery document and caches the endpoints
 * for the lifetime of the server process.
 *
 * Using the discovery document (rather than hardcoded URLs) is an Intuit
 * app-review requirement so the app automatically picks up any endpoint changes.
 */

const DISCOVERY_URL = 'https://developer.api.intuit.com/.well-known/openid_configuration'

type IntuitEndpoints = {
  authorization_endpoint: string
  token_endpoint: string
  revocation_endpoint: string
}

let cached: IntuitEndpoints | null = null

export async function getIntuitEndpoints(): Promise<IntuitEndpoints> {
  if (cached) return cached

  const res = await fetch(DISCOVERY_URL, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`Failed to fetch Intuit discovery document: ${res.status}`)

  const doc = await res.json() as Record<string, string>

  cached = {
    authorization_endpoint: doc.authorization_endpoint,
    token_endpoint:         doc.token_endpoint,
    revocation_endpoint:    doc.revocation_endpoint,
  }

  return cached
}
