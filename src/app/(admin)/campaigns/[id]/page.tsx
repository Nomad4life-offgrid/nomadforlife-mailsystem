import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContactStatusBadge } from '@/components/ui/Badge'
import { resolveAudienceContacts, isDeliverable } from '@/lib/services/audience'
import { getCurrentUserWithRole } from '@/lib/auth/guards'
import { SendButton } from './SendButton'
import { TestModeForm } from './TestModeForm'
import {
  markCampaignReady,
  setCampaignStatus,
  sendCampaign,
  deleteCampaign,
  addCampaignStep,
  removeCampaignStep,
  activateFunnelCampaign,
  processFunnelStep,
  setStepStatus,
  triggerBatch,
  sendTestMailAction,
  setTestMode,
} from '../actions'
import type { Campaign, Contact } from '@/types'

// ── Configuratie ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  draft:     { label: 'Concept',     dot: 'bg-zinc-400',   badge: 'bg-zinc-100 text-zinc-600'     },
  ready:     { label: 'Klaar',       dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700'      },
  scheduled: { label: 'Ingepland',   dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700'  },
  sending:   { label: 'Verzenden',   dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-800'    },
  completed: { label: 'Voltooid',    dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700'    },
  paused:    { label: 'Gepauzeerd',  dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-800'  },
  cancelled: { label: 'Geannuleerd', dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700'        },
  active:    { label: 'Actief',      dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700'    },
  archived:  { label: 'Gearchiveerd',dot: 'bg-zinc-300',   badge: 'bg-zinc-100 text-zinc-400'     },
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('campaigns').select('name').eq('id', id).maybeSingle()
  return { title: data?.name ?? 'Campagne' }
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

function delayLabel(hours: number, days: number) {
  const total = days * 24 + hours
  if (total === 0) return 'Direct bij inschrijving'
  if (total < 24)  return `Na ${total}u`
  const d = Math.floor(total / 24)
  const h = total % 24
  if (h === 0) return `Na ${d} dag${d !== 1 ? 'en' : ''}`
  return `Na ${d}d ${h}u`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ error?: string; info?: string }>
}) {
  const { id }          = await params
  const { error, info } = await searchParams
  const supabase  = await createClient()

  const { data: raw } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!raw) notFound()

  const campaign = raw as Campaign

  // Rol ophalen voor role-aware UI (verzendknop)
  const currentUser = await getCurrentUserWithRole()
  const isAdmin     = currentUser?.role === 'admin'

  const cfg      = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
  const isOneOff = campaign.campaign_type === 'one_off'

  // ── Doelgroep resolven (alleen one_off) ─────────────────────────────────────
  let audience: Awaited<ReturnType<typeof resolveAudienceContacts>> | null = null
  let audienceName = ''

  if (isOneOff && (campaign.audience_group_id || campaign.audience_segment_id)) {
    audience = await resolveAudienceContacts(supabase, {
      groupIds:   campaign.audience_group_id   ? [campaign.audience_group_id]   : [],
      segmentIds: campaign.audience_segment_id ? [campaign.audience_segment_id] : [],
    })

    if (campaign.audience_group_id) {
      const { data: g } = await supabase
        .from('contact_groups')
        .select('name')
        .eq('id', campaign.audience_group_id)
        .maybeSingle()
      audienceName = g?.name ?? 'Onbekende lijst'
    } else if (campaign.audience_segment_id) {
      const { data: s } = await supabase
        .from('segments')
        .select('name')
        .eq('id', campaign.audience_segment_id)
        .maybeSingle()
      audienceName = s?.name ?? 'Onbekend segment'
    }
  }

  // ── Template-naam voor one_off (voor de detailkaart) ─────────────────────────
  let templateName: string | null = null
  let templateSubject: string | null = null

  if (isOneOff && campaign.template_id) {
    const { data: tpl } = await supabase
      .from('templates')
      .select('name, subject')
      .eq('id', campaign.template_id)
      .maybeSingle()
    templateName    = tpl?.name    ?? null
    templateSubject = tpl?.subject ?? null
  }

  // ── Mail-log statistieken voor one_off (wachtrij-voortgang) ─────────────────
  let oneOffStats = { pending: 0, sent: 0, failed: 0, skipped: 0, total: 0 }

  if (isOneOff && campaign.sent_at) {
    const { data: stepRow } = await supabase
      .from('campaign_steps')
      .select('id')
      .eq('campaign_id', id)
      .order('step_order')
      .limit(1)
      .maybeSingle()

    if (stepRow) {
      const { data: logRows } = await supabase
        .from('mail_logs')
        .select('status')
        .eq('campaign_step_id', stepRow.id)

      for (const r of logRows ?? []) {
        const s = r.status as keyof Omit<typeof oneOffStats, 'total'>
        if (s in oneOffStats) oneOffStats[s]++
        oneOffStats.total++
      }
    }
  }

  // ── Funnel-specifieke data ───────────────────────────────────────────────────
  let steps:        any[]                                                = []
  let templates:    any[]                                                = []
  let totalRuns     = 0
  let activeRuns    = 0
  let completedRuns = 0
  // stepId → { pending, sent, failed, total }
  const stepStatsMap = new Map<string, { pending: number; sent: number; failed: number; total: number }>()

  if (!isOneOff) {
    const [stepsRes, tplRes, totalRes, activeRes, completedRes] = await Promise.all([
      supabase
        .from('campaign_steps')
        .select('id, step_order, delay_hours, delay_days, subject, preview_text, status, send_condition, template_id, templates(name)')
        .eq('campaign_id', id)
        .order('step_order'),
      supabase.from('templates').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('campaign_runs').select('*', { count: 'exact', head: true }).eq('campaign_id', id),
      supabase.from('campaign_runs').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'active'),
      supabase.from('campaign_runs').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'completed'),
    ])
    steps         = stepsRes.data ?? []
    templates     = tplRes.data ?? []
    totalRuns     = totalRes.count ?? 0
    activeRuns    = activeRes.count ?? 0
    completedRuns = completedRes.count ?? 0

    // Mail-log statistieken per stap (één query voor alle stappen)
    if (steps.length > 0) {
      const { data: logRows } = await supabase
        .from('mail_logs')
        .select('campaign_step_id, status')
        .in('campaign_step_id', steps.map((s: any) => s.id))

      for (const row of logRows ?? []) {
        const st = stepStatsMap.get(row.campaign_step_id) ?? { pending: 0, sent: 0, failed: 0, total: 0 }
        if (row.status === 'pending') st.pending++
        else if (row.status === 'sent')    st.sent++
        else if (row.status === 'failed')  st.failed++
        st.total++
        stepStatsMap.set(row.campaign_step_id, st)
      }
    }
  }

  // ── Validatiecheck: campagne klaar voor verzending? ──────────────────────────
  const isReadyToSend = isOneOff && !!(
    campaign.subject &&
    campaign.template_id &&
    campaign.audience_type &&
    (campaign.audience_group_id || campaign.audience_segment_id)
  )

  // ── Bound actions ───────────────────────────────────────────────────────────
  const readyFn        = markCampaignReady.bind(null, id)
  const sendFn         = sendCampaign.bind(null, id)
  const toDraftFn      = setCampaignStatus.bind(null, id, 'draft')
  const pauseFn        = setCampaignStatus.bind(null, id, 'paused')
  const resumeFn       = setCampaignStatus.bind(null, id, 'ready')
  const cancelFn       = setCampaignStatus.bind(null, id, 'cancelled')
  const archiveFn      = setCampaignStatus.bind(null, id, 'archived')
  const activateFn     = activateFunnelCampaign.bind(null, id)
  const deleteFn       = deleteCampaign.bind(null, id)
  const addStepFn      = addCampaignStep.bind(null, id)
  const triggerBatchFn = triggerBatch.bind(null, id)
  const testMailFn     = sendTestMailAction.bind(null, id)
  const testModeFn     = setTestMode.bind(null, id)

  const displaySample = audience?.contacts.slice(0, 50) ?? []
  const allContacts   = audience?.contacts ?? []
  const rawCount      = (audience?.total ?? 0) + (audience?.excluded ?? 0)

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/campaigns" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Campagnes
        </Link>
        <Link
          href={`/campaigns/${id}/report`}
          className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Rapport
        </Link>
      </div>

      {/* Foutbanner (via redirect ?error=) */}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Infobanner (via redirect ?info=) */}
      {info && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {decodeURIComponent(info)}
        </div>
      )}

      {/* Header */}
      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-zinc-900">{campaign.name}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isOneOff ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
            }`}>
              {isOneOff ? 'Eenmalig' : 'Funnel'}
            </span>
          </div>
          {campaign.description && (
            <p className="mt-1 text-sm text-zinc-500 max-w-xl">{campaign.description}</p>
          )}
          <p className="mt-1 text-xs text-zinc-400">
            Van: <span className="font-medium">{campaign.from_name}</span> &lt;{campaign.from_email}&gt;
            {campaign.reply_to_email && (
              <span className="ml-2">· Reply-to: {campaign.reply_to_email}</span>
            )}
          </p>
        </div>

        {/* Acties */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Bewerken — altijd beschikbaar tenzij verzonden */}
          {!['sending', 'completed'].includes(campaign.status) && (
            <Link
              href={`/campaigns/${id}/edit`}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Bewerken
            </Link>
          )}

          {/* ONE-OFF statusacties */}
          {isOneOff && (
            <>
              {campaign.status === 'draft' && (
                <form action={readyFn}>
                  <button
                    type="submit"
                    disabled={!isReadyToSend}
                    title={!isReadyToSend ? 'Vul onderwerpregel, template en doelgroep in' : undefined}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Klaarzetten voor verzending
                  </button>
                </form>
              )}

              {['ready', 'scheduled'].includes(campaign.status) && !campaign.sent_at && (
                <SendButton
                  action={sendFn}
                  recipientCount={audience?.total ?? 0}
                  isAdmin={isAdmin}
                />
              )}

              {campaign.sent_at && (
                <span className="text-xs text-zinc-500 tabular-nums">
                  Verstuurd op {new Date(campaign.sent_at).toLocaleString('nl-NL')}
                </span>
              )}

              {['ready', 'scheduled'].includes(campaign.status) && (
                <form action={toDraftFn}>
                  <button className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                    Terug naar concept
                  </button>
                </form>
              )}

              {['ready', 'scheduled', 'draft'].includes(campaign.status) && (
                <form action={cancelFn}>
                  <button className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                    Annuleren
                  </button>
                </form>
              )}

              {campaign.status === 'sending' && (
                <>
                  {oneOffStats.pending > 0 && (
                    <form action={triggerBatchFn}>
                      <button className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
                        Verwerk wachtrij
                        <span className="rounded-full bg-indigo-500 px-1.5 text-xs">
                          {oneOffStats.pending}
                        </span>
                      </button>
                    </form>
                  )}
                  <form action={pauseFn}>
                    <button className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 transition-colors">
                      Pauzeren
                    </button>
                  </form>
                </>
              )}

              {campaign.status === 'paused' && (
                <form action={resumeFn}>
                  <button className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                    Hervatten
                  </button>
                </form>
              )}
            </>
          )}

          {/* FUNNEL statusacties */}
          {!isOneOff && (
            <>
              {!['active', 'archived'].includes(campaign.status) && (
                <form action={activateFn}>
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                    Activeren
                  </button>
                </form>
              )}
              {campaign.status === 'active' && (
                <form action={pauseFn}>
                  <button className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 transition-colors">
                    Pauzeren
                  </button>
                </form>
              )}
              {campaign.status === 'paused' && (
                <form action={activateFn}>
                  <button className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                    Hervatten
                  </button>
                </form>
              )}
              {campaign.status !== 'archived' && (
                <form action={archiveFn}>
                  <button className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                    Archiveren
                  </button>
                </form>
              )}
            </>
          )}

          {/* Verwijderen — altijd behalve verzenden */}
          {campaign.status !== 'sending' && (
            <form action={deleteFn}>
              <button className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Verwijderen
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ONE-OFF: Detailweergave
      ══════════════════════════════════════════════════════════════ */}
      {isOneOff && (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* Linkerkolom: instellingen + stats */}
          <div className="space-y-5">

            {/* Verzendstatus + mail-stats */}
            {campaign.sent_at && (
              <div className={`rounded-xl border p-5 space-y-3 ${
                campaign.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
              }`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {campaign.status === 'completed' ? 'Verzending voltooid' : 'Verzending bezig'}
                </p>
                <p className="text-sm text-zinc-700">
                  Gestart op {new Date(campaign.sent_at).toLocaleString('nl-NL')}
                </p>
                {campaign.recipient_count != null && (
                  <p className="text-sm font-semibold text-zinc-900">
                    {campaign.recipient_count.toLocaleString('nl-NL')} ontvangers
                  </p>
                )}
                {oneOffStats.total > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-black/10">
                    <div>
                      <p className="text-xs text-zinc-500">Verzonden</p>
                      <p className="text-sm font-semibold text-green-800">{oneOffStats.sent.toLocaleString('nl-NL')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Wachtrij</p>
                      <p className="text-sm font-semibold text-amber-800">{oneOffStats.pending.toLocaleString('nl-NL')}</p>
                    </div>
                    {oneOffStats.failed > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500">Mislukt</p>
                        <p className="text-sm font-semibold text-red-700">{oneOffStats.failed.toLocaleString('nl-NL')}</p>
                      </div>
                    )}
                    {oneOffStats.skipped > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500">Overgeslagen</p>
                        <p className="text-sm font-semibold text-zinc-500">{oneOffStats.skipped.toLocaleString('nl-NL')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Testmail-formulier */}
            {isOneOff && campaign.template_id && !campaign.sent_at && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-zinc-700 mb-3">Testmail versturen</h2>
                <form action={testMailFn} className="flex gap-2">
                  <input
                    name="test_email"
                    type="email"
                    required
                    placeholder="naam@voorbeeld.nl"
                    className="flex-1 min-w-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Verstuur test
                  </button>
                </form>
                <p className="mt-1.5 text-xs text-zinc-400">
                  Verstuurt met voorbeelddata — wordt niet gelogd.
                </p>
              </div>
            )}

            {/* Validatiewaarschuwingen (concept) */}
            {campaign.status === 'draft' && !isReadyToSend && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">Vereist voor verzending</p>
                <ul className="space-y-1 text-xs text-amber-700">
                  {!campaign.subject      && <li>· Onderwerpregel ontbreekt</li>}
                  {!campaign.template_id  && <li>· Template niet geselecteerd</li>}
                  {(!campaign.audience_type || (!campaign.audience_group_id && !campaign.audience_segment_id)) && (
                    <li>· Doelgroep niet geselecteerd</li>
                  )}
                </ul>
              </div>
            )}

            {/* E-mailinstellingen */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-700">E-mailinstellingen</h2>
              {campaign.subject ? (
                <div>
                  <p className="text-xs text-zinc-400">Onderwerpregel</p>
                  <p className="text-sm font-medium text-zinc-900">{campaign.subject}</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">Nog geen onderwerpregel</p>
              )}
              {campaign.preview_text && (
                <div>
                  <p className="text-xs text-zinc-400">Preview-tekst</p>
                  <p className="text-sm text-zinc-700">{campaign.preview_text}</p>
                </div>
              )}
              {templateName ? (
                <div>
                  <p className="text-xs text-zinc-400">Template</p>
                  <p className="text-sm font-medium text-zinc-900">{templateName}</p>
                  {templateSubject && (
                    <p className="text-xs text-zinc-400">{templateSubject}</p>
                  )}
                </div>
              ) : campaign.template_id ? (
                <p className="text-xs text-zinc-400 italic">Template niet gevonden</p>
              ) : (
                <p className="text-xs text-zinc-400 italic">Geen template geselecteerd</p>
              )}
              <div className="flex gap-3 text-xs text-zinc-500 pt-1">
                <span className={campaign.track_opens ? 'text-green-700' : 'line-through'}>Opens</span>
                <span className={campaign.track_clicks ? 'text-green-700' : 'line-through'}>Klikken</span>
              </div>
            </div>

            {/* Doelgroep */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-700">Doelgroep</h2>
              {campaign.audience_type ? (
                <>
                  <div>
                    <p className="text-xs text-zinc-400">
                      {campaign.audience_type === 'group' ? 'Lijst / groep' : 'Segment'}
                    </p>
                    <p className="text-sm font-medium text-zinc-900">{audienceName || '—'}</p>
                  </div>
                  {audience && (
                    <div className="space-y-2 border-t border-zinc-100 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-600">Contacten in doelgroep</span>
                        <span className="tabular-nums font-medium text-zinc-900">
                          {rawCount.toLocaleString('nl-NL')}
                        </span>
                      </div>
                      {audience.excluded > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">Uitgesloten (opt-out/bounce)</span>
                          <span className="tabular-nums text-red-500">{audience.excluded.toLocaleString('nl-NL')}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-zinc-700">Leverbaar</span>
                        <span className="tabular-nums text-green-700">{audience.total.toLocaleString('nl-NL')}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-400 italic">Geen doelgroep geselecteerd</p>
              )}
            </div>

            {/* Verzending */}
            {(campaign.planned_send_at || campaign.batch_size > 0) && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                <h2 className="text-sm font-semibold text-zinc-700">Verzending</h2>
                {campaign.planned_send_at && (
                  <div>
                    <p className="text-xs text-zinc-400">Geplande datum</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {new Date(campaign.planned_send_at).toLocaleString('nl-NL')}
                    </p>
                  </div>
                )}
                {campaign.batch_size > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400">Batchgrootte</p>
                    <p className="text-sm font-medium text-zinc-900">
                      {campaign.batch_size.toLocaleString('nl-NL')} per run
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rechterkolom: doelgroeppreview */}
          <div className="lg:col-span-2">
            {/* Waarschuwing uitgesloten contacten */}
            {audience && audience.excluded > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="font-medium">
                    {audience.excluded.toLocaleString('nl-NL')} contact{audience.excluded !== 1 ? 'en' : ''} uitgesloten
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Uitgeschreven, afgemeld of gemarkeerd als bounce — worden niet verzonden.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-700">
                Doelgroeppreview
                {allContacts.length > 50 && (
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    (eerste 50 van {allContacts.length.toLocaleString('nl-NL')})
                  </span>
                )}
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Leverbaar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {displaySample.length === 0 && !audience && (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-sm text-zinc-400">
                        Selecteer een doelgroep om de preview te zien.
                      </td>
                    </tr>
                  )}
                  {displaySample.length === 0 && audience && (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-sm text-zinc-400">
                        Geen leverbare contacten in de geselecteerde doelgroep.
                      </td>
                    </tr>
                  )}
                  {displaySample.map((c: Contact) => {
                    const name        = [c.first_name, c.last_name].filter(Boolean).join(' ')
                    const deliverable = isDeliverable(c)
                    return (
                      <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/contacts/${c.id}`}
                            className="font-mono text-xs text-zinc-700 hover:underline"
                          >
                            {c.email}
                          </Link>
                          {name && <p className="mt-0.5 text-xs text-zinc-400">{name}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <ContactStatusBadge status={c.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          {deliverable ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Leverbaar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              Uitgesloten
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FUNNEL: Statistieken + stappenbeheer
      ══════════════════════════════════════════════════════════════ */}
      {!isOneOff && (
        <>
          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-3">
            {[
              { label: 'Ingeschreven',  value: totalRuns,     color: 'text-zinc-900' },
              { label: 'Actief',        value: activeRuns,    color: 'text-blue-700' },
              { label: 'Voltooid',      value: completedRuns, color: 'text-green-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>
                  {value.toLocaleString('nl-NL')}
                </p>
              </div>
            ))}
          </div>

          {/* Testmodus */}
          <div className="mt-6 max-w-sm">
            <TestModeForm
              testMode={campaign.test_mode ?? false}
              testDelayMinutes={campaign.test_delay_minutes ?? 5}
              action={testModeFn}
            />
          </div>

          {/* Stappenoverzicht */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Funnel-stappen</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Worden in volgorde uitgevoerd na inschrijving.
                </p>
              </div>
              <span className="text-xs text-zinc-400">
                {steps.length} stap{steps.length !== 1 ? 'pen' : ''}
              </span>
            </div>

            <div className="space-y-0">
              {steps.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-10 text-center">
                  <p className="text-sm text-zinc-400">Nog geen stappen — voeg er hieronder een toe.</p>
                </div>
              )}
              {steps.map((step: any, idx: number) => {
                const removeFn  = removeCampaignStep.bind(null, id, step.id)
                const processFn = processFunnelStep.bind(null, id, step.id)
                const pauseFn   = setStepStatus.bind(null, id, step.id, 'paused')
                const resumeFn  = setStepStatus.bind(null, id, step.id, 'active')
                const tpl       = step.templates as { name: string } | null
                const isLast    = idx === steps.length - 1
                const stats     = stepStatsMap.get(step.id)
                const isPaused  = step.status === 'paused'

                const condLabel: Record<string, string> = {
                  always:              '',
                  opened_previous:     'Als vorige geopend',
                  not_opened_previous: 'Als vorige niet geopend',
                  clicked_previous:    'Als geklikt in vorige',
                }
                const cond = (step.send_condition as any)?.type
                const condText = cond && cond !== 'always' ? condLabel[cond] : null

                return (
                  <div key={step.id}>
                    <div className={`group rounded-xl border bg-white px-5 py-4 transition-colors ${
                      isPaused ? 'border-yellow-200 opacity-70' : 'border-zinc-200 hover:border-zinc-300'
                    }`}>
                      <div className="flex items-start gap-4">
                        {/* Stap-nummer cirkel */}
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                          isPaused
                            ? 'border-yellow-300 bg-yellow-50 text-yellow-600'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                        }`}>
                          {step.step_order}
                        </div>

                        {/* Inhoud */}
                        <div className="flex-1 min-w-0">
                          {/* Onderwerpregel */}
                          <p className="font-medium text-zinc-900 leading-snug">
                            {step.subject ?? (
                              <span className="italic text-amber-600 font-normal">Onderwerpregel ontbreekt</span>
                            )}
                          </p>

                          {/* Template + vertraging + conditie */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                            <span>
                              {tpl?.name ?? <span className="italic text-red-400">(verwijderd template)</span>}
                            </span>
                            <span>·</span>
                            <span>{delayLabel(step.delay_hours ?? 0, step.delay_days ?? 0)}</span>
                            {condText && (
                              <>
                                <span>·</span>
                                <span className="text-indigo-500">{condText}</span>
                              </>
                            )}
                            {isPaused && (
                              <>
                                <span>·</span>
                                <span className="font-medium text-yellow-600">Gepauzeerd</span>
                              </>
                            )}
                          </div>

                          {/* Preview-tekst */}
                          {step.preview_text && (
                            <p className="mt-1 text-xs text-zinc-400 italic truncate">{step.preview_text}</p>
                          )}

                          {/* Delivery stats */}
                          {stats && stats.total > 0 && (
                            <div className="mt-2 flex items-center gap-3 text-xs">
                              {stats.sent > 0 && (
                                <span className="inline-flex items-center gap-1 text-green-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                  {stats.sent.toLocaleString('nl-NL')} verzonden
                                </span>
                              )}
                              {stats.pending > 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                  {stats.pending.toLocaleString('nl-NL')} wachtrij
                                </span>
                              )}
                              {stats.failed > 0 && (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                  {stats.failed.toLocaleString('nl-NL')} mislukt
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Acties (zichtbaar bij hover) */}
                        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Verwerk stap */}
                          {campaign.status === 'active' && !isPaused && (
                            <form action={processFn}>
                              <button
                                type="submit"
                                className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                                title="Klaarstaan contacten in wachtrij zetten"
                              >
                                Verwerken
                              </button>
                            </form>
                          )}

                          {/* Pauzeren / hervatten */}
                          {isPaused ? (
                            <form action={resumeFn}>
                              <button className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors">
                                Hervatten
                              </button>
                            </form>
                          ) : (
                            <form action={pauseFn}>
                              <button className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors">
                                Pauzeren
                              </button>
                            </form>
                          )}

                          <Link
                            href={`/campaigns/${id}/steps/${step.id}/edit`}
                            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 transition-colors"
                          >
                            Bewerken
                          </Link>
                          <form action={removeFn}>
                            <button className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                              Verwijderen
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                    {!isLast && (
                      <div className="flex justify-center py-1">
                        <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Stap toevoegen */}
            <form action={addStepFn} className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white p-5 space-y-4">
              <p className="text-sm font-medium text-zinc-700">Stap toevoegen</p>

              {/* Rij 1: template + vertraging */}
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Template <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="template_id"
                    required
                    className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="">Kies een template…</option>
                    {templates.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Dagen</label>
                  <input
                    name="delay_days" type="number" min={0} defaultValue={0}
                    className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Uren</label>
                  <input
                    name="delay_hours" type="number" min={0} max={23} defaultValue={0}
                    className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Rij 2: onderwerpregel + preview-tekst */}
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-52">
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                    Onderwerpregel <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="subject"
                    type="text"
                    required
                    placeholder="Bijv. Welkom bij Nomad For Life!"
                    className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1 min-w-52">
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Preview-tekst</label>
                  <input
                    name="preview_text"
                    type="text"
                    placeholder="Preheader (optioneel)…"
                    className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
                >
                  Stap toevoegen
                </button>
              </div>

              {templates.length === 0 && (
                <p className="text-xs text-amber-600">
                  Geen templates beschikbaar.{' '}
                  <Link href="/templates/new" className="underline">Maak er eerst een aan.</Link>
                </p>
              )}
            </form>
          </div>
        </>
      )}

      {/* Footer-links */}
      <div className="mt-8 flex items-center gap-6 text-sm border-t border-zinc-200 pt-6">
        <Link href={`/logs?campaign_id=${id}`} className="text-zinc-500 hover:text-zinc-900 transition-colors">
          Verzendbeheer →
        </Link>
      </div>
    </div>
  )
}

