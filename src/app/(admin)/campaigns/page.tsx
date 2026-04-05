import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Campagnes' }

// ── Status configuratie ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  draft:     { label: 'Concept',     dot: 'bg-zinc-400',    badge: 'bg-zinc-100 text-zinc-600'      },
  ready:     { label: 'Klaar',       dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700'       },
  scheduled: { label: 'Ingepland',   dot: 'bg-indigo-500',  badge: 'bg-indigo-50 text-indigo-700'   },
  sending:   { label: 'Verzenden',   dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-800'     },
  completed: { label: 'Voltooid',    dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700'     },
  paused:    { label: 'Gepauzeerd',  dot: 'bg-yellow-500',  badge: 'bg-yellow-50 text-yellow-800'   },
  cancelled: { label: 'Geannuleerd', dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700'         },
  active:    { label: 'Actief',      dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700'     },
  archived:  { label: 'Gearchiveerd',dot: 'bg-zinc-300',    badge: 'bg-zinc-100 text-zinc-400'      },
}

const TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  one_off: { label: 'Eenmalig', badge: 'bg-blue-50 text-blue-700' },
  funnel:  { label: 'Funnel',   badge: 'bg-purple-50 text-purple-700' },
}

const TABS = [
  { key: 'all',       label: 'Alles'     },
  { key: 'draft',     label: 'Concept'   },
  { key: 'ready',     label: 'Klaar'     },
  { key: 'scheduled', label: 'Ingepland' },
  { key: 'sending',   label: 'Verzenden' },
  { key: 'completed', label: 'Voltooid'  },
  { key: 'paused',    label: 'Gepauzeerd'},
] as const

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: filterStatus } = await searchParams
  const supabase = await createClient()

  const { data: allCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, description, status, campaign_type, from_name, from_email, planned_send_at, sent_at, recipient_count, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const campaigns = filterStatus && filterStatus !== 'all'
    ? (allCampaigns ?? []).filter((c) => c.status === filterStatus)
    : (allCampaigns ?? [])

  const counts = Object.fromEntries(
    TABS.map(({ key }) => [
      key,
      key === 'all'
        ? (allCampaigns?.length ?? 0)
        : (allCampaigns ?? []).filter((c) => c.status === key).length,
    ])
  )

  const currentTab = filterStatus ?? 'all'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Campagnes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {campaigns.length} campagne{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuwe campagne
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={key === 'all' ? '/campaigns' : `/campaigns?status=${key}`}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              currentTab === key
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                currentTab === key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {counts[key]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Campagnelijst */}
      <div className="mt-4 space-y-2">
        {campaigns.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-700">Geen campagnes</p>
            <p className="text-xs text-zinc-400 mt-1">
              {currentTab === 'all'
                ? <><Link href="/campaigns/new" className="underline text-zinc-600">Maak je eerste campagne aan</Link> om te beginnen.</>
                : `Geen campagnes met status "${currentTab}".`}
            </p>
          </div>
        )}

        {campaigns.map((c) => {
          const statusCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
          const typeCfg   = TYPE_CONFIG[c.campaign_type] ?? TYPE_CONFIG.one_off

          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              {/* Links */}
              <div className="flex items-center gap-4 min-w-0">
                <span className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${statusCfg.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-900 truncate">{c.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.badge}`}>
                      {typeCfg.label}
                    </span>
                  </div>
                  {c.description && (
                    <p className="mt-0.5 text-sm text-zinc-500 truncate max-w-md">{c.description}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    {c.from_name} &lt;{c.from_email}&gt;
                    {c.planned_send_at && !c.sent_at && (
                      <span className="ml-2 text-indigo-500">
                        · Gepland: {new Date(c.planned_send_at).toLocaleString('nl-NL')}
                      </span>
                    )}
                    {c.sent_at && (
                      <span className="ml-2 text-green-600">
                        · Verstuurd: {new Date(c.sent_at).toLocaleString('nl-NL')}
                        {c.recipient_count != null && ` aan ${c.recipient_count.toLocaleString('nl-NL')} ontvangers`}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Rechts */}
              <div className="flex items-center gap-4 shrink-0 ml-6">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.badge}`}>
                  {statusCfg.label}
                </span>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {new Date(c.created_at).toLocaleDateString('nl-NL')}
                </span>
                <svg className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
