import { createServiceClient } from '@/lib/supabase/service'

export const metadata = { title: 'Afgemeld' }

export default async function UnsubscribeDonePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase  = createServiceClient()

  // Fetch event to show context-aware confirmation
  const { data: event } = await supabase
    .from('unsubscribe_events')
    .select('campaign_id, campaigns(name)')
    .eq('token', token)
    .single()

  const isGlobal   = !event || event.campaign_id === null
  const campaign   = event?.campaigns as unknown as { name: string } | null

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">

        {/* Checkmark */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-zinc-900">Afgemeld</h1>

        <p className="mt-2 text-sm text-zinc-500">
          {isGlobal
            ? 'Je bent afgemeld van alle e-mails. Je ontvangt geen verdere berichten van ons.'
            : `Je bent afgemeld van de campagne "${campaign?.name ?? ''}". Andere e-mails van ons blijf je ontvangen.`}
        </p>

        <p className="mt-4 text-xs text-zinc-400">
          Je kunt je via de website altijd opnieuw aanmelden.
        </p>
      </div>
    </div>
  )
}
