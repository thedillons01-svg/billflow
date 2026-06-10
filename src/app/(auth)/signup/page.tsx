'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup, type AuthState } from '@/app/actions/auth'

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(signup, null)

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
        <p style={{ fontSize: 14, color: '#6B7280' }}>Create your account</p>
      </div>

      <div style={{
        background: 'white', borderRadius: 12,
        border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: 32,
      }}>
        {state?.message ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontSize: 13, color: '#065F46', background: '#ECFDF5',
              border: '1px solid #A7F3D0', borderRadius: 6, padding: '12px 16px',
            }}>
              {state.message}
            </div>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: '#2DB87A', textDecoration: 'none' }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <input
                id="password" name="password" type="password"
                autoComplete="new-password" required
                style={{
                  width: '100%', height: 38, boxSizing: 'border-box',
                  border: '1px solid #D1D5DB', borderRadius: 7,
                  padding: '0 12px', fontSize: 14, color: '#111827',
                  outline: 'none',
                }}
              />
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
              {isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>

      {!state?.message && (
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ fontWeight: 500, color: '#2DB87A', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      )}
    </div>
  )
}
