'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/guards'

// ── Shared helpers ────────────────────────────────────────────────────────────

type StepRow = { id: string; step_order: number; delay_days: number; delay_hours: number }

/**
 * Schedules mail_logs for all steps of a campaign run.
 * Cumulative delay = sum of (delay_days * 24 + delay_hours) for each step.
 */
async function scheduleMailLogs(
  supabase: ReturnType<typeof createServiceClient>,
  runId:     string,
  contactId: string,
  steps:     StepRow[],
): Promise<void> {
  if (steps.length === 0) return

  let cumulativeMs = 0
  for (const step of steps) {
    cumulativeMs += (step.delay_days * 24 + step.delay_hours) * 3_600_000
    await supabase.from('mail_logs').insert({
      campaign_run_id:  runId,
      campaign_step_id: step.id,
      contact_id:       contactId,
      scheduled_at:     new Date(Date.now() + cumulativeMs).toISOString(),
    })
  }
}

async function fetchSteps(
  supabase:   ReturnType<typeof createServiceClient>,
  campaignId: string,
): Promise<StepRow[]> {
  const { data, error } = await supabase
    .from('campaign_steps')
    .select('id, step_order, delay_days, delay_hours')
    .eq('campaign_id', campaignId)
    .order('step_order')

  if (error) throw new Error(error.message)
  return data ?? []
}

// ── subscribeContacts ─────────────────────────────────────────────────────────

export async function subscribeContacts(formData: FormData) {
  await requireAdmin()
  const supabase   = createServiceClient()
  const campaignId = formData.get('campaign_id') as string
  const rawEmails  = formData.get('emails') as string

  const emails = rawEmails
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!campaignId || emails.length === 0) {
    throw new Error('Campaign and at least one email are required.')
  }

  const steps = await fetchSteps(supabase, campaignId)
  const now   = new Date().toISOString()

  for (const email of emails) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, global_opt_out, opted_in, status')
      .eq('email', email)
      .single()

    let contactId: string

    if (existing) {
      if (existing.global_opt_out || existing.status === 'opted_out') continue
      if (!existing.opted_in || existing.status !== 'active') continue
      contactId = existing.id
    } else {
      // Admin is explicitly adding this email — auto opt-in (consent asserted by admin)
      const { data: created, error: createErr } = await supabase
        .from('contacts')
        .insert({
          email,
          opted_in:    true,
          opted_in_at: now,
          status:      'active',
          source:      'admin',
        })
        .select('id')
        .single()
      if (createErr || !created) continue
      contactId = created.id
    }

    const { data: run } = await supabase
      .from('campaign_runs')
      .upsert(
        { campaign_id: campaignId, contact_id: contactId },
        { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true }
      )
      .select('id')
      .single()

    if (!run) continue
    await scheduleMailLogs(supabase, run.id, contactId, steps)
  }

  revalidatePath('/logs')
  redirect('/logs')
}

// ── subscribeGroup ────────────────────────────────────────────────────────────

/**
 * Schrijf alle actieve contacten in een groep in op een campagne.
 */
export async function subscribeGroup(formData: FormData) {
  await requireAdmin()
  const supabase   = createServiceClient()
  const campaignId = formData.get('campaign_id') as string
  const groupId    = formData.get('group_id')    as string

  if (!campaignId || !groupId) throw new Error('Campagne en segment zijn verplicht.')

  const { data: members, error: membersErr } = await supabase
    .from('contact_group_members')
    .select('contacts(id, email, global_opt_out, opted_in, status)')
    .eq('group_id', groupId)

  if (membersErr) throw new Error(membersErr.message)
  if (!members || members.length === 0) {
    revalidatePath('/logs')
    redirect('/logs')
  }

  const steps = await fetchSteps(supabase, campaignId)

  for (const member of members) {
    const contact = member.contacts as unknown as {
      id: string; email: string; global_opt_out: boolean; opted_in: boolean; status: string
    } | null

    if (!contact) continue
    if (contact.global_opt_out || contact.status === 'opted_out') continue
    if (!contact.opted_in || contact.status !== 'active') continue

    const { data: run } = await supabase
      .from('campaign_runs')
      .upsert(
        { campaign_id: campaignId, contact_id: contact.id },
        { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true }
      )
      .select('id')
      .single()

    if (!run) continue
    await scheduleMailLogs(supabase, run.id, contact.id, steps)
  }

  revalidatePath('/logs')
  redirect('/logs')
}
