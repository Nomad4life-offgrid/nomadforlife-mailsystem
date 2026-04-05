import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeChain, makeMockClient, makeFormData } from '../helpers/mockSupabase'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  createCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
  addCampaignStep,
  removeCampaignStep,
} from '@/app/(admin)/campaigns/actions'

const CAMPAIGN_ID = 'campaign-uuid-1'
const STEP_ID     = 'step-uuid-1'
const TEMPLATE_ID = 'template-uuid-1'

// ── Campaign CRUD ─────────────────────────────────────────────────────────────

describe('createCampaign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a campaign and redirects to its detail page', async () => {
    const campaignsChain = makeChain({ data: { id: CAMPAIGN_ID }, error: null })
    campaignsChain['insert'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['select'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['single'] = vi.fn().mockResolvedValue({ data: { id: CAMPAIGN_ID }, error: null })

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      name:        'Welcome Series',
      description: 'Onboarding flow',
      from_email:  'hello@nomadforlife.com',
      from_name:   'Nomad For Life',
    })

    const { redirect } = await import('next/navigation')
    await expect(createCampaign(null, fd)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith(`/campaigns/${CAMPAIGN_ID}`)
  })

  it('inserts with correct field values', async () => {
    const campaignsChain = makeChain({ data: { id: CAMPAIGN_ID }, error: null })
    campaignsChain['insert'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['select'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['single'] = vi.fn().mockResolvedValue({ data: { id: CAMPAIGN_ID }, error: null })

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      name:        'Test Campaign',
      description: '',
      from_email:  'test@test.com',
      from_name:   'Test Sender',
    })

    await expect(createCampaign(null, fd)).rejects.toThrow('NEXT_REDIRECT')

    expect(campaignsChain['insert']).toHaveBeenCalledWith(expect.objectContaining({
      name:       'Test Campaign',
      from_email: 'test@test.com',
      from_name:  'Test Sender',
    }))
  })

  it('stores null for empty description', async () => {
    const campaignsChain = makeChain({ data: { id: CAMPAIGN_ID }, error: null })
    campaignsChain['insert'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['select'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['single'] = vi.fn().mockResolvedValue({ data: { id: CAMPAIGN_ID }, error: null })

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ name: 'X', description: '', from_email: 'x@x.com', from_name: 'X' })
    await expect(createCampaign(null, fd)).rejects.toThrow('NEXT_REDIRECT')

    const insertPayload = (campaignsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.description).toBeNull()
  })

  it('returns error message when Supabase returns an error', async () => {
    const campaignsChain = makeChain({ data: null, error: { message: 'duplicate key' } })
    campaignsChain['insert'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['select'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: { message: 'duplicate key' } })

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ name: 'X', description: '', from_email: 'x@x.com', from_name: 'X' })
    const result = await createCampaign(null, fd)
    expect(result?.message).toBe('duplicate key')
  })
})

describe('updateCampaign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates the correct campaign by id', async () => {
    const campaignsChain = makeChain({ data: { status: 'draft' }, error: null })
    campaignsChain['select']      = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['update']      = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['eq']          = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['is']          = vi.fn().mockResolvedValue({ data: null, error: null })
    campaignsChain['maybeSingle'] = vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null })

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({
      name:        'Updated Name',
      description: 'New desc',
      from_email:  'new@x.com',
      from_name:   'New Sender',
    })
    await expect(updateCampaign(CAMPAIGN_ID, null, fd)).rejects.toThrow('NEXT_REDIRECT')
  })
})

// ── Campaign status ───────────────────────────────────────────────────────────

describe('setCampaignStatus — campaign run lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  const statuses = ['active', 'paused', 'archived', 'draft'] as const

  for (const status of statuses) {
    it(`transitions campaign to "${status}"`, async () => {
      const campaignsChain = makeChain({ data: null, error: null })
      campaignsChain['update'] = vi.fn().mockReturnValue(campaignsChain)
      campaignsChain['eq']     = vi.fn().mockResolvedValue({ data: null, error: null })

      const client = makeMockClient({ campaigns: campaignsChain })
      vi.mocked(createServiceClient).mockReturnValue(client as never)

      await setCampaignStatus(CAMPAIGN_ID, status)

      expect(campaignsChain['update']).toHaveBeenCalledWith({ status })
      expect(campaignsChain['eq']).toHaveBeenCalledWith('id', CAMPAIGN_ID)
    })
  }

  it('throws when Supabase returns an error', async () => {
    const campaignsChain = makeChain({ data: null, error: { message: 'row not found' } })
    campaignsChain['update'] = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['eq']     = vi.fn().mockResolvedValue({ data: null, error: { message: 'row not found' } })

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    await expect(setCampaignStatus('nonexistent', 'active')).rejects.toThrow('row not found')
  })
})

describe('deleteCampaign', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes the campaign and redirects to /campaigns', async () => {
    const campaignsChain = makeChain({ data: { status: 'draft' }, error: null })
    campaignsChain['select']      = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['update']      = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['eq']          = vi.fn().mockReturnValue(campaignsChain)
    campaignsChain['maybeSingle'] = vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null })

    // Laatste eq-aanroep (voor de update) resolvet zonder error
    const updateChain = makeChain({ data: null, error: null })
    updateChain['eq']  = vi.fn().mockResolvedValue({ data: null, error: null })
    campaignsChain['update'] = vi.fn().mockReturnValue(updateChain)

    const client = makeMockClient({ campaigns: campaignsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const { redirect } = await import('next/navigation')
    await expect(deleteCampaign(CAMPAIGN_ID)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/campaigns')
  })
})

// ── Funnel steps ──────────────────────────────────────────────────────────────

describe('addCampaignStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('auto-increments step_order based on existing highest', async () => {
    const stepsChain = makeChain({ data: { step_order: 2 }, error: null })
    stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
    stepsChain['order']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['limit']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['single'] = vi.fn().mockResolvedValue({ data: { step_order: 2 }, error: null })
    stepsChain['insert'] = vi.fn().mockResolvedValue({ data: null, error: null })

    const client = makeMockClient({ campaign_steps: stepsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ template_id: TEMPLATE_ID, delay_hours: '24' })
    await addCampaignStep(CAMPAIGN_ID, fd)

    const insertPayload = (stepsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.step_order).toBe(3)  // existing max = 2, next = 3
  })

  it('sets step_order to 1 when no steps exist yet', async () => {
    const stepsChain = makeChain({ data: null, error: null })
    stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
    stepsChain['order']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['limit']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })  // no existing
    stepsChain['insert'] = vi.fn().mockResolvedValue({ data: null, error: null })

    const client = makeMockClient({ campaign_steps: stepsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ template_id: TEMPLATE_ID, delay_hours: '0' })
    await addCampaignStep(CAMPAIGN_ID, fd)

    const insertPayload = (stepsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.step_order).toBe(1)
  })

  it('stores delay_hours as a number', async () => {
    const stepsChain = makeChain({ data: null, error: null })
    stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
    stepsChain['order']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['limit']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })
    stepsChain['insert'] = vi.fn().mockResolvedValue({ data: null, error: null })

    const client = makeMockClient({ campaign_steps: stepsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ template_id: TEMPLATE_ID, delay_hours: '48' })
    await addCampaignStep(CAMPAIGN_ID, fd)

    const payload = (stepsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(typeof payload.delay_hours).toBe('number')
    expect(payload.delay_hours).toBe(48)
  })

  it('associates step with correct campaign_id and template_id', async () => {
    const stepsChain = makeChain({ data: null, error: null })
    stepsChain['select'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockReturnValue(stepsChain)
    stepsChain['order']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['limit']  = vi.fn().mockReturnValue(stepsChain)
    stepsChain['single'] = vi.fn().mockResolvedValue({ data: null, error: null })
    stepsChain['insert'] = vi.fn().mockResolvedValue({ data: null, error: null })

    const client = makeMockClient({ campaign_steps: stepsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    const fd = makeFormData({ template_id: TEMPLATE_ID, delay_hours: '0' })
    await addCampaignStep(CAMPAIGN_ID, fd)

    const payload = (stepsChain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(payload.campaign_id).toBe(CAMPAIGN_ID)
    expect(payload.template_id).toBe(TEMPLATE_ID)
  })
})

describe('removeCampaignStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the step by id', async () => {
    const stepsChain = makeChain({ data: null, error: null })
    stepsChain['delete'] = vi.fn().mockReturnValue(stepsChain)
    stepsChain['eq']     = vi.fn().mockResolvedValue({ data: null, error: null })

    const client = makeMockClient({ campaign_steps: stepsChain })
    vi.mocked(createServiceClient).mockReturnValue(client as never)

    await removeCampaignStep(CAMPAIGN_ID, STEP_ID)

    expect(stepsChain['delete']).toHaveBeenCalled()
    expect(stepsChain['eq']).toHaveBeenCalledWith('id', STEP_ID)
  })
})
