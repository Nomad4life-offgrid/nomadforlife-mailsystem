import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeChain, makeMockClient, makeFormData, captureInserts } from '../helpers/mockSupabase'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { subscribeContacts } from '@/app/(admin)/send/actions'

// ── Helpers ──────────────────────────────────────────────────────────────────

const CAMPAIGN_ID   = 'campaign-uuid-1'
const CONTACT_ID    = 'contact-uuid-1'
const RUN_ID        = 'run-uuid-1'
const STEP_ID_1     = 'step-uuid-1'
const STEP_ID_2     = 'step-uuid-2'
const TEMPLATE_ID   = 'template-uuid-1'

/** Two campaign steps: step 1 immediate, step 2 after 24 h */
const steps = [
  { id: STEP_ID_1, step_order: 1, delay_hours: 0  },
  { id: STEP_ID_2, step_order: 2, delay_hours: 24 },
]

function makeClient(overrides: {
  contactResult?: unknown
  runResult?: unknown
} = {}) {
  const contactsChain  = makeChain(overrides.contactResult ?? { data: null, error: null })
  const stepsChain     = makeChain({ data: steps, error: null })
  const runsChain      = makeChain(overrides.runResult ?? { data: { id: RUN_ID }, error: null })
  const mailLogsChain  = makeChain({ data: null, error: null })

  // contacts: select chain resolves, insert chain resolves
  contactsChain['select'] = vi.fn().mockReturnValue(contactsChain)
  contactsChain['eq']     = vi.fn().mockReturnValue(contactsChain)
  contactsChain['single'] = vi.fn().mockResolvedValue(overrides.contactResult ?? { data: null, error: null })

  // stepsChain select returns an array (not single)
  stepsChain['select']  = vi.fn().mockReturnValue(stepsChain)
  stepsChain['eq']      = vi.fn().mockReturnValue(stepsChain)
  stepsChain['order']   = vi.fn().mockResolvedValue({ data: steps, error: null })

  // runsChain: upsert → select → single
  runsChain['upsert']  = vi.fn().mockReturnValue(runsChain)
  runsChain['select']  = vi.fn().mockReturnValue(runsChain)
  runsChain['single']  = vi.fn().mockResolvedValue(overrides.runResult ?? { data: { id: RUN_ID }, error: null })

  return {
    client: makeMockClient({
      contacts:       contactsChain,
      campaign_steps: stepsChain,
      campaign_runs:  runsChain,
      mail_logs:      mailLogsChain,
    }),
    mailLogsChain,
    contactsChain,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('subscribeContacts — signup flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when campaign_id is missing', async () => {
    const { client } = makeClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: '', emails: 'a@b.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('Campaign and at least one email are required.')
  })

  it('throws when emails list is empty', async () => {
    const { client } = makeClient()
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: '   \n  ' })
    await expect(subscribeContacts(fd)).rejects.toThrow('Campaign and at least one email are required.')
  })

  it('creates a new contact when email is not found', async () => {
    // contacts.single() → null (not found) → insert creates it
    const { client, contactsChain } = makeClient({
      contactResult: { data: null, error: null },
    })

    // After not found, insert should return the new contact id
    contactsChain['insert'] = vi.fn().mockReturnValue(contactsChain)
    contactsChain['select'] = vi.fn().mockReturnValue(contactsChain)
    contactsChain['single'] = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })         // first call: lookup
      .mockResolvedValueOnce({ data: { id: CONTACT_ID }, error: null }) // second: insert

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'new@example.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT') // success → redirect
  })

  it('reuses existing contact without re-inserting', async () => {
    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
    })

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'existing@example.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    // insert should NOT have been called on contacts
    expect(contactsChain['insert']).not.toHaveBeenCalled()
  })

  it('skips globally opted-out contacts', async () => {
    const optedOut = { id: CONTACT_ID, global_opt_out: true }
    const { client, mailLogsChain } = makeClient({
      contactResult: { data: optedOut, error: null },
    })

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'optout@example.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    // No mail_logs should have been created
    expect(mailLogsChain['insert']).not.toHaveBeenCalled()
  })

  it('skips duplicate subscription (already in campaign)', async () => {
    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, mailLogsChain, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
      // upsert with ignoreDuplicates returns null when row already exists
      runResult: { data: null, error: null },
    })

    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'dup@example.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(mailLogsChain['insert']).not.toHaveBeenCalled()
  })

  it('redirects to /logs on success', async () => {
    const { redirect } = await import('next/navigation')
    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'ok@example.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/logs')
  })
})

describe('subscribeContacts — batch verzending', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses emails separated by newlines', async () => {
    const { client, contactsChain } = makeClient({
      contactResult: { data: null, error: null },
    })
    contactsChain['single'] = vi.fn()
      .mockResolvedValue({ data: null, error: null })   // not found
    contactsChain['insert'] = vi.fn().mockReturnValue(contactsChain)

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      campaign_id: CAMPAIGN_ID,
      emails: 'a@x.com\nb@x.com\nc@x.com',
    })

    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    // from('contacts') was called once per email (3 lookups)
    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls
      .filter(([t]: [string]) => t === 'contacts')
    expect(fromCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('parses emails separated by commas and semicolons', async () => {
    const { client, contactsChain } = makeClient({
      contactResult: { data: null, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })
    contactsChain['insert'] = vi.fn().mockReturnValue(contactsChain)

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      campaign_id: CAMPAIGN_ID,
      emails: 'x@a.com,y@a.com;z@a.com',
    })

    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls
      .filter(([t]: [string]) => t === 'contacts')
    expect(fromCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('normalises email addresses to lowercase', async () => {
    const { client, contactsChain } = makeClient({
      contactResult: { data: null, error: null },
    })

    const insertedEmails: string[] = []
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })
    contactsChain['insert'] = vi.fn().mockImplementation((payload: { email: string }) => {
      insertedEmails.push(payload.email)
      return contactsChain
    })

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      campaign_id: CAMPAIGN_ID,
      emails: 'UPPER@Example.COM',
    })

    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')
    expect(insertedEmails[0]).toBe('upper@example.com')
  })

  it('filters out blank lines and whitespace-only entries', async () => {
    const { client, contactsChain } = makeClient({
      contactResult: { data: null, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })
    contactsChain['insert'] = vi.fn().mockReturnValue(contactsChain)

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      campaign_id: CAMPAIGN_ID,
      emails: '\n  \nvalid@x.com\n  \n',
    })

    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const contactFromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls
      .filter(([t]: [string]) => t === 'contacts')
    // 1 valid email → 1 lookup + 1 insert attempt = max 2 contacts calls, not 3+
    expect(contactFromCalls.length).toBeLessThanOrEqual(2)
  })
})

describe('subscribeContacts — followup mails scheduling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates one mail_log per campaign step', async () => {
    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, mailLogsChain, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
      runResult: { data: { id: RUN_ID }, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })

    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'ok@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    // 2 steps → 2 mail_log inserts
    expect(mailLogsChain['insert']).toHaveBeenCalledTimes(2)
  })

  it('schedules step 1 immediately (delay_hours = 0)', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, mailLogsChain, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
      runResult:     { data: { id: RUN_ID }, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'ok@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const firstCall  = (mailLogsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const scheduledAt = new Date(firstCall.scheduled_at).getTime()

    // Step 1: delay_hours=0 → scheduled_at ≈ now
    expect(scheduledAt).toBe(now)
  })

  it('schedules step 2 with cumulative 24 h delay', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, mailLogsChain, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
      runResult:     { data: { id: RUN_ID }, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'ok@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const secondCall  = (mailLogsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[1][0]
    const scheduledAt = new Date(secondCall.scheduled_at).getTime()

    const expected = now + 24 * 60 * 60 * 1000
    expect(scheduledAt).toBe(expected)
  })

  it('sets correct campaign_run_id and campaign_step_id on each mail_log', async () => {
    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const { client, mailLogsChain, contactsChain } = makeClient({
      contactResult: { data: existingContact, error: null },
      runResult:     { data: { id: RUN_ID }, error: null },
    })
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'ok@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    const insertCalls = (mailLogsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls
    // status is intentionally absent — the DB default handles 'pending'
    expect(insertCalls[0][0]).toMatchObject({
      campaign_run_id:  RUN_ID,
      campaign_step_id: STEP_ID_1,
      contact_id:       CONTACT_ID,
    })
    expect(insertCalls[0][0]).not.toHaveProperty('status')
    expect(insertCalls[1][0]).toMatchObject({
      campaign_run_id:  RUN_ID,
      campaign_step_id: STEP_ID_2,
      contact_id:       CONTACT_ID,
    })
  })

  it('does not schedule any mail_logs when campaign has no steps', async () => {
    const existingContact = { id: CONTACT_ID, global_opt_out: false }
    const stepsChain  = makeChain({ data: null, error: null })
    stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
    stepsChain['order']  = vi.fn().mockResolvedValue({ data: [], error: null }) // empty steps

    const contactsChain = makeChain({ data: existingContact, error: null })
    contactsChain['select'] = vi.fn().mockReturnValue(contactsChain)
    contactsChain['eq']     = vi.fn().mockReturnValue(contactsChain)
    contactsChain['single'] = vi.fn().mockResolvedValue({ data: existingContact, error: null })

    const runsChain = makeChain({ data: { id: RUN_ID }, error: null })
    runsChain['upsert']  = vi.fn().mockReturnValue(runsChain)
    runsChain['select']  = vi.fn().mockReturnValue(runsChain)
    runsChain['single']  = vi.fn().mockResolvedValue({ data: { id: RUN_ID }, error: null })

    const mailLogsChain = makeChain({ data: null, error: null })

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

    const fd = makeFormData({ campaign_id: CAMPAIGN_ID, emails: 'ok@x.com' })
    await expect(subscribeContacts(fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(mailLogsChain['insert']).not.toHaveBeenCalled()
  })
})
