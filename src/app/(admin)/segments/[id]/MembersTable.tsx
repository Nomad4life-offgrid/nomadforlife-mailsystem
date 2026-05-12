'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { removeContactFromGroup, removeContactsFromGroupBulk } from '../actions'

type Member = {
  contact_id: string
  added_at: string
  contact: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    status: string
    opted_in: boolean
  } | null
}

export function MembersTable({ groupId, members }: { groupId: string; members: Member[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const allIds = members.map((m) => m.contact_id)
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

  function handleBulkRemove() {
    if (selected.size === 0) return
    const count = selected.size
    if (!confirm(`Weet je zeker dat je ${count} contact${count === 1 ? '' : 'en'} uit deze lijst wilt verwijderen?`)) return
    const ids = Array.from(selected)
    startTransition(async () => {
      await removeContactsFromGroupBulk(groupId, ids)
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm">
          <span className="text-zinc-700">{selected.size} geselecteerd</span>
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
              onClick={handleBulkRemove}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Bezig…' : `Verwijder ${selected.size} uit lijst`}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
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
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Toegevoegd</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-zinc-400">
                  Nog geen contacten in deze lijst.
                </td>
              </tr>
            )}
            {members.map((m) => {
              const c = m.contact
              const removeFn = removeContactFromGroup.bind(null, groupId, m.contact_id)
              const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ')
              const isSelected = selected.has(m.contact_id)

              return (
                <tr
                  key={m.contact_id}
                  className={`group transition-colors ${isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50'}`}
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Selecteer ${c?.email ?? m.contact_id}`}
                      checked={isSelected}
                      onChange={() => toggleOne(m.contact_id)}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    />
                  </td>
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
                        <ContactStatusBadge status={c.status as 'active' | 'pending' | 'opted_out'} />
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
    </>
  )
}
