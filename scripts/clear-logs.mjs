#!/usr/bin/env node
/**
 * Leeg alle mail-logs, campaign_runs, en reset campagne-verzendstatus.
 * Gebruik tijdens testen om opnieuw te kunnen verzenden.
 */
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

console.log('Mail logs verwijderen…')
const { error: e1, count: c1 } = await supabase
  .from('mail_logs')
  .delete({ count: 'exact' })
  .gte('created_at', '1970-01-01')
if (e1) { console.error(e1); process.exit(1) }
console.log(`  ${c1 ?? '?'} rijen verwijderd`)

console.log('Campaign runs verwijderen…')
const { error: e2, count: c2 } = await supabase
  .from('campaign_runs')
  .delete({ count: 'exact' })
  .gte('subscribed_at', '1970-01-01')
if (e2) { console.error(e2); process.exit(1) }
console.log(`  ${c2 ?? '?'} rijen verwijderd`)

console.log('Campagnes resetten (sent_at, recipient_count, status=draft)…')
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, sent_at')
  .not('sent_at', 'is', null)
  .is('deleted_at', null)

if (campaigns && campaigns.length > 0) {
  const ids = campaigns.map((c) => c.id)
  const { error: e3 } = await supabase
    .from('campaigns')
    .update({ sent_at: null, recipient_count: null, status: 'draft' })
    .in('id', ids)
  if (e3) { console.error(e3); process.exit(1) }
  console.log(`  ${ids.length} campagnes gereset:`)
  campaigns.forEach((c) => console.log(`    - ${c.name} (was ${c.status})`))
} else {
  console.log('  geen campagnes om te resetten')
}

console.log('Klaar.')
