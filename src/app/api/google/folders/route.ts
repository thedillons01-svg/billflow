import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getValidGDriveToken, listGDriveFolders } from '@/lib/storage/gdrive'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parentId = req.nextUrl.searchParams.get('parent') ?? 'root'

  const service = createServiceClient()
  const { data: membership } = await service
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No company' }, { status: 404 })

  const { data: company } = await service
    .from('companies')
    .select('gdrive_access_token, gdrive_refresh_token, gdrive_token_expires_at')
    .eq('company_id', membership.company_id)
    .single()

  if (!company?.gdrive_access_token) {
    return NextResponse.json({ error: 'Google Drive not connected' }, { status: 400 })
  }

  try {
    const accessToken = await getValidGDriveToken(company, membership.company_id)
    const folders = await listGDriveFolders(accessToken, parentId)
    return NextResponse.json({ folders })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
