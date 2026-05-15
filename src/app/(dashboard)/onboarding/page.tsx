import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // If company is already set up, go to bills
  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, qb_type, fsm_platform, job_costing_enabled')
    .single()

  return (
    <div className="flex h-full items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
            <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0 1 12 2v5h4a1 1 0 0 1 .82 1.573l-7 10A1 1 0 0 1 8 18v-5H4a1 1 0 0 1-.82-1.573l7-10a1 1 0 0 1 1.12-.38Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Purchasomatic</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Set up your company to start capturing vendor invoices automatically.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <OnboardingForm
            defaultName={company?.name ?? ''}
            defaultQbType={(company?.qb_type ?? 'qbo') as 'qbo' | 'qbd'}
            defaultFsm={(company?.fsm_platform ?? 'unknown') as string}
            defaultJobCosting={company?.job_costing_enabled ?? false}
          />
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          You can change these settings anytime in Settings.
        </p>
      </div>
    </div>
  )
}
