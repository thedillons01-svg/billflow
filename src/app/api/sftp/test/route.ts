import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testSftpConnection } from '@/lib/storage/sftp'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    host?: string
    port?: number
    username?: string
    password?: string
  }

  if (!body.host || !body.username || !body.password) {
    return NextResponse.json({ error: 'host, username and password are required' }, { status: 400 })
  }

  const result = await testSftpConnection({
    host:     body.host,
    port:     body.port ?? 22,
    username: body.username,
    password: body.password,
  })

  return NextResponse.json(result)
}
