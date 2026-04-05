import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { addContactToGroup, removeContactFromGroup } from '../actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('contact_groups').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ?? 'Lijst' }
}

const TYPE_LABEL: Record<string, string> = { group: 'Groep', list: 'Lijst' }

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { id }     = await params
  const { q = '' } = await searchParams
  const supabase   = await createClient()

  const [{ data: group }, { data: members }, { data: allContacts }] = await Promise.all([
    supabase
      .from('contact_groups')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('contact_group_members')
      .select('contact_id, added_at, contacts(id, email, first_name, last_name, status, opted_in)')
      .eq('group_id', id)
      .order('added_at', { ascending: false }),
    supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('email'),
  ])

  if (!group) notFound()

  const memberIds  = new Set(members?.map((m) => m.contact_id) ?? [])
  const nonMembers = (allContacts ?? []).filter((c) => !memberIds.has(c.id))
  const addFn      = addContactToGroup.bind(null, id)

  // Filter displayed members by search query
  const displayedMembers = q
    ? (members ?? []).filter((m) => {
        const c = m.contacts as unknown as { email: string; first_name: string | null; last_name: string | null } | null
        const search = q.toLowerCase()
        return (
          c?.email?.toLowerCase().includes(search) ||
          c?.first_name?.toLowerCase().includes(search) ||
          c?.last_name?.toLowerCase().includes(search)
        )
      })
    : (members ?? [])

  return (
    <div className="p-8">
      {/* Back */}
      <Link href="/segments" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
        ← Lijsten &amp; Segmenten
      </Link>

      {/* Header */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
          <h1 className="text-2xl font-semibold text-zinc-900">{group.name}</h1>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
            {TYPE_LABEL[group.list_type ?? 'group']}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
            {(members?.length ?? 0).toLocaleString('nl-NL')} contacten
          </span>
        </div>
        <Link
          href={`/segments/${id}/edit`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Bewerken
        </Link>
      </div>
      {group.description && (
        <p className="mt-1 text-sm text-zinc-500">{group.description}</p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">

        {/* Member table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search */}
          <form method="GET" className="flex gap-2">
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Zoek op naam of e-mail…"
              className="block flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Zoeken
            </button>
            {q && (
              <Link
                href={`/segments/${id}`}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Wis
              </Link>
            )}
          </form>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Toegevoegd</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {displayedMembers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-zinc-400">
                      {q ? `Geen resultaten voor "${q}".` : 'Nog geen contacten in deze lijst.'}
                    </td>
                  </tr>
                )}
                {displayedMembers.map((m) => {
                  const c = m.contacts as unknown as {
                    id: string; email: string; first_name: string | null
                    last_name: string | null; status: string; opted_in: boolean
                  } | null
                  const removeFn = removeContactFromGroup.bind(null, id, m.contact_id)
                  const name     = [c?.first_name, c?.last_name].filter(Boolean).join(' ')

                  return (
                    <tr key={m.contact_id} className="group hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/contacts/${m.contact_id}`}
                          className="font-mono text-xs text-zinc-700 hover:underline"
                        >
                          {c?.email ?? '—'}
                        </Link>
                        {name && <p className="text-xs text-zinc-400 mt-0.5">{name}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        {c && (
                          <div className="flex items-center gap-1.5">
                            <ContactStatusBadge status={c.status as any} />
                            {!c.opted_in && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                Niet opted-in
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-400">
                        {new Date(m.added_at).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <form action={removeFn} className="inline opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="submit" className="text-xs text-red-400 hover:text-red-600">
                            Verwijder
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact toevoegen */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">Contact toevoegen</h2>
            <form action={addFn as unknown as (fd: FormData) => Promise<void>} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
              <select
                name="contact_id"
                required
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              >
                <option value="">Kies een contact…</option>
                {nonMembers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email}{c.first_name ? ` — ${c.first_name}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={nonMembers.length === 0}
                className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                Toevoegen
              </button>
              {nonMembers.length === 0 && (
                <p className="text-xs text-zinc-400 text-center">
                  Alle actieve contacten zijn al lid van deze lijst.
                </p>
              )}
            </form>
          </div>

          {/* Campagne versturen */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-medium text-zinc-600 mb-2">Campagne versturen</p>
            <Link
              href={`/send?group_id=${id}`}
              className="block w-full rounded-md border border-zinc-300 bg-white py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Verstuur aan deze lijst →
            </Link>
          </div>

          {/* Stats */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Statistieken</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Totaal</span>
              <span className="text-sm font-semibold text-zinc-900">{(members?.length ?? 0).toLocaleString('nl-NL')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Opted-in</span>
              <span className="text-sm font-semibold text-zinc-900">
                {(members ?? []).filter((m) => (m.contacts as any)?.opted_in).length.toLocaleString('nl-NL')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
