'use client'

import { useState, useTransition } from 'react'
import { quicksendNow, quicksendSave, type QuickSendResult } from './actions'
import { BRANCHES, BRANCHE_LABELS } from '@/lib/email/branche-data'

type Step = 'form' | 'sent' | 'saved'

export function QuickSendForm() {
  const [step, setStep]       = useState<Step>('form')
  const [pending, startTx]    = useTransition()
  const [bedrijf, setBedrijf] = useState('')
  const [email,   setEmail]   = useState('')
  const [branche, setBranche] = useState<string>('')
  const [last,    setLast]    = useState<QuickSendResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  function reset() {
    setBedrijf('')
    setEmail('')
    setBranche('')
    setLast(null)
    setError(null)
    setStep('form')
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTx(async () => {
      const result = await quicksendNow(fd)
      setLast(result)
      if (result.ok) setStep('sent')
      else           setError(result.error)
    })
  }

  function onSave() {
    if (!last?.ok) return
    startTx(async () => {
      const result = await quicksendSave(last.contactId)
      if (result.ok) {
        setStep('saved')
        setTimeout(reset, 600)
      } else {
        setError(result.error)
      }
    })
  }

  if (step === 'sent' && last?.ok) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-green-400 bg-green-50 p-6 text-center">
          <svg className="mx-auto h-16 w-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="mt-3 text-lg font-semibold text-green-800">Verzonden</p>
          <p className="mt-1 text-sm text-green-700">{last.email}</p>
          <p className="text-xs text-green-600 mt-0.5">{last.bedrijfsnaam} · {BRANCHE_LABELS[last.branche]}</p>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="block w-full rounded-xl bg-zinc-900 py-4 text-base font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Bezig…' : 'Nieuw'}
        </button>
        <p className="text-center text-xs text-zinc-400">
          &quot;Nieuw&quot; bewaart deze in groep Founding Partners + de verzendlijst, en maakt het formulier leeg.
        </p>
      </div>
    )
  }

  if (step === 'saved') {
    return (
      <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-6 text-center">
        <p className="text-base font-semibold text-blue-800">Bewaard. Formulier wordt gereset…</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="bedrijfsnaam">Bedrijfsnaam</label>
        <input
          id="bedrijfsnaam"
          name="bedrijfsnaam"
          type="text"
          required
          autoComplete="off"
          value={bedrijf}
          onChange={(e) => setBedrijf(e.target.value)}
          className="block w-full rounded-lg border border-zinc-300 px-4 py-3.5 text-base focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="email">E-mailadres</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-zinc-300 px-4 py-3.5 text-base focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="branche">Branche</label>
        <select
          id="branche"
          name="branche"
          required
          value={branche}
          onChange={(e) => setBranche(e.target.value)}
          className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-3.5 text-base focus:border-zinc-500 focus:outline-none"
        >
          <option value="" disabled>— Kies branche —</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{BRANCHE_LABELS[b]}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-xl bg-[#f85d1b] py-4 text-base font-semibold text-white hover:bg-[#d94d10] disabled:opacity-50 transition-colors mt-2"
      >
        {pending ? 'Versturen…' : 'Verzenden'}
      </button>
    </form>
  )
}
