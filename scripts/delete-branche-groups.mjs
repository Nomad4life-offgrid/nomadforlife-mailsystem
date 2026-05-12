#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const NAMES = [
  'Founding Partners — Off-grid',
  'Founding Partners — Inbouw',
  'Founding Partners — Verhuur',
  'Founding Partners — Aanschaf',
  'Founding Partners — Keuring',
  'Founding Partners — Verzekeringen',
  'Founding Partners — Multi',
]

const { data: groups } = await supabase
  .from('contact_groups')
  .select('id, name')
  .in('name', NAMES)

console.log(`Gevonden: ${groups.length} groepen`)

for (const g of groups) {
  // Verwijder eerst members (voor het geval er geen cascade is)
  await supabase.from('contact_group_members').delete().eq('group_id', g.id)
  const { error } = await supabase.from('contact_groups').delete().eq('id', g.id)
  if (error) { console.error(`  ${g.name}: ${error.message}`); continue }
  console.log(`  Verwijderd: ${g.name}`)
}
console.log('Klaar.')
