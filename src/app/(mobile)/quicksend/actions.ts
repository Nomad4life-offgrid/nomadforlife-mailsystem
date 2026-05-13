'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireEditor } from '@/lib/auth/guards'
import { buildMailPayload } from '@/lib/email/sender'
import { sendEmail } from '@/lib/email/sendgrid'
import {
  customFieldsFromTexts,
  isBranche,
  loadBrancheTexts,
  type Branche,
} from '@/lib/email/branche-data'
import { sendgrid, app } from '@/lib/config'

const TEMPLATE_NAME       = 'Founding Partners 1'
const GROUP_NAME          = 'Founding Partners'
const CC_FIRST_N_ADHOC    = 5
const CC_INTERNAL_ADDRESS = 'hello@nomad4life.com'

export type QuickSendResult =
  | { ok: true; contactId: string; email: string; bedrijfsnaam: string; branche: Branche; ccTo: string | null }
  | { ok: false; error: string }

/**
 * Verstuur direct één mail naar één prospect met de Founding Partners-template.
 * Maakt het contact aan of werkt 'm bij met de juiste custom_fields.
 * Maakt NOG GEEN lid van de groep en logt NOG GEEN mail_log — dat doet de
 * vervolgactie {@link quicksendSave}.
 */
export async function quicksendNow(formData: FormData): Promise<QuickSendResult> {
  await requireEditor()

  const bedrijfsnaam = (formData.get('bedrijfsnaam') as string ?? '').trim()
  const email        = (formData.get('email')        as string ?? '').trim().toLowerCase()
  const brancheRaw   = (formData.get('branche')      as string ?? '').trim()

  if (!bedrijfsnaam) return { ok: false, error: 'Bedrijfsnaam is verplicht.' }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: 'Geldig e-mailadres is verplicht.' }
  if (!isBranche(brancheRaw))                  return { ok: false, error: 'Kies een geldige branche.' }
  const branche = brancheRaw as Branche

  const supabase = createServiceClient()

  // ── Template laden ────────────────────────────────────────────────────────
  const { data: template } = await supabase
    .from('templates')
    .select('id, subject, html_body, text_body')
    .eq('name', TEMPLATE_NAME)
    .is('deleted_at', null)
    .maybeSingle()
  if (!template) return { ok: false, error: `Template "${TEMPLATE_NAME}" niet gevonden.` }

  // ── Contact aanmaken/bijwerken met juiste custom_fields ───────────────────
  const texts = await loadBrancheTexts(supabase)
  const customFields = customFieldsFromTexts(branche, bedrijfsnaam, texts)
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('contacts')
    .select('id, custom_fields, deleted_at')
    .eq('email', email)
    .maybeSingle()

  let contactId: string
  if (existing) {
    const merged = { ...(existing.custom_fields ?? {}), ...customFields }
    const upd: Record<string, unknown> = { company: bedrijfsnaam, custom_fields: merged, status: 'active' }
    if (existing.deleted_at) upd.deleted_at = null
    const { error } = await supabase.from('contacts').update(upd).eq('id', existing.id)
    if (error) return { ok: false, error: `Contact bijwerken mislukt: ${error.message}` }
    contactId = existing.id
  } else {
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        email,
        company:       bedrijfsnaam,
        contact_type:  'partner',
        source:        'admin',
        status:        'active',
        opted_in:      true,
        opted_in_at:   now,
        custom_fields: customFields,
      })
      .select('id')
      .single()
    if (error || !created) return { ok: false, error: `Contact aanmaken mislukt: ${error?.message}` }
    contactId = created.id
  }

  // ── Unsubscribe-token aanmaken (voor de footer-link) ──────────────────────
  const { data: unsubRow, error: unsubErr } = await supabase
    .from('unsubscribe_events')
    .insert({ contact_id: contactId })
    .select('token')
    .single()
  if (unsubErr || !unsubRow) return { ok: false, error: 'Afmeldtoken aanmaken mislukt.' }

  const unsubscribeUrl     = `${app.url}/unsubscribe/${unsubRow.token}`
  const unsubscribePostUrl = `${app.url}/api/unsubscribe/${unsubRow.token}`

  // ── Tellen hoeveel ad-hoc sends er al zijn gedaan; eerste N krijgen CC ────
  // Eenvoudige seq op basis van contacten met custom_fields.via_quicksend=true.
  const { count: adhocCount } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .filter('custom_fields->>via_quicksend', 'eq', 'true')

  const includeCc = (adhocCount ?? 0) < CC_FIRST_N_ADHOC
  const ccTo = includeCc ? CC_INTERNAL_ADDRESS : null

  // ── Payload bouwen + versturen ────────────────────────────────────────────
  const payload = buildMailPayload({
    contact: { email, first_name: null, last_name: null, custom_fields: customFields },
    template: { subject: template.subject, html_body: template.html_body, text_body: template.text_body },
    campaign: { from_email: sendgrid.fromEmail, from_name: sendgrid.fromName, name: 'Founding Partners (ad-hoc)' },
    companyName: bedrijfsnaam,
    unsubscribeUrl,
    unsubscribePostUrl,
  })

  const result = await sendEmail({ ...payload, cc: ccTo ? [ccTo] : undefined })
  if (!result.ok) return { ok: false, error: `Verzenden mislukt: ${result.error}` }

  // Markeer dit contact als 'via quicksend' zodat de teller klopt voor volgende sends.
  await supabase
    .from('contacts')
    .update({ custom_fields: { ...customFields, via_quicksend: true } })
    .eq('id', contactId)

  return { ok: true, contactId, email, bedrijfsnaam, branche, ccTo }
}

export type QuickSaveResult = { ok: true } | { ok: false; error: string }

/**
 * Markeer de zojuist verstuurde mail in de "officiële" verzendlijst:
 * - Voeg contact toe aan de groep "Founding Partners"
 * - Maak een campaign_run + mail_log (status=sent) aan voor de Founding Partners-campagne
 *   zodat het in de stats van die campagne meetelt.
 */
export async function quicksendSave(contactId: string): Promise<QuickSaveResult> {
  await requireEditor()
  if (!contactId) return { ok: false, error: 'contactId ontbreekt.' }

  const supabase = createServiceClient()

  // 1. Lid maken van groep Founding Partners
  const { data: group } = await supabase
    .from('contact_groups')
    .select('id')
    .eq('name', GROUP_NAME)
    .maybeSingle()
  if (!group) return { ok: false, error: `Groep "${GROUP_NAME}" niet gevonden.` }

  await supabase
    .from('contact_group_members')
    .upsert(
      { contact_id: contactId, group_id: group.id, added_at: new Date().toISOString() },
      { onConflict: 'contact_id,group_id', ignoreDuplicates: true },
    )

  // 2. Mail_log aanmaken in Founding Partners-campagne (status=sent)
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('name', GROUP_NAME)
    .is('deleted_at', null)
    .maybeSingle()

  if (campaign) {
    const { data: step } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', campaign.id)
      .order('step_order')
      .limit(1)
      .maybeSingle()

    if (step) {
      const { data: run } = await supabase
        .from('campaign_runs')
        .upsert(
          { campaign_id: campaign.id, contact_id: contactId, subscribed_at: new Date().toISOString() },
          { onConflict: 'campaign_id,contact_id' },
        )
        .select('id')
        .single()

      if (run) {
        const now = new Date().toISOString()
        await supabase.from('mail_logs').insert({
          campaign_run_id:  run.id,
          campaign_step_id: step.id,
          contact_id:       contactId,
          scheduled_at:     now,
          sent_at:          now,
          status:           'sent',
        })
      }
    }
  }

  return { ok: true }
}
