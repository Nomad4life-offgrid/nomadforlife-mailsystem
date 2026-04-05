'use client'

import { useActionState } from 'react'
import { createGroup } from './actions'
import type { FormState } from './actions'

export function NewGroupForm() {
  const [state, action, isPending] = useActionState(
    createGroup,
    null as FormState
  )

  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-5">
      <p className="text-sm font-medium text-zinc-700 mb-3">Nieuwe lijst</p>

      {state?.message && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.message}
        </p>
      )}

      <form action={action} className="space-y-3">
        <div>
          <input
            name="name"
            type="text"
            required
            placeholder="Naam…"
            className={`block w-full rounded-md border px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none ${
              state?.errors?.name ? 'border-red-400 bg-red-50' : 'border-zinc-300'
            }`}
          />
          {state?.errors?.name && (
            <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
          )}
        </div>

        <input
          name="description"
          type="text"
          placeholder="Omschrijving (optioneel)"
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Kleur</label>
            <input
              name="color"
              type="color"
              defaultValue="#71717a"
              className="h-7 w-10 cursor-pointer rounded border border-zinc-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Type</label>
            <select
              name="list_type"
              defaultValue="group"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-zinc-500 focus:outline-none"
            >
              <option value="group">Groep</option>
              <option value="list">Lijst</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Aanmaken…' : 'Aanmaken'}
        </button>
      </form>
    </div>
  )
}
