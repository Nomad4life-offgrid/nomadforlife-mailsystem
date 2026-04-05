'use client'

import { useState } from 'react'

type Props = {
  testMode:         boolean
  testDelayMinutes: number
  action:           (formData: FormData) => Promise<void>
}

export function TestModeForm({ testMode: initialMode, testDelayMinutes: initialMinutes, action }: Props) {
  const [enabled, setEnabled] = useState(initialMode)

  return (
    <div className={`rounded-xl border p-5 space-y-3 ${
      enabled ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white'
    }`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">Testmodus</h2>
        {enabled && (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
            Actief
          </span>
        )}
      </div>

      <form action={action} className="space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            name="test_mode"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 accent-amber-500"
          />
          <span className="text-sm text-zinc-700">Versnelde verzending inschakelen</span>
        </label>

        <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
          <label className="block text-xs text-zinc-500 mb-1">
            Minuten vertraging per stap (i.p.v. dagen)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="test_delay_minutes"
              defaultValue={initialMinutes}
              min={1}
              max={120}
              disabled={!enabled}
              className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <span className="text-xs text-zinc-400">minuten</span>
          </div>
        </div>

        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Opslaan
        </button>
      </form>

      <p className="text-xs text-zinc-400">
        {enabled
          ? `Stappen met een vertraging &gt; 0 wachten ${initialMinutes} min. Stap 1 (direct) blijft ongewijzigd.`
          : 'Normale vertragingen in dagen worden gebruikt.'}
      </p>
    </div>
  )
}
