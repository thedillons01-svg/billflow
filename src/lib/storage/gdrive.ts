import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GDriveCompanyFields = {
  gdrive_access_token:     string | null
  gdrive_refresh_token:    string | null
  gdrive_token_expires_at: string | null
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

export async function getValidGDriveToken(
  company: GDriveCompanyFields,
  companyId: string,
): Promise<string> {
  if (!company.gdrive_access_token || !company.gdrive_refresh_token) {
    throw new Error('Google Drive not connected')
  }

  const expiresAt = company.gdrive_token_expires_at
    ? new Date(company.gdrive_token_expires_at)
    : new Date(0)

  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return company.gdrive_access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: company.gdrive_refresh_token,
      grant_type:    'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Google Drive token refresh failed: ${res.status}`)

  const data = await res.json() as { access_token: string; expires_in: number }
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await createServiceClient()
    .from('companies')
    .update({ gdrive_access_token: data.access_token, gdrive_token_expires_at: newExpiry })
    .eq('company_id', companyId)

  return data.access_token
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

export async function uploadToGDrive(opts: {
  accessToken: string
  folderId: string
  filename: string
  buffer: Buffer
}): Promise<void> {
  const { accessToken, folderId, filename, buffer } = opts
  const boundary = 'purchasomatic_boundary'

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: filename, parents: [folderId] }) +
      `\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${accessToken}`,
        'Content-Type':  `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Drive upload failed (${res.status}): ${text.slice(0, 200)}`)
  }
}

// ---------------------------------------------------------------------------
// Folder listing (used by settings UI folder picker)
// ---------------------------------------------------------------------------

export async function listGDriveFolders(
  accessToken: string,
  parentId: string = 'root',
): Promise<Array<{ id: string; name: string }>> {
  const q = `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&pageSize=100`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Folder listing failed: ${res.status}`)

  const data = await res.json() as { files: Array<{ id: string; name: string }> }
  return data.files ?? []
}
