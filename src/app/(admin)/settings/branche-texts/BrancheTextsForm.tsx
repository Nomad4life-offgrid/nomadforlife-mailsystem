'use client'

import { useActionState, useTransition, useState } from 'react'
import { saveBrancheTexts, applyBrancheTextsToContacts } from './actions'
import type { SaveBrancheTextsState } from './actions'
import { BRANCHES, BRANCHE_LABELS, type Branche } from '@/lib/email/branche-data'

type Row = {
  branche:  Branche
  zin:      string
  subject:  string
  url_slug: string
  ps_block: string
}

export function BrancheTextsForm({ initialRows }: { initialRows: Row[] }) {
  const [state, formAction, isPending] = useActionState<SaveBrancheTextsState, FormData>(
    saveBrancheTexts,
    null,
  )
  const [applying, setApplying] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<{ branche: string; updated: number; error?: string } | null>(null)
  const [, startTransition] = useTransition()

  function handleApply(branche: string) {
    if (!confirm(`Pas de huidige tekst toe op alle bestaande contacten met branche "${branche}"?\n\nAndere custom_fields-keys blijven staan; alleen aanhef, zin, onderwerp, categorie_url en ps_offgrid worden overschreven.`)) return
    setApplying(branche)
    startTransition(async () => {
      const result = await applyBrancheTextsToContacts(branche)
      setApplyResult({ branche, ...result })
      setApplying(null)
    })
  }

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Opgeslagen. Nieuwe contacten krijgen automatisch de bijgewerkte tekst. Voor bestaande contacten klik je op &quot;Toepassen op bestaande&quot; per branche.
        </div>
      )}
      {applyResult && (
        <div className={`rounded-md border px-4 py-3 text-sm ${applyResult.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          {applyResult.error
            ? `Fout bij "${applyResult.branche}": ${applyResult.error}`
            : `"${applyResult.branche}": ${applyResult.updated} contacten geüpdatet.`}
        </div>
      )}

      {initialRows.map((row) => (
        <div key={row.branche} className="rounded-lg border border-zinc-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">{BRANCHE_LABELS[row.branche]}</h2>
            <button
              type="button"
              onClick={() => handleApply(row.branche)}
              disabled={applying !== null}
              className="text-xs font-medium text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50"
            >
              {applying === row.branche ? 'Bezig…' : 'Toepassen op bestaande contacten'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Onderwerpregel (gebruikt als <code className="font-mono bg-zinc-100 px-1 rounded">{'{{onderwerp}}'}</code>)
            </label>
            <input
              type="text"
              name={`${row.branche}__subject`}
              defaultValue={row.subject}
              required
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Branche-zin (gebruikt als <code className="font-mono bg-zinc-100 px-1 rounded">{'{{branche_zin}}'}</code>)
            </label>
            <textarea
              name={`${row.branche}__zin`}
              defaultValue={row.zin}
              required
              rows={2}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              URL-slug categoriepagina (na <code className="font-mono bg-zinc-100 px-1 rounded">/campers-vans/</code>)
            </label>
            <input
              type="text"
              name={`${row.branche}__url_slug`}
              defaultValue={row.url_slug}
              required
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              PS-blok (gebruikt als <code className="font-mono bg-zinc-100 px-1 rounded">{'{{ps_offgrid}}'}</code>) <span className="text-zinc-400 font-normal">— laat leeg als niet van toepassing</span>
            </label>
            <textarea
              name={`${row.branche}__ps_block`}
              defaultValue={row.ps_block}
              rows={3}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none resize-y"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 sticky bottom-4 bg-white/95 backdrop-blur border border-zinc-200 rounded-md px-4 py-3 shadow-sm">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Opslaan…' : 'Alle wijzigingen opslaan'}
        </button>
        <p className="text-xs text-zinc-500">
          Opslaan werkt alleen de DB bij. Klik per branche apart op &quot;Toepassen op bestaande contacten&quot; om de 197 bestaande Founding Partners bij te werken.
        </p>
      </div>
    </form>
  )
}
