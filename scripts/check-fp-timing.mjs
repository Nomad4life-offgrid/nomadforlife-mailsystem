import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: c } = await supabase.from('campaigns').select('id, name, status, sent_at, recipient_count').eq('name', 'Founding Partners').single()
console.log('Campagne:', c)

const { data: step } = await supabase.from('campaign_steps').select('id').eq('campaign_id', c.id).single()

const { data: byStatus } = await supabase.from('mail_logs').select('status, updated_at').eq('campaign_step_id', step.id)
const buckets = {}
for (const l of byStatus) {
  const min = l.updated_at.slice(0, 19)
  const k = `${l.status} | ${min}`
  buckets[k] = (buckets[k] ?? 0) + 1
}
console.log('\nGroepering (status | updated_at tot op sec):')
Object.entries(buckets).sort().forEach(([k, n]) => console.log(`  ${n.toString().padStart(3)} × ${k}`))

// Voor 5 skipped logs, toon volledige info
console.log('\n5 skipped logs details:')
const { data: sk } = await supabase
  .from('mail_logs')
  .select('id, status, error_message, scheduled_at, updated_at, contacts(email, custom_fields, global_opt_out, bounced_at), campaign_steps(template_id, templates(id, name)), campaign_runs(status)')
  .eq('campaign_step_id', step.id)
  .eq('status', 'skipped')
  .limit(5)
for (const l of sk) {
  console.log(`\n  ${l.contacts?.email}`)
  console.log(`    template: ${l.campaign_steps?.templates?.name ?? 'NULL'}`)
  console.log(`    run status: ${l.campaign_runs?.status ?? 'NULL'}`)
  console.log(`    bounced_at: ${l.contacts?.bounced_at ?? 'null'}`)
  console.log(`    global_opt_out: ${l.contacts?.global_opt_out}`)
  console.log(`    branche: ${l.contacts?.custom_fields?.branche ?? 'null'}`)
  console.log(`    error_msg: ${l.error_message ?? 'null'}`)
}
