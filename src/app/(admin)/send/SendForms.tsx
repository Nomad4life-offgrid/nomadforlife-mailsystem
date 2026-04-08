'use client'

import { useRef, useState } from 'react'
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
  return d.toISOString().slice(0, 16)
}

/** Wraps form submission: reads datetime-local value, converts to UTC ISO, injects hidden field */
function withStartAt(action: (fd: FormData) => Promise<void>) {
  return async (fd: FormData) => {
    const localVal = fd.get('start_at_local') as string | null
    if (localVal) {
      // datetime-local value has no timezone — interpret as local time
      const utcIso = new Date(localVal).toISOString()
      fd.set('start_at', utcIso)
    }
    fd.delete('start_at_local')
    await action(fd)
  }
}

// ── Segment form ──────────────────────────────────────────────────────────────

export function SegmentForm({ campaigns, groups }: { campaigns: Campaign[]; groups: Group[] }) {
  const [campaignId, setCampaignId] = useState('')
  const showDate = isFunnel(campaigns, campaignId)
  const defaultDate = useRef(localNow())

  const action = withStartAt(subscribeGroup)

  return (
    <form action={action} className="p-6 space-y-4">
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
            name="start_at_local"
            type="datetime-local"
            defaultValue={defaultDate.current}
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
  const [campaignId, setCampaignId] = useState('')
  const showDate = isFunnel(campaigns, campaignId)
  const defaultDate = useRef(localNow())

  const action = withStartAt(subscribeContacts)

  return (
    <form action={action} className="p-6 space-y-4">
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
          E-mailadressen <span className="text-red-500">*</span>
        </label>
        <textarea
          name="emails"
          rows={5}
          required
          placeholder={'jan@example.com\npiet@example.com'}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {showDate && (
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">
            Startdatum &amp; tijd funnel
            <span className="ml-1.5 font-normal text-zinc-400">(Stap 1 wordt verstuurd op dit moment)</span>
          </label>
          <input
            name="start_at_local"
            type="datetime-local"
            defaultValue={defaultDate.current}
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
