'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { ContactSchema, UpdateContactSchema } from '@/lib/validations/contact'
import { logConsent } from '@/lib/consent/log'
import { requireAdmin, requireEditor } from '@/lib/auth/guards'

// ── Import result type ────────────────────────────────────────────────────────

export type ImportResult = {
  imported: number
  skipped: number
  failed: number
  errors: string[]
  group_name?: string
  group_added?: number
} | null

// ── Shared state type (returned by useActionState actions) ────────────────────

export type ContactFormState = {
  errors?: Partial<Record<string, string[]>>
  message?: string
} | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFormToObject(formData: FormData) {
  return {
    email:        formData.get('email'),
    first_name:   formData.get('first_name') || null,
    last_name:    formData.get('last_name')  || null,
    company:      formData.get('company')    || null,
    phone:        formData.get('phone')      || null,
    contact_type: formData.get('contact_type') || null,
    source:       formData.get('source')     || 'admin',
    notes:        formData.get('notes')      || null,
  }
}

// ── CREATE ────────────────────────────────────────────────────────────────────

/**
 * Used with useActionState — returns errors or redirects on success.
 */
export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  await requireEditor()
  const raw     = parseFormToObject(formData)
  const parsed  = ContactSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { email, first_name, last_name, company, phone, contact_type, source, notes } = parsed.data
  const supabase = createServiceClient()
  const now      = new Date().toISOString()

  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      email,
      first_name,
      last_name,
      company,
      phone,
      contact_type,
      source,
      notes,
      opted_in:    true,
      opted_in_at: now,
      status:      'active',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { errors: { email: [`E-mailadres ${email} is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  await logConsent({
    supabase,
    contactId:  newContact.id,
    eventType:  'manually_added',
    channel:    'admin',
    notes:      'Handmatig aangemaakt door beheerder',
  })

  redirect('/contacts')
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

/**
 * Used with useActionState — bind `id` before passing to useActionState.
 * updateContact.bind(null, id) → (prevState, formData) => Promise<state>
 */
export async function updateContact(
  id: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  await requireEditor()
  if (!id) return { message: 'Contact ID ontbreekt.' }

  const raw    = parseFormToObject(formData)
  const parsed = UpdateContactSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { email, first_name, last_name, company, phone, contact_type, source, notes } = parsed.data
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('contacts')
    .update({ email, first_name, last_name, company, phone, contact_type, source, notes })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    if (error.code === '23505') {
      return { errors: { email: [`E-mailadres ${email} is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  revalidatePath(`/contacts/${id}`)
  revalidatePath('/contacts')
  redirect(`/contacts/${id}`)
}

// ── ARCHIVE (soft delete) ─────────────────────────────────────────────────────

export async function archiveContact(id: string) {
  await requireAdmin()
  if (!id) throw new Error('Contact ID ontbreekt.')

  const supabase = createServiceClient()
  const now      = new Date().toISOString()

  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: now })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  revalidatePath('/contacts')
  redirect('/contacts')
}

// ── RESTORE ───────────────────────────────────────────────────────────────────

export async function restoreContact(id: string) {
  await requireEditor()
  if (!id) throw new Error('Contact ID ontbreekt.')

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/contacts/${id}`)
  revalidatePath('/contacts')
}

// ── CONSENT ───────────────────────────────────────────────────────────────────

export async function optInContact(id: string) {
  await requireEditor()
  if (!id) throw new Error('Contact ID ontbreekt.')

  const supabase = createServiceClient()
  const now      = new Date().toISOString()

  const { error } = await supabase
    .from('contacts')
    .update({
      opted_in:        true,
      opted_in_at:     now,
      global_opt_out:  false,
      status:          'active',
      unsubscribed_at: null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await logConsent({
    supabase,
    contactId: id,
    eventType: 'consent_renewed',
    channel:   'admin',
    notes:     'Opt-in handmatig gezet door beheerder',
  })

  revalidatePath(`/contacts/${id}`)
  revalidatePath('/contacts')
}

// ── IMPORT ────────────────────────────────────────────────────────────────────

const ImportRowSchema = z.object({
  email:        z.string().email(),
  first_name:   z.string().optional().nullable(),
  last_name:    z.string().optional().nullable(),
  company:      z.string().optional().nullable(),
  contact_type: z.enum(['camping','sponsor','adverteerder','lid','partner','prospect','overig']).optional().nullable(),
})

const BATCH_SIZE = 100

/**
 * Importeert contacten vanuit een geparseerde CSV als JSON-string.
 * Alle geïmporteerde contacten worden direct opt-in gezet (source='import').
 * Voert inserts uit in batches van BATCH_SIZE om DB-limieten te respecteren.
 * Optioneel: voegt alle contacten toe aan een statische groep (group_id).
 */
export async function importContacts(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  await requireEditor()

  const rawJson = formData.get('rows')
  if (!rawJson || typeof rawJson !== 'string') {
    return { imported: 0, skipped: 0, failed: 0, errors: ['Geen gegevens ontvangen.'] }
  }

  const groupId = (formData.get('group_id') as string | null) || null

  let rows: unknown[]
  try {
    rows = JSON.parse(rawJson)
  } catch {
    return { imported: 0, skipped: 0, failed: 0, errors: ['Ongeldige JSON-invoer.'] }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, errors: ['Geen rijen gevonden.'] }
  }

  const supabase = createServiceClient()
  const now      = new Date().toISOString()

  let imported = 0
  let skipped  = 0
  let failed   = 0
  const errors: string[] = []

  // Validate all rows first
  const validRows: z.infer<typeof ImportRowSchema>[] = []
  for (let i = 0; i < rows.length; i++) {
    const parsed = ImportRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      failed++
      errors.push(`Rij ${i + 1}: ${parsed.error.issues[0]?.message ?? 'Ongeldig'}`)
    } else {
      validRows.push(parsed.data)
    }
  }

  // Process in batches of BATCH_SIZE
  for (let start = 0; start < validRows.length; start += BATCH_SIZE) {
    const batch = validRows.slice(start, start + BATCH_SIZE)

    const records = batch.map((row) => ({
      email:        row.email.toLowerCase().trim(),
      first_name:   row.first_name  || null,
      last_name:    row.last_name   || null,
      company:      row.company     || null,
      contact_type: row.contact_type || null,
      source:       'import' as const,
      opted_in:     true,
      opted_in_at:  now,
      status:       'active' as const,
    }))

    const { data: inserted, error } = await supabase
      .from('contacts')
      .upsert(records, {
        onConflict:        'email',
        ignoreDuplicates:  true,
      })
      .select('id')

    if (error) {
      failed += batch.length
      errors.push(`Batch fout: ${error.message}`)
      continue
    }

    const newCount = inserted?.length ?? 0
    imported += newCount
    skipped  += batch.length - newCount

    // Log consent for each newly inserted contact
    if (inserted && inserted.length > 0) {
      for (const contact of inserted) {
        await logConsent({
          supabase,
          contactId: contact.id,
          eventType: 'imported',
          channel:   'admin',
          notes:     'Geïmporteerd via CSV-import door beheerder',
        })
      }
    }
  }

  // ── Voeg alle CSV-contacten toe aan de geselecteerde groep ───────────────
  let groupName: string | undefined
  let groupAdded: number | undefined

  if (groupId) {
    // Resolve group name
    const { data: group } = await supabase
      .from('contact_groups')
      .select('name')
      .eq('id', groupId)
      .single()
    groupName = group?.name

    // Fetch IDs of all contacts in the CSV (new + already existing)
    const emails = validRows.map((r) => r.email.toLowerCase().trim())
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('id')
      .in('email', emails)
      .is('deleted_at', null)

    if (allContacts && allContacts.length > 0) {
      const members = allContacts.map((c) => ({
        contact_id: c.id,
        group_id:   groupId,
        added_at:   now,
      }))

      // Upsert in batches — ignore duplicates (already members)
      for (let start = 0; start < members.length; start += BATCH_SIZE) {
        const batch = members.slice(start, start + BATCH_SIZE)
        await supabase
          .from('contact_group_members')
          .upsert(batch, { onConflict: 'contact_id,group_id', ignoreDuplicates: true })
      }

      groupAdded = allContacts.length
    }

    revalidatePath('/segments')
  }

  revalidatePath('/contacts')

  return { imported, skipped, failed, errors, group_name: groupName, group_added: groupAdded }
}

export async function optOutContact(id: string) {
  await requireEditor()
  if (!id) throw new Error('Contact ID ontbreekt.')

  const supabase = createServiceClient()
  const now      = new Date().toISOString()

  const { error: contactErr } = await supabase
    .from('contacts')
    .update({
      global_opt_out:  true,
      opted_in:        false,
      unsubscribed_at: now,
      status:          'opted_out',
    })
    .eq('id', id)

  if (contactErr) throw new Error(contactErr.message)

  // Cancel active runs
  await supabase
    .from('campaign_runs')
    .update({ status: 'opted_out', opted_out_at: now })
    .eq('contact_id', id)
    .eq('status', 'active')

  // Skip pending mail_logs
  const { data: runs } = await supabase
    .from('campaign_runs')
    .select('id')
    .eq('contact_id', id)

  if (runs && runs.length > 0) {
    await supabase
      .from('mail_logs')
      .update({ status: 'skipped' })
      .in('campaign_run_id', runs.map((r) => r.id))
      .eq('status', 'pending')
  }

  await logConsent({
    supabase,
    contactId: id,
    eventType: 'opt_out_global',
    channel:   'admin',
    notes:     'Globale opt-out handmatig gezet door beheerder',
  })

  revalidatePath(`/contacts/${id}`)
  revalidatePath('/contacts')
}
