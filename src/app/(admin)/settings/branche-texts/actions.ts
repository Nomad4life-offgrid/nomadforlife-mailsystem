'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/guards'
import {
  BRANCHES,
  customFieldsFromTexts,
  isBranche,
  loadBrancheTexts,
  type Branche,
  type BrancheTextRow,
} from '@/lib/email/branche-data'

export type SaveBrancheTextsState = { ok?: true; error?: string; applied?: number } | null

/**
 * Sla alle 7 branche-rijen op. Lege ps_block is OK.
 */
export async function saveBrancheTexts(
  _prev: SaveBrancheTextsState,
  formData: FormData,
): Promise<SaveBrancheTextsState> {
  await requireAdmin()
  const supabase = createServiceClient()

  const rows: BrancheTextRow[] = []
  for (const b of BRANCHES) {
    rows.push({
      branche:  b,
      zin:      (formData.get(`${b}__zin`)      as string ?? '').trim(),
      subject:  (formData.get(`${b}__subject`)  as string ?? '').trim(),
      url_slug: (formData.get(`${b}__url_slug`) as string ?? '').trim(),
      ps_block: (formData.get(`${b}__ps_block`) as string ?? '').trim(),
    })
  }

  const missing = rows.filter((r) => !r.zin || !r.subject || !r.url_slug)
  if (missing.length > 0) {
    return { error: `Vul minimaal zin, onderwerp en url_slug in voor: ${missing.map((m) => m.branche).join(', ')}` }
  }

  const { error } = await supabase
    .from('branche_texts')
    .upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'branche' })

  if (error) {
    return { error: `Opslaan mislukt: ${error.message}. Heb je de SQL-migratie al toegepast?` }
  }

  revalidatePath('/settings/branche-texts')
  return { ok: true }
}

/**
 * Werk de custom_fields van alle bestaande contacten van één branche bij
 * met de huidige tekstinhoud uit branche_texts. Andere keys blijven staan.
 */
export async function applyBrancheTextsToContacts(branche: string): Promise<{ updated: number; error?: string }> {
  await requireAdmin()
  if (!isBranche(branche)) return { updated: 0, error: 'Ongeldige branche.' }

  const supabase = createServiceClient()
  const texts = await loadBrancheTexts(supabase)

  const { data: contacts, error: fetchErr } = await supabase
    .from('contacts')
    .select('id, company, email, custom_fields')
    .filter('custom_fields->>branche', 'eq', branche)
    .is('deleted_at', null)

  if (fetchErr) return { updated: 0, error: fetchErr.message }
  if (!contacts || contacts.length === 0) return { updated: 0 }

  let updated = 0
  for (const c of contacts) {
    const bedrijfsnaam = c.company ?? c.email ?? ''
    const next = { ...(c.custom_fields ?? {}), ...customFieldsFromTexts(branche as Branche, bedrijfsnaam, texts) }
    const { error: upErr } = await supabase.from('contacts').update({ custom_fields: next }).eq('id', c.id)
    if (!upErr) updated++
  }

  revalidatePath('/settings/branche-texts')
  return { updated }
}
