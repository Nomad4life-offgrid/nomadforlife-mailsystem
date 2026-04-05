/**
 * Funnel service — planner logic voor drip-campagnes.
 *
 * Bepaalt welke contacten klaar zijn voor welke stap op basis van:
 * - campaign_run status (alleen 'active')
 * - Contactleverability (isDeliverable)
 * - Vertraging (delay_days + delay_hours) t.o.v. inschrijvingsdatum (stap 1)
 *   of de verzendtijdstip van de vorige stap (stap 2+)
 * - Verzendconditie (send_condition): gedragsfilter op vorige stap
 * - Deduplicatie: contacten die al een mail_log hebben voor deze stap worden overgeslagen
 *
 * Testmodus:
 *   Als campaign.test_mode = true worden delay_days/delay_hours vervangen door
 *   campaign.test_delay_minutes minuten (alleen voor stappen met delay > 0).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact, StepSendCondition } from '@/types'
import { isDeliverable } from './audience'

// ── Delivery stats ────────────────────────────────────────────────────────────

export type StepDeliveryStats = {
  pending:  number
  sent:     number
  failed:   number
  skipped:  number
  total:    number
}

/**
 * Geeft aggregated mail_log aantallen terug voor één campagne-stap.
 * Gebruikt voor de detailpagina (stap-kaart statistieken).
 */
export async function getStepDeliveryStats(
  supabase: SupabaseClient,
  stepId: string
): Promise<StepDeliveryStats> {
  const { data, error } = await supabase
    .from('mail_logs')
    .select('status')
    .eq('campaign_step_id', stepId)

  if (error) throw new Error(error.message)

  const counts: StepDeliveryStats = { pending: 0, sent: 0, failed: 0, skipped: 0, total: 0 }
  for (const row of data ?? []) {
    const s = row.status as keyof Omit<StepDeliveryStats, 'total'>
    if (s in counts) counts[s]++
    counts.total++
  }
  return counts
}

// ── Planner ───────────────────────────────────────────────────────────────────

export type ContactReadyForStep = {
  contactId:     string
  campaignRunId: string
  /** ISO timestamp waarop de mail gepland staat (= readyAt moment) */
  scheduledAt:   string
}

type RunRow = {
  id:            string
  contact_id:    string
  subscribed_at: string
  contacts:      Contact
}

type PrevLog = {
  sent_at:    string | null
  opened_at:  string | null
  clicked_at: string | null
}

function meetsCondition(cond: StepSendCondition | null, log: PrevLog | undefined): boolean {
  if (!cond || cond.type === 'always') return true
  if (!log) return false
  switch (cond.type) {
    case 'opened_previous':     return log.opened_at !== null
    case 'not_opened_previous': return log.opened_at === null
    case 'clicked_previous':    return log.clicked_at !== null
    default:                    return true
  }
}

/** Berekent effectieve vertraging in ms, rekening houdend met testmodus.
 *  In testmodus krijgen stap 2+ altijd test_delay_minutes, ook als delay 0 is.
 *  Stap 1 (welkomstmail) gebruikt altijd de werkelijke delay (meestal 0 = direct).
 */
function resolveDelayMs(
  step:    { delay_days: number; delay_hours: number; step_order: number },
  campaign: { test_mode: boolean; test_delay_minutes: number },
): number {
  if (campaign.test_mode && step.step_order > 1) {
    return (campaign.test_delay_minutes ?? 5) * 60_000
  }
  return (step.delay_days * 24 + step.delay_hours) * 3_600_000
}

/**
 * Bepaalt welke contacten klaar zijn om de gegeven stap te ontvangen.
 *
 * Geeft een lege array terug als:
 * - Stap of campagne niet gevonden
 * - Campagne niet 'active' of niet van type 'funnel'
 * - Stap heeft status 'paused'
 *
 * Controles per contact:
 * 1. campaign_run status = 'active'
 * 2. contact is leverbaar (isDeliverable)
 * 3. Nog geen mail_log voor dit run+stap (deduplicatie)
 * 4. Vertraging verstreken (relatief aan subscribed_at voor stap 1, aan vorige stap sent_at voor stap 2+)
 * 5. send_condition voldaan (op basis van vorige stap mail_log)
 */
export async function getContactsReadyForStep(
  supabase: SupabaseClient,
  campaignId: string,
  stepId: string
): Promise<ContactReadyForStep[]> {
  const now = new Date()

  // ── Stap ophalen ──────────────────────────────────────────────────────────
  const { data: step, error: stepErr } = await supabase
    .from('campaign_steps')
    .select('id, step_order, delay_days, delay_hours, status, send_condition')
    .eq('id', stepId)
    .eq('campaign_id', campaignId)
    .single()

  if (stepErr || !step) throw new Error('Stap niet gevonden.')
  if (step.status !== 'active') return []

  // ── Campagne ophalen (incl. testmodus) ────────────────────────────────────
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('status, campaign_type, test_mode, test_delay_minutes')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign || campaign.campaign_type !== 'funnel' || campaign.status !== 'active') return []

  // ── Actieve runs ophalen (met contact-data voor leverability-check) ────────
  const { data: runsData, error: runsErr } = await supabase
    .from('campaign_runs')
    .select('id, contact_id, subscribed_at, contacts(*)')
    .eq('campaign_id', campaignId)
    .eq('status', 'active')

  if (runsErr) throw new Error(runsErr.message)
  const runs = (runsData ?? []) as unknown as RunRow[]

  if (runs.length === 0) return []

  // ── Bestaande mail_logs voor deze stap (deduplicatie) ────────────────────
  const { data: existingLogs } = await supabase
    .from('mail_logs')
    .select('campaign_run_id')
    .eq('campaign_step_id', stepId)

  const alreadyQueued = new Set((existingLogs ?? []).map((l: { campaign_run_id: string }) => l.campaign_run_id))

  const delayMs = resolveDelayMs(step, campaign)

  // ── Stap 1: vertraging t.o.v. inschrijvingsdatum ─────────────────────────
  if (step.step_order === 1) {
    return runs
      .filter(run => {
        if (alreadyQueued.has(run.id)) return false
        if (!isDeliverable(run.contacts)) return false
        const readyAt = new Date(run.subscribed_at).getTime() + delayMs
        return readyAt <= now.getTime()
      })
      .map(run => ({
        contactId:     run.contact_id,
        campaignRunId: run.id,
        scheduledAt:   new Date(new Date(run.subscribed_at).getTime() + delayMs).toISOString(),
      }))
  }

  // ── Stap 2+: vertraging t.o.v. vorige stap + gedragsconditie ─────────────
  const { data: prevStep, error: prevStepErr } = await supabase
    .from('campaign_steps')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('step_order', step.step_order - 1)
    .single()

  if (prevStepErr || !prevStep) return []

  const { data: prevLogs } = await supabase
    .from('mail_logs')
    .select('campaign_run_id, sent_at, opened_at, clicked_at')
    .eq('campaign_step_id', prevStep.id)
    .eq('status', 'sent')

  type PrevLogRow = { campaign_run_id: string; sent_at: string | null; opened_at: string | null; clicked_at: string | null }
  const prevLogByRun = new Map<string, PrevLog>(
    (prevLogs ?? []).map((l: PrevLogRow) => [
      l.campaign_run_id,
      { sent_at: l.sent_at, opened_at: l.opened_at, clicked_at: l.clicked_at },
    ])
  )

  return runs
    .filter(run => {
      if (alreadyQueued.has(run.id)) return false
      if (!isDeliverable(run.contacts)) return false
      const prev = prevLogByRun.get(run.id)
      if (!prev?.sent_at) return false  // vorige stap nog niet verzonden
      if (!meetsCondition(step.send_condition, prev)) return false
      const readyAt = new Date(prev.sent_at).getTime() + delayMs
      return readyAt <= now.getTime()
    })
    .map(run => {
      const prev = prevLogByRun.get(run.id)!
      return {
        contactId:     run.contact_id,
        campaignRunId: run.id,
        scheduledAt:   new Date(new Date(prev.sent_at!).getTime() + delayMs).toISOString(),
      }
    })
}

// ── Automatische planner ──────────────────────────────────────────────────────

export type PlanResult = { queued: number }

/**
 * Loopt alle actieve funnel-campagnes af en zet klare contacten in de wachtrij.
 * Bedoeld om vanuit de cron aan te roepen vóór processBatch().
 */
export async function planAllFunnelSteps(supabase: SupabaseClient): Promise<PlanResult> {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 'active')
    .eq('campaign_type', 'funnel')

  if (!campaigns || campaigns.length === 0) return { queued: 0 }

  let queued = 0

  for (const campaign of campaigns) {
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('status', 'active')
      .order('step_order', { ascending: true })

    if (!steps) continue

    for (const step of steps) {
      const ready = await getContactsReadyForStep(supabase, campaign.id, step.id)
      if (ready.length === 0) continue

      const logs = ready.map(r => ({
        campaign_run_id:  r.campaignRunId,
        campaign_step_id: step.id,
        contact_id:       r.contactId,
        scheduled_at:     r.scheduledAt,
        status:           'pending',
      }))

      const BATCH = 500
      for (let i = 0; i < logs.length; i += BATCH) {
        const { error } = await supabase.from('mail_logs').insert(logs.slice(i, i + BATCH))
        if (error) console.error(`[planner] insert mislukt campagne ${campaign.id} stap ${step.id}:`, error.message)
        else queued += logs.slice(i, i + BATCH).length
      }
    }
  }

  console.log(`[planner] klaar — ${queued} nieuwe mail_logs aangemaakt`)
  return { queued }
}
