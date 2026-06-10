'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AuthState = { error?: string; message?: string } | null

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  const { data: membership } = await supabase.from('company_members').select('company_id').limit(1).single()
  if (!membership) redirect('/onboarding')
  redirect('/bills')
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${appUrl}/api/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  if (data.session) redirect('/onboarding')

  return { message: 'Check your email for a confirmation link to complete sign-up.' }
}

export async function forgotPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const redirectTo = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/reset-password'

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) return { error: error.message }
  return { message: 'Check your email for a password reset link.' }
}

export async function signout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
