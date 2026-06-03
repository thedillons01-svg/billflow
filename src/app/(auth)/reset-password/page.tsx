'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setIsPending(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setIsPending(false)
    } else {
      router.push('/bills')
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Purchasomatic</h1>
        <p className="mt-2 text-sm text-gray-500">Set a new password</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
