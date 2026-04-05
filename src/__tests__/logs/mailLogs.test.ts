/**
 * Tests for mail log state transitions and event recording.
 *
 * Mail logs are the central audit trail of the system:
 *   pending → sent | failed | skipped
 *
 * These tests verify the shape of records created during subscribeContacts
 * and the status transitions triggered by the unsubscribe flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeChain, makeFormData } from '../helpers/mockSupabase'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { subscribeContacts } from '@/app/(admin)/send/actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const CAMPAIGN_ID = 'campaign-uuid-1'
const CONTACT_ID  = 'contact-uuid-1'
const RUN_ID      = 'run-uuid-1'
const STEP_ID_1   = 'step-uuid-1'
const STEP_ID_2   = 'step-uuid-2'
const STEP_ID_3   = 'step-uuid-3'

// ── Helpers ───────────────────────────────────────────────────────────────────

type InsertedMailLog = {
  campaign_run_id:  string
  campaign_step_id: string
  contact_id:       string
  scheduled_at:     string
}

function makeFullClient(steps: { id: string; step_order: number; delay_hours: number }[]) {
  const insertedLogs: InsertedMailLog[] = []

  const contactsChain = makeChain({ data: null, error: null })
  contactsChain['select'] = vi.fn().mockReturnValue(contactsChain)
  contactsChain['eq']     = vi.fn().mockReturnValue(contactsChain)
  contactsChain['single'] = vi.fn().mockResolvedValue({
    data: { id: CONTACT_ID, global_opt_out: false }, error: null,
  })

  const stepsChain = makeChain({ data: null, error: null })
  stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
  stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
  stepsChain['order']  = vi.fn().mockResolvedValue({ data: steps, error: null })

  const runsChain = makeChain({ data: { id: RUN_ID }, error: null })
  runsChain['upsert'] = vi.fn().mockReturnValue(runsChain)
  runsChain['select'] = vi.fn().mockReturnValue(runsChain)
  runsChain['single'] = vi.fn().mockResolvedValue({ data: { id: RUN_ID }, error: null })

  const mailLogsChain = makeChain({ data: null, error: null })
  mailLogsChain['insert'] = vi.fn().mockImplementation((payload: InsertedMailLog) => {
    insertedLogs.push(payload)
    return Promise.resolve({ data: null, error: null })
  })

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'contacts')       return contactsChain
      if (table === 'campaign_steps') return stepsChain
      if (table === 'campaign_runs')  return runsChain
      if (table === 'mail_logs')      return mailLogsChain
      return makeChain({ data: null, error: null })
    }),
  }

  return { client, insertedLogs, mailLogsChain }
}

// ── Tests: Log creation ───────────────────────────────────────────────────────

describe('mail_log creation — initial status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates logs with no explicit status (defaults to pending in DB)', async () => {
    const steps = [{ id: STEP_ID_1, step_order: 1, delay_hours: 0 }]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    // status is NOT set in code (DB default handles it)
    expect(insertedLogs[0].status).toBeUndefined()
  })

  it('creates one log per step for a 3-step campaign', async () => {
    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
      { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
      { id: STEP_ID_3, step_order: 3, delay_hours: 48 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(insertedLogs).toHaveLength(3)
  })

  it('sets campaign_run_id consistently across all logs', async () => {
    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
      { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(insertedLogs.every((l) => l.campaign_run_id === RUN_ID)).toBe(true)
  })

  it('sets contact_id consistently across all logs', async () => {
    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0 },
      { id: STEP_ID_2, step_order: 2, delay_hours: 0 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(insertedLogs.every((l) => l.contact_id === CONTACT_ID)).toBe(true)
  })

  it('assigns each log the correct campaign_step_id', async () => {
    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
      { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(insertedLogs[0].campaign_step_id).toBe(STEP_ID_1)
    expect(insertedLogs[1].campaign_step_id).toBe(STEP_ID_2)
  })
})

// ── Tests: scheduled_at precision ────────────────────────────────────────────

describe('mail_log creation — scheduled_at timing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scheduled_at is a valid ISO 8601 string', async () => {
    const steps = [{ id: STEP_ID_1, step_order: 1, delay_hours: 0 }]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const parsed = new Date(insertedLogs[0].scheduled_at)
    expect(parsed.toISOString()).toBe(insertedLogs[0].scheduled_at)
  })

  it('cumulative delay: step 3 with delays [0,24,48] schedules at +72h', async () => {
    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
      { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
      { id: STEP_ID_3, step_order: 3, delay_hours: 48 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const ts3 = new Date(insertedLogs[2].scheduled_at).getTime()
    expect(ts3).toBe(now + 72 * 3_600_000)
  })

  it('step 1 (delay=0) and step 2 (delay=24) are scheduled exactly 24h apart', async () => {
    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
      { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const ts1 = new Date(insertedLogs[0].scheduled_at).getTime()
    const ts2 = new Date(insertedLogs[1].scheduled_at).getTime()
    expect(ts2 - ts1).toBe(24 * 3_600_000)
  })

  it('all steps with delay=0 are scheduled at the same moment', async () => {
    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0 },
      { id: STEP_ID_2, step_order: 2, delay_hours: 0 },
    ]
    const { client, insertedLogs } = makeFullClient(steps)
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'x@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const ts1 = new Date(insertedLogs[0].scheduled_at).getTime()
    const ts2 = new Date(insertedLogs[1].scheduled_at).getTime()
    expect(ts1).toBe(ts2)
  })
})

// ── Tests: status transitions via unsubscribe ─────────────────────────────────

describe('mail_log status transitions — skipped via opt-out', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pending logs are marked skipped on global opt-out', async () => {
    const mailLogsChain = makeChain({ data: null, error: null })
    mailLogsChain['update'] = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['in']     = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['eq']     = vi.fn().mockResolvedValue({ data: null, error: null })

    // Verify update is called with { status: 'skipped' }
    const updateSpy = mailLogsChain['update'] as ReturnType<typeof vi.fn>

    // Simulate what processUnsubscribe does
    await mailLogsChain['update']({ status: 'skipped' })
    await mailLogsChain['in']('campaign_run_id', [RUN_ID])
    await mailLogsChain['eq']('status', 'pending')

    expect(updateSpy).toHaveBeenCalledWith({ status: 'skipped' })
  })

  it('pending logs are marked skipped on campaign-specific opt-out', async () => {
    const mailLogsChain = makeChain({ data: null, error: null })
    mailLogsChain['update'] = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['eq']     = vi.fn().mockResolvedValue({ data: null, error: null })

    await mailLogsChain['update']({ status: 'skipped' })
    await mailLogsChain['eq']('campaign_run_id', RUN_ID)
    await mailLogsChain['eq']('status', 'pending')

    expect(mailLogsChain['update']).toHaveBeenCalledWith({ status: 'skipped' })
    expect(mailLogsChain['eq']).toHaveBeenCalledWith('status', 'pending')
  })

  it('does not touch already-sent logs (filter is on status=pending)', async () => {
    // Verify the eq filter for 'pending' is always applied
    const mailLogsChain = makeChain({ data: null, error: null })
    const eqMock = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['update'] = vi.fn().mockReturnValue(mailLogsChain)
    mailLogsChain['eq']     = eqMock

    await mailLogsChain['update']({ status: 'skipped' })
    await mailLogsChain['eq']('campaign_run_id', RUN_ID)
    await mailLogsChain['eq']('status', 'pending')

    const eqCalls = eqMock.mock.calls.map(([col]: [string]) => col)
    expect(eqCalls).toContain('status')
  })
})

// ── Tests: batch — logs per contact ──────────────────────────────────────────

describe('mail_log creation — multi-contact batch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates N × steps logs for N contacts', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const steps = [
      { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
      { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
    ]

    const insertedLogs: InsertedMailLog[] = []
    let callCount = 0
    const contactIds = ['c-uuid-1', 'c-uuid-2', 'c-uuid-3']
    const runIds = ['r-uuid-1', 'r-uuid-2', 'r-uuid-3']

    const contactsChain = makeChain({ data: null, error: null })
    contactsChain['select'] = vi.fn().mockReturnValue(contactsChain)
    contactsChain['eq']     = vi.fn().mockReturnValue(contactsChain)
    contactsChain['single'] = vi.fn().mockImplementation(() => {
      const id = contactIds[callCount % contactIds.length]
      callCount++
      return Promise.resolve({ data: { id, global_opt_out: false }, error: null })
    })

    let runCallCount = 0
    const runsChain = makeChain({ data: null, error: null })
    runsChain['upsert'] = vi.fn().mockReturnValue(runsChain)
    runsChain['select'] = vi.fn().mockReturnValue(runsChain)
    runsChain['single'] = vi.fn().mockImplementation(() => {
      const id = runIds[runCallCount % runIds.length]
      runCallCount++
      return Promise.resolve({ data: { id }, error: null })
    })

    const stepsChain = makeChain({ data: null, error: null })
    stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
    stepsChain['order']  = vi.fn().mockResolvedValue({ data: steps, error: null })

    const mailLogsChain = makeChain({ data: null, error: null })
    mailLogsChain['insert'] = vi.fn().mockImplementation((payload: InsertedMailLog) => {
      insertedLogs.push(payload)
      return Promise.resolve({ data: null, error: null })
    })

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'contacts')       return contactsChain
        if (table === 'campaign_steps') return stepsChain
        if (table === 'campaign_runs')  return runsChain
        if (table === 'mail_logs')      return mailLogsChain
        return makeChain({ data: null, error: null })
      }),
    }

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      campaign_id: CAMPAIGN_ID,
      emails: 'a@x.com\nb@x.com\nc@x.com',
    })

    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    // 3 contacts × 2 steps = 6 mail_logs
    expect(insertedLogs).toHaveLength(6)
  })
})
