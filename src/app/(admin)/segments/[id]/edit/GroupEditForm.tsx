'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updateGroup } from '../../actions'
import type { FormState } from '../../actions'
import type { ContactGroup } from '@/types'

const inputCls = (hasError: boolean) =>
  `mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 ${
    hasError ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white'
  }`

function FieldError({ errors, field }: { errors?: Partial<Record<string, string[]>>; field: string }) {
  const msgs = errors?.[field]
  if (!msgs?.length) return null
  return <p className="mt-1 text-xs text-red-600">{msgs[0]}</p>
}

export function GroupEditForm({
  id,
  defaultValues,
}: {
  id:            string
  defaultValues: ContactGroup
}) {
  const boundUpdate = updateGroup.bind(null, id)
  const [state, action, isPending] = useActionState(
    boundUpdate,
    null as FormState
  )

  const errors = state?.errors

  return (
    <form action={action} className="space-y-6">
      {state?.message && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Lijstdetails</h2>

        {/* Naam */}
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="name">
            Naam <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={defaultValues.name}
            className={inputCls(!!errors?.name)}
          />
          <FieldError errors={errors} field="name" />
        </div>

        {/* Omschrijving */}
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="description">
            Omschrijving
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={defaultValues.description ?? ''}
            className={`${inputCls(!!errors?.description)} resize-y`}
          />
          <FieldError errors={errors} field="description" />
        </div>

        {/* Kleur + Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="color">Kleur</label>
            <input
              id="color"
              name="color"
              type="color"
              defaultValue={defaultValues.color}
              className="mt-1 h-9 w-full cursor-pointer rounded-md border border-zinc-300"
            />
            <FieldError errors={errors} field="color" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="list_type">Type</label>
            <select
              id="list_type"
              name="list_type"
              defaultValue={defaultValues.list_type ?? 'group'}
              className={inputCls(!!errors?.list_type)}
            >
              <option value="group">Groep</option>
              <option value="list">Lijst</option>
            </select>
            <FieldError errors={errors} field="list_type" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        <Link
          href={`/segments/${id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Annuleren
        </Link>
      </div>
    </form>
  )
}
