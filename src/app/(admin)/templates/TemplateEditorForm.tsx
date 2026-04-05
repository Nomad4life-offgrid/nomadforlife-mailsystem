'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogoSnippet } from './LogoSnippet'
import { TEMPLATE_VAR_REFERENCE, SAMPLE_VARS, renderEmail } from '@/lib/email/renderer'

const CATEGORIES = [
  { value: 'general',       label: 'Algemeen' },
  { value: 'onboarding',    label: 'Onboarding' },
  { value: 'followup',      label: 'Opvolging' },
  { value: 'newsletter',    label: 'Nieuwsbrief' },
  { value: 'transactional', label: 'Transactioneel' },
]

type Props = {
  action:      (formData: FormData) => Promise<unknown>
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
  const [tab,     setTab]     = useState<'html' | 'preview'>('html')
  const [htmlBody, setHtmlBody] = useState(template?.html_body ?? '')

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
              id="subject" name="subject" type="text" required
              defaultValue={template?.subject ?? ''}
              placeholder="Bijv. Welkom bij {{company_name}}!"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
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
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="html_body">
            HTML-inhoud <span className="text-red-500">*</span>
          </label>
          <div className="mb-2"><LogoSnippet /></div>
          <p className="text-xs text-zinc-400 mb-1.5">
            Verplicht: <code className="font-mono bg-zinc-100 px-1 rounded">{'{{unsubscribe_url}}'}</code>
            {' '}— Optioneel:{' '}
            {optionalVars.map(v => (
              <code key={v.variable} className="font-mono bg-zinc-100 px-1 rounded mr-1">{v.variable}</code>
            ))}
          </p>
          <textarea
            id="html_body" name="html_body" rows={20} required
            value={htmlBody}
            onChange={e => setHtmlBody(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-zinc-500 focus:outline-none"
          />
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            {submitLabel}
          </button>
          {extraButtons}
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
