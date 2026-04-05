'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { Contact } from '@/types'
import type { ContactFormState } from '@/app/(admin)/contacts/actions'
import { CONTACT_TYPES, CONTACT_SOURCES } from '@/lib/validations/contact'

const TYPE_LABELS: Record<string, string> = {
  camping:      'Camping',
  sponsor:      'Sponsor',
  adverteerder: 'Adverteerder',
  lid:          'Lid',
  partner:      'Partner',
  prospect:     'Prospect',
  overig:       'Overig',
}

const SOURCE_LABELS: Record<string, string> = {
  manual:  'Handmatig',
  import:  'Import',
  api:     'API',
  website: 'Website',
  admin:   'Admin',
}

type ContactFormProps = {
  action: (prev: ContactFormState, formData: FormData) => Promise<ContactFormState>
  defaultValues?: Partial<Contact>
  cancelHref?: string
}

function FieldError({ errors, field }: { errors?: Partial<Record<string, string[]>>; field: string }) {
  const msgs = errors?.[field]
  if (!msgs?.length) return null
  return <p className="mt-1 text-xs text-red-600">{msgs[0]}</p>
}

const inputCls = (hasError: boolean) =>
  `mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 ${
    hasError ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white'
  }`

export function ContactForm({ action, defaultValues, cancelHref = '/contacts' }: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)

  const d = defaultValues ?? {}
  const errors = (state as any)?.errors as Partial<Record<string, string[]>> | undefined

  return (
    <form action={formAction} className="space-y-6">

      {/* Global error */}
      {(state as any)?.message && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(state as any).message}
        </div>
      )}

      {/* ── Sectie: Persoonsgegevens ─────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Persoonsgegevens</h2>

        {/* E-mail */}
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="email">
            E-mailadres <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={d.email ?? ''}
            className={inputCls(!!errors?.email)}
          />
          <FieldError errors={errors} field="email" />
        </div>

        {/* Naam */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="first_name">Voornaam</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              defaultValue={d.first_name ?? ''}
              className={inputCls(!!errors?.first_name)}
            />
            <FieldError errors={errors} field="first_name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="last_name">Achternaam</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              defaultValue={d.last_name ?? ''}
              className={inputCls(!!errors?.last_name)}
            />
            <FieldError errors={errors} field="last_name" />
          </div>
        </div>

        {/* Telefoon */}
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="phone">Telefoonnummer</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={d.phone ?? ''}
            className={inputCls(!!errors?.phone)}
          />
          <FieldError errors={errors} field="phone" />
        </div>
      </div>

      {/* ── Sectie: Organisatie ──────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Organisatie</h2>

        {/* Bedrijf */}
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="company">Bedrijf / organisatie</label>
          <input
            id="company"
            name="company"
            type="text"
            defaultValue={d.company ?? ''}
            className={inputCls(!!errors?.company)}
          />
          <FieldError errors={errors} field="company" />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="contact_type">Contacttype</label>
          <select
            id="contact_type"
            name="contact_type"
            defaultValue={d.contact_type ?? ''}
            className={inputCls(!!errors?.contact_type)}
          >
            <option value="">— Geen type —</option>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <FieldError errors={errors} field="contact_type" />
        </div>
      </div>

      {/* ── Sectie: Herkomst ─────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Herkomst</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="source">Bron</label>
          <select
            id="source"
            name="source"
            defaultValue={d.source ?? 'admin'}
            className={inputCls(!!errors?.source)}
          >
            {CONTACT_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
          <FieldError errors={errors} field="source" />
        </div>
      </div>

      {/* ── Sectie: Notities ─────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Interne notities</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="notes">Notities</label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={d.notes ?? ''}
            placeholder="Interne notities — niet zichtbaar voor het contact"
            className={`${inputCls(!!errors?.notes)} resize-y`}
          />
          <FieldError errors={errors} field="notes" />
        </div>
      </div>

      {/* ── Acties ───────────────────────────────────────────────── */}
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
          href={cancelHref}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Annuleren
        </Link>
      </div>
    </form>
  )
}
