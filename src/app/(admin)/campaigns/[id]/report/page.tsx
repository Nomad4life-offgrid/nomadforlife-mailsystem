import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, relativeTime } from '@/utils/date'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('campaigns').select('name').eq('id', id).maybeSingle()
  return { title: `Rapport — ${data?.name ?? 'Campagne'}` }
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  sent:    'bg-green-50 text-green-700',
  failed:  'bg-red-50 text-red-600',
  skipped: 'bg-yellow-50 text-yellow-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Gepland',
  sent:    'Verzonden',
  failed:  'Mislukt',
  skipped: 'Overgeslagen',
}

function pct(value: number, total: number): string {
  if (total === 0) return '—'
  return `${Math.round((value / total) * 100)}%`
}

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id }   = await params
  const supabase = await createClient()

  // ── Campagne ophalen ────────────────────────────────────────────────────────
  const { data: raw } = await supabase
    .from('campaigns')
    .select('id, name, description, status, campaign_type, from_name, from_email, sent_at, planned_send_at, recipient_count, created_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!raw) notFound()

  const campaign = raw as {
    id: string; name: string; description: string | null; status: string;
    campaign_type: string; from_name: string; from_email: string;
    sent_at: string | null; planned_send_at: string | null;
    recipient_count: number | null; created_at: string
  }

  const isOneOff = campaign.campaign_type === 'one_off'

  // ── Stappen ophalen ─────────────────────────────────────────────────────────
  const { data: stepsRaw } = await supabase
    .from('campaign_steps')
    .select('id, step_order, subject, delay_days, delay_hours')
    .eq('campaign_id', id)
    .order('step_order')

  const steps = stepsRaw ?? []

  // ── Mail logs ophalen (alle stappen in één query) ───────────────────────────
  let logs: Array<{
    id: string; status: string; opened_at: string | null; clicked_at: string | null;
    campaign_step_id: string; error_message: string | null;
    contacts: { id: string; email: string } | null
  }> = []

  if (steps.length > 0) {
    const { data } = await supabase
      .from('mail_logs')
      .select('id, status, opened_at, clicked_at, campaign_step_id, error_message, contacts(id, email)')
      .in('campaign_step_id', steps.map(s => s.id))

    logs = (data ?? []) as unknown as typeof logs
  }

  // ── Unsubscribes voor deze campagne ─────────────────────────────────────────
  const { count: unsubscribeCount } = await supabase
    .from('unsubscribe_events')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', id)
    .not('used_at', 'is', null)

  // ── Aggregatie: totaalcijfers ────────────────────────────────────────────────
  const total    = logs.length
  const sent     = logs.filter(l => l.status === 'sent').length
  const pending  = logs.filter(l => l.status === 'pending').length
  const failed   = logs.filter(l => l.status === 'failed').length
  const skipped  = logs.filter(l => l.status === 'skipped').length
  const opened   = logs.filter(l => l.opened_at).length
  const clicked  = logs.filter(l => l.clicked_at).length

  // ── Aggregatie: per stap ─────────────────────────────────────────────────────
  const stepStatsMap = new Map<string, {
    pending: number; sent: number; failed: number; skipped: number;
    opened: number; clicked: number; total: number
  }>()

  for (const log of logs) {
    const s = stepStatsMap.get(log.campaign_step_id) ?? {
      pending: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, total: 0,
    }
    if (log.status === 'pending') s.pending++
    else if (log.status === 'sent')    s.sent++
    else if (log.status === 'failed')  s.failed++
    else if (log.status === 'skipped') s.skipped++
    if (log.opened_at)  s.opened++
    if (log.clicked_at) s.clicked++
    s.total++
    stepStatsMap.set(log.campaign_step_id, s)
  }

  // ── Recente fouten ───────────────────────────────────────────────────────────
  const recentErrors = logs
    .filter(l => l.status === 'failed')
    .slice(0, 10)

  // ── Delay-label helper ───────────────────────────────────────────────────────
  function delayLabel(step: { delay_days: number; delay_hours: number }): string {
    const total = step.delay_days * 24 + step.delay_hours
    if (total === 0) return 'Direct'
    if (total < 24)  return `Na ${total}u`
    const d = Math.floor(total / 24)
    const h = total % 24
    if (h === 0) return `Na ${d} dag${d !== 1 ? 'en' : ''}`
    return `Na ${d}d ${h}u`
  }

  const CAMPAIGN_STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
    draft:     { label: 'Concept',     dot: 'bg-zinc-400',   badge: 'bg-zinc-100 text-zinc-600'    },
    ready:     { label: 'Klaar',       dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700'     },
    scheduled: { label: 'Ingepland',   dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700' },
    sending:   { label: 'Verzenden',   dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-800'   },
    active:    { label: 'Actief',      dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700'   },
    completed: { label: 'Voltooid',    dot: 'bg-green-400',  badge: 'bg-green-50 text-green-600'   },
    paused:    { label: 'Gepauzeerd',  dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700' },
    cancelled: { label: 'Geannuleerd', dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700'       },
  }

  const cfg = CAMPAIGN_STATUS_CONFIG[campaign.status] ?? CAMPAIGN_STATUS_CONFIG.draft

  return (
    <div className="p-8 max-w-5xl space-y-8">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <Link href="/campaigns" className="hover:text-zinc-900 transition-colors">← Campagnes</Link>
        <span className="text-zinc-300">/</span>
        <Link href={`/campaigns/${id}`} className="hover:text-zinc-900 transition-colors truncate max-w-xs">
          {campaign.name}
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="text-zinc-700 font-medium">Rapport</span>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-zinc-900">{campaign.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isOneOff ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
              }`}>
                {isOneOff ? 'Eenmalig' : 'Funnel'}
              </span>
            </div>
            {campaign.description && (
              <p className="mt-1 text-sm text-zinc-500">{campaign.description}</p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              Van: <span className="font-medium">{campaign.from_name}</span> &lt;{campaign.from_email}&gt;
              {campaign.sent_at && (
                <span className="ml-2 text-green-600">
                  · Verstuurd {formatDateTime(campaign.sent_at)}
                </span>
              )}
            </p>
          </div>
          <Link
            href={`/logs?campaign_id=${id}`}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Logs bekijken →
          </Link>
        </div>
      </div>

      {/* ── Totaaloverzicht ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Totaaloverzicht</h2>

        {total === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">Nog geen e-mails in de wachtrij voor deze campagne.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ReportCard label="Geselecteerd" value={campaign.recipient_count ?? total} />
            <ReportCard label="Verzonden"    value={sent}    sub={pct(sent, total)}    highlight="green" />
            <ReportCard label="In wachtrij"  value={pending} sub={pct(pending, total)} />
            <ReportCard label="Overgeslagen" value={skipped} sub={pct(skipped, total)} />
            <ReportCard label="Mislukt"      value={failed}  sub={pct(failed, total)}  highlight={failed > 0 ? 'red' : undefined} />
            <ReportCard label="Afgemeld"     value={unsubscribeCount ?? 0} sub={pct(unsubscribeCount ?? 0, sent)} highlight={(unsubscribeCount ?? 0) > 0 ? 'amber' : undefined} />
            <ReportCard label="Geopend"      value={opened}  sub={pct(opened, sent)}   highlight={opened > 0 ? 'blue' : undefined} />
            <ReportCard label="Geklikt"      value={clicked} sub={pct(clicked, sent)}  highlight={clicked > 0 ? 'blue' : undefined} />
          </div>
        )}
      </section>

      {/* ── Stapverdeling (funnel of meerdere stappen) ───────────────────────── */}
      {steps.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {isOneOff ? 'Stap' : `Funnelstappen (${steps.length})`}
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">#</th>
                  {!isOneOff && (
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Vertraging</th>
                  )}
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Onderwerp</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Totaal</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Verzonden</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Gepland</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Overgeslagen</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Mislukt</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Geopend</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Geklikt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {steps.map((step) => {
                  const s = stepStatsMap.get(step.id) ?? {
                    pending: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, total: 0,
                  }
                  return (
                    <tr key={step.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5 text-xs font-medium text-zinc-500 tabular-nums">{step.step_order}</td>
                      {!isOneOff && (
                        <td className="px-5 py-3.5 text-xs text-zinc-400">{delayLabel(step)}</td>
                      )}
                      <td className="px-5 py-3.5 text-sm text-zinc-800 max-w-xs truncate">
                        {step.subject ?? <span className="italic text-zinc-400">Geen onderwerp</span>}
                      </td>
                      <Num value={s.total} />
                      <Num value={s.sent}    cls="text-green-600" />
                      <Num value={s.pending} />
                      <Num value={s.skipped} cls={s.skipped > 0 ? 'text-amber-600' : undefined} />
                      <Num value={s.failed}  cls={s.failed  > 0 ? 'text-red-600'   : undefined} />
                      <Num value={s.opened}  cls={s.opened  > 0 ? 'text-blue-600'  : undefined} sub={pct(s.opened, s.sent)} />
                      <Num value={s.clicked} cls={s.clicked > 0 ? 'text-blue-600'  : undefined} sub={pct(s.clicked, s.sent)} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Recente fouten ──────────────────────────────────────────────────── */}
      {recentErrors.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-red-500">
              Recente fouten ({failed})
            </h2>
            <Link href={`/logs?status=failed&campaign_id=${id}`} className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              Alle fouten →
            </Link>
          </div>
          <div className="rounded-xl border border-red-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50 border-b border-red-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Stap</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-400">Foutmelding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentErrors.map((log) => {
                  const contact  = log.contacts as { id: string; email: string } | null
                  const stepNum  = steps.find(s => s.id === log.campaign_step_id)?.step_order
                  return (
                    <tr key={log.id}>
                      <td className="px-5 py-3">
                        {contact ? (
                          <Link href={`/contacts/${contact.id}`} className="font-mono text-xs text-zinc-700 hover:underline">
                            {contact.email}
                          </Link>
                        ) : <span className="text-zinc-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500">
                        {stepNum != null ? `Stap ${stepNum}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-red-600 max-w-xs truncate" title={log.error_message ?? ''}>
                        {log.error_message ?? <span className="italic text-zinc-300">Geen details</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Tijdlijn (campagne info) ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Campagne-info</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 grid grid-cols-2 gap-4 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Aangemaakt</p>
            <p className="font-medium text-zinc-800">{formatDateTime(campaign.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Gepland voor</p>
            <p className="font-medium text-zinc-800">{formatDateTime(campaign.planned_send_at)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Gestart</p>
            <p className="font-medium text-zinc-800">{formatDateTime(campaign.sent_at)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-0.5">Totale stappen</p>
            <p className="font-medium text-zinc-800">{steps.length}</p>
          </div>
        </div>
      </section>

    </div>
  )
}

// ── Hulpcomponenten ──────────────────────────────────────────────────────────

function ReportCard({
  label, value, sub, highlight,
}: {
  label:      string
  value:      number
  sub?:       string
  highlight?: 'green' | 'red' | 'amber' | 'blue'
}) {
  const borderCls = {
    green: 'border-green-100',
    red:   'border-red-200 bg-red-50',
    amber: 'border-amber-100 bg-amber-50',
    blue:  'border-blue-100',
    undefined: 'border-zinc-200',
  }[highlight ?? 'undefined'] ?? 'border-zinc-200'

  const labelCls = {
    green: 'text-green-600', red: 'text-red-500', amber: 'text-amber-600', blue: 'text-blue-600',
    undefined: 'text-zinc-400',
  }[highlight ?? 'undefined'] ?? 'text-zinc-400'

  const valueCls = {
    green: 'text-green-700', red: 'text-red-700', amber: 'text-amber-700', blue: 'text-blue-700',
    undefined: 'text-zinc-900',
  }[highlight ?? 'undefined'] ?? 'text-zinc-900'

  return (
    <div className={`rounded-xl border bg-white p-5 ${borderCls}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${labelCls}`}>{label}</p>
      <p className={`mt-1.5 text-3xl font-bold tabular-nums ${valueCls}`}>
        {value.toLocaleString('nl-NL')}
      </p>
      {sub && <p className={`mt-1 text-xs ${labelCls}`}>{sub}</p>}
    </div>
  )
}

function Num({
  value, cls, sub,
}: {
  value: number
  cls?:  string
  sub?:  string
}) {
  return (
    <td className="px-5 py-3.5 text-right tabular-nums">
      <span className={`text-sm font-medium ${cls ?? 'text-zinc-700'}`}>
        {value > 0 ? value.toLocaleString('nl-NL') : <span className="text-zinc-300">—</span>}
      </span>
      {sub && value > 0 && (
        <span className="block text-xs text-zinc-400">{sub}</span>
      )}
    </td>
  )
}
