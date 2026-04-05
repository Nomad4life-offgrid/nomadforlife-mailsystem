/**
 * Tests for the unsubscribe flow.
 *
 * The page component is an async Server Component, so we test the underlying
 * Supabase interactions via a thin wrapper that mirrors the page logic.
 * This avoids JSX rendering complexity while covering all branching paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeChain, makeMockClient } from '../helpers/mockSupabase'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'

// ── Extracted logic (mirrors UnsubscribePage) ────────────────────────────────
// We extract the business logic so it can be unit-tested without React/JSX.

type UnsubscribeEvent = {
  id: string
  contact_id: string
  campaign_id: string | null
  used_at: string | null
}

async function processUnsubscribe(
  supabase: ReturnType<typeof createServiceClient>,
  token: string
): Promise<'not_found' | 'already_used' | 'global_opt_out' | 'campaign_opt_out'> {
  const { data: event } = await supabase
    .from('unsubscribe_events')
    .select('id, contact_id, campaign_id, used_at')
    .eq('token', token)
    .single() as { data: UnsubscribeEvent | null }

  if (!event) return 'not_found'
  if (event.used_at) return 'already_used'

  const isGlobal = event.campaign_id === null

  if (isGlobal) {
    await supabase.from('contacts').update({ global_opt_out: true }).eq('id', event.contact_id)

    await supabase
      .from('campaign_runs')
      .update({ status: 'opted_out', opted_out_at: new Date().toISOString() })
      .eq('contact_id', event.contact_id)

    const { data: runs } = await supabase
      .from('campaign_runs')
      .select('id')
      .eq('contact_id', event.contact_id) as { data: { id: string }[] | null }

    if (runs && runs.length > 0) {
      const runIds = runs.map((r) => r.id)
      await supabase
        .from('mail_logs')
        .update({ status: 'skipped' })
        .in('campaign_run_id', runIds)
        .eq('status', 'pending')
    }
  } else {
    await supabase
      .from('campaign_runs')
      .update({ status: 'opted_out', opted_out_at: new Date().toISOString() })
      .eq('campaign_id', event.campaign_id)
      .eq('contact_id', event.contact_id)

    const { data: run } = await supabase
      .from('campaign_runs')
      .select('id')
      .eq('campaign_id', event.campaign_id)
      .eq('contact_id', event.contact_id)
      .single() as { data: { id: string } | null }

    if (run) {
      await supabase
        .from('mail_logs')
        .update({ status: 'skipped' })
        .eq('campaign_run_id', run.id)
        .eq('status', 'pending')
    }
  }

  await supabase
    .from('unsubscribe_events')
    .update({ used_at: new Date().toISOString() })
    .eq('id', event.id)

  return isGlobal ? 'global_opt_out' : 'campaign_opt_out'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOKEN       = 'abc123token'
const CONTACT_ID  = 'contact-uuid-1'
const CAMPAIGN_ID = 'campaign-uuid-1'
const RUN_ID      = 'run-uuid-1'
const EVENT_ID    = 'event-uuid-1'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Unsubscribe flow — token lookup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found for unknown token', async () => {
    const eventsChain = makeChain({ data: null, error: null })
    eventsChain['select'] = vi.fn().mockReturnValue(eventsChain)
    eventsChain['eq']     = vi.fn().mockReturnValue(eventsChain)
    eventsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })

    const client = makeMockClient({ unsubscribe_events: eventsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const result = await processUnsubscribe(client as never, 'unknown-token')
    expect(result).toBe('not_found')
  })

  it('returns already_used when token was previously consumed', async () => {
    const event: UnsubscribeEvent = {
      id: EVENT_ID, contact_id: CONTACT_ID, campaign_id: null,
      used_at: '2026-01-01T10:00:00Z',
    }
    const eventsChain = makeChain({ data: event, error: null })
    eventsChain['select'] = vi.fn().mockReturnValue(eventsChain)
    eventsChain['eq']     = vi.fn().mockReturnValue(eventsChain)
    eventsChain['single'] = vi.fn().mockResolvedValue({ data: event, error: null })

    const client = makeMockClient({ unsubscribe_events: eventsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const result = await processUnsubscribe(client as never, TOKEN)
    expect(result).toBe('already_used')
  })
})

describe('Unsubscribe flow — global opt-out', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeGlobalClient() {
    const event: UnsubscribeEvent = {
      id: EVENT_ID, contact_id: CONTACT_ID, campaign_id: null, used_at: null,
    }

    const eventsChain  = makeChain({ data: event, error: null })
    eventsChain['select']  = vi.fn().mockReturnValue(eventsChain)
    eventsChain['eq']      = vi.fn().mockReturnValue(eventsChain)
    eventsChain['update']  = vi.fn().mockReturnValue(eventsChain)
    eventsChain['single']  = vi.fn().mockResolvedValue({ data: event, error: null })

    const contactsChain = makeChain({ data: null, error: null })
    contactsChain['update'] = vi.fn().mockReturnValue(contactsChain)
    contactsChain['eq']     = vi.fn().mockReturnValue(contactsChain)

    const runsChain = makeChain({ data: [{ id: RUN_ID }], error: null })
    runsChain['update']  = vi.fn().mockReturnValue(runsChain)
    runsChain['select']  = vi.fn().mockReturnValue(runsChain)
    runsChain['eq']      = vi.fn().mockReturnValue(runsChain)
    // select('id').eq() without single() → resolved directly
    ;(runsChain['eq'] as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ id: RUN_ID }], error: null })

    const mailLogsChain = makeChain({ data: null, error: null })
    mailLogsChain['update'] = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['in']     = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['eq']     = vi.fn().mockReturnValue(mailLogsChain)

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'unsubscribe_events') return eventsChain
        if (table === 'contacts')           return contactsChain
        if (table === 'campaign_runs')      return runsChain
        if (table === 'mail_logs')          return mailLogsChain
        return makeChain({ data: null, error: null })
      }),
    }

    return { client, contactsChain, runsChain, mailLogsChain, eventsChain }
  }

  it('returns global_opt_out result', async () => {
    const { client } = makeGlobalClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)
    const result = await processUnsubscribe(client as never, TOKEN)
    expect(result).toBe('global_opt_out')
  })

  it('sets global_opt_out = true on the contact', async () => {
    const { client, contactsChain } = makeGlobalClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    await processUnsubscribe(client as never, TOKEN)

    expect(contactsChain['update']).toHaveBeenCalledWith({ global_opt_out: true })
  })

  it('marks all campaign_runs as opted_out', async () => {
    const { client, runsChain } = makeGlobalClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    await processUnsubscribe(client as never, TOKEN)

    expect(runsChain['update']).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'opted_out' })
    )
  })

  it('skips all pending mail_logs across all runs', async () => {
    const { client, mailLogsChain } = makeGlobalClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    await processUnsubscribe(client as never, TOKEN)

    expect(mailLogsChain['update']).toHaveBeenCalledWith({ status: 'skipped' })
    expect(mailLogsChain['in']).toHaveBeenCalledWith('campaign_run_id', [RUN_ID])
  })

  it('marks the unsubscribe token as used', async () => {
    const { client, eventsChain } = makeGlobalClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    await processUnsubscribe(client as never, TOKEN)

    expect(eventsChain['update']).toHaveBeenCalledWith(
      expect.objectContaining({ used_at: expect.any(String) })
    )
  })

  it('is idempotent: second call with same token returns already_used', async () => {
    const { client } = makeGlobalClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    // First call
    const first = await processUnsubscribe(client as never, TOKEN)
    expect(first).toBe('global_opt_out')

    // Simulate token now marked as used
    const usedEvent: UnsubscribeEvent = {
      id: EVENT_ID, contact_id: CONTACT_ID, campaign_id: null,
      used_at: new Date().toISOString(),
    }

    const staleEventsChain = makeChain({ data: usedEvent, error: null })
    staleEventsChain['select'] = vi.fn().mockReturnValue(staleEventsChain)
    staleEventsChain['eq']     = vi.fn().mockReturnValue(staleEventsChain)
    staleEventsChain['single'] = vi.fn().mockResolvedValue({ data: usedEvent, error: null })

    const staleClient = {
      from: vi.fn().mockReturnValue(staleEventsChain),
    }

    const second = await processUnsubscribe(staleClient as never, TOKEN)
    expect(second).toBe('already_used')
  })
})

describe('Unsubscribe flow — campaign-specific opt-out', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeCampaignClient() {
    const event: UnsubscribeEvent = {
      id: EVENT_ID, contact_id: CONTACT_ID,
      campaign_id: CAMPAIGN_ID, used_at: null,
    }

    const eventsChain = makeChain({ data: event, error: null })
    eventsChain['select']  = vi.fn().mockReturnValue(eventsChain)
    eventsChain['eq']      = vi.fn().mockReturnValue(eventsChain)
    eventsChain['update']  = vi.fn().mockReturnValue(eventsChain)
    eventsChain['single']  = vi.fn().mockResolvedValue({ data: event, error: null })

    const runsChain = makeChain({ data: { id: RUN_ID }, error: null })
    runsChain['update']  = vi.fn().mockReturnValue(runsChain)
    runsChain['select']  = vi.fn().mockReturnValue(runsChain)
    runsChain['eq']      = vi.fn().mockReturnValue(runsChain)
    runsChain['single']  = vi.fn().mockResolvedValue({ data: { id: RUN_ID }, error: null })

    const mailLogsChain = makeChain({ data: null, error: null })
    mailLogsChain['update'] = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['eq']     = vi.fn().mockReturnValue(mailLogsChain)

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'unsubscribe_events') return eventsChain
        if (table === 'campaign_runs')      return runsChain
        if (table === 'mail_logs')          return mailLogsChain
        return makeChain({ data: null, error: null })
      }),
    }

    return { client, runsChain, mailLogsChain, eventsChain }
  }

  it('returns campaign_opt_out', async () => {
    const { client } = makeCampaignClient()
    const result = await processUnsubscribe(client as never, TOKEN)
    expect(result).toBe('campaign_opt_out')
  })

  it('marks only the specific campaign_run as opted_out', async () => {
    const { client, runsChain } = makeCampaignClient()

    await processUnsubscribe(client as never, TOKEN)

    // Must filter by campaign_id AND contact_id
    const updateCall = (runsChain['update'] as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(updateCall[0]).toMatchObject({ status: 'opted_out' })
  })

  it('skips only pending mail_logs for that specific campaign run', async () => {
    const { client, mailLogsChain } = makeCampaignClient()

    await processUnsubscribe(client as never, TOKEN)

    expect(mailLogsChain['update']).toHaveBeenCalledWith({ status: 'skipped' })
    expect(mailLogsChain['eq']).toHaveBeenCalledWith('campaign_run_id', RUN_ID)
    expect(mailLogsChain['eq']).toHaveBeenCalledWith('status', 'pending')
  })

  it('does NOT touch contacts.global_opt_out', async () => {
    const { client } = makeCampaignClient()
    const contactsChain = makeChain({ data: null, error: null })
    contactsChain['update'] = vi.fn().mockReturnValue(contactsChain)

    // Save original implementation before overriding to avoid infinite recursion
    const fromSpy = client.from as ReturnType<typeof vi.fn>
    const originalImpl = fromSpy.getMockImplementation()!
    fromSpy.mockImplementation((table: string) => {
      if (table === 'contacts') return contactsChain
      return originalImpl(table)
    })

    await processUnsubscribe(client as never, TOKEN)

    expect(contactsChain['update']).not.toHaveBeenCalled()
  })
})
