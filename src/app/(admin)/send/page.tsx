import { createClient } from '@/lib/supabase/server'
import { subscribeContacts, subscribeGroup } from './actions'

export const metadata = { title: 'Send' }

export default async function SendPage({
  searchParams,
}: {
  searchParams: Promise<{ group_id?: string }>
}) {
  const { group_id } = await searchParams
  const supabase     = await createClient()

  const [{ data: campaigns }, { data: groups }] = await Promise.all([
    supabase.from('campaigns').select('id, name').eq('status', 'active').order('name'),
    supabase.from('contact_groups').select('id, name, color').order('name'),
  ])

  const noCampaigns = !campaigns || campaigns.length === 0

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900">Send</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Schrijf contacten in op een campagne via een segment of handmatig.
        Opted-out en al ingeschreven contacten worden overgeslagen.
      </p>

      {noCampaigns && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
          Geen actieve campagnes. Activeer eerst een campagne voordat je verstuurt.
        </div>
      )}

      {!noCampaigns && (
        <div className="mt-8 space-y-6">

          {/* Segment verzending */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">Verstuur aan segment</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Alle actieve contacten in het gekozen segment worden ingeschreven.
              </p>
            </div>
            <form action={subscribeGroup} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Campagne <span className="text-red-500">*</span>
                  </label>
                  <select name="campaign_id" required className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none">
                    <option value="">Kies campagne…</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Segment <span className="text-red-500">*</span>
                  </label>
                  <select name="group_id" required defaultValue={group_id ?? ''} className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none">
                    <option value="">Kies segment…</option>
                    {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
                Verstuur aan segment
              </button>
            </form>
          </div>

          {/* Handmatige verzending */}
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">Handmatig e-mailadressen</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Één per regel of kommagescheiden. Nieuwe contacten worden aangemaakt.
              </p>
            </div>
            <form action={subscribeContacts} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Campagne <span className="text-red-500">*</span>
                </label>
                <select name="campaign_id" required className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none">
                  <option value="">Kies campagne…</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  E-mailadressen <span className="text-red-500">*</span>
                </label>
                <textarea name="emails" rows={6} required placeholder={"jan@example.com\npiet@example.com"} className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-zinc-500 focus:outline-none" />
              </div>
              <button type="submit" className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
                Inschrijven &amp; inplannen
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
