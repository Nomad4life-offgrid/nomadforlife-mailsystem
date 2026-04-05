import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { ContactGroup, Segment } from '@/types'
import { deleteGroup, deleteSegment } from './actions'
import { NewGroupForm } from './NewGroupForm'

export const metadata = { title: 'Lijsten & Segmenten' }

const OP_LABEL: Record<string, string> = { AND: 'alle', OR: 'één van de' }
const STATUS_COLOR: Record<string, string> = {
  group: 'bg-blue-100 text-blue-700',
  list:  'bg-purple-100 text-purple-700',
}
const TYPE_LABEL: Record<string, string> = { group: 'Groep', list: 'Lijst' }

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'lijsten' } = await searchParams
  const supabase = await createClient()

  const [{ data: groups }, { data: segments }] = await Promise.all([
    supabase
      .from('contact_groups')
      .select('*')
      .order('name'),
    supabase
      .from('segments')
      .select('*')
      .order('name'),
  ])

  // Member counts per group
  const memberCounts = await Promise.all(
    (groups ?? []).map((g) =>
      supabase
        .from('contact_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id)
    )
  )

  const tabs = [
    { key: 'lijsten',   label: 'Statische lijsten' },
    { key: 'segmenten', label: 'Dynamische segmenten' },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Lijsten &amp; Segmenten</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Statische lijsten voor handmatige doelgroepen, dynamische segmenten op basis van filterregels.
          </p>
        </div>
        {tab === 'segmenten' && (
          <Link
            href="/segments/dynamic/new"
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nieuw segment
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-zinc-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/segments?tab=${t.key}`}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Statische lijsten ──────────────────────────────────────────────── */}
      {tab === 'lijsten' && (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(groups ?? []).map((group: ContactGroup, idx) => {
              const count    = memberCounts[idx]?.count ?? 0
              const deleteFn = deleteGroup.bind(null, group.id)

              return (
                <div
                  key={group.id}
                  className="group rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <Link
                        href={`/segments/${group.id}`}
                        className="truncate font-medium text-zinc-900 hover:underline"
                      >
                        {group.name}
                      </Link>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[group.list_type ?? 'group']
                      }`}>
                        {TYPE_LABEL[group.list_type ?? 'group']}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/segments/${group.id}/edit`}
                        className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                      >
                        Bewerken
                      </Link>
                      <form action={deleteFn} className="inline">
                        <button
                          type="submit"
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Verwijder
                        </button>
                      </form>
                    </div>
                  </div>

                  {group.description && (
                    <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{group.description}</p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-2xl font-semibold tabular-nums text-zinc-900">
                      {count.toLocaleString('nl-NL')}
                    </span>
                    <Link
                      href={`/segments/${group.id}`}
                      className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      Bekijk contacten →
                    </Link>
                  </div>
                </div>
              )
            })}

            {/* Nieuwe lijst card */}
            <NewGroupForm />
          </div>
        </div>
      )}

      {/* ── Dynamische segmenten ───────────────────────────────────────────── */}
      {tab === 'segmenten' && (
        <div className="mt-6">
          {(segments ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
              <svg className="mx-auto h-10 w-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="mt-3 text-sm font-medium text-zinc-600">Nog geen dynamische segmenten</p>
              <p className="mt-1 text-sm text-zinc-400">Maak een segment met filterregels om automatisch contacten te selecteren.</p>
              <Link
                href="/segments/dynamic/new"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
              >
                Eerste segment aanmaken
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Naam</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Filter</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Bijgewerkt</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(segments as Segment[]).map((seg) => {
                    const deleteFn      = deleteSegment.bind(null, seg.id)
                    const condCount     = seg.filter_json?.conditions?.length ?? 0
                    const op            = OP_LABEL[seg.filter_json?.operator ?? 'AND'] ?? 'alle'
                    const refreshedDate = seg.refreshed_at
                      ? new Date(seg.refreshed_at).toLocaleDateString('nl-NL')
                      : null

                    return (
                      <tr key={seg.id} className="group hover:bg-zinc-50 transition-colors">
                        <td className="px-5 py-4">
                          <Link
                            href={`/segments/dynamic/${seg.id}`}
                            className="font-medium text-zinc-900 hover:underline"
                          >
                            {seg.name}
                          </Link>
                          {seg.description && (
                            <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{seg.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-500">
                          {condCount} conditie{condCount !== 1 ? 's' : ''} ({op})
                        </td>
                        <td className="px-5 py-4">
                          {seg.preview_count !== null ? (
                            <span className="font-semibold tabular-nums text-zinc-900">
                              {seg.preview_count.toLocaleString('nl-NL')}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-400">
                          {refreshedDate ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href={`/segments/dynamic/${seg.id}`}
                              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                              Bekijk
                            </Link>
                            <Link
                              href={`/segments/dynamic/${seg.id}/edit`}
                              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                            >
                              Bewerken
                            </Link>
                            <form action={deleteFn} className="inline">
                              <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                                Verwijder
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
          )}
        </div>
      )}
    </div>
  )
}
