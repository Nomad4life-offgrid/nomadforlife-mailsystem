import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LogsChart } from './LogsChart'

export const metadata = { title: 'Mail Logs' }

const PAGE_SIZE = 50

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending: { label: 'Gepland',       dot: 'bg-zinc-400',   badge: 'bg-zinc-100 text-zinc-600'    },
  sent:    { label: 'Verzonden',     dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700'   },
  failed:  { label: 'Mislukt',       dot: 'bg-red-500',    badge: 'bg-red-50 text-red-600'       },
  skipped: { label: 'Overgeslagen',  dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700' },
}

const STATUSES = ['all', 'pending', 'sent', 'failed', 'skipped'] as const

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; campaign_id?: string; page?: string }>
}) {
  const { status, campaign_id, page: pageParam } = await searchParams
  const pageNum = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset  = (pageNum - 1) * PAGE_SIZE
  const supabase = await createClient()

  // Status counts for filter tabs + chart
  const [pendingRes, sentRes, failedRes, skippedRes, openedRes, totalRes] = await Promise.all([
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'skipped'),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent').not('opened_at', 'is', null),
    supabase.from('mail_logs').select('*', { count: 'exact', head: true }),
  ])

  const counts: Record<string, number> = {
    all:     totalRes.count   ?? 0,
    pending: pendingRes.count ?? 0,
    sent:    sentRes.count    ?? 0,
    failed:  failedRes.count  ?? 0,
    skipped: skippedRes.count ?? 0,
  }
  const openedCount = openedRes.count ?? 0

  // Logs query with pagination
  let query = supabase
    .from('mail_logs')
    .select(`
      id, status, scheduled_at, sent_at, opened_at, clicked_at, error_message, retry_count,
      contacts (id, email, first_name, last_name),
      campaign_steps (step_order, campaigns (id, name))
    `, { count: 'exact' })
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status && status !== 'all') query = query.eq('status', status)
  if (campaign_id)                 query = query.eq('campaign_steps.campaigns.id', campaign_id)

  const { data: logs, count: filteredCount } = await query

  const currentStatus = status ?? 'all'
  const totalPages    = Math.ceil((filteredCount ?? 0) / PAGE_SIZE)

  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams()
    if (status && status !== 'all') p.set('status', status)
    if (campaign_id)                p.set('campaign_id', campaign_id)
    if (pageNum !== 1)              p.set('page', String(pageNum))
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '') p.delete(k)
      else p.set(k, String(v))
    }
    return `/logs${p.toString() ? `?${p.toString()}` : ''}`
  }

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins  = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days  = Math.floor(diff / 86_400_000)
    if (mins  <  1)  return 'just now'
    if (mins  < 60)  return `${mins}m ago`
    if (hours < 24)  return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Mail Logs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {(filteredCount ?? 0).toLocaleString('nl-NL')} entries
            {campaign_id && ' voor deze campagne'}
            {status && status !== 'all' && ` · gefilterd op ${STATUS_CONFIG[status]?.label ?? status}`}
          </p>
        </div>
        {campaign_id && (
          <Link href="/logs" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← All logs
          </Link>
        )}
      </div>

      {/* Chart */}
      {counts.all > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white px-8 py-6">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Statistieken</p>
          <LogsChart
            sent={counts.sent}
            opened={openedCount}
            failed={counts.failed}
            skipped={counts.skipped}
            pending={counts.pending}
          />
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {STATUSES.map((s) => {
          const cfg = s !== 'all' ? STATUS_CONFIG[s] : null
          const count = counts[s] ?? 0
          const href = buildUrl({ status: s === 'all' ? '' : s, page: 1 })

          return (
            <Link
              key={s}
              href={href}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                currentStatus === s
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {cfg && (
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
              )}
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                currentStatus === s ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Campaign · Step</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Scheduled</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {logs?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-14 text-center">
                  <p className="text-sm text-zinc-500">No logs found.</p>
                  {currentStatus !== 'all' && (
                    <Link href="/logs" className="mt-1 block text-xs text-zinc-400 underline">
                      Clear filter
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {logs?.map((log) => {
              const contact  = log.contacts as unknown as { id: string; email: string; first_name: string | null; last_name: string | null } | null
              const step     = log.campaign_steps as unknown as { step_order: number; campaigns: { id: string; name: string } | null } | null
              const campaign = step?.campaigns
              const cfg      = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.pending

              return (
                <tr key={log.id} className="group hover:bg-zinc-50 transition-colors">
                  {/* Contact */}
                  <td className="px-5 py-4">
                    <p className="font-mono text-xs text-zinc-700">{contact?.email ?? '—'}</p>
                    {(contact?.first_name || contact?.last_name) && (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {[contact?.first_name, contact?.last_name].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </td>

                  {/* Campaign + step */}
                  <td className="px-5 py-4">
                    {campaign ? (
                      <Link href={`/campaigns/${campaign.id}`} className="text-zinc-800 hover:underline font-medium">
                        {campaign.name}
                      </Link>
                    ) : <span className="text-zinc-300">—</span>}
                    {step && (
                      <p className="mt-0.5 text-xs text-zinc-400">Step {step.step_order}</p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {log.error_message && (
                      <p className="mt-1 text-xs text-red-500 max-w-xs truncate" title={log.error_message}>
                        {log.error_message}
                      </p>
                    )}
                    {log.retry_count > 0 && (
                      <p className="mt-0.5 text-xs text-zinc-400">{log.retry_count}× retried</p>
                    )}
                  </td>

                  {/* Scheduled */}
                  <td className="px-5 py-4">
                    <p className="text-xs text-zinc-600">{new Date(log.scheduled_at).toLocaleString('nl-NL')}</p>
                    {log.sent_at && (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Sent {formatRelative(log.sent_at)}
                      </p>
                    )}
                  </td>

                  {/* Tracking */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 text-xs">
                      {/* Opened */}
                      <span className={`flex items-center gap-1 ${log.opened_at ? 'text-green-600' : 'text-zinc-300'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {log.opened_at ? formatRelative(log.opened_at) : '—'}
                      </span>
                      {/* Clicked */}
                      <span className={`flex items-center gap-1 ${log.clicked_at ? 'text-blue-600' : 'text-zinc-300'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                        </svg>
                        {log.clicked_at ? formatRelative(log.clicked_at) : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Footer: paginering */}
        {totalPages > 1 && (
          <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Pagina {pageNum} van {totalPages} ({(filteredCount ?? 0).toLocaleString('nl-NL')} entries)</span>
            <div className="flex gap-2">
              {pageNum > 1 && (
                <Link
                  href={buildUrl({ page: pageNum - 1 })}
                  className="rounded border border-zinc-300 px-3 py-1 hover:bg-white transition-colors"
                >
                  ← Vorige
                </Link>
              )}
              {pageNum < totalPages && (
                <Link
                  href={buildUrl({ page: pageNum + 1 })}
                  className="rounded border border-zinc-300 px-3 py-1 hover:bg-white transition-colors"
                >
                  Volgende →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
