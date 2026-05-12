#!/usr/bin/env node
/**
 * 1. Verwijder hello@danfold.nl uit SendGrid's bounce-suppression-lijst
 * 2. Zet zijn mail_log terug op pending zodat 'Verwerk wachtrij' 'm oppakt
 */
import { createClient } from '@supabase/supabase-js'

const EMAIL = 'hello@danfold.nl'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// 1. SendGrid bounce-suppression verwijderen
console.log(`SendGrid: ${EMAIL} uit bounce-lijst verwijderen…`)
const sgRes = await fetch(`https://api.sendgrid.com/v3/suppression/bounces/${encodeURIComponent(EMAIL)}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
})
if (!sgRes.ok && sgRes.status !== 404) {
  console.error(`  fout: ${sgRes.status} ${await sgRes.text()}`)
  process.exit(1)
}
console.log(`  ${sgRes.status === 404 ? 'niet gevonden (geen suppression)' : 'verwijderd'}`)

// 2. Check ook blocks + invalid + spam_reports
for (const list of ['blocks', 'invalid_emails', 'spam_reports']) {
  const r = await fetch(`https://api.sendgrid.com/v3/suppression/${list}/${encodeURIComponent(EMAIL)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
  })
  console.log(`  ${list}: ${r.status === 404 ? 'niet aanwezig' : r.ok ? 'verwijderd' : `fout ${r.status}`}`)
}

// 3. Contact ophalen
const { data: contact } = await supabase
  .from('contacts')
  .select('id, email')
  .eq('email', EMAIL)
  .single()

if (!contact) { console.error(`Contact ${EMAIL} niet gevonden`); process.exit(1) }

// 4. Campagne status terug op sending
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, status')
  .eq('name', 'Testmailing')
  .single()

if (campaign.status !== 'sending') {
  await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id)
  console.log(`\nCampagne "Testmailing" terug op sending`)
}

// 5. Mail-log reset (meest recente voor dit contact in deze campagne)
const { data: runs } = await supabase
  .from('campaign_runs')
  .select('id')
  .eq('campaign_id', campaign.id)
  .eq('contact_id', contact.id)

const runIds = runs.map((r) => r.id)

const now = new Date().toISOString()
const { data: updated } = await supabase
  .from('mail_logs')
  .update({ status: 'pending', scheduled_at: now, retry_count: 0, sent_at: null, error_message: null, external_message_id: null })
  .in('campaign_run_id', runIds)
  .select('id')

console.log(`${updated.length} mail_log(s) gereset naar pending voor ${EMAIL}`)
console.log('\nKlik "Verwerk wachtrij" op de Testmailing campagnepagina.')
