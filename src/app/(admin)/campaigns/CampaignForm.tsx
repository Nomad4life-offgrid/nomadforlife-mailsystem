'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { FormState } from './actions'
import type { Campaign, ContactGroup, Segment } from '@/types'

// ── Minimalistische template-summary voor de picker ───────────────────────────

type TemplatePick = { id: string; name: string; subject: string }

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  mode:          'new' | 'edit'
  action:        (prev: FormState, fd: FormData) => Promise<FormState>
  defaultValues?: Partial<Campaign>
  campaignId?:   string
  templates:     TemplatePick[]
  groups:        ContactGroup[]
  segments:      Segment[]
}

// ── Hulpcomponenten ───────────────────────────────────────────────────────────

function FieldError({ msgs }: { msgs?: string[] }) {
  if (!msgs?.length) return null
  return <p className="mt-1 text-xs text-red-600">{msgs[0]}</p>
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ── Hoofd-component ───────────────────────────────────────────────────────────

export function CampaignForm({
  mode,
  action,
  defaultValues,
  campaignId,
  templates,
  groups,
  segments,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null as FormState)
  const errors = state?.errors

  const [campaignType, setCampaignType] = useState<'one_off' | 'funnel'>(
    defaultValues?.campaign_type ?? 'one_off'
  )
  const [audienceType, setAudienceType] = useState<'group' | 'segment'>(
    defaultValues?.audience_type ?? 'group'
  )

  const inputCls = (hasErr: boolean) =>
    `mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 ${
      hasErr ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white'
    }`

  const cancelHref =
    mode === 'edit' && campaignId ? `/campaigns/${campaignId}` : '/campaigns'

  return (
    <form action={formAction} className="space-y-6">
      {state?.message && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* ── Campagnetype ──────────────────────────────────────────── */}
      {mode === 'new' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Campagnetype</h2>
          <div className="flex gap-4">
            {[
              {
                value: 'one_off',
                label: 'Eenmalig',
                desc:  'Eén blast-bericht aan een geselecteerde doelgroep',
              },
              {
                value: 'funnel',
                label: 'Funnel',
                desc:  'Automatische reeks e-mails na inschrijving',
              },
            ].map(({ value, label, desc }) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  campaignType === value
                    ? 'border-zinc-900 bg-zinc-50'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name="campaign_type"
                  value={value}
                  checked={campaignType === value}
                  onChange={() => setCampaignType(value as 'one_off' | 'funnel')}
                  className="sr-only"
                />
                <p className="text-sm font-semibold text-zinc-900">{label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Behoud campaign_type bij edit (hidden) */}
      {mode === 'edit' && (
        <input type="hidden" name="campaign_type" value={campaignType} />
      )}

      {/* ── Campagnedetails ───────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Campagnedetails</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="name">
            Naam <span className="text-red-500">*</span>
          </label>
          <input
            id="name" name="name" type="text" required
            defaultValue={defaultValues?.name ?? ''}
            className={inputCls(!!errors?.name)}
          />
          <FieldError msgs={errors?.name} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="description">
            Interne omschrijving
          </label>
          <textarea
            id="description" name="description" rows={2}
            defaultValue={defaultValues?.description ?? ''}
            className={`${inputCls(false)} resize-y`}
            placeholder="Alleen zichtbaar in het beheerpaneel"
          />
        </div>
      </div>

      {/* ── E-mailinstellingen (only one_off) ─────────────────────── */}
      {campaignType === 'one_off' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">E-mailinstellingen</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="subject">
              Onderwerpregel <span className="text-red-500">*</span>
            </label>
            <input
              id="subject" name="subject" type="text"
              defaultValue={defaultValues?.subject ?? ''}
              placeholder="Bijv. Nieuw aanbod voor campingleden"
              className={inputCls(!!errors?.subject)}
            />
            <FieldError msgs={errors?.subject} />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="preview_text">
              Preview-tekst
            </label>
            <input
              id="preview_text" name="preview_text" type="text"
              defaultValue={defaultValues?.preview_text ?? ''}
              placeholder="Korte tekst zichtbaar naast de onderwerpregel in de inbox"
              className={inputCls(false)}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Preheader-tekst — max. ~90 tekens voor de meeste e-mailclients.
            </p>
          </div>
        </div>
      )}

      {/* ── Afzender ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Afzender</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="from_name">
              Naam afzender <span className="text-red-500">*</span>
            </label>
            <input
              id="from_name" name="from_name" type="text" required
              defaultValue={defaultValues?.from_name ?? ''}
              placeholder="Nomad For Life"
              className={inputCls(!!errors?.from_name)}
            />
            <FieldError msgs={errors?.from_name} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="from_email">
              E-mailadres afzender <span className="text-red-500">*</span>
            </label>
            <input
              id="from_email" name="from_email" type="email" required
              defaultValue={defaultValues?.from_email ?? ''}
              placeholder="info@nomadforlife.nl"
              className={inputCls(!!errors?.from_email)}
            />
            <FieldError msgs={errors?.from_email} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="reply_to">
            Reply-to adres (optioneel)
          </label>
          <input
            id="reply_to" name="reply_to" type="email"
            defaultValue={defaultValues?.reply_to_email ?? ''}
            placeholder="reacties@nomadforlife.nl"
            className={inputCls(false)}
          />
        </div>
      </div>

      {/* ── Template (only one_off) ──────────────────────────────── */}
      {campaignType === 'one_off' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Template</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="template_id">
              E-mailtemplate <span className="text-red-500">*</span>
            </label>
            <select
              id="template_id" name="template_id"
              defaultValue={defaultValues?.template_id ?? ''}
              className={inputCls(!!errors?.template_id)}
            >
              <option value="">Kies een template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.subject}
                </option>
              ))}
            </select>
            <FieldError msgs={errors?.template_id} />
            {templates.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                Geen templates beschikbaar.{' '}
                <Link href="/templates/new" className="underline">Maak er eerst een aan.</Link>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Doelgroep (only one_off) ──────────────────────────────── */}
      {campaignType === 'one_off' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Doelgroep</h2>

          <div>
            <p className="text-sm font-medium text-zinc-700 mb-2">Type doelgroep</p>
            <div className="flex gap-5">
              {[
                { value: 'group',   label: 'Statische lijst of groep' },
                { value: 'segment', label: 'Dynamisch segment' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience_type"
                    value={value}
                    checked={audienceType === value}
                    onChange={() => setAudienceType(value as 'group' | 'segment')}
                    className="accent-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {audienceType === 'group' ? (
            <div key="group-picker">
              <label className="block text-sm font-medium text-zinc-700" htmlFor="audience_group_id">
                Lijst of groep <span className="text-red-500">*</span>
              </label>
              <select
                id="audience_group_id" name="audience_group_id"
                defaultValue={defaultValues?.audience_group_id ?? ''}
                className={inputCls(false)}
              >
                <option value="">Kies een lijst/groep…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <input type="hidden" name="audience_segment_id" value="" />
              {groups.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  Geen lijsten/groepen beschikbaar.{' '}
                  <Link href="/segments" className="underline">Beheer lijsten →</Link>
                </p>
              )}
            </div>
          ) : (
            <div key="segment-picker">
              <label className="block text-sm font-medium text-zinc-700" htmlFor="audience_segment_id">
                Segment <span className="text-red-500">*</span>
              </label>
              <select
                id="audience_segment_id" name="audience_segment_id"
                defaultValue={defaultValues?.audience_segment_id ?? ''}
                className={inputCls(false)}
              >
                <option value="">Kies een segment…</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input type="hidden" name="audience_group_id" value="" />
              {segments.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-600">
                  Geen segmenten beschikbaar.{' '}
                  <Link href="/segments?tab=segmenten" className="underline">Beheer segmenten →</Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Verzendinstellingen ───────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Instellingen</h2>

        {campaignType === 'one_off' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="planned_send_at">
                Geplande verzenddatum (optioneel)
              </label>
              <input
                id="planned_send_at" name="planned_send_at"
                type="datetime-local"
                defaultValue={
                  defaultValues?.planned_send_at
                    ? new Date(defaultValues.planned_send_at).toISOString().slice(0, 16)
                    : ''
                }
                className={`${inputCls(false)}`}
              />
              <p className="mt-1 text-xs text-zinc-400">Leeg laten om direct te verzenden.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="batch_size">
                Batchgrootte
              </label>
              <input
                id="batch_size" name="batch_size" type="number" min={0}
                defaultValue={defaultValues?.batch_size ?? 0}
                className={inputCls(false)}
              />
              <p className="mt-1 text-xs text-zinc-400">
                Max. e-mails per verzendrun. <strong>0</strong> = geen limiet.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="track_opens" name="track_opens" type="checkbox"
              value="on"
              defaultChecked={defaultValues?.track_opens !== false}
              className="rounded accent-zinc-900"
            />
            <span className="text-sm text-zinc-700">Opens bijhouden</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="track_clicks" name="track_clicks" type="checkbox"
              value="on"
              defaultChecked={defaultValues?.track_clicks !== false}
              className="rounded accent-zinc-900"
            />
            <span className="text-sm text-zinc-700">Klikken bijhouden</span>
          </label>
        </div>
      </div>

      {/* ── Acties ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending && <SpinnerIcon />}
          {isPending ? 'Opslaan…' : mode === 'new' ? 'Campagne aanmaken' : 'Opslaan'}
        </button>
        <Link
          href={cancelHref}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Annuleren
        </Link>
      </div>
    </form>
  )
}
