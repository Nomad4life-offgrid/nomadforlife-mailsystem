import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateCampaignStep } from '../../../../actions'
import type { CampaignStep } from '@/types'

// ── Configuratie ──────────────────────────────────────────────────────────────

const SEND_CONDITIONS = [
  { value: 'always',              label: 'Altijd verzenden' },
  { value: 'opened_previous',     label: 'Alleen als de vorige mail geopend is' },
  { value: 'not_opened_previous', label: 'Alleen als de vorige mail NIET geopend is' },
  { value: 'clicked_previous',    label: 'Alleen als er geklikt is in de vorige mail' },
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>
}) {
  const { id, stepId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('campaign_steps')
    .select('step_order, campaigns(name)')
    .eq('id', stepId)
    .eq('campaign_id', id)
    .maybeSingle()
  const campName = (data?.campaigns as any)?.name ?? 'Campagne'
  return { title: `Stap ${data?.step_order ?? '?'} bewerken — ${campName}` }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StepEditPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>
}) {
  const { id: campaignId, stepId } = await params
  const supabase = await createClient()

  const [stepRes, tplRes, campRes] = await Promise.all([
    supabase
      .from('campaign_steps')
      .select('*')
      .eq('id', stepId)
      .eq('campaign_id', campaignId)
      .maybeSingle(),
    supabase
      .from('templates')
      .select('id, name, subject')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('campaigns')
      .select('name')
      .eq('id', campaignId)
      .maybeSingle(),
  ])

  if (!stepRes.data) notFound()

  const step      = stepRes.data as CampaignStep
  const templates = (tplRes.data ?? []) as { id: string; name: string; subject: string }[]
  const campName  = campRes.data?.name ?? 'Campagne'

  const updateFn = updateCampaignStep.bind(null, campaignId, stepId)
  const currentCondition = (step.send_condition as any)?.type ?? 'always'

  return (
    <div className="p-8 max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link href="/campaigns" className="hover:text-zinc-900 transition-colors">Campagnes</Link>
        <span>/</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-zinc-900 transition-colors">
          {campName}
        </Link>
        <span>/</span>
        <span className="text-zinc-700">Stap {step.step_order} bewerken</span>
      </nav>

      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
        Stap {step.step_order} bewerken
      </h1>

      <form action={updateFn} className="mt-8 space-y-6">

        {/* Template */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Template <span className="text-red-500">*</span>
          </label>
          <select
            name="template_id"
            defaultValue={step.template_id}
            required
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <option value="">Kies een template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="mt-1.5 text-xs text-amber-600">
              Geen templates beschikbaar.{' '}
              <Link href="/templates/new" className="underline">Maak er eerst een aan.</Link>
            </p>
          )}
        </div>

        {/* Onderwerpregel */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Onderwerpregel <span className="text-red-500">*</span>
          </label>
          <input
            name="subject"
            type="text"
            defaultValue={step.subject ?? ''}
            required
            placeholder="Bijv. Welkom bij Nomad For Life!"
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Preview-tekst */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1.5">
            Preview-tekst
            <span className="ml-1.5 font-normal text-zinc-400">(preheader)</span>
          </label>
          <input
            name="preview_text"
            type="text"
            defaultValue={step.preview_text ?? ''}
            placeholder="Korte tekst zichtbaar naast de onderwerpregel in de inbox…"
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Vertraging */}
        <div>
          <p className="block text-sm font-medium text-zinc-700 mb-1.5">Vertraging</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Dagen</label>
              <input
                name="delay_days"
                type="number"
                min={0}
                defaultValue={step.delay_days}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Uren</label>
              <input
                name="delay_hours"
                type="number"
                min={0}
                max={23}
                defaultValue={step.delay_hours}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-zinc-400">
            {step.step_order === 1
              ? 'Vertraging t.o.v. inschrijvingsdatum.'
              : 'Vertraging t.o.v. het verzendmoment van de vorige stap.'}
          </p>
        </div>

        {/* Verzendconditie — alleen voor stap 2+ */}
        {step.step_order > 1 && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Verzendconditie
            </label>
            <select
              name="send_condition"
              defaultValue={currentCondition}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {SEND_CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-400">
              Filtert op gedrag in de vorige stap. Kies &quot;Altijd&quot; voor geen filter.
            </p>
          </div>
        )}

        {/* Acties */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Stap opslaan
          </button>
          <Link
            href={`/campaigns/${campaignId}`}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Annuleren
          </Link>
        </div>
      </form>
    </div>
  )
}
