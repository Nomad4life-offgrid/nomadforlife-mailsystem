'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { subscribeGroup, subscribeContacts } from './actions'

/** Full-screen overlay shown while a form action is pending. */
function PendingOverlay({ title, description }: { title: string; description: string }) {
  const { pending } = useFormStatus()
  if (!pending) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-xl bg-white shadow-xl px-8 py-6 max-w-sm w-[90%] text-center">
        <svg className="mx-auto h-10 w-10 animate-spin text-zinc-900" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <h3 className="mt-3 text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  )
}

/** Submit button that greys out while the form action is pending. */
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {pending ? 'Bezig met inschrijven…' : label}
    </button>
  )
}

type Campaign = {
  id: string
  name: string
  status: string
  campaign_type: string
}

type Group = {
  id: string
  name: string
  color: string
}

function isFunnel(campaigns: Campaign[], id: string) {
  return campaigns.find((c) => c.id === id)?.campaign_type === 'funnel'
}

/** Formats the current local datetime as YYYY-MM-DDTHH:MM for datetime-local inputs */
function localNow() {
  const d = new Date()
  d.setSeconds(0, 0)
  // Strip timezone offset to format for datetime-local input in local time
  const tzMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzMs).toISOString().slice(0, 16)
}

/** Converts a local datetime-local string (YYYY-MM-DDTHH:MM) to a UTC ISO string. */
function toUtcIso(local: string) {
  if (!local) return ''
  return new Date(local).toISOString()
}

// ── Segment form ──────────────────────────────────────────────────────────────

export function SegmentForm({ campaigns, groups }: { campaigns: Campaign[]; groups: Group[] }) {
  const [campaignId, setCampaignId]       = useState('')
  const [startAtLocal, setStartAtLocal]   = useState(localNow())
  const showDate = isFunnel(campaigns, campaignId)

  return (
    <form action={subscribeGroup} className="p-6 space-y-4">
      <PendingOverlay
        title="Segment wordt ingeschreven…"
        description="De contacten worden geladen en ingepland. Dit kan even duren bij grote segmenten."
      />
      {/* Hidden UTC-ISO start_at — only relevant for funnels */}
      {showDate && <input type="hidden" name="start_at" value={toUtcIso(startAtLocal)} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">
            Campagne <span className="text-red-500">*</span>
          </label>
          <select
            name="campaign_id"
            required
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Kies campagne…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.campaign_type === 'funnel' ? ' (funnel)' : ' (eenmalig)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">
            Segment <span className="text-red-500">*</span>
          </label>
          <select name="group_id" required className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none">
            <option value="">Kies segment…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {showDate && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">
            Startdatum &amp; tijd funnel
            <span className="ml-1.5 font-normal text-zinc-400">(Stap 1 wordt verstuurd op dit moment)</span>
          </label>
          <input
            type="datetime-local"
            value={startAtLocal}
            onChange={(e) => setStartAtLocal(e.target.value)}
            className="block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Laat leeg om direct te starten. Stap 2 en verder volgen op basis van de vertragingen in de funnel.
          </p>
        </div>
      )}

      <SubmitButton label="Inschrijven & inplannen" />
    </form>
  )
}

// ── Email form ────────────────────────────────────────────────────────────────

export function EmailForm({ campaigns }: { campaigns: Campaign[] }) {
  const [campaignId, setCampaignId]     = useState('')
  const [startAtLocal, setStartAtLocal] = useState(localNow())
  const showDate = isFunnel(campaigns, campaignId)

  return (
    <form action={subscribeContacts} className="p-6 space-y-4">
      <PendingOverlay
        title="Contacten worden ingeschreven…"
        description="De e-mailadressen worden verwerkt en ingepland. Dit kan even duren."
      />
      {showDate && <input type="hidden" name="start_at" value={toUtcIso(startAtLocal)} />}

      <div>
        <label className="block text-xs font-medium text-zinc-600 mb-1.5">
          Campagne <span className="text-red-500">*</span>
        </label>
        <select
          name="campaign_id"
          required
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="">Kies campagne…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.campaign_type === 'funnel' ? ' (funnel)' : ' (eenmalig)'}
            </option>
          ))}
        </select>
      </div>

      {/* Instructiekader personalisatie */}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        <p className="font-semibold mb-1">Formaat per regel</p>
        <ul className="space-y-0.5">
          <li>
            <code className="font-mono bg-white/70 px-1 rounded">email@voorbeeld.nl</code>
            <span className="text-blue-700"> — alleen e-mail (geen bedrijfsnaam)</span>
          </li>
          <li>
            <code className="font-mono bg-white/70 px-1 rounded">Bedrijfsnaam;email@voorbeeld.nl</code>
            <span className="text-blue-700"> — bedrijfsnaam vóór de puntkomma, e-mail erachter</span>
          </li>
        </ul>
        <p className="mt-2 text-blue-700">
          De bedrijfsnaam wordt opgeslagen op het contact en automatisch gebruikt waar
          {' '}<code className="font-mono bg-white/70 px-1 rounded">{'{{company_name}}'}</code>{' '}
          in de template staat.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 mb-1.5">
          E-mailadressen <span className="text-red-500">*</span>
        </label>
        <textarea
          name="emails"
          rows={5}
          required
          placeholder={'Acme Tenten;info@acme.nl\nBoertje Glamp;marijn@boertje.nl\njan@example.com'}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Eén contact per regel. Nieuwe contacten worden automatisch aangemaakt en opt-in gezet.
        </p>
      </div>

      {showDate && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">
            Startdatum &amp; tijd funnel
            <span className="ml-1.5 font-normal text-zinc-400">(Stap 1 wordt verstuurd op dit moment)</span>
          </label>
          <input
            type="datetime-local"
            value={startAtLocal}
            onChange={(e) => setStartAtLocal(e.target.value)}
            className="block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Laat leeg om direct te starten. Stap 2 en verder volgen op basis van de vertragingen in de funnel.
          </p>
        </div>
      )}

      <SubmitButton label="Inschrijven & inplannen" />
    </form>
  )
}
