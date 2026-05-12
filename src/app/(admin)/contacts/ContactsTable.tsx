'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/utils/date'
import { fullName, initials } from '@/utils/format'
import { archiveContact, archiveContactsBulk } from './actions'

type ContactRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  contact_type: string | null
  source: string
  status: string
  opted_in: boolean | null
  opted_in_at: string | null
  unsubscribed_at: string | null
  bounced_at: string | null
  created_at: string
}

type Props = {
  contacts: ContactRow[]
  sourceLabels: Record<string, string>
  typeLabels:   Record<string, string>
}

export function ContactsTable({ contacts, sourceLabels, typeLabels }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const allIds = contacts.map((c) => c.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkArchive() {
    if (selected.size === 0) return
    const count = selected.size
    if (!confirm(`Weet je zeker dat je ${count} contact${count === 1 ? '' : 'en'} wilt archiveren?`)) return
    const ids = Array.from(selected)
    startTransition(async () => {
      await archiveContactsBulk(ids)
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm">
          <span className="text-zinc-700">
            {selected.size} geselecteerd
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Selectie wissen
            </button>
            <button
              type="button"
              onClick={handleBulkArchive}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Bezig…' : `Archiveer ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  aria-label="Alles selecteren"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
              </th>
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
            {contacts.map((c) => {
              const name = fullName(c.first_name, c.last_name)
              const ini  = initials(c.first_name, c.last_name) || c.email[0].toUpperCase()
              const archiveFn = archiveContact.bind(null, c.id)
              const isBounced = !!c.bounced_at
              const isSelected = selected.has(c.id)

              return (
                <tr
                  key={c.id}
                  className={`group transition-colors ${isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50'}`}
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Selecteer ${c.email}`}
                      checked={isSelected}
                      onChange={() => toggleOne(c.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    />
                  </td>

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

                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">{c.email}</td>

                  <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">
                    {c.company ?? <span className="text-zinc-300">—</span>}
                  </td>

                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {c.contact_type
                      ? <span className="text-xs text-zinc-600">{typeLabels[c.contact_type] ?? c.contact_type}</span>
                      : <span className="text-zinc-300">—</span>}
                  </td>

                  <td className="px-5 py-3.5">
                    {isBounced
                      ? <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-50 text-orange-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />Bounced
                        </span>
                      : <ContactStatusBadge status={c.status} />}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-zinc-400 hidden lg:table-cell">
                    {sourceLabels[c.source] ?? c.source}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-zinc-400 tabular-nums hidden xl:table-cell">
                    {c.opted_in_at ? formatDate(c.opted_in_at) : <span className="italic">—</span>}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-zinc-400 tabular-nums hidden xl:table-cell">
                    {formatDate(c.created_at)}
                  </td>

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
    </>
  )
}
