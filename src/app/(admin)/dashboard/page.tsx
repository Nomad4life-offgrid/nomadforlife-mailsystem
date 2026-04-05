import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, relativeTime } from '@/utils/date'

export const metadata = { title: 'Dashboard — Nomad For Life Mail' }

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-zinc-300',
  sent:    'bg-green-500',
  failed:  'bg-red-500',
  skipped: 'bg-yellow-400',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  sent:    'bg-green-50 text-green-700',
  failed:  'bg-red-50 text-red-600',
  skipped: 'bg-yellow-50 text-yellow-700',
}

const CAMPAIGN_STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  draft:     { label: 'Concept',     dot: 'bg-zinc-400',   badge: 'bg-zinc-100 text-zinc-500'    },
  ready:     { label: 'Klaar',       dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700'     },
  scheduled: { label: 'Ingepland',   dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700' },
  sending:   { label: 'Verzenden',   dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-800'   },
  active:    { label: 'Actief',      dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700'   },
  completed: { label: 'Voltooid',    dot: 'bg-green-400',  badge: 'bg-green-50 text-green-600'   },
  paused:    { label: 'Gepauzeerd',  dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700' },
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalContacts },
    { count: activeContacts },
    { count: optedOutContacts },
    { count: pendingContacts },
    { count: sentMails },
    { count: pendingMails },
    { count: failedMails },
    { count: skippedMails },
    { data: allCampaigns },
    { data: recentFailed },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('opted_in', true).is('deleted_at', null),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('global_opt_out', true).is('deleted_at', null),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'skipped'),
    supabase.from('campaigns')
      .select('id, name, status, campaign_type, planned_send_at, sent_at, recipient_count')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('mail_logs')
      .select('id, error_message, scheduled_at, contacts(email), campaign_steps(campaigns(name))')
      .eq('status', 'failed')
      .order('scheduled_at', { ascending: false })
      .limit(5),
    supabase.from('mail_logs')
      .select('id, status, scheduled_at, sent_at, contacts(email), campaign_steps(campaigns(name))')
      .order('scheduled_at', { ascending: false })
      .limit(8),
  ])

  const campaigns       = allCampaigns ?? []
  const upcomingCampaigns = campaigns.filter(c => ['scheduled', 'sending', 'active'].includes(c.status))
  const failed          = failedMails ?? 0
  const campaignCounts  = Object.fromEntries(
    ['draft', 'ready', 'scheduled', 'sending', 'active', 'completed', 'paused'].map(s => [
      s,
      campaigns.filter(c => c.status === s).length,
    ])
  )

  return (
    <div className="p-8 space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Overzicht van je mailsysteem.</p>
        </div>
        <Link
          href="/send"
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Verzenden
        </Link>
      </div>

      {/* ── Contacten ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Contacten</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Totaal"
            value={totalContacts ?? 0}
            href="/contacts"
          />
          <StatCard
            label="Actief & ingeschreven"
            value={activeContacts ?? 0}
            sub="kunnen e-mail ontvangen"
            href="/contacts?status=active"
            highlight="green"
          />
          <StatCard
            label="In behandeling"
            value={pendingContacts ?? 0}
            sub="nog niet bevestigd"
            href="/contacts?status=pending"
          />
          <StatCard
            label="Afgemeld"
            value={optedOutContacts ?? 0}
            sub="global opt-out"
            href="/contacts?status=opted_out"
            highlight={optedOutContacts ? 'amber' : undefined}
          />
        </div>
      </section>

      {/* ── E-mail statistieken ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">E-mailverkeer</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Verzonden"
            value={sentMails ?? 0}
            href="/logs?status=sent"
            highlight="green"
          />
          <StatCard
            label="In wachtrij"
            value={pendingMails ?? 0}
            sub="gepland"
            href="/logs?status=pending"
          />
          <StatCard
            label="Mislukt"
            value={failed}
            sub={failed > 0 ? 'vereist aandacht' : 'alles in orde'}
            href="/logs?status=failed"
            highlight={failed > 0 ? 'red' : undefined}
          />
          <StatCard
            label="Overgeslagen"
            value={skippedMails ?? 0}
            sub="geblokkeerd of opt-out"
            href="/logs?status=skipped"
          />
        </div>
      </section>

      {/* ── Campagne-overzicht + Recente fouten ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Campagnestatus */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">Campagnes</h2>
            <Link href="/campaigns" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              Alle campagnes →
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400 italic">Nog geen campagnes</p>
          ) : (
            <div className="space-y-2">
              {(['draft', 'ready', 'scheduled', 'sending', 'active', 'completed', 'paused'] as const).map((s) => {
                const count = campaignCounts[s] ?? 0
                if (count === 0) return null
                const cfg = CAMPAIGN_STATUS_CONFIG[s]
                return (
                  <Link
                    key={s}
                    href={`/campaigns?status=${s}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="text-sm text-zinc-700">{cfg.label}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${cfg.badge}`}>
                      {count}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="mt-4 border-t border-zinc-100 pt-4">
            <Link
              href="/campaigns/new"
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nieuwe campagne
            </Link>
          </div>
        </div>

        {/* Recente activiteit */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">Recente activiteit</h2>
            <Link href="/logs" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              Alle logs →
            </Link>
          </div>

          {!recentActivity || recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-zinc-500">Nog geen activiteit.</p>
              <p className="text-xs text-zinc-400 mt-1">Maak een campagne aan en verstuur je eerste e-mail.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentActivity.map((log) => {
                const contact  = log.contacts as unknown as { email: string } | null
                const step     = log.campaign_steps as unknown as { campaigns: { name: string } | null } | null
                const campaign = step?.campaigns
                const badgeCls = STATUS_BADGE[log.status] ?? STATUS_BADGE.pending
                const dotCls   = STATUS_DOT[log.status] ?? STATUS_DOT.pending
                const STATUS_LABELS: Record<string, string> = {
                  pending: 'Gepland', sent: 'Verzonden', failed: 'Mislukt', skipped: 'Overgeslagen',
                }
                return (
                  <li key={log.id} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${dotCls}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-800 truncate">{contact?.email ?? '—'}</p>
                      <p className="text-xs text-zinc-400 truncate">{campaign?.name ?? '—'}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
                        {STATUS_LABELS[log.status] ?? log.status}
                      </span>
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {relativeTime(log.scheduled_at)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Ingeplande campagnes ─────────────────────────────────────────────── */}
      {upcomingCampaigns.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Actieve & ingeplande campagnes</h2>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Campagne</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Verzending</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Ontvangers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {upcomingCampaigns.map((c) => {
                  const cfg = CAMPAIGN_STATUS_CONFIG[c.status] ?? CAMPAIGN_STATUS_CONFIG.draft
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/campaigns/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.campaign_type === 'one_off' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {c.campaign_type === 'one_off' ? 'Eenmalig' : 'Funnel'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 tabular-nums">
                        {c.sent_at
                          ? <span className="text-green-600">Gestart {formatDateTime(c.sent_at)}</span>
                          : c.planned_send_at
                            ? formatDateTime(c.planned_send_at)
                            : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 tabular-nums">
                        {c.recipient_count != null ? c.recipient_count.toLocaleString('nl-NL') : <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Recente fouten ──────────────────────────────────────────────────── */}
      {failed > 0 && recentFailed && recentFailed.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-red-500">
              Recente fouten ({failed.toLocaleString('nl-NL')})
            </h2>
            <Link href="/logs?status=failed" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              Alle fouten →
            </Link>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-red-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Campagne</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Foutmelding</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Tijdstip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 bg-white">
                {recentFailed.map((log) => {
                  const contact  = log.contacts as unknown as { email: string } | null
                  const step     = log.campaign_steps as unknown as { campaigns: { name: string } | null } | null
                  const campaign = step?.campaigns
                  return (
                    <tr key={log.id}>
                      <td className="px-5 py-3 font-mono text-xs text-zinc-700">{contact?.email ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{campaign?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-red-600 max-w-xs truncate" title={log.error_message ?? ''}>
                        {log.error_message ?? <span className="text-zinc-300 italic">Geen details</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                        {formatDateTime(log.scheduled_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Snelle acties ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Snelle acties</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { href: '/campaigns/new', label: 'Nieuwe campagne' },
            { href: '/contacts/new',  label: 'Contact toevoegen' },
            { href: '/templates/new', label: 'Nieuw template' },
            { href: '/consent',       label: 'Consent audit' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
            >
              {label}
              <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}

// ── Herbruikbare StatCard component ──────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  href,
  highlight,
}: {
  label:      string
  value:      number
  sub?:       string
  href:       string
  highlight?: 'green' | 'red' | 'amber'
}) {
  const borderCls = highlight === 'red'
    ? 'border-red-200 bg-red-50'
    : highlight === 'green'
      ? 'border-green-100'
      : highlight === 'amber'
        ? 'border-amber-100 bg-amber-50'
        : 'border-zinc-200 hover:border-zinc-300'

  const labelCls = highlight === 'red'
    ? 'text-red-500'
    : highlight === 'amber'
      ? 'text-amber-600'
      : 'text-zinc-400'

  const valueCls = highlight === 'red'
    ? 'text-red-700'
    : highlight === 'amber'
      ? 'text-amber-700'
      : 'text-zinc-900'

  const subCls = highlight === 'red'
    ? 'text-red-400'
    : highlight === 'amber'
      ? 'text-amber-500'
      : 'text-zinc-400'

  return (
    <Link
      href={href}
      className={`group rounded-xl border bg-white p-5 hover:shadow-sm transition-all ${borderCls}`}
    >
      <p className={`text-xs font-medium uppercase tracking-wide ${labelCls}`}>{label}</p>
      <p className={`mt-1.5 text-3xl font-bold tabular-nums ${valueCls}`}>
        {value.toLocaleString('nl-NL')}
      </p>
      {sub && <p className={`mt-1 text-xs ${subCls}`}>{sub}</p>}
    </Link>
  )
}
