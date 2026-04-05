import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignForm } from '../../CampaignForm'
import { updateCampaign } from '../../actions'
import type { Campaign } from '@/types'

export const metadata = { title: 'Campagne bewerken' }

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = await createClient()

  const [
    { data: raw },
    { data: templates },
    { data: groups },
    { data: segments },
  ] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('templates')
      .select('id, name, subject')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('contact_groups')
      .select('id, name, description, color, list_type, is_locked, created_by, created_at, updated_at')
      .order('name'),
    supabase
      .from('segments')
      .select('id, name, description, filter_json, preview_count, refreshed_at, created_by, created_at, updated_at')
      .order('name'),
  ])

  if (!raw) notFound()

  const campaign = raw as Campaign
  const isActive = ['sending', 'completed'].includes(campaign.status)

  const boundUpdate = updateCampaign.bind(null, id)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/campaigns/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← Terug naar campagne
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Campagne bewerken</h1>
        <p className="mt-1 text-sm text-zinc-400 font-mono">{campaign.name}</p>
      </div>

      {/* Waarschuwing voor actieve/voltooide campagnes */}
      {isActive && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {campaign.status === 'sending'
            ? 'Deze campagne is momenteel aan het verzenden. Bewerken is niet beschikbaar.'
            : 'Deze campagne is al verstuurd. Wijzigingen hebben geen invloed op verzonden e-mails.'}
        </div>
      )}

      {/* Waarschuwing voor klaarstaande campagnes */}
      {['ready', 'scheduled'].includes(campaign.status) && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Deze campagne staat klaar voor verzending. Na het opslaan wordt de status teruggezet naar <strong>concept</strong> — je moet hem opnieuw klaarzetten.
        </div>
      )}

      {!isActive ? (
        <CampaignForm
          mode="edit"
          action={boundUpdate}
          defaultValues={campaign}
          campaignId={id}
          templates={templates ?? []}
          groups={(groups ?? []) as any}
          segments={(segments ?? []) as any}
        />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
          <p className="text-sm text-zinc-500">Bewerken is niet mogelijk terwijl de campagne verstuurd wordt.</p>
          <Link
            href={`/campaigns/${id}`}
            className="mt-3 inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            Terug naar overzicht
          </Link>
        </div>
      )}
    </div>
  )
}
