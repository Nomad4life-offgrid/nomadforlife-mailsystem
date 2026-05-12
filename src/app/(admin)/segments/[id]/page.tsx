import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addContactToGroup } from '../actions'
import { MembersTable } from './MembersTable'

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

          {q && displayedMembers.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-400">
              Geen resultaten voor &quot;{q}&quot;.
            </div>
          ) : (
            <MembersTable
              groupId={id}
              members={displayedMembers.map((m) => ({
                contact_id: m.contact_id,
                added_at:   m.added_at,
                contact:    m.contacts as unknown as {
                  id: string; email: string; first_name: string | null
                  last_name: string | null; status: string; opted_in: boolean
                } | null,
              }))}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* CSV importeren */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">CSV importeren</h2>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
              <p className="text-xs text-zinc-500">
                Upload een CSV-bestand met twee kolommen:
                {' '}<code className="font-mono bg-zinc-100 px-1 rounded">company</code> en
                {' '}<code className="font-mono bg-zinc-100 px-1 rounded">email</code>.
                De bedrijfsnaam wordt gebruikt voor personalisatie via
                {' '}<code className="font-mono bg-zinc-100 px-1 rounded">{'{{company_name}}'}</code>.
              </p>
              <Link
                href={`/contacts/import?group_id=${id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                CSV uploaden
              </Link>
            </div>
          </div>

          {/* Contact toevoegen */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">Los contact toevoegen</h2>
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
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-2">
            <p className="text-xs font-medium text-zinc-600">Campagne versturen</p>
            <Link
              href={`/campaigns/new?group_id=${id}`}
              className="block w-full rounded-md bg-zinc-900 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Nieuwe campagne naar deze lijst →
            </Link>
            <Link
              href={`/send?group_id=${id}`}
              className="block w-full rounded-md border border-zinc-300 bg-white py-2 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Inschrijven op bestaande funnel
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
