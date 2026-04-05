'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { SegmentFilterBuilder } from '@/components/segments/SegmentFilterBuilder'
import { updateSegment } from '../../../actions'
import type { FormState } from '../../../actions'
import type { Segment } from '@/types'

export function SegmentEditForm({
  id,
  defaultValues,
}: {
  id:            string
  defaultValues: Segment
}) {
  const boundUpdate = updateSegment.bind(null, id)
  const [state, action, isPending] = useActionState(boundUpdate, null as FormState)
  const errors = state?.errors

  return (
    <form action={action} className="space-y-6">
      {state?.message && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Naam + omschrijving */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Segmentdetails</h2>

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
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 ${
              errors?.name ? 'border-red-400 bg-red-50' : 'border-zinc-300'
            }`}
          />
          {errors?.name && <p className="mt-1 text-xs text-red-600">{errors.name[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="description">
            Omschrijving
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={defaultValues.description ?? ''}
            className="mt-1 block w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      {/* Filter builder with pre-filled values */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Filterregels</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Wijzigingen wissen de opgeslagen preview — vernieuw de preview na het opslaan.
          </p>
        </div>

        {(errors as any)?.filter_json && (
          <p className="text-xs text-red-600">{(errors as any).filter_json[0]}</p>
        )}

        <SegmentFilterBuilder defaultValue={defaultValues.filter_json} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        <Link
          href={`/segments/dynamic/${id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Annuleren
        </Link>
      </div>
    </form>
  )
}
