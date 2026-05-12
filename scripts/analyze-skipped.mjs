#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: c } = await supabase.from('campaigns').select('id').eq('name', 'Founding Partners').single()

const { data: steps } = await supabase.from('campaign_steps').select('id').eq('campaign_id', c.id)
const stepIds = steps.map((s) => s.id)

const { data: logs } = await supabase
  .from('mail_logs')
  .select('id, status, contact_id, contacts(email, company, global_opt_out, bounced_at, status, custom_fields), campaign_runs(status)')
  .in('campaign_step_id', stepIds)

console.log(`Totaal mail_logs voor "Founding Partners": ${logs.length}\n`)

const byStatus = {}
for (const l of logs) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
console.log('Status-verdeling:')
for (const [s, n] of Object.entries(byStatus)) console.log(`  ${s.padEnd(10)} ${n}`)

const skipped = logs.filter((l) => l.status === 'skipped')
console.log(`\nGedetailleerde reden voor ${skipped.length} skipped:`)

const reasons = {}
const examples = {}
for (const l of skipped) {
  const c = l.contacts
  const r = l.campaign_runs
  let reason
  if (!c) reason = 'contact niet gevonden'
  else if (c.global_opt_out) reason = 'global_opt_out=true'
  else if (c.bounced_at) reason = `bounced_at gezet (${c.bounced_at})`
  else if (r?.status === 'opted_out') reason = 'campaign_run.status=opted_out'
  else reason = 'onbekend (template/campagne mogelijk null)'
  reasons[reason] = (reasons[reason] ?? 0) + 1
  if (!examples[reason]) examples[reason] = []
  if (examples[reason].length < 5) examples[reason].push(c?.email ?? '(?)')
}
for (const [r, n] of Object.entries(reasons)) {
  console.log(`  ${n}× ${r}`)
  console.log(`     voorbeelden: ${examples[r].join(', ')}`)
}
