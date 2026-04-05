/**
 * Core unsubscribe logic — pure function, framework-agnostic.
 *
 * Accepts a Supabase service client and a resolved token event.
 * Handles both global and campaign-specific opt-outs.
 * Logs ip_address, user_agent, and optional reason on the event row.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { logConsent }         from '@/lib/consent/log'

type SupabaseClient = ReturnType<typeof createServiceClient>

export type UnsubscribeEvent = {
  id: string
  contact_id: string
  campaign_id: string | null
  used_at: string | null
}

export type UnsubscribeContext = {
  ip?: string
  userAgent?: string
  reason?: string
}

export type UnsubscribeResult =
  | { outcome: 'already_used' }
  | { outcome: 'not_found' }
  | { outcome: 'global'; contactEmail: string }
  | { outcome: 'campaign'; campaignName: string | null }

/**
 * Looks up a token and returns the raw event row, or null if not found.
 */
export async function findUnsubscribeEvent(
  supabase: SupabaseClient,
  token: string,
): Promise<UnsubscribeEvent | null> {
  const { data } = await supabase
    .from('unsubscribe_events')
    .select('id, contact_id, campaign_id, used_at')
    .eq('token', token)
    .single()

  return data ?? null
}

/**
 * Processes an unsubscribe event:
 * 1. Marks contact as opted out
 * 2. Fills unsubscribed_at
 * 3. Cancels active campaign runs
 * 4. Skips pending mail_logs
 * 5. Logs ip_address, user_agent, reason on the event row
 *
 * Idempotent: returns 'already_used' if token was already processed.
 */
export async function processUnsubscribe(
  supabase: SupabaseClient,
  event: UnsubscribeEvent,
  ctx: UnsubscribeContext = {},
): Promise<UnsubscribeResult> {
  if (event.used_at) {
    return { outcome: 'already_used' }
  }

  const now      = new Date().toISOString()
  const isGlobal = event.campaign_id === null

  if (isGlobal) {
    // ── 1. Mark contact as globally opted out ────────────────────────────
    await supabase
      .from('contacts')
      .update({
        global_opt_out:  true,
        opted_in:        false,
        unsubscribed_at: now,
        status:          'opted_out',
      })
      .eq('id', event.contact_id)

    // ── 2. Cancel all active campaign runs ───────────────────────────────
    await supabase
      .from('campaign_runs')
      .update({ status: 'opted_out', opted_out_at: now })
      .eq('contact_id', event.contact_id)
      .eq('status', 'active')

    // ── 3. Skip all pending mail_logs ────────────────────────────────────
    const { data: runs } = await supabase
      .from('campaign_runs')
      .select('id')
      .eq('contact_id', event.contact_id)

    if (runs && runs.length > 0) {
      await supabase
        .from('mail_logs')
        .update({ status: 'skipped' })
        .in('campaign_run_id', runs.map((r) => r.id))
        .eq('status', 'pending')
    }

    // ── 4. Fetch contact email for confirmation message ──────────────────
    const { data: contact } = await supabase
      .from('contacts')
      .select('email')
      .eq('id', event.contact_id)
      .single()

    // ── 5. Log event ─────────────────────────────────────────────────────
    await supabase
      .from('unsubscribe_events')
      .update({
        used_at:    now,
        ip_address: ctx.ip        ?? null,
        user_agent: ctx.userAgent ?? null,
        reason:     ctx.reason    ?? null,
      })
      .eq('id', event.id)

    // ── 6. Consent audit trail ────────────────────────────────────────────
    await logConsent({
      supabase,
      contactId:  event.contact_id,
      eventType:  'opt_out_global',
      channel:    'email',
      ipAddress:  ctx.ip        ?? null,
      userAgent:  ctx.userAgent ?? null,
      notes:      ctx.reason    ?? null,
      metadata:   { via: 'unsubscribe_link', unsubscribe_event_id: event.id },
    })

    return { outcome: 'global', contactEmail: contact?.email ?? '' }
  } else {
    // ── Campaign-specific opt-out ────────────────────────────────────────

    // ── 1. Find the run ──────────────────────────────────────────────────
    const { data: run } = await supabase
      .from('campaign_runs')
      .select('id')
      .eq('campaign_id', event.campaign_id)
      .eq('contact_id', event.contact_id)
      .maybeSingle()

    if (run) {
      // ── 2. Cancel the run ──────────────────────────────────────────────
      await supabase
        .from('campaign_runs')
        .update({ status: 'opted_out', opted_out_at: now })
        .eq('id', run.id)

      // ── 3. Skip pending mail_logs for this run ─────────────────────────
      await supabase
        .from('mail_logs')
        .update({ status: 'skipped' })
        .eq('campaign_run_id', run.id)
        .eq('status', 'pending')
    }

    // ── 4. Fetch campaign name for confirmation ──────────────────────────
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name')
      .eq('id', event.campaign_id)
      .single()

    // ── 5. Log event ─────────────────────────────────────────────────────
    await supabase
      .from('unsubscribe_events')
      .update({
        used_at:    now,
        ip_address: ctx.ip        ?? null,
        user_agent: ctx.userAgent ?? null,
        reason:     ctx.reason    ?? null,
      })
      .eq('id', event.id)

    // ── 6. Consent audit trail ────────────────────────────────────────────
    await logConsent({
      supabase,
      contactId: event.contact_id,
      eventType: 'opt_out',
      channel:   'email',
      ipAddress: ctx.ip        ?? null,
      userAgent: ctx.userAgent ?? null,
      notes:     ctx.reason    ?? null,
      metadata:  {
        via: 'unsubscribe_link',
        campaign_id: event.campaign_id,
        unsubscribe_event_id: event.id,
      },
    })

    return { outcome: 'campaign', campaignName: campaign?.name ?? null }
  }
}
