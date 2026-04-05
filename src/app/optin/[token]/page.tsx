import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { logConsent } from '@/lib/consent/log'

export const metadata = { title: 'Confirm subscription' }

export default async function OptInPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServiceClient()

  // Look up the token
  const { data: tokenRow } = await supabase
    .from('opt_in_tokens')
    .select('id, contact_id, campaign_id, used_at')
    .eq('token', token)
    .single()

  if (!tokenRow) notFound()

  // Already confirmed
  if (tokenRow.used_at) {
    return <StatusPage status="already_confirmed" />
  }

  // Activate the contact
  const now = new Date().toISOString()

  await supabase
    .from('contacts')
    .update({ opted_in: true, opted_in_at: now, status: 'active' })
    .eq('id', tokenRow.contact_id)

  // Mark token as used
  await supabase
    .from('opt_in_tokens')
    .update({ used_at: now })
    .eq('id', tokenRow.id)

  // Consent audit: bevestiging geklikt
  await logConsent({
    supabase,
    contactId: tokenRow.contact_id,
    eventType: 'opt_in_confirmed',
    channel:   'web',
    notes:     'Double opt-in bevestigingslink geklikt',
    metadata:  tokenRow.campaign_id
      ? { campaign_id: tokenRow.campaign_id, opt_in_token_id: tokenRow.id }
      : { opt_in_token_id: tokenRow.id },
  })

  // If a campaign_id was attached, subscribe the contact to that campaign
  if (tokenRow.campaign_id) {
    // Fetch campaign steps
    const { data: steps } = await supabase
      .from('campaign_steps')
      .select('id, step_order, delay_hours')
      .eq('campaign_id', tokenRow.campaign_id)
      .order('step_order')

    if (steps && steps.length > 0) {
      // Create campaign_run (ignore if already exists)
      const { data: run } = await supabase
        .from('campaign_runs')
        .upsert(
          { campaign_id: tokenRow.campaign_id, contact_id: tokenRow.contact_id },
          { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true }
        )
        .select('id')
        .single()

      if (run) {
        let cumulativeHours = 0
        for (const step of steps) {
          cumulativeHours += step.delay_hours
          await supabase.from('mail_logs').insert({
            campaign_run_id:  run.id,
            campaign_step_id: step.id,
            contact_id:       tokenRow.contact_id,
            scheduled_at:     new Date(Date.now() + cumulativeHours * 3_600_000).toISOString(),
          })
        }
      }
    }
  }

  return <StatusPage status="confirmed" hasCampaign={!!tokenRow.campaign_id} />
}

function StatusPage({
  status,
  hasCampaign = false,
}: {
  status: 'confirmed' | 'already_confirmed'
  hasCampaign?: boolean
}) {
  const isNew = status === 'confirmed'

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isNew ? 'bg-green-100' : 'bg-zinc-100'}`}>
          <svg className={`h-6 w-6 ${isNew ? 'text-green-600' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">
          {isNew ? 'Subscription confirmed!' : 'Already confirmed'}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {isNew
            ? hasCampaign
              ? "You're now subscribed. Your first email is on its way."
              : "You're now confirmed and will receive emails from us."
            : 'Your subscription was already confirmed. Nothing else to do.'}
        </p>
        <p className="mt-4 text-xs text-zinc-400">
          You can unsubscribe at any time via the link in any email we send you.
        </p>
      </div>
    </div>
  )
}
