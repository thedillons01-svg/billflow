'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup, type AuthState } from '@/app/actions/auth'

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(signup, null)

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">BillFlow</h1>
        <p className="mt-2 text-sm text-gray-500">Create your account</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        {state?.message ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-4">
              {state.message}
            </p>
            <Link href="/login" className="block text-sm font-medium text-blue-600 hover:text-blue-500">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>

      {!state?.message && (
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      )}
    </div>
  )
}
