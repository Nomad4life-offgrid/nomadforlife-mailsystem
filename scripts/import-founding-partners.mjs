#!/usr/bin/env node
/**
 * Eenmalig: import Founding Partners CSV → contacts + group 'Founding Partners'.
 * Run via: node --env-file=.env.local scripts/import-founding-partners.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const CSV_PATH   = resolve(__dirname, 'data/founding-partners.csv')
const GROUP_NAME = 'Founding Partners'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── CSV parser (simple, ';' separated, no embedded ; or newlines) ──────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const header = lines.shift().split(';').map((h) => h.trim())
  return lines.map((line) => {
    const cols = line.split(';')
    const row = {}
    header.forEach((h, i) => {
      const v = (cols[i] ?? '').trim()
      row[h] = v === '' ? null : v
    })
    return row
  })
}

// ── Mojibake fix: dubbel ge-encodeerde UTF-8 ───────────────────────────────────
function fixMojibake(s) {
  if (s == null) return s
  // Heuristiek: bevat "Ã" of "â" → reverse latin-1 → utf-8
  if (/Ã|â/.test(s)) {
    try {
      return Buffer.from(s, 'latin1').toString('utf8')
    } catch {
      return s
    }
  }
  return s
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const csv  = readFileSync(CSV_PATH, 'utf8')
  const rows = parseCsv(csv)

  console.log(`Geparseerd: ${rows.length} rijen`)

  // ── Groep zoeken/aanmaken ──────────────────────────────────────────────────
  const { data: existing, error: findErr } = await supabase
    .from('contact_groups')
    .select('id, name')
    .eq('name', GROUP_NAME)
    .maybeSingle()

  if (findErr) {
    console.error('Groep zoeken faalde:', findErr.message)
    process.exit(1)
  }

  let groupId = existing?.id ?? null

  if (groupId) {
    console.log(`Groep "${GROUP_NAME}" bestaat al (${groupId})`)
  } else {
    const { data: created, error: createErr } = await supabase
      .from('contact_groups')
      .insert({
        name:        GROUP_NAME,
        description: 'Founding Partner outreach — partnervoorstel camper- en vanlife-bedrijven',
        list_type:   'group',
      })
      .select('id')
      .single()
    if (createErr) {
      console.error('Groep aanmaken faalde:', createErr.message)
      process.exit(1)
    }
    groupId = created.id
    console.log(`Groep "${GROUP_NAME}" aangemaakt (${groupId})`)
  }

  // ── Contacten upserten ─────────────────────────────────────────────────────
  const seen = new Set()
  const records = []
  const skippedDupe = []

  for (const r of rows) {
    const email = r['e-mailadres']?.toLowerCase().trim()
    if (!email) continue
    if (seen.has(email)) {
      skippedDupe.push({ email, company: r.bedrijfsnaam })
      continue
    }
    seen.add(email)

    const customFields = {
      aanhef:        fixMojibake(r.aanhef),
      onderwerp:     fixMojibake(r.onderwerp),
      branche:       fixMojibake(r.branche),
      branches_alle: fixMojibake(r.branches_alle),
      is_multi:      r.is_multi === 'ja',
      sub_types:     fixMojibake(r.sub_types),
      branche_zin:   fixMojibake(r.branche_zin),
      categorie_url: r.categorie_url,
      ps_offgrid:    fixMojibake(r.ps_offgrid),
    }

    records.push({
      email,
      company:       fixMojibake(r.bedrijfsnaam),
      contact_type:  'partner',
      source:        'import',
      status:        'active',
      opted_in:      true,
      opted_in_at:   new Date().toISOString(),
      custom_fields: customFields,
    })
  }

  console.log(`Te importeren: ${records.length} unieke contacten (${skippedDupe.length} dupes overgeslagen)`)
  if (skippedDupe.length > 0) {
    console.log('  Dupes:', skippedDupe.slice(0, 10).map((d) => `${d.email} (${d.company})`).join(', '), skippedDupe.length > 10 ? '…' : '')
  }

  // Upsert per batch op email
  const BATCH = 100
  let inserted = 0
  let updated  = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const emails = batch.map((b) => b.email)

    // Detecteer welke al bestaan (voor stats)
    const { data: existingRows } = await supabase
      .from('contacts')
      .select('email')
      .in('email', emails)
    const existingEmails = new Set((existingRows ?? []).map((r) => r.email))

    const { error: upErr } = await supabase
      .from('contacts')
      .upsert(batch, { onConflict: 'email' })
    if (upErr) {
      console.error(`Batch ${i / BATCH + 1} upsert error:`, upErr.message)
      process.exit(1)
    }
    for (const r of batch) {
      if (existingEmails.has(r.email)) updated++
      else inserted++
    }
  }

  console.log(`Upsert klaar: ${inserted} nieuw, ${updated} geüpdatet`)

  // ── Lid maken van de groep ─────────────────────────────────────────────────
  const allEmails = records.map((r) => r.email)
  const { data: contactRows, error: fetchErr } = await supabase
    .from('contacts')
    .select('id, email')
    .in('email', allEmails)
    .is('deleted_at', null)

  if (fetchErr) {
    console.error('Contacten ophalen faalde:', fetchErr.message)
    process.exit(1)
  }

  const members = (contactRows ?? []).map((c) => ({
    contact_id: c.id,
    group_id:   groupId,
    added_at:   new Date().toISOString(),
  }))

  let memberAdded = 0
  for (let i = 0; i < members.length; i += BATCH) {
    const batch = members.slice(i, i + BATCH)
    const { error: memErr } = await supabase
      .from('contact_group_members')
      .upsert(batch, { onConflict: 'contact_id,group_id', ignoreDuplicates: true })
    if (memErr) {
      console.error(`Members batch ${i / BATCH + 1} error:`, memErr.message)
      process.exit(1)
    }
    memberAdded += batch.length
  }

  console.log(`Toegevoegd aan groep "${GROUP_NAME}": ${memberAdded} contacten`)
  console.log('Klaar.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
