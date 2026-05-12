#!/usr/bin/env node
/**
 * Fix typo info@nomaf4life.com → info@nomad4life.com en zet de 3 niet-bezorgde
 * mail_logs terug op 'pending' zodat ze opnieuw verstuurd kunnen worden.
 */
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// 1. Typo fixen
const { data: typoFix, error: typoErr } = await supabase
  .from('contacts')
  .update({ email: 'info@nomad4life.com' })
  .eq('email', 'info@nomaf4life.com')
  .select('id, email, company')

if (typoErr) {
  if (typoErr.code === '23505') {
    console.log('info@nomad4life.com bestaat al — typo-contact wordt verwijderd ipv hernoemd')
    await supabase.from('contacts').delete().eq('email', 'info@nomaf4life.com')
  } else {
    console.error('Typo-fix faalde:', typoErr)
    process.exit(1)
  }
} else {
  console.log(`Typo gefixed: ${typoFix.length} contact(en) hernoemd → info@nomad4life.com`)
}

// 2. De 3 niet-bezorgde adressen
const targets = ['info@pimfaassen.nl', 'hello@danfold.nl', 'info@nomad4life.com']

const { data: contacts } = await supabase
  .from('contacts')
  .select('id, email')
  .in('email', targets)

console.log(`\n${contacts.length} contacten gevonden voor retry:`)
contacts.forEach((c) => console.log(`  ${c.email}`))

const contactIds = contacts.map((c) => c.id)

// 3. Campagne status terug op 'sending' (was 'completed' na vorige run)
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, status')
  .eq('name', 'Testmailing')
  .single()

console.log(`\nCampagne "Testmailing" status was: ${campaign.status}`)

if (campaign.status !== 'sending') {
  await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id)
  console.log('  → terug op sending')
}

// 4. Bestaande mail_logs voor deze contacten op 'pending' + scheduled_at=now
const now = new Date().toISOString()
const { data: logs } = await supabase
  .from('mail_logs')
  .update({ status: 'pending', scheduled_at: now, retry_count: 0, sent_at: null, error_message: null })
  .in('contact_id', contactIds)
  .select('id, contact_id')

console.log(`\n${logs.length} mail_logs gereset naar pending. Status van die contacten:`)
for (const l of logs) {
  const c = contacts.find((c) => c.id === l.contact_id)
  console.log(`  ${c?.email}`)
}

console.log('\nKlik nu "Verwerk wachtrij" op de Testmailing campagnepagina om opnieuw te verzenden.')
