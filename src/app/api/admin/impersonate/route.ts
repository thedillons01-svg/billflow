import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'thedillons01@gmail.com'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const admin = createServiceClient()

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (error || !data?.properties?.email_otp) {
    return NextResponse.json({ error: error?.message ?? 'Failed to generate OTP' }, { status: 500 })
  }

  return NextResponse.json({ email, otp: data.properties.email_otp })
}
