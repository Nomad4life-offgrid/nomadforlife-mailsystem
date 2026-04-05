/**
 * Log service — read queries for mail_logs, consent_logs, activity_logs.
 * All log tables are append-only; there are no mutations here.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MailLog, ConsentLog, ActivityLog } from '@/types'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

// ── Mail logs ─────────────────────────────────────────────────────────────────

export async function getMailLogs(
  supabase: SupabaseClient,
  opts: Partial<PaginationParams> & { contact_id?: string; campaign_run_id?: string } = {}
): Promise<PaginatedResponse<MailLog>> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  let query = supabase
    .from('mail_logs')
    .select('*', { count: 'exact' })
    .order('scheduled_at', { ascending: false })
    .range(from, to)

  if (opts.contact_id)      query = query.eq('contact_id', opts.contact_id)
  if (opts.campaign_run_id) query = query.eq('campaign_run_id', opts.campaign_run_id)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data:  data as MailLog[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

// ── Consent logs ──────────────────────────────────────────────────────────────

export async function getConsentLogs(
  supabase: SupabaseClient,
  contactId: string
): Promise<ConsentLog[]> {
  const { data, error } = await supabase
    .from('consent_logs')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as ConsentLog[]
}

/** Append a consent log entry (service-role only). */
export async function logConsent(
  supabase: SupabaseClient,
  entry: Omit<ConsentLog, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('consent_logs').insert(entry)
  if (error) throw new Error(error.message)
}

// ── Activity logs ─────────────────────────────────────────────────────────────

export async function getActivityLogs(
  supabase: SupabaseClient,
  opts: Partial<PaginationParams> & { entity_type?: string; entity_id?: string } = {}
): Promise<PaginatedResponse<ActivityLog>> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts.entity_type) query = query.eq('entity_type', opts.entity_type)
  if (opts.entity_id)   query = query.eq('entity_id', opts.entity_id)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data:  data as ActivityLog[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

/** Append an activity log entry (service-role only). */
export async function logActivity(
  supabase: SupabaseClient,
  entry: Omit<ActivityLog, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert(entry)
  if (error) throw new Error(error.message)
}
