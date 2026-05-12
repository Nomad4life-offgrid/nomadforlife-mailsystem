#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Welke campagnes hebben pending logs?
const { data: logs } = await supabase
  .from('mail_logs')
  .select('id, status, scheduled_at, campaign_step_id, contact_id, campaign_steps(campaign_id, campaigns(name, status))')
  .order('scheduled_at', { ascending: false })
  .limit(20)

console.log(`Mail logs (laatste 20):`)
for (const l of logs ?? []) {
  const c = l.campaign_steps?.campaigns
  console.log(`  ${l.status.padEnd(8)} sched=${l.scheduled_at}  campaign="${c?.name}" status=${c?.status}`)
}

// Check sendgrid config
console.log(`\nSendgrid env:`)
console.log(`  SENDGRID_API_KEY:    ${process.env.SENDGRID_API_KEY ? 'set (' + process.env.SENDGRID_API_KEY.slice(0,8) + '…)' : 'MISSING'}`)
console.log(`  SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL ?? 'MISSING'}`)
console.log(`  SENDGRID_FROM_NAME:  ${process.env.SENDGRID_FROM_NAME ?? 'MISSING'}`)
console.log(`  APP_URL:             ${process.env.APP_URL ?? 'MISSING'}`)
console.log(`  NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL ?? 'MISSING'}`)
