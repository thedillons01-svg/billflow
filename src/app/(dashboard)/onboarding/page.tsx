import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, qb_type, fsm_platform, job_costing_enabled')
    .single()

  return (
    <div
      className="flex h-full items-center justify-center px-4"
      style={{ background: '#F7F9F8' }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex items-center justify-center rounded-[10px] text-white"
            style={{ width: 40, height: 40, background: '#2DB87A', fontSize: 18, fontWeight: 700 }}
          >
            P
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Welcome to Purchasomatic
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6 }}>
            Set up your company to start capturing vendor invoices automatically.
          </p>
        </div>

        <div
          style={{
            background: 'white',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <OnboardingForm
            defaultName={company?.name ?? ''}
            defaultQbType={(company?.qb_type ?? 'qbo') as 'qbo' | 'qbd'}
            defaultFsm={(company?.fsm_platform ?? 'unknown') as string}
            defaultJobCosting={company?.job_costing_enabled ?? false}
          />
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          You can change these settings anytime in Settings.
        </p>
      </div>
    </div>
  )
}
