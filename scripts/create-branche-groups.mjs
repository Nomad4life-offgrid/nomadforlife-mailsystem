#!/usr/bin/env node
/**
 * Maak statische groepen aan per branche en koppel daar de bestaande
 * Founding Partners-contacten aan op basis van custom_fields.branche.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const BRANCHES = [
  { key: 'off-grid',      label: 'Founding Partners — Off-grid',      color: '#f85d1b' },
  { key: 'inbouw',        label: 'Founding Partners — Inbouw',        color: '#0ea5e9' },
  { key: 'verhuur',       label: 'Founding Partners — Verhuur',       color: '#22c55e' },
  { key: 'aanschaf',      label: 'Founding Partners — Aanschaf',      color: '#a855f7' },
  { key: 'keuring',       label: 'Founding Partners — Keuring',       color: '#eab308' },
  { key: 'verzekeringen', label: 'Founding Partners — Verzekeringen', color: '#ef4444' },
  { key: 'multi',         label: 'Founding Partners — Multi',         color: '#6366f1' },
]

// Haal alle Founding Partners op (op basis van source=import + opted_in)
// en groepeer ze op custom_fields.branche.
const { data: contacts, error: fetchErr } = await supabase
  .from('contacts')
  .select('id, email, custom_fields')
  .is('deleted_at', null)
  .eq('source', 'import')
  .not('custom_fields->>branche', 'is', null)

if (fetchErr) { console.error(fetchErr); process.exit(1) }
console.log(`Founding Partners contacten gevonden: ${contacts.length}`)

const byBranche = {}
for (const c of contacts) {
  const b = c.custom_fields?.branche
  if (!b) continue
  ;(byBranche[b] ??= []).push(c.id)
}

for (const b of BRANCHES) {
  const ids = byBranche[b.key] ?? []
  console.log(`\n${b.label}: ${ids.length} contacten`)

  // Groep zoeken/aanmaken
  const { data: existing } = await supabase
    .from('contact_groups')
    .select('id')
    .eq('name', b.label)
    .maybeSingle()

  let groupId = existing?.id
  if (!groupId) {
    const { data: created, error: createErr } = await supabase
      .from('contact_groups')
      .insert({
        name:        b.label,
        description: `Founding Partners-contacten met branche "${b.key}".`,
        list_type:   'group',
        color:       b.color,
      })
      .select('id')
      .single()
    if (createErr) { console.error(createErr); process.exit(1) }
    groupId = created.id
    console.log(`  Aangemaakt (${groupId})`)
  } else {
    console.log(`  Bestond al (${groupId})`)
  }

  if (ids.length === 0) continue

  const members = ids.map((id) => ({
    contact_id: id,
    group_id:   groupId,
    added_at:   new Date().toISOString(),
  }))

  // Upsert in batches
  const BATCH = 100
  for (let i = 0; i < members.length; i += BATCH) {
    const batch = members.slice(i, i + BATCH)
    const { error } = await supabase
      .from('contact_group_members')
      .upsert(batch, { onConflict: 'contact_id,group_id', ignoreDuplicates: true })
    if (error) { console.error(error); process.exit(1) }
  }
  console.log(`  Gekoppeld: ${members.length}`)
}

console.log('\nKlaar.')
