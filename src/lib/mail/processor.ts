/**
 * Mail-wachtrij processor — verzendt pending mail_logs via SendGrid.
 *
 * Verantwoordelijkheden:
 * - Haalt een batch pending mail_logs op (gefilterd op scheduled_at <= nu)
 * - Voert per log de send-guards uit (global_opt_out, campaign-status, run-status)
 * - Bouwt de mail-payload (subject-override, variabelen, unsubscribe-URL)
 * - Verstuurt via SendGrid en logt het resultaat terug in mail_logs
 * - Markeert campagnes als 'completed' als er geen pending logs meer zijn
 *
 * Gebruik:
 *   processBatch(supabase)                          — verwerk globale wachtrij
 *   processBatch(supabase, { campaignId: '...' })   — alleen voor één campagne
 *   processBatch(supabase, { stepId: '...' })       — alleen voor één stap
 *
 * Bedoeld om vanuit de HTTP-route én vanuit server actions aanroepbaar te zijn,
 * zodat zowel cron-gebaseerde als handmatige verwerking dezelfde logica gebruiken.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail }      from '@/lib/email/sendgrid'
import { buildMailPayload } from '@/lib/email/sender'
import { app }            from '@/lib/config'

// ── Constanten ────────────────────────────────────────────────────────────────

const MAX_RETRIES         = 3
const DEFAULT_BATCH_LIMIT = 100

/** Campagne-statussen waarbij wél verzonden mag worden. */
const SENDABLE_STATUSES = new Set(['sending', 'active'])

// ── Typen ─────────────────────────────────────────────────────────────────────

export type BatchOptions = {
  /** Filter op één campagne (vertaalt naar de stap-IDs van die campagne). */
  campaignId?: string
  /** Filter op één specifieke stap. */
  stepId?: string
  /** Maximum aantal logs te verwerken (default: 100). */
  limit?: number
}

export type BatchResult = {
  processed: number
  sent:      number
  failed:    number
  skipped:   number
  /** Campagne-IDs die tijdens deze batch naar 'completed' zijn overgegaan. */
  campaignsCompleted: string[]
}

// ── Interne row-typen (afgeleid van Supabase select) ─────────────────────────

type LogRow = {
  id:               string
  retry_count:      number
  campaign_run_id:  string
  campaign_step_id: string
  contact_id:       string
  contacts:         ContactRow | null
  campaign_steps:   StepRow    | null
  campaign_runs:    RunRow     | null
}

type ContactRow = {
  id:             string
  email:          string
  first_name:     string | null
  last_name:      string | null
  global_opt_out: boolean
  bounced_at:     string | null
}

type StepRow = {
  id:               string
  subject:          string | null
  subject_override: string | null
  templates: {
    subject:   string
    html_body: string
    text_body: string | null
  } | null
  campaigns: {
    id:         string
    name:       string
    from_email: string
    from_name:  string
    status:     string
  } | null
}

type RunRow = {
  id:          string
  status:      string
  campaign_id: string
}

// ── Hoofd-functie ─────────────────────────────────────────────────────────────

export async function processBatch(
  supabase: SupabaseClient,
  opts: BatchOptions = {}
): Promise<BatchResult> {
  const limit = opts.limit ?? DEFAULT_BATCH_LIMIT

  // ── Stap-IDs bepalen voor campagne-filter ──────────────────────────────────
  let stepIdFilter: string[] | null = null

  if (opts.stepId) {
    stepIdFilter = [opts.stepId]
  } else if (opts.campaignId) {
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', opts.campaignId)

    if (!steps || steps.length === 0) {
      return { processed: 0, sent: 0, failed: 0, skipped: 0, campaignsCompleted: [] }
    }
    stepIdFilter = steps.map((s) => s.id)
  }

  // ── Pending logs ophalen ───────────────────────────────────────────────────
  let query = supabase
    .from('mail_logs')
    .select(`
      id, retry_count, campaign_run_id, campaign_step_id, contact_id,
      contacts ( id, email, first_name, last_name, global_opt_out, bounced_at ),
      campaign_steps (
        id, subject, subject_override,
        templates ( subject, html_body, text_body ),
        campaigns ( id, name, from_email, from_name, status )
      ),
      campaign_runs ( id, status, campaign_id )
    `)
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (stepIdFilter) {
    query = query.in('campaign_step_id', stepIdFilter)
  }

  const { data: logs, error: fetchErr } = await query
  if (fetchErr) throw new Error(`[processor] ophalen mislukt: ${fetchErr.message}`)
  if (!logs || logs.length === 0) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0, campaignsCompleted: [] }
  }

  let sent = 0, failed = 0, skipped = 0
  const seenCampaignIds = new Set<string>()

  // ── Per-log verwerken ──────────────────────────────────────────────────────
  for (const raw of logs as unknown as LogRow[]) {
    const log      = raw
    const contact  = log.contacts
    const step     = log.campaign_steps
    const run      = log.campaign_runs
    const template = step?.templates ?? null
    const campaign = step?.campaigns ?? null

    if (campaign?.id) seenCampaignIds.add(campaign.id)

    // ── Skip-guards ──────────────────────────────────────────────────────────
    const shouldSkip =
      !contact   || !template  || !campaign           ||
      contact.global_opt_out                          ||
      contact.bounced_at !== null                     ||  // hard/soft bounce — niet verzenden
      run?.status === 'opted_out'                     ||
      !SENDABLE_STATUSES.has(campaign.status)

    if (shouldSkip) {
      await supabase
        .from('mail_logs')
        .update({ status: 'skipped' })
        .eq('id', log.id)
      skipped++
      continue
    }

    // ── Unsubscribe-token aanmaken ───────────────────────────────────────────
    const { data: unsubRow, error: unsubErr } = await supabase
      .from('unsubscribe_events')
      .insert({ contact_id: contact.id, campaign_id: campaign.id })
      .select('token')
      .single()

    if (unsubErr || !unsubRow) {
      console.error(`[processor] unsubscribe token error log ${log.id}:`, unsubErr?.message)
      await markFailed(supabase, log.id, log.retry_count, 'Kon afmeldtoken niet aanmaken', false)
      failed++
      continue
    }

    const unsubscribeUrl     = `${app.url}/unsubscribe/${unsubRow.token}`
    const unsubscribePostUrl = `${app.url}/api/unsubscribe/${unsubRow.token}`

    // ── Subject-prioriteit:
    //    funnel-stap subject > one_off subject_override > template-standaard
    const subjectToUse =
      step?.subject          ??
      step?.subject_override ??
      template.subject

    const payload = buildMailPayload({
      contact,
      template: {
        subject:   subjectToUse,
        html_body: template.html_body,
        text_body: template.text_body,
      },
      campaign: {
        from_email: campaign.from_email,
        from_name:  campaign.from_name,
        name:       campaign.name,
      },
      unsubscribeUrl,
      unsubscribePostUrl,
    })

    // ── Versturen ────────────────────────────────────────────────────────────
    const result = await sendEmail(payload)

    if (result.ok) {
      await supabase
        .from('mail_logs')
        .update({
          status:              'sent',
          sent_at:             new Date().toISOString(),
          external_message_id: result.messageId,
          error_message:       null,
        })
        .eq('id', log.id)
      sent++
    } else {
      await markFailed(supabase, log.id, log.retry_count, result.error, result.retryable)
      failed++
    }
  }

  // ── Campaign-completion check ──────────────────────────────────────────────
  const campaignsCompleted: string[] = []

  for (const campaignId of seenCampaignIds) {
    const completed = await checkAndCompleteCampaign(supabase, campaignId)
    if (completed) campaignsCompleted.push(campaignId)
  }

  console.log(
    `[processor] klaar — verwerkt:${logs.length} ` +
    `verzonden:${sent} mislukt:${failed} overgeslagen:${skipped} ` +
    `voltooid:${campaignsCompleted.length}`
  )

  return { processed: logs.length, sent, failed, skipped, campaignsCompleted }
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

async function markFailed(
  supabase:    SupabaseClient,
  logId:       string,
  retryCount:  number,
  errorMessage: string,
  retryable:   boolean,
) {
  const newRetryCount = retryCount + 1
  const exhausted     = !retryable || newRetryCount >= MAX_RETRIES

  await supabase
    .from('mail_logs')
    .update({
      status:        exhausted ? 'failed' : 'pending',
      retry_count:   newRetryCount,
      error_message: errorMessage,
    })
    .eq('id', logId)
}

/**
 * Controleert of een campagne volledig verwerkt is en markeert hem 'completed'.
 * Alleen van toepassing op one_off-campagnes met status 'sending'.
 * Retourneert true als de status gewijzigd is.
 */
async function checkAndCompleteCampaign(
  supabase:   SupabaseClient,
  campaignId: string
): Promise<boolean> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('status, campaign_type')
    .eq('id', campaignId)
    .maybeSingle()

  // Alleen one_off-campagnes in 'sending' krijgen automatische completion
  if (!campaign || campaign.status !== 'sending' || campaign.campaign_type !== 'one_off') {
    return false
  }

  // Alle stap-IDs voor deze campagne
  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('id')
    .eq('campaign_id', campaignId)

  if (!steps || steps.length === 0) return false

  // Zijn er nog pending logs?
  const { count } = await supabase
    .from('mail_logs')
    .select('id', { count: 'exact', head: true })
    .in('campaign_step_id', steps.map((s) => s.id))
    .eq('status', 'pending')

  if (count !== 0) return false

  // Alles verzonden — status bijwerken
  await supabase
    .from('campaigns')
    .update({ status: 'completed' })
    .eq('id', campaignId)

  return true
}
