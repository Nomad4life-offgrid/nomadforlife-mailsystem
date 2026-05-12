#!/usr/bin/env node
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

const csv = readFileSync(resolve(__dirname, 'data/founding-partners.csv'), 'utf8')
const emails = [...new Set(
  csv.split(/\r?\n/).slice(1).filter(Boolean)
    .map((l) => l.split(';')[2]?.toLowerCase().trim())
    .filter(Boolean),
)]

console.log(`Unique CSV emails: ${emails.length}`)

const { data: all } = await supabase
  .from('contacts')
  .select('id, email, deleted_at, status')
  .in('email', emails)

console.log(`In contacts table:        ${all.length}`)
console.log(`  Active (not archived):  ${all.filter(c => !c.deleted_at).length}`)
console.log(`  Archived:               ${all.filter(c => c.deleted_at).length}`)

const { data: group } = await supabase
  .from('contact_groups')
  .select('id')
  .eq('name', 'Founding Partners')
  .single()

const { data: members } = await supabase
  .from('contact_group_members')
  .select('contact_id')
  .eq('group_id', group.id)

console.log(`\nIn Founding Partners group: ${members.length}`)

const memberIds = new Set(members.map(m => m.contact_id))
const inGroup = all.filter(c => memberIds.has(c.id))
const inGroupArchived = inGroup.filter(c => c.deleted_at)
const inGroupActive   = inGroup.filter(c => !c.deleted_at)
const notInGroup = all.filter(c => !memberIds.has(c.id))

console.log(`  Active members from CSV:    ${inGroupActive.length}`)
console.log(`  Archived members from CSV:  ${inGroupArchived.length}`)
console.log(`\nCSV contacts NOT in group:  ${notInGroup.length}`)
if (notInGroup.length > 0) {
  console.log('  Sample (first 10):')
  notInGroup.slice(0, 10).forEach(c => {
    console.log(`    ${c.email}  ${c.deleted_at ? '[archived]' : `[active, status=${c.status}]`}`)
  })
}

const missingEmails = emails.filter(e => !all.some(c => c.email === e))
console.log(`\nCSV emails not in contacts at all: ${missingEmails.length}`)
if (missingEmails.length > 0) {
  console.log('  ', missingEmails.join(', '))
}
