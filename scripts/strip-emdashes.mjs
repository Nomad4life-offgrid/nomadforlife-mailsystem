#!/usr/bin/env node
/**
 * Verwijder em-dashes (—) uit custom_fields.* van Founding Partners-contacten.
 * Vervangt " — " door ", " en losse "—" door ",".
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function clean(s) {
  if (typeof s !== 'string') return s
  return s
    .replace(/ [—�] /g, ', ')
    .replace(/[—�]/g, ',')
    .replace(/,\s*,/g, ',')
}

const csv = readFileSync(resolve(__dirname, 'data/founding-partners.csv'), 'utf8')
const emails = [...new Set(
  csv.split(/\r?\n/).slice(1).filter(Boolean)
    .map((l) => l.split(';')[2]?.toLowerCase().trim())
    .filter(Boolean),
)]

const { data: contacts } = await supabase
  .from('contacts')
  .select('id, custom_fields')
  .in('email', emails)

let updated = 0
for (const c of contacts) {
  const cf = c.custom_fields ?? {}
  const newCf = {}
  let changed = false
  for (const [k, v] of Object.entries(cf)) {
    const cleaned = clean(v)
    newCf[k] = cleaned
    if (cleaned !== v) changed = true
  }
  if (!changed) continue
  const { error } = await supabase.from('contacts').update({ custom_fields: newCf }).eq('id', c.id)
  if (error) { console.error(error); process.exit(1) }
  updated++
}
console.log(`Em-dashes verwijderd in ${updated} contacten.`)
