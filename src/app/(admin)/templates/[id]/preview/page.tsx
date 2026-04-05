import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { substituteVars, htmlToText, SAMPLE_VARS, TEMPLATE_VAR_REFERENCE } from '@/lib/email/renderer'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('templates')
    .select('name')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  return { title: `Voorbeeld — ${data?.name ?? 'Template'}` }
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: template } = await supabase
    .from('templates')
    .select('id, name, subject, preview_text, html_body, text_body')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!template) notFound()

  const renderedHtml    = substituteVars(template.html_body,  SAMPLE_VARS)
  const renderedSubject = substituteVars(template.subject,    SAMPLE_VARS)
  const rawText         = template.text_body ?? htmlToText(template.html_body)
  const renderedText    = substituteVars(rawText, SAMPLE_VARS)

  // srcdoc vereist HTML-escaping van alleen & en "
  const srcdoc = renderedHtml
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link href="/templates" className="hover:text-zinc-900 transition-colors">Templates</Link>
        <span>/</span>
        <Link href={`/templates/${id}/edit`} className="hover:text-zinc-900 transition-colors">
          {template.name}
        </Link>
        <span>/</span>
        <span className="text-zinc-700">Voorbeeld</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{template.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Weergegeven met voorbeeldgegevens — zo ziet de ontvanger de e-mail.
        </p>
      </div>

      {/* Onderwerpregel */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">Onderwerpregel</p>
        <p className="text-sm font-medium text-zinc-900">{renderedSubject}</p>
        {template.preview_text && (
          <>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mt-3 mb-1">Preview-tekst</p>
            <p className="text-sm text-zinc-600">{substituteVars(template.preview_text, SAMPLE_VARS)}</p>
          </>
        )}
      </div>

      {/* HTML preview */}
      <div>
        <p className="text-sm font-medium text-zinc-700 mb-2">HTML-versie</p>
        <div className="rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50">
          <iframe
            srcDoc={srcdoc}
            title={`HTML preview: ${template.name}`}
            className="w-full border-0"
            style={{ height: '600px' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Tekst preview */}
      <div>
        <p className="text-sm font-medium text-zinc-700 mb-2">Tekstversie</p>
        <pre className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-80">
          {renderedText}
        </pre>
      </div>

      {/* Variabelen-referentie */}
      <div>
        <p className="text-sm font-medium text-zinc-700 mb-2">Beschikbare variabelen</p>
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-44">Variabele</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Beschrijving</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Voorbeeldwaarde</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-24">Verplicht</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_VAR_REFERENCE.map((v, i) => (
                <tr key={v.variable} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                  <td className="px-4 py-2.5 font-mono text-xs text-indigo-700">{v.variable}</td>
                  <td className="px-4 py-2.5 text-zinc-700">{v.description}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{v.example}</td>
                  <td className="px-4 py-2.5">
                    {v.required ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">ja</span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acties */}
      <div className="flex gap-3 pt-2 border-t border-zinc-100">
        <Link
          href={`/templates/${id}/edit`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Bewerken
        </Link>
        <Link
          href="/templates"
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Terug naar templates
        </Link>
      </div>
    </div>
  )
}
