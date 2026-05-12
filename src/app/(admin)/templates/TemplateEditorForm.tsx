'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { LogoSnippet } from './LogoSnippet'
import { TEMPLATE_VAR_REFERENCE, SAMPLE_VARS, renderEmail } from '@/lib/email/renderer'
import { sendTemplateTestMail } from './actions'

/** Client-side HTML strip — zelfde vorm als de server-cleanup. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trimStart()
}

const CATEGORIES = [
  { value: 'general',       label: 'Algemeen' },
  { value: 'onboarding',    label: 'Onboarding' },
  { value: 'followup',      label: 'Opvolging' },
  { value: 'newsletter',    label: 'Nieuwsbrief' },
  { value: 'transactional', label: 'Transactioneel' },
]

type Props = {
  action:      (formData: FormData) => Promise<void>
  submitLabel: string
  cancelHref:  string
  extraButtons?: React.ReactNode
  template?: {
    name?:         string
    subject?:      string
    preview_text?: string | null
    html_body?:    string
    text_body?:    string | null
    category?:     string | null
  }
}

export function TemplateEditorForm({ action, submitLabel, cancelHref, extraButtons, template }: Props) {
  const [tab,      setTab]      = useState<'html' | 'preview'>('html')
  const [htmlBody, setHtmlBody] = useState(template?.html_body ?? '')
  const [subject,  setSubject]  = useState(template?.subject ?? '')
  const [testSent, setTestSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  const optionalVars = TEMPLATE_VAR_REFERENCE.filter(v => !v.required)

  const { html: previewHtml } = renderEmail({
    htmlBody,
    textBody:       null,
    contact:        { first_name: SAMPLE_VARS.first_name, last_name: SAMPLE_VARS.last_name, email: SAMPLE_VARS.email },
    campaignName:   SAMPLE_VARS.campaign_name,
    companyName:    SAMPLE_VARS.company_name,
    unsubscribeUrl: '#preview-afmelden',
  })

  return (
    <>
      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b border-zinc-200 mb-4">
        {(['html', 'preview'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t === 'html' ? 'HTML-editor' : 'Voorbeeld'}
          </button>
        ))}
      </div>

      {/* ── HTML-editor tab ── */}
      <form action={action} className={`space-y-5 rounded-lg border border-zinc-200 bg-white p-6${tab === 'preview' ? ' hidden' : ''}`}>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="name">
              Naam <span className="text-red-500">*</span>
            </label>
            <input
              id="name" name="name" type="text" required
              defaultValue={template?.name ?? ''}
              placeholder="Bijv. Welkomstmail"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="category">
              Categorie
            </label>
            <select
              id="category" name="category"
              defaultValue={template?.category ?? 'general'}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="subject">
              Standaard onderwerpregel <span className="text-red-500">*</span>
            </label>
            <input
              id="subject" name="subject" type="text" required maxLength={200}
              value={subject}
              onChange={e => setSubject(stripHtml(e.target.value))}
              onPaste={e => {
                e.preventDefault()
                const pasted = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')
                setSubject(stripHtml(pasted))
              }}
              placeholder="Bijv. Welkom bij {{company_name}}!"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Alleen platte tekst. Variabelen zijn toegestaan (bv. <code className="bg-zinc-100 px-1 rounded font-mono">{'{{onderwerp}}'}</code>).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="preview_text">
              Preview-tekst
              <span className="ml-1 font-normal text-zinc-400">(preheader)</span>
            </label>
            <input
              id="preview_text" name="preview_text" type="text"
              defaultValue={template?.preview_text ?? ''}
              placeholder="Korte tekst zichtbaar in de inbox…"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Variabelen zoals <code className="bg-zinc-100 px-1 rounded font-mono">{'{{preheader}}'}</code> of <code className="bg-zinc-100 px-1 rounded font-mono">{'{{branche}}'}</code> zijn toegestaan.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="html_body">
            HTML-inhoud <span className="text-red-500">*</span>
          </label>
          <div className="mb-2"><LogoSnippet /></div>
          <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
            <p className="mb-1.5 font-medium text-zinc-700">
              Verplicht: <code className="font-mono bg-white border border-zinc-200 px-1 rounded">{'{{unsubscribe_url}}'}</code>
            </p>
            <details>
              <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 select-none">
                Beschikbare variabelen ({optionalVars.length})
              </summary>
              <table className="mt-2 w-full text-xs">
                <tbody>
                  {optionalVars.map(v => (
                    <tr key={v.variable} className="align-top">
                      <td className="py-0.5 pr-3 whitespace-nowrap">
                        <code className="font-mono bg-white border border-zinc-200 px-1 rounded">{v.variable}</code>
                      </td>
                      <td className="py-0.5 text-zinc-500">{v.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
          <textarea
            id="html_body" name="html_body" rows={20} required
            value={htmlBody}
            onChange={e => setHtmlBody(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-zinc-500 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-amber-700 font-medium">
            Verplicht: voeg <code className="bg-amber-50 px-1 rounded font-mono">{'{{unsubscribe_url}}'}</code> toe als href van je afmeldlink.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="text_body">
            Tekstversie
            <span className="ml-1 font-normal text-zinc-400">(optioneel — automatisch gegenereerd als leeg)</span>
          </label>
          <textarea
            id="text_body" name="text_body" rows={6}
            defaultValue={template?.text_body ?? ''}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2 flex-wrap items-center">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            {submitLabel}
          </button>
          {extraButtons}
          {/* Testmail knop — stuurt huidige HTML naar hello@nomad4life.com */}
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const fd = new FormData()
              fd.set('html_body', htmlBody)
              fd.set('subject',   subject)
              startTransition(async () => {
                await sendTemplateTestMail(fd)
                setTestSent(true)
                setTimeout(() => setTestSent(false), 4000)
              })
            }}
            className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Versturen…' : testSent ? '✓ Verstuurd' : 'Stuur testmail → hello@nomad4life.com'}
          </button>
          <Link
            href={cancelHref}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Annuleren
          </Link>
        </div>
      </form>

      {/* ── Voorbeeld tab ── */}
      {tab === 'preview' && (
        <div
          className="rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden"
          style={{ height: 'calc(100vh - 220px)' }}
        >
          <iframe
            srcDoc={previewHtml}
            className="w-full h-full"
            title="E-mail voorbeeld"
            sandbox="allow-same-origin"
          />
        </div>
      )}
    </>
  )
}
