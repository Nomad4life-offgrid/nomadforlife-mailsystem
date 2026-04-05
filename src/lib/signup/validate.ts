/**
 * SubscribeDTO — validatieschema voor POST /api/public/subscribe
 *
 * Velden:
 *   email       — verplicht, geldig e-mailadres
 *   first_name  — optioneel, max 100 tekens
 *   last_name   — optioneel, max 100 tekens
 *   group_id    — optioneel UUID van een contact_group om de inschrijver aan toe te voegen
 *   form_source — optioneel tag die bijhoudt via welk formulier/pagina de aanmelding kwam
 *                 (bijv. 'homepage_footer', 'campingpagina', 'popup')
 *                 Wordt opgeslagen in metadata — niet in de source-kolom van contacts.
 */

import { z } from 'zod'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const SubscribeDTOSchema = z.object({
  email: z
    .string()
    .min(1, 'E-mailadres is verplicht.')
    .trim()
    .toLowerCase()
    .email('Ongeldig e-mailadres.'),

  first_name: z
    .string()
    .trim()
    .max(100, 'Voornaam mag maximaal 100 tekens bevatten.')
    .optional(),

  last_name: z
    .string()
    .trim()
    .max(100, 'Achternaam mag maximaal 100 tekens bevatten.')
    .optional(),

  group_id: z
    .string()
    .regex(UUID_RE, 'group_id moet een geldig UUID zijn.')
    .optional(),

  form_source: z
    .string()
    .trim()
    .max(100, 'form_source mag maximaal 100 tekens bevatten.')
    .optional(),
})

export type SubscribeDTO = z.infer<typeof SubscribeDTOSchema>

export type SubscribeValidationError = {
  field: string
  message: string
}

export function validateSubscribeDTO(raw: unknown): {
  data:   SubscribeDTO | null
  errors: SubscribeValidationError[]
} {
  const result = SubscribeDTOSchema.safeParse(raw)

  if (result.success) {
    return { data: result.data, errors: [] }
  }

  const errors: SubscribeValidationError[] = result.error.issues.map(e => ({
    field:   e.path.join('.') || 'unknown',
    message: e.message,
  }))

  return { data: null, errors }
}
