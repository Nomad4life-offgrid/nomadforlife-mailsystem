/**
 * Campaign service — read-only queries used by Server Components and Route Handlers.
 * Mutations live in app/(admin)/campaigns/actions.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Campaign, CampaignSummary, CampaignStep, CampaignRun } from '@/types'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function getCampaigns(
  supabase: SupabaseClient,
  opts: Partial<PaginationParams> & { status?: string } = {}
): Promise<PaginatedResponse<CampaignSummary>> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  let query = supabase
    .from('campaigns')
    .select('id, name, status, from_email, from_name, created_at', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (opts.status) {
    query = query.eq('status', opts.status)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data:  data as CampaignSummary[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

export async function getCampaign(supabase: SupabaseClient, id: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Campaign | null
}

// ── Steps ─────────────────────────────────────────────────────────────────────

export async function getCampaignSteps(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignStep[]> {
  const { data, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_order')

  if (error) throw new Error(error.message)
  return data as CampaignStep[]
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function getCampaignRuns(
  supabase: SupabaseClient,
  campaignId: string,
  opts: Partial<PaginationParams> = {}
): Promise<PaginatedResponse<CampaignRun>> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  const { data, error, count } = await supabase
    .from('campaign_runs')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('subscribed_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const total = count ?? 0
  return {
    data:  data as CampaignRun[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

export async function getContactRuns(
  supabase: SupabaseClient,
  contactId: string
): Promise<CampaignRun[]> {
  const { data, error } = await supabase
    .from('campaign_runs')
    .select('*')
    .eq('contact_id', contactId)
    .order('subscribed_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as CampaignRun[]
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getCampaignStats(supabase: SupabaseClient, campaignId: string) {
  const [runsRes, logsRes] = await Promise.all([
    supabase
      .from('campaign_runs')
      .select('status', { count: 'exact' })
      .eq('campaign_id', campaignId),
    supabase
      .from('mail_logs')
      .select('status, opened_at, clicked_at')
      .eq('campaign_id', campaignId), // joined via campaign_steps
  ])

  if (runsRes.error) throw new Error(runsRes.error.message)

  const runs = runsRes.data as { status: string }[]
  return {
    total:     runs.length,
    active:    runs.filter(r => r.status === 'active').length,
    completed: runs.filter(r => r.status === 'completed').length,
    opted_out: runs.filter(r => r.status === 'opted_out').length,
    bounced:   runs.filter(r => r.status === 'bounced').length,
  }
}
