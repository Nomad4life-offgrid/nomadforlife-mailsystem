'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { ContactSchema, UpdateContactSchema } from '@/lib/validations/contact'
import { logConsent } from '@/lib/consent/log'
import { requireAdmin, requireEditor } from '@/lib/auth/guards'

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
