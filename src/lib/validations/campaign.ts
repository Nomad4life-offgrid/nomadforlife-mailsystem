import { z } from 'zod'

// ── Campaign ──────────────────────────────────────────────────────────────────

export const CampaignSchema = z.object({
  name:                 z.string().min(1, 'Naam is verplicht').max(200),
  description:          z.string().max(1000).nullish().transform((v) => v ?? null),
  campaign_type:        z.enum(['one_off', 'funnel']).default('one_off'),
  // Afzender
  from_email:           z.string().email('Ongeldig afzenderadres'),
  from_name:            z.string().min(1, 'Naam afzender is verplicht').max(100),
  reply_to:             z.string().email('Ongeldig reply-to adres').nullish().transform((v) => v || null),
  // Tracking
  track_opens:          z.boolean().default(true),
  track_clicks:         z.boolean().default(true),
  // E-mail (one_off)
  subject:              z.string().max(500).nullish().transform((v) => v || null),
  preview_text:         z.string().max(200).nullish().transform((v) => v || null),
  // Template (one_off)
  template_id:          z.string().uuid('Ongeldig template').nullish().transform((v) => v || null),
  // Doelgroep (one_off)
  audience_type:        z.enum(['group', 'segment']).nullish().transform((v) => v || null),
  audience_group_id:    z.string().nullish().transform((v) => {
    if (!v) return null
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return UUID_RE.test(v) ? v : null
  }),
  audience_segment_id:  z.string().nullish().transform((v) => {
    if (!v) return null
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return UUID_RE.test(v) ? v : null
  }),
  // Verzending (one_off)
  planned_send_at:      z.string().nullish().transform((v) => v || null),
  batch_size:           z.coerce.number().int().min(0).default(0),
})

export const UpdateCampaignSchema = CampaignSchema.partial().omit({ campaign_type: true })

// ── Campaign Steps ────────────────────────────────────────────────────────────

export const CampaignStepSchema = z.object({
  template_id:      z.string().uuid('Ongeldig template ID'),
  delay_days:       z.coerce.number().int().min(0).default(0),
  delay_hours:      z.coerce.number().int().min(0).max(23).default(0),
  subject_override: z.string().max(500).nullish(),
})

// ── Exports ───────────────────────────────────────────────────────────────────

export type CampaignInput       = z.infer<typeof CampaignSchema>
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>
export type CampaignStepInput   = z.infer<typeof CampaignStepSchema>
