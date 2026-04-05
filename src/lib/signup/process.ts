/**
 * Verwerkingslogica voor publieke nieuwsbriefinschrijvingen.
 *
 * Stappen:
 *   1. Bestaand contact opzoeken (inclusief soft-deleted)
 *   2. Statuscheck — voorkomt dubbele aanmeldingen of heractivatie van opt-outs
 *   3. Contact aanmaken of herstellen (als eerder soft-deleted)
 *   4. Opt-in token aanmaken voor double opt-in
 *   5. Consent-log schrijven (AVG art. 7)
 *   6. Optioneel koppelen aan een contact_group
 *
 * Regels:
 *   - Contacten met status 'opted_out' worden NIET heractiveerd — ze moeten
 *     handmatig via de admin opnieuw worden ingeschreven.
 *   - Contacten met status 'pending' krijgen een nieuw token — de vorige
 *     bevestigingsmail kan verlopen zijn. Beide tokens zijn geldig.
 *   - Locked groups worden stilzwijgend overgeslagen (geen fout naar de gebruiker).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { logConsent }          from '@/lib/consent/log'
import type { SubscribeDTO }   from './validate'

type SupabaseClient = ReturnType<typeof createServiceClient>

export type SubscribeOutcome =
  | 'created'             // nieuw contact aangemaakt, awaiting confirmation
  | 'restored'            // eerder soft-deleted contact hersteld, awaiting confirmation
  | 'confirmation_resent' // bestaand pending-contact: nieuw token aangemaakt
  | 'already_active'      // contact is al actief aangemeld
  | 'already_unsubscribed'// contact heeft zich eerder uitgeschreven

export type ProcessSubscribeResult = {
  outcome:    SubscribeOutcome
  contactId?: string
  token?:     string
}

export type SubscribeContext = {
  ip?:       string | null
  userAgent?: string | null
}

export async function processSubscribe(
  supabase: SupabaseClient,
  dto:      SubscribeDTO,
  ctx:      SubscribeContext,
): Promise<ProcessSubscribeResult> {
  const { email, first_name, last_name, group_id, form_source } = dto
  const ip        = ctx.ip        ?? null
  const userAgent = ctx.userAgent ?? null

  // ── 1. Bestaand contact opzoeken (inclusief soft-deleted) ──────────────────
  const { data: existing, error: lookupErr } = await supabase
    .from('contacts')
    .select('id, status, deleted_at, opted_in, first_name, last_name')
    .eq('email', email)
    .maybeSingle()

  if (lookupErr) throw new Error(lookupErr.message)

  // ── 2. Statuscheck ─────────────────────────────────────────────────────────
  if (existing && !existing.deleted_at) {
    if (existing.status === 'opted_out') {
      return { outcome: 'already_unsubscribed' }
    }
    if (existing.status === 'active') {
      return { outcome: 'already_active', contactId: existing.id }
    }
    // status === 'pending': stuur nieuw bevestigingstoken
    const token = await createOptInToken(supabase, existing.id)
    await logConsent({
      supabase,
      contactId: existing.id,
      eventType: 'opt_in',
      channel:   'web',
      ipAddress: ip,
      userAgent,
      notes:     'Herhaald inschrijfverzoek — nieuw bevestigingstoken aangemaakt',
      metadata:  buildMetadata(form_source, group_id),
    })
    if (group_id) await linkToGroup(supabase, existing.id, group_id)
    return { outcome: 'confirmation_resent', contactId: existing.id, token }
  }

  // ── 3. Contact aanmaken of herstellen ──────────────────────────────────────
  let contactId: string

  if (existing?.deleted_at) {
    // Herstel soft-deleted contact
    const { error } = await supabase
      .from('contacts')
      .update({
        deleted_at:      null,
        status:          'pending',
        opted_in:        false,
        opted_in_at:     null,
        unsubscribed_at: null,
        global_opt_out:  false,
        first_name:      first_name ?? existing.first_name ?? null,
        last_name:       last_name  ?? existing.last_name  ?? null,
        source:          'website',
        metadata:        buildMetadata(form_source, group_id),
      })
      .eq('id', existing.id)

    if (error) throw new Error(error.message)
    contactId = existing.id
  } else {
    // Nieuw contact aanmaken
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        email,
        first_name: first_name ?? null,
        last_name:  last_name  ?? null,
        source:     'website',
        status:     'pending',
        opted_in:   false,
        metadata:   buildMetadata(form_source, group_id),
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    contactId = newContact.id
  }

  // ── 4. Opt-in token aanmaken ────────────────────────────────────────────────
  const token = await createOptInToken(supabase, contactId)

  // ── 5. Consent-log schrijven ────────────────────────────────────────────────
  await logConsent({
    supabase,
    contactId,
    eventType: 'opt_in',
    channel:   'web',
    ipAddress: ip,
    userAgent,
    notes:     existing?.deleted_at
      ? 'Hernieuwde aanmelding na verwijdering — awaiting double opt-in'
      : 'Nieuwe aanmelding via websiteformulier — awaiting double opt-in',
    metadata:  buildMetadata(form_source, group_id),
  })

  // ── 6. Optioneel koppelen aan groep ─────────────────────────────────────────
  if (group_id) await linkToGroup(supabase, contactId, group_id)

  return {
    outcome:   existing?.deleted_at ? 'restored' : 'created',
    contactId,
    token,
  }
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

async function createOptInToken(
  supabase: SupabaseClient,
  contactId: string,
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('opt_in_tokens')
    .insert({ contact_id: contactId })
    .select('token')
    .single()

  if (error) {
    console.error(`[subscribe] opt_in_token aanmaken mislukt voor contact ${contactId}:`, error.message)
    return undefined
  }

  return data.token
}

async function linkToGroup(
  supabase:  SupabaseClient,
  contactId: string,
  groupId:   string,
): Promise<void> {
  // Groep bestaat en is niet vergrendeld?
  const { data: group } = await supabase
    .from('contact_groups')
    .select('id, is_locked')
    .eq('id', groupId)
    .maybeSingle()

  if (!group || group.is_locked) return

  const { error } = await supabase
    .from('contact_group_members')
    .upsert(
      { group_id: groupId, contact_id: contactId },
      { onConflict: 'group_id,contact_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error(`[subscribe] groepskoppeling mislukt (group:${groupId} contact:${contactId}):`, error.message)
  }
}

function buildMetadata(
  formSource?: string,
  groupId?:   string,
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    signup_source: formSource ?? 'website_signup',
  }
  if (groupId) meta.group_id = groupId
  return meta
}
