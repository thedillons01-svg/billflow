import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, qbd_service_key')
    .single()

  if (!company) return NextResponse.json({ error: 'No company' }, { status: 404 })

  // Generate service key if not set
  let serviceKey = company.qbd_service_key
  if (!serviceKey) {
    serviceKey = randomBytes(8).toString('hex')
    await supabase.from('companies')
      .update({ qbd_service_key: serviceKey })
      .eq('company_id', company.company_id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'
  const appId = `Purchasomatic-${company.company_id.slice(0, 8)}`

  const qwc = `<?xml version="1.0"?>
<QBWCXML>
  <AppName>Purchasomatic</AppName>
  <AppID>${appId}</AppID>
  <AppURL>${appUrl}/api/quickbooks/qbd</AppURL>
  <AppDescription>Purchasomatic — Automated vendor invoice capture for ${company.name}</AppDescription>
  <AppSupport>${appUrl}/settings</AppSupport>
  <UserName>${serviceKey}</UserName>
  <Password>${serviceKey}</Password>
  <OwnerID>{${company.company_id.toUpperCase()}}</OwnerID>
  <FileID>{${randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5').toUpperCase()}}</FileID>
  <QBType>QBFS</QBType>
  <Scheduler>
    <RunEveryNMinutes>30</RunEveryNMinutes>
  </Scheduler>
</QBWCXML>`

  return new NextResponse(qwc, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="Purchasomatic-${company.name.replace(/[^a-z0-9]/gi, '_')}.QWC"`,
    },
  })
}
