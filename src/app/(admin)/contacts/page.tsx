import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/StatCard'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/date'
import { fullName, initials } from '@/utils/format'
import { archiveContact } from './actions'
import { SourceFilter } from './SourceFilter'

export const metadata = { title: 'Contacten' }

const LIMIT = 50

const SOURCE_LABELS: Record<string, string> = {
  manual:  'Handmatig',
  import:  'Import',
  api:     'API',
  website: 'Website',
  admin:   'Admin',
}

const TYPE_LABELS: Record<string, string> = {
  camping:      'Camping',
  sponsor:      'Sponsor',
  adverteerder: 'Adverteerder',
  lid:          'Lid',
  partner:      'Partner',
  prospect:     'Prospect',
  overig:       'Overig',
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string; page?: string }>
}) {
  const { q, status, source, page: pageStr } = await searchParams
  const page   = Math.max(1, parseInt(pageStr ?? '1', 10))
  const from   = (page - 1) * LIMIT
  const to     = from + LIMIT - 1

  const supabase = await createClient()

  // ── Stats (counts ignoring search/filter) ────────────────────────────────
  const [{ count: total }, { count: activeCt }, { count: pendingCt }, { count: optedOutCt }, { count: bouncedCt }] =
    await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'pending'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'opted_out'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).is('deleted_at', null).not('bounced_at', 'is', null),
    ])

  // ── Data query ────────────────────────────────────────────────────────────
  let query = supabase
    .from('contacts')
    .select(
      'id, email, first_name, last_name, company, contact_type, source, status, opted_in, opted_in_at, unsubscribed_at, bounced_at, created_at',
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(
      `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`
    )
  }
  if (status === 'bounced') {
    query = query.not('bounced_at', 'is', null)
  } else if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (source && source !== 'all') {
    query = query.eq('source', source)
  }

  const { data: contacts, count: filteredCount } = await query
  const totalPages = Math.ceil((filteredCount ?? 0) / LIMIT)

  // ── URL helpers ───────────────────────────────────────────────────────────
  function tabHref(s: string) {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (source && source !== 'all') p.set('source', source)
    if (s !== 'all') p.set('status', s)
    const qs = p.toString()
    return `/contacts${qs ? `?${qs}` : ''}`
  }

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status && status !== 'all') params.set('status', status)
    if (source && source !== 'all') params.set('source', source)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/contacts${qs ? `?${qs}` : ''}`
  }

  const currentStatus = status ?? 'all'

  const filterTabs = [
    { key: 'all',       label: 'Alle',          count: total      ?? 0 },
    { key: 'active',    label: 'Actief',         count: activeCt   ?? 0 },
    { key: 'pending',   label: 'In afwachting',  count: pendingCt  ?? 0 },
    { key: 'opted_out', label: 'Afgemeld',       count: optedOutCt ?? 0 },
    { key: 'bounced',   label: 'Bounced',        count: bouncedCt  ?? 0 },
  ]

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Contacten</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {filteredCount ?? 0} contact{(filteredCount ?? 0) !== 1 ? 'en' : ''}
            {q ? ` voor "${q}"` : ''}
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuw contact
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Totaal"       value={total      ?? 0} />
        <StatCard label="Actief"       value={activeCt   ?? 0} />
        <StatCard label="In afwachting" value={pendingCt  ?? 0} />
        <StatCard label="Afgemeld"     value={optedOutCt ?? 0} />
      </div>

      {/* Search + source filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form method="GET" className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Zoek op naam, e-mail of bedrijf…"
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-zinc-500 focus:outline-none"
          />
          {status && status !== 'all' && <input type="hidden" name="status" value={status} />}
          {source && source !== 'all' && <input type="hidden" name="source" value={source} />}
        </form>

        {/* Source filter */}
        <SourceFilter
          value={source ?? 'all'}
          options={Object.entries(SOURCE_LABELS)}
          hiddenFields={{
            ...(q ? { q } : {}),
            ...(status && status !== 'all' ? { status } : {}),
          }}
        />
      </div>

      {/* Status filter tabs */}
      <div className="mt-3 flex gap-1 rounded-md border border-zinc-200 bg-white p-1 w-fit">
        {filterTabs.map(({ key, label, count }) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              currentStatus === key
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs tabular-nums ${currentStatus === key ? 'text-zinc-400' : 'text-zinc-400'}`}>
              {count}
            </span>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Naam</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">E-mail</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hidden md:table-cell">Bedrijf</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hidden lg:table-cell">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hidden lg:table-cell">Bron</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hidden xl:table-cell">Opt-in</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hidden xl:table-cell">Aangemeld</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(!contacts || contacts.length === 0) && (
              <tr>
                <td colSpan={9} className="py-0">
                  <EmptyState
                    title={q ? `Geen resultaten voor "${q}"` : 'Geen contacten'}
                    description={q ? 'Probeer een andere zoekterm.' : 'Voeg je eerste contact toe via de knop rechtsboven.'}
                    action={q ? (
                      <Link href="/contacts" className="text-sm text-zinc-500 underline">Zoekopdracht wissen</Link>
                    ) : (
                      <Link href="/contacts/new" className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                        Nieuw contact
                      </Link>
                    )}
                  />
                </td>
              </tr>
            )}
            {contacts?.map((c) => {
              const name = fullName(c.first_name, c.last_name)
              const ini  = initials(c.first_name, c.last_name) || c.email[0].toUpperCase()
              const archiveFn = archiveContact.bind(null, c.id)
              const isBounced = !!c.bounced_at

              return (
                <tr key={c.id} className="group hover:bg-zinc-50 transition-colors">
                  {/* Naam */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                        {ini}
                      </span>
                      <Link
                        href={`/contacts/${c.id}`}
                        className="font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                      >
                        {name !== '—' ? name : <span className="italic text-zinc-400">Geen naam</span>}
                      </Link>
                    </div>
                  </td>

                  {/* E-mail */}
                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">{c.email}</td>

                  {/* Bedrijf */}
                  <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">
                    {c.company ?? <span className="text-zinc-300">—</span>}
                  </td>

                  {/* Type */}
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {c.contact_type
                      ? <span className="text-xs text-zinc-600">{TYPE_LABELS[c.contact_type] ?? c.contact_type}</span>
                      : <span className="text-zinc-300">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    {isBounced
                      ? <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Bounced
                        </span>
                      : <ContactStatusBadge status={c.status} />}
                  </td>

                  {/* Bron */}
                  <td className="px-5 py-3.5 text-xs text-zinc-400 hidden lg:table-cell">
                    {SOURCE_LABELS[c.source] ?? c.source}
                  </td>

                  {/* Opt-in */}
                  <td className="px-5 py-3.5 text-xs text-zinc-400 tabular-nums hidden xl:table-cell">
                    {c.opted_in_at ? formatDate(c.opted_in_at) : <span className="italic">—</span>}
                  </td>

                  {/* Aangemeld */}
                  <td className="px-5 py-3.5 text-xs text-zinc-400 tabular-nums hidden xl:table-cell">
                    {formatDate(c.created_at)}
                  </td>

                  {/* Acties */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/contacts/${c.id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 whitespace-nowrap">
                        Bekijken
                      </Link>
                      <Link href={`/contacts/${c.id}/edit`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                        Bewerken
                      </Link>
                      <form action={archiveFn} className="inline">
                        <button type="submit" className="text-xs font-medium text-red-400 hover:text-red-600">
                          Archiveren
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            {from + 1}–{Math.min(to + 1, filteredCount ?? 0)} van {filteredCount} contacten
          </span>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
                ← Vorige
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center gap-1">
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-zinc-300">…</span>}
                  <Link
                    href={pageHref(p)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      p === page
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    {p}
                  </Link>
                </span>
              ))}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50">
                Volgende →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
