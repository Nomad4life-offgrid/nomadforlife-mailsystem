#!/usr/bin/env node
/**
 * Ontarchiveer alle gearchiveerde contacten uit founding-partners.csv
 * en koppel ze aan de groep 'Founding Partners'.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GROUP_NAME = 'Founding Partners'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const csv = readFileSync(resolve(__dirname, 'data/founding-partners.csv'), 'utf8')
const emails = [...new Set(
  csv.split(/\r?\n/).slice(1).filter(Boolean)
    .map((l) => l.split(';')[2]?.toLowerCase().trim())
    .filter(Boolean),
)]

// Vind gearchiveerde
const { data: archived, error: fetchErr } = await supabase
  .from('contacts')
  .select('id, email')
  .in('email', emails)
  .not('deleted_at', 'is', null)

if (fetchErr) { console.error(fetchErr); process.exit(1) }

console.log(`Gearchiveerde contacten gevonden: ${archived.length}`)

if (archived.length > 0) {
  const ids = archived.map((c) => c.id)
  const { error: restoreErr } = await supabase
    .from('contacts')
    .update({ deleted_at: null })
    .in('id', ids)
  if (restoreErr) { console.error('Restore failed:', restoreErr); process.exit(1) }
  console.log(`Ontarchiveerd: ${ids.length}`)
}

// Groep ophalen
const { data: group } = await supabase
  .from('contact_groups')
  .select('id')
  .eq('name', GROUP_NAME)
  .single()

// Alle 197 contacten ophalen (nu allemaal niet-gearchiveerd) en koppelen
const { data: all } = await supabase
  .from('contacts')
  .select('id, email')
  .in('email', emails)
  .is('deleted_at', null)

const members = all.map((c) => ({
  contact_id: c.id,
  group_id:   group.id,
  added_at:   new Date().toISOString(),
}))

const BATCH = 100
let totalUpserted = 0
for (let i = 0; i < members.length; i += BATCH) {
  const batch = members.slice(i, i + BATCH)
  const { error } = await supabase
    .from('contact_group_members')
    .upsert(batch, { onConflict: 'contact_id,group_id', ignoreDuplicates: true })
  if (error) { console.error(error); process.exit(1) }
  totalUpserted += batch.length
}

// Verifieer eindstand
const { data: finalMembers } = await supabase
  .from('contact_group_members')
  .select('contact_id')
  .eq('group_id', group.id)

console.log(`Groep "${GROUP_NAME}" bevat nu: ${finalMembers.length} leden`)
console.log('Klaar.')
