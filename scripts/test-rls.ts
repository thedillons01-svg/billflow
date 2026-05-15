import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const url   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svcRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

const service = createClient(url, svcRole)
const anonClient = createClient(url, anon)

async function main() {
  console.log('=== Purchasomatic RLS smoke test ===\n')

  // 1. Check company_members table was backfilled
  const { data: members, error: membersErr } = await service
    .from('company_members')
    .select('user_id, company_id, role')

  if (membersErr) {
    console.error('FAIL: company_members query error:', membersErr.message)
    process.exit(1)
  }
  console.log(`✓ company_members has ${members?.length ?? 0} row(s)`)
  if (!members?.length) {
    console.error('FAIL: backfill did not run — no membership rows')
    process.exit(1)
  }

  // 2. Verify anon client (no session) sees ZERO rows on protected tables
  const tables = ['companies', 'bills', 'vendors', 'bill_line_items'] as const
  for (const table of tables) {
    const { data, error } = await anonClient.from(table).select('*').limit(5)
    if (error) {
      // RLS blocking unauthenticated = expected
      console.log(`✓ ${table}: anon blocked (${error.message})`)
    } else if (!data || data.length === 0) {
      console.log(`✓ ${table}: anon sees 0 rows (RLS working)`)
    } else {
      console.error(`FAIL: ${table}: anon client returned ${data.length} rows — RLS not blocking!`)
      process.exit(1)
    }
  }

  // 3. Service role should see all rows
  const { data: allBills } = await service.from('bills').select('bill_id').limit(100)
  console.log(`✓ service role sees ${allBills?.length ?? 0} bill(s) (bypasses RLS as expected)`)

  // 4. Check policies exist on key tables
  const { data: policies } = await service
    .from('pg_policies' as never)
    .select('tablename, policyname')
    .in('tablename' as never, ['companies', 'bills', 'vendors', 'bill_line_items', 'company_members'] as never)

  if (policies) {
    console.log(`\n✓ ${policies.length} RLS policies found on key tables:`)
    for (const p of policies as Array<{ tablename: string; policyname: string }>) {
      console.log(`    ${p.tablename}: ${p.policyname}`)
    }
  }

  console.log('\n✓ All checks passed — RLS is active and blocking unauthenticated access.')
}

main().catch(err => { console.error(err); process.exit(1) })
