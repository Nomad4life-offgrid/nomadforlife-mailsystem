import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/utils/date'
import { fullName } from '@/utils/format'

export const metadata = { title: 'Consent audit' }

const EVENT_LABELS: Record<string, string> = {
  opt_in:            'Opt-in',
  opt_in_confirmed:  'Opt-in bevestigd',
  opt_out:           'Opt-out (campagne)',
  opt_out_global:    'Globale opt-out',
  consent_withdrawn: 'Consent ingetrokken',
  consent_renewed:   'Consent vernieuwd',
  imported:          'Geïmporteerd',
  manually_added:    'Handmatig toegevoegd',
}

const CHANNEL_LABELS: Record<string, string> = {
  email:  'E-mail',
  web:    'Web',
  import: 'Import',
  admin:  'Beheerder',
  api:    'API',
}

const EVENT_COLORS: Record<string, string> = {
  opt_in:            'bg-blue-50 text-blue-700',
  opt_in_confirmed:  'bg-green-50 text-green-700',
  opt_out:           'bg-amber-50 text-amber-700',
  opt_out_global:    'bg-red-50 text-red-700',
  consent_withdrawn: 'bg-red-50 text-red-700',
  consent_renewed:   'bg-green-50 text-green-700',
  imported:          'bg-zinc-100 text-zinc-500',
  manually_added:    'bg-zinc-100 text-zinc-500',
}

export default async function ConsentAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event_type?: string; channel?: string; page?: string }>
}) {
  const params     = await searchParams
  const pageNum    = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize   = 50
  const offset     = (pageNum - 1) * pageSize
  const filterType = params.event_type ?? ''
  const filterChan = params.channel    ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('consent_logs')
    .select(`
      id, event_type, channel, ip_address, notes, created_at,
      contacts ( id, email, first_name, last_name )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (filterType) query = query.eq('event_type', filterType)
  if (filterChan) query = query.eq('channel', filterChan)

  const { data, count, error } = await query

  const logs  = (data ?? []) as any[]
  const total = count ?? 0
  const pages = Math.ceil(total / pageSize)

  function buildUrl(overrides: Record<string, string | number>) {
    const p = new URLSearchParams()
    if (filterType)             p.set('event_type', filterType)
    if (filterChan)             p.set('channel', filterChan)
    if (pageNum !== 1)          p.set('page', String(pageNum))
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '') p.delete(k)
      else p.set(k, String(v))
    }
    const qs = p.toString()
    return `/consent${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="p-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Consent audit trail</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Onveranderlijk register van alle opt-in en opt-out gebeurtenissen (AVG art. 7).
          </p>
        </div>
        <span className="text-sm text-zinc-400">{total.toLocaleString('nl-NL')} events</span>
      </div>

      {/* AVG notice */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Juridische status:</strong> Dit register is append-only en mag nooit worden bewerkt of verwijderd.
        Bewaar gegevens minimaal 3 jaar na het laatste contact conform AVG-bewijslastplicht.
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-sm text-zinc-500">
          <span>Type:</span>
          {['', ...Object.keys(EVENT_LABELS)].map((type) => (
            <Link
              key={type}
              href={buildUrl({ event_type: type, page: 1 })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterType === type
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {type ? EVENT_LABELS[type] : 'Alles'}
            </Link>
          ))}
        </div>

        {filterType || filterChan ? (
          <Link
            href="/consent"
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            Filter wissen
          </Link>
        ) : null}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Fout bij laden: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {logs.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-400 italic">Geen consent events gevonden</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Tijdstip</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Gebeurtenis</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Kanaal</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">IP</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Notitie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.map((log: any) => {
                const contact = log.contacts as { id: string; email: string; first_name: string | null; last_name: string | null } | null
                const name    = contact ? fullName(contact.first_name, contact.last_name) : null
                return (
                  <tr key={log.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      {contact ? (
                        <Link href={`/contacts/${contact.id}`} className="group">
                          {name && name !== '—' && (
                            <p className="font-medium text-zinc-900 group-hover:text-zinc-600 transition-colors">{name}</p>
                          )}
                          <p className="font-mono text-xs text-zinc-400 group-hover:text-zinc-600 transition-colors">{contact.email}</p>
                        </Link>
                      ) : (
                        <span className="text-zinc-300 italic text-xs">Verwijderd</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_COLORS[log.event_type] ?? 'bg-zinc-100 text-zinc-500'}`}>
                        {EVENT_LABELS[log.event_type] ?? log.event_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {CHANNEL_LABELS[log.channel] ?? log.channel}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-zinc-400">
                      {log.ip_address ?? <span className="text-zinc-200">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 max-w-xs truncate">
                      {log.notes ?? <span className="text-zinc-200">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>Pagina {pageNum} van {pages}</span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={buildUrl({ page: pageNum - 1 })}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                ← Vorige
              </Link>
            )}
            {pageNum < pages && (
              <Link
                href={buildUrl({ page: pageNum + 1 })}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Volgende →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
