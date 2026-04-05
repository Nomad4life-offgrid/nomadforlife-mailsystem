'use client'

import { useActionState } from 'react'
import { sendTestMail } from './actions'
import type { TestMailResult } from './actions'

type Template = { id: string; name: string }

export function TestMailForm({ templates }: { templates: Template[] }) {
  const [state, action, pending] = useActionState<TestMailResult | null, FormData>(
    sendTestMail,
    null,
  )

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Ontvanger <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="to_email"
            required
            placeholder="jij@nomad4life.com"
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Template <span className="text-red-500">*</span>
          </label>
          <select
            name="template_id"
            required
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Kies template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Onderwerp <span className="text-zinc-400 font-normal">(optioneel — gebruikt template-onderwerp als leeg)</span>
        </label>
        <input
          type="text"
          name="subject"
          placeholder="[TESTMAIL] …"
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {pending ? 'Versturen…' : 'Stuur testmail'}
        </button>

        {state?.ok === true && (
          <span className="text-sm text-green-600 font-medium">Testmail verstuurd.</span>
        )}
        {state?.ok === false && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  )
}
