import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { confirmUnsubscribe } from './actions'

export const metadata = { title: 'Afmelden' }

const REASONS = [
  'Too many emails',
  'Content not relevant',
  'Did not subscribe',
  'Other',
]

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('unsubscribe_events')
    .select('id, used_at, campaign_id')
    .eq('token', token)
    .single()

  if (!event) notFound()

  if (event.used_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">Al afgemeld</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Deze link is al eerder gebruikt. Je bent al afgemeld.
          </p>
        </div>
      </div>
    )
  }

  const boundAction = confirmUnsubscribe.bind(null, token)

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Afmelden</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          {event.campaign_id
            ? 'Je staat op het punt je af te melden van deze campagne.'
            : 'Je staat op het punt je af te melden van alle e-mails.'}
        </p>

        <form action={boundAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reason" className="block text-xs font-medium text-zinc-600">
              Reden (optioneel)
            </label>
            <select
              id="reason"
              name="reason"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none"
            >
              <option value="">Geen reden opgeven</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Bevestig afmelding
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-400">
          Je kunt je altijd opnieuw aanmelden via onze website.
        </p>
      </div>
    </div>
  )
}
