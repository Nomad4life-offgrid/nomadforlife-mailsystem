'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { SegmentFilterBuilder } from '@/components/segments/SegmentFilterBuilder'
import { createSegment } from '../../actions'
import type { FormState } from '../../actions'

export default function NewSegmentPage() {
  const [state, action, isPending] = useActionState(createSegment, null as FormState)
  const errors = state?.errors

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/segments?tab=segmenten" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Segmenten
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Nieuw dynamisch segment</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Definieer filterregels — contacten worden automatisch geselecteerd op basis van hun kenmerken.
        </p>
      </div>

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
              placeholder="bv. Actieve campings"
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
              placeholder="Optionele omschrijving…"
              className="mt-1 block w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        {/* Filter builder */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Filterregels</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Alleen actieve, opted-in contacten worden geselecteerd. Uitgeschreven en gepauzeerde contacten worden altijd uitgesloten.
            </p>
          </div>

          {(errors as any)?.filter_json && (
            <p className="text-xs text-red-600">{(errors as any).filter_json[0]}</p>
          )}

          <SegmentFilterBuilder />
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
            {isPending ? 'Aanmaken…' : 'Segment aanmaken'}
          </button>
          <Link
            href="/segments?tab=segmenten"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Annuleren
          </Link>
        </div>
      </form>
    </div>
  )
}
