'use client'

import { useActionState, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login, type AuthState } from '@/app/actions/auth'

function LoginForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(login, null)
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const confirmError = searchParams.get('error') === 'confirmation_failed'

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <img src="/logo-512.png" alt="Purchasomatic" style={{ width: 48, height: 48 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1A3D2B', letterSpacing: '-0.01em' }}>
            Purchasomatic
          </span>
        </div>
        <p style={{ fontSize: 14, color: '#6B7280' }}>Sign in to your account</p>
      </div>

      <div style={{
        background: 'white', borderRadius: 12,
        border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: 32,
      }}>
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {confirmError && (
            <div style={{
              fontSize: 13, color: '#92400E', background: '#FFFBEB',
              border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 12px',
            }}>
              Email confirmation failed or expired. Please try signing up again.
            </div>
          )}
          {state?.error && (
            <div style={{
              fontSize: 13, color: '#991B1B', background: '#FEF2F2',
              border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px',
            }}>
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email" name="email" type="email"
              autoComplete="email" required placeholder="you@example.com"
              style={{
                width: '100%', height: 38, boxSizing: 'border-box',
                border: '1px solid #D1D5DB', borderRadius: 7,
                padding: '0 12px', fontSize: 14, color: '#111827',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                Password
              </label>
              <Link href="/forgot-password" style={{ fontSize: 12, color: '#2DB87A', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" required
                style={{
                  width: '100%', height: 38, boxSizing: 'border-box',
                  border: '1px solid #D1D5DB', borderRadius: 7,
                  padding: '0 38px 0 12px', fontSize: 14, color: '#111827',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                  color: '#9CA3AF', lineHeight: 1,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 16 }} />
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={isPending}
            style={{
              width: '100%', height: 40,
              background: isPending ? '#86EFBD' : '#2DB87A',
              color: 'white', border: 'none', borderRadius: 7,
              fontSize: 14, fontWeight: 600, cursor: isPending ? 'default' : 'pointer',
              marginTop: 4,
            }}
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={{ fontWeight: 500, color: '#2DB87A', textDecoration: 'none' }}>
          Sign up free
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
