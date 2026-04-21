'use client'

import { useState } from 'react'
import { subscribeGroup, subscribeContacts } from './actions'

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

      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
      >
        Inschrijven &amp; inplannen
      </button>
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

      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
      >
        Inschrijven &amp; inplannen
      </button>
    </form>
  )
}
