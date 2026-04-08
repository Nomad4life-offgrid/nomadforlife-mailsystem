import { createClient } from '@/lib/supabase/server'
import { SegmentForm, EmailForm } from './SendForms'

export const metadata = { title: 'Inschrijven op campagne' }

export default async function SendPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { data: groups }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, status, campaign_type')
      .in('status', ['active', 'ready', 'sending', 'scheduled'])
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('contact_groups')
      .select('id, name, color')
      .order('name'),
  ])

  const noCampaigns = !campaigns || campaigns.length === 0

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900">Inschrijven op campagne</h1>

      {/* Uitleg */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-600 space-y-2">
        <p className="font-medium text-zinc-800">Wanneer gebruik je welke methode?</p>
        <ul className="space-y-1.5 text-xs">
          <li className="flex gap-2">
            <span className="font-semibold text-zinc-700 shrink-0">Funnel</span>
            <span>Schrijf een segment of losse e-mailadressen in op een funnel-campagne. Alle stappen worden direct ingepland op basis van de ingestelde vertragingen. Je kunt een startdatum/tijd kiezen.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-zinc-700 shrink-0">Eenmalig</span>
            <span>Gebruik de <strong>"Nu versturen"</strong> knop op de campagnepagina. Die verstuurt naar de vaste doelgroep die op de campagne is ingesteld.</span>
          </li>
        </ul>
      </div>

      {noCampaigns && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
          Geen actieve campagnes gevonden. Activeer eerst een campagne.
        </div>
      )}

      {!noCampaigns && (
        <div className="mt-6 space-y-6">

          {/* Segment */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">Via segment</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Alle actieve opted-in contacten in het segment worden ingeschreven. Al ingeschreven contacten worden overgeslagen.
              </p>
            </div>
            <SegmentForm campaigns={campaigns} groups={groups ?? []} />
          </div>

          {/* Losse e-mails */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">Losse e-mailadressen</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Één per regel of kommagescheiden. Nieuwe contacten worden automatisch aangemaakt en opt-in gezet.
              </p>
            </div>
            <EmailForm campaigns={campaigns} />
          </div>

        </div>
      )}
    </div>
  )
}
