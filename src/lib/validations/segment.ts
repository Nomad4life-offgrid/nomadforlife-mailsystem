import { z } from 'zod'

// ── Segment filter rules ───────────────────────────────────────────────────────

const SegmentConditionSchema = z.object({
  field: z.string().min(1),
  op:    z.enum(['eq', 'neq', 'contains', 'not_contains', 'gte', 'lte', 'is_null', 'is_not_null']),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

const SegmentFilterSchema = z.object({
  operator:   z.enum(['AND', 'OR']),
  conditions: z.array(SegmentConditionSchema).min(1, 'Minimaal één conditie vereist'),
})

export const SegmentSchema = z.object({
  name:        z.string().min(1, 'Naam is verplicht').max(200),
  description: z.string().max(1000).nullish(),
  filter_json: SegmentFilterSchema,
})

export const UpdateSegmentSchema = SegmentSchema.partial()

export type SegmentInput       = z.infer<typeof SegmentSchema>
export type UpdateSegmentInput = z.infer<typeof UpdateSegmentSchema>

// ── Contact group (statische lijst) ──────────────────────────────────────────

export const GroupSchema = z.object({
  name:        z.string().min(1, 'Naam is verplicht').max(200),
  description: z.string().max(1000).nullish(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ongeldig kleurformaat').default('#71717a'),
  list_type:   z.enum(['group', 'list']).default('group'),
})

export const UpdateGroupSchema = GroupSchema.partial().extend({
  name: z.string().min(1, 'Naam is verplicht').max(200),
})

export type GroupInput       = z.infer<typeof GroupSchema>
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>
