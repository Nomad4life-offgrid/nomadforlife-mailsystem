'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveAudienceContacts } from '@/lib/services/audience'
import { CampaignSchema, UpdateCampaignSchema } from '@/lib/validations/campaign'
import { requireAdmin, requireEditor } from '@/lib/auth/guards'
import type { Campaign } from '@/types'

// ── Gedeeld type ──────────────────────────────────────────────────────────────

export type FormState = {
  errors?: Partial<Record<string, string[]>>
  message?: string
} | null

// ── Hulpfunctie: parse checkbox ───────────────────────────────────────────────

function parseCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on'
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createCampaign(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const raw = {
    name:                 formData.get('name'),
    description:          formData.get('description') || null,
    campaign_type:        formData.get('campaign_type') || 'one_off',
    from_email:           formData.get('from_email'),
    from_name:            formData.get('from_name'),
    reply_to:             formData.get('reply_to') || null,
    track_opens:          parseCheckbox(formData, 'track_opens'),
    track_clicks:         parseCheckbox(formData, 'track_clicks'),
    subject:              formData.get('subject') || null,
    preview_text:         formData.get('preview_text') || null,
    template_id:          formData.get('template_id') || null,
    audience_type:        formData.get('audience_type') || null,
    audience_group_id:    formData.get('audience_group_id') || null,
    audience_segment_id:  formData.get('audience_segment_id') || null,
    planned_send_at:      formData.get('planned_send_at') || null,
    batch_size:           formData.get('batch_size') || 0,
  }

  const parsed = CampaignSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { reply_to, ...rest } = parsed.data

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...rest, reply_to_email: reply_to, status: 'draft' })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { errors: { name: [`De naam "${parsed.data.name}" is al in gebruik.`] } }
    }
    return { message: error.message }
  }

  revalidatePath('/campaigns')
  redirect(`/campaigns/${data.id}?info=${encodeURIComponent('Campagne aangemaakt als concept.')}`)
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateCampaign(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireEditor()
  const raw = {
    name:                 formData.get('name'),
    description:          formData.get('description') || null,
    from_email:           formData.get('from_email'),
    from_name:            formData.get('from_name'),
    reply_to:             formData.get('reply_to') || null,
    track_opens:          parseCheckbox(formData, 'track_opens'),
    track_clicks:         parseCheckbox(formData, 'track_clicks'),
    subject:              formData.get('subject') || null,
    preview_text:         formData.get('preview_text') || null,
    template_id:          formData.get('template_id') || null,
    audience_type:        formData.get('audience_type') || null,
    audience_group_id:    formData.get('audience_group_id') || null,
    audience_segment_id:  formData.get('audience_segment_id') || null,
    planned_send_at:      formData.get('planned_send_at') || null,
    batch_size:           formData.get('batch_size') || 0,
  }

  const parsed = UpdateCampaignSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { reply_to, ...rest } = parsed.data

  const supabase = createServiceClient()

  // Als campagne klaarstond, terugzetten naar concept (vereist hervalidatie)
  const { data: current } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const resetToDraft = current?.status === 'ready' || current?.status === 'scheduled'

  const { error } = await supabase
    .from('campaigns')
    .update({
      ...rest,
      reply_to_email: reply_to,
      ...(resetToDraft ? { status: 'draft' } : {}),
    })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { message: error.message }

  revalidatePath(`/campaigns/${id}`)
  revalidatePath('/campaigns')
  redirect(`/campaigns/${id}`)
}

// ── STATUS: Klaarzetten (draft → ready) ───────────────────────────────────────

export async function markCampaignReady(id: string) {
  await requireEditor()
  const supabase = createServiceClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('subject, template_id, audience_type, audience_group_id, audience_segment_id, campaign_type')
    .eq('id', id)
    .maybeSingle()

  if (!campaign) throw new Error('Campagne niet gevonden.')
  if (campaign.campaign_type !== 'one_off') {
    throw new Error('Alleen eenmalige campagnes kunnen worden klaargezet voor verzending.')
  }

  const missing: string[] = []
  if (!campaign.subject) missing.push('onderwerpregel')
  if (!campaign.template_id) missing.push('template')
  if (!campaign.audience_type || (!campaign.audience_group_id && !campaign.audience_segment_id)) {
    missing.push('doelgroep')
  }

  if (missing.length > 0) {
    const msg = encodeURIComponent(`Vul eerst in: ${missing.join(', ')}`)
    redirect(`/campaigns/${id}?error=${msg}`)
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'ready' })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${id}`)
  revalidatePath('/campaigns')
  redirect(`/campaigns/${id}`)
}

// ── STATUS: Terugzetten naar concept (ready/scheduled → draft) ────────────────

export async function setCampaignStatus(id: string, status: string) {
  // Verzendstatussen zijn voorbehouden aan admin
  if (['sending', 'completed'].includes(status)) {
    await requireAdmin()
  } else {
    await requireEditor()
  }
  const ALLOWED = [
    'draft', 'ready', 'scheduled', 'sending', 'completed',
    'paused', 'cancelled', 'active', 'archived',
  ]
  if (!ALLOWED.includes(status)) throw new Error(`Ongeldige status: ${status}`)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('campaigns')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${id}`)
  revalidatePath('/campaigns')
}

// ── VERSTUREN ─────────────────────────────────────────────────────────────────

/**
 * Verstuurt een eenmalige campagne:
 * 1. Controleert guards (status, sent_at, verplichte velden)
 * 2. Zorgt dat er een campaign_step bestaat met het campagne-template
 * 3. Resolveert de doelgroep via audience service
 * 4. Maakt campaign_runs + mail_logs aan voor alle leverbare contacten
 * 5. Zet sent_at, recipient_count en status=sending
 *
 * Verzendbeveiliging: sent_at voorkomt dubbele verzending.
 */
export async function sendCampaign(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  // 1. Haal campagne op + guards
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle() as { data: Campaign | null }

  if (!campaign) throw new Error('Campagne niet gevonden.')

  // Verzendbeveiliging: mag niet opnieuw verstuurd worden
  if (campaign.sent_at) {
    const sentDate = new Date(campaign.sent_at).toLocaleString('nl-NL')
    const msg = encodeURIComponent(`Deze campagne is al verstuurd op ${sentDate}.`)
    redirect(`/campaigns/${id}?error=${msg}`)
  }

  if (!['ready', 'scheduled'].includes(campaign.status)) {
    throw new Error(
      `Campagne heeft status "${campaign.status}" — alleen "klaar" of "ingepland" kan verstuurd worden.`
    )
  }

  if (!campaign.template_id) throw new Error('Selecteer een template voordat je verstuurt.')
  if (!campaign.subject)     throw new Error('Vul een onderwerpregel in voordat je verstuurt.')

  // 2. Zorg voor één campaign_step (auto-aangemaakt voor one_off)
  const { data: existingStep } = await supabase
    .from('campaign_steps')
    .select('id')
    .eq('campaign_id', id)
    .order('step_order')
    .limit(1)
    .maybeSingle()

  let stepId: string

  if (existingStep) {
    stepId = existingStep.id
    // Synchroniseer template + onderwerp bij eventuele bewerkingen
    await supabase
      .from('campaign_steps')
      .update({
        template_id:      campaign.template_id,
        subject_override: campaign.subject,
      })
      .eq('id', stepId)
  } else {
    const { data: newStep, error: stepErr } = await supabase
      .from('campaign_steps')
      .insert({
        campaign_id:      id,
        template_id:      campaign.template_id,
        step_order:       1,
        delay_hours:      0,
        delay_days:       0,
        subject_override: campaign.subject,
      })
      .select('id')
      .single()

    if (stepErr || !newStep) throw new Error('Kon verzendstap niet aanmaken: ' + stepErr?.message)
    stepId = newStep.id
  }

  // 3. Doelgroep resolven
  const audience = await resolveAudienceContacts(supabase, {
    groupIds:   campaign.audience_group_id   ? [campaign.audience_group_id]   : [],
    segmentIds: campaign.audience_segment_id ? [campaign.audience_segment_id] : [],
  })

  if (audience.contacts.length === 0) {
    const msg = encodeURIComponent('Geen leverbare contacten gevonden in de doelgroep.')
    redirect(`/campaigns/${id}?error=${msg}`)
  }

  const now         = new Date()
  const scheduledAt = campaign.planned_send_at
    ? new Date(campaign.planned_send_at).toISOString()
    : now.toISOString()

  // 4. Campaign_runs + mail_logs aanmaken
  let successCount = 0

  for (const contact of audience.contacts) {
    const { data: run } = await supabase
      .from('campaign_runs')
      .upsert(
        {
          campaign_id:   id,
          contact_id:    contact.id,
          subscribed_at: now.toISOString(),
        },
        { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle()

    if (!run) continue

    await supabase.from('mail_logs').insert({
      campaign_run_id:  run.id,
      campaign_step_id: stepId,
      contact_id:       contact.id,
      scheduled_at:     scheduledAt,
      status:           'pending',
    })

    successCount++
  }

  // 5. Campagne bijwerken
  await supabase
    .from('campaigns')
    .update({
      status:          'sending',
      sent_at:         now.toISOString(),
      recipient_count: successCount,
    })
    .eq('id', id)

  revalidatePath(`/campaigns/${id}`)
  revalidatePath('/campaigns')
  redirect(`/campaigns/${id}`)
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteCampaign(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (campaign?.status === 'sending') {
    throw new Error('Een campagne die aan het verzenden is kan niet worden verwijderd.')
  }

  // Soft delete
  const { error } = await supabase
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/campaigns')
  redirect('/campaigns')
}

// ── FUNNEL: Activeren (validatie + status → active) ───────────────────────────

/**
 * Valideert alle funnel-stappen en zet de campagne op 'active'.
 * Vereisten: minimaal één stap, elke stap heeft template + onderwerpregel.
 */
export async function activateFunnelCampaign(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('step_order, template_id, subject')
    .eq('campaign_id', id)
    .order('step_order')

  if (!steps || steps.length === 0) {
    const msg = encodeURIComponent('Een funnel-campagne heeft minimaal één stap nodig.')
    redirect(`/campaigns/${id}?error=${msg}`)
  }

  const invalid = steps.filter(s => !s.template_id || !s.subject)
  if (invalid.length > 0) {
    const nums = invalid.map((s) => `stap ${s.step_order}`).join(', ')
    const msg  = encodeURIComponent(`${nums}: template en onderwerpregel zijn verplicht.`)
    redirect(`/campaigns/${id}?error=${msg}`)
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${id}`)
  revalidatePath('/campaigns')
  redirect(`/campaigns/${id}`)
}

// ── FUNNEL: Campaign steps ────────────────────────────────────────────────────

export async function addCampaignStep(campaignId: string, formData: FormData) {
  await requireEditor()
  if (!campaignId) throw new Error('Campaign ID ontbreekt.')

  const template_id = (formData.get('template_id') as string)?.trim()
  if (!template_id) throw new Error('Template is verplicht.')

  const subject      = (formData.get('subject') as string)?.trim()      || null
  const preview_text = (formData.get('preview_text') as string)?.trim() || null
  const delay_hours  = Math.max(0, Number(formData.get('delay_hours') ?? 0))
  const delay_days   = Math.max(0, Number(formData.get('delay_days')  ?? 0))

  const supabase = createServiceClient()

  const { data: last } = await supabase
    .from('campaign_steps')
    .select('step_order')
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const step_order = (last?.step_order ?? 0) + 1

  const { error } = await supabase
    .from('campaign_steps')
    .insert({ campaign_id: campaignId, template_id, subject, preview_text, delay_hours, delay_days, step_order })

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function updateCampaignStep(
  campaignId: string,
  stepId: string,
  formData: FormData
) {
  await requireEditor()
  if (!campaignId || !stepId) throw new Error('Campaign of step ID ontbreekt.')

  const template_id = (formData.get('template_id') as string)?.trim()
  if (!template_id) throw new Error('Template is verplicht.')

  const subject          = (formData.get('subject') as string)?.trim()      || null
  const preview_text     = (formData.get('preview_text') as string)?.trim() || null
  const delay_hours      = Math.max(0, Number(formData.get('delay_hours')  ?? 0))
  const delay_days       = Math.max(0, Number(formData.get('delay_days')   ?? 0))

  // send_condition: serialiseer als JSON of null
  const condRaw = (formData.get('send_condition') as string)?.trim()
  const send_condition = condRaw && condRaw !== 'always'
    ? JSON.stringify({ type: condRaw })
    : null

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('campaign_steps')
    .update({ template_id, subject, preview_text, delay_hours, delay_days, send_condition })
    .eq('id', stepId)
    .eq('campaign_id', campaignId)

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${campaignId}`)
  redirect(`/campaigns/${campaignId}`)
}

// ── FUNNEL: Stap status (pauzeren / hervatten) ────────────────────────────────

export async function setStepStatus(
  campaignId: string,
  stepId: string,
  status: 'active' | 'paused'
) {
  await requireEditor()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('campaign_steps')
    .update({ status })
    .eq('id', stepId)
    .eq('campaign_id', campaignId)

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${campaignId}`)
}

// ── FUNNEL: Stap verwerken (planner uitvoeren) ────────────────────────────────

/**
 * Voert de planner uit voor één campagne-stap:
 * 1. Bepaalt welke contacten klaar zijn via getContactsReadyForStep
 * 2. Maakt mail_logs aan voor alle klaar-contacten (status = 'pending')
 * 3. Redirects terug naar campagne-detail met resultaatbericht
 */
export async function processFunnelStep(campaignId: string, stepId: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { getContactsReadyForStep } = await import('@/lib/services/funnel')

  const ready = await getContactsReadyForStep(supabase, campaignId, stepId)

  if (ready.length > 0) {
    const logs = ready.map(r => ({
      campaign_run_id:  r.campaignRunId,
      campaign_step_id: stepId,
      contact_id:       r.contactId,
      scheduled_at:     r.scheduledAt,
      status:           'pending',
    }))

    // Verwerk in batches van 500 om payload-limieten te respecteren
    const BATCH = 500
    for (let i = 0; i < logs.length; i += BATCH) {
      const { error } = await supabase.from('mail_logs').insert(logs.slice(i, i + BATCH))
      if (error) throw new Error(error.message)
    }
  }

  const msg = ready.length > 0
    ? encodeURIComponent(`${ready.length} contact${ready.length !== 1 ? 'en' : ''} in de wachtrij gezet.`)
    : encodeURIComponent('Geen nieuwe contacten klaar voor deze stap.')

  revalidatePath(`/campaigns/${campaignId}`)
  redirect(`/campaigns/${campaignId}?info=${msg}`)
}

// ── Wachtrij handmatig verwerken ──────────────────────────────────────────────

/**
 * Verwerkt de wachtrij voor één campagne (max 100 mails).
 * Bruikbaar als handmatige trigger vanuit de admin-UI naast de automatische cron.
 */
export async function triggerBatch(campaignId: string) {
  await requireAdmin()
  const supabase = createServiceClient()
  const { processBatch } = await import('@/lib/mail/processor')

  const result = await processBatch(supabase, { campaignId })

  const parts = [
    `${result.sent} verzonden`,
    result.failed  > 0 ? `${result.failed} mislukt`    : null,
    result.skipped > 0 ? `${result.skipped} overgeslagen` : null,
  ].filter(Boolean)

  const base    = result.processed > 0 ? parts.join(', ') : 'Geen berichten klaar voor verzending.'
  const suffix  = result.campaignsCompleted.length > 0 ? ' Campagne afgerond.' : ''
  const msg     = encodeURIComponent(base + suffix)

  revalidatePath(`/campaigns/${campaignId}`)
  redirect(`/campaigns/${campaignId}?info=${msg}`)
}

// ── Testmodus instellen ───────────────────────────────────────────────────────

export async function setTestMode(campaignId: string, formData: FormData) {
  await requireAdmin()
  const supabase = createServiceClient()

  const testMode         = formData.get('test_mode') === 'on'
  const rawMinutes       = parseInt(formData.get('test_delay_minutes') as string)
  const testDelayMinutes = isNaN(rawMinutes) ? 5 : Math.max(1, Math.min(rawMinutes, 120))

  const { error } = await supabase
    .from('campaigns')
    .update({ test_mode: testMode, test_delay_minutes: testDelayMinutes })
    .eq('id', campaignId)

  if (error) throw new Error(error.message)

  revalidatePath(`/campaigns/${campaignId}`)
  redirect(`/campaigns/${campaignId}?info=${encodeURIComponent(
    testMode
      ? `Testmodus actief — elke stap wacht ${testDelayMinutes} minuten.`
      : 'Testmodus uitgeschakeld — normale vertragingen.'
  )}`)
}

// ── Testmail versturen ────────────────────────────────────────────────────────

/**
 * Verstuurt een testmail naar het opgegeven adres met voorbeelddata.
 * Geen mail_log record — test-mails worden niet getrackt.
 */
export async function sendTestMailAction(campaignId: string, formData: FormData) {
  await requireEditor()
  const toEmail = (formData.get('test_email') as string)?.trim()
  if (!toEmail) throw new Error('Vul een e-mailadres in voor de testmail.')

  const supabase = createServiceClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('template_id, subject, from_email, from_name')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign?.template_id) {
    const msg = encodeURIComponent('Selecteer eerst een template voordat je een testmail verstuurt.')
    redirect(`/campaigns/${campaignId}?error=${msg}`)
  }

  const { sendTestEmail } = await import('@/lib/mail/test-mail')

  const result = await sendTestEmail({
    supabase,
    templateId: campaign.template_id!,
    toEmail,
    fromEmail:  campaign.from_email,
    fromName:   campaign.from_name,
    subject:    campaign.subject,
    appUrl:     process.env.NEXT_PUBLIC_APP_URL ?? '',
  })

  if (result.ok) {
    const msg = encodeURIComponent(`Testmail verzonden naar ${toEmail}.`)
    redirect(`/campaigns/${campaignId}?info=${msg}`)
  } else {
    const msg = encodeURIComponent(`Testmail mislukt: ${result.error}`)
    redirect(`/campaigns/${campaignId}?error=${msg}`)
  }
}

export async function removeCampaignStep(campaignId: string, stepId: string) {
  await requireEditor()
  if (!campaignId || !stepId) throw new Error('Campaign of step ID ontbreekt.')

  const supabase = createServiceClient()

  const { data: target } = await supabase
    .from('campaign_steps')
    .select('id, step_order')
    .eq('id', stepId)
    .eq('campaign_id', campaignId)
    .single()

  if (!target) throw new Error('Stap niet gevonden.')

  const { error: deleteErr } = await supabase
    .from('campaign_steps')
    .delete()
    .eq('id', stepId)

  if (deleteErr) throw new Error(deleteErr.message)

  // Hernummer latere stappen
  const { data: laterSteps } = await supabase
    .from('campaign_steps')
    .select('id, step_order')
    .eq('campaign_id', campaignId)
    .gt('step_order', target.step_order)
    .order('step_order')

  if (laterSteps && laterSteps.length > 0) {
    await Promise.all(
      laterSteps.map((s) =>
        supabase
          .from('campaign_steps')
          .update({ step_order: s.step_order - 1 })
          .eq('id', s.id)
      )
    )
  }

  revalidatePath(`/campaigns/${campaignId}`)
}
