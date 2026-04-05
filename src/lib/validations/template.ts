import { z } from 'zod'

export const TemplateSchema = z.object({
  name:         z.string().min(1, 'Naam is verplicht').max(200),
  subject:      z.string().min(1, 'Onderwerp is verplicht').max(500),
  preview_text: z.string().max(200).nullish(),
  html_body:    z.string().min(1, 'HTML-inhoud is verplicht'),
  text_body:    z.string().nullish(),
  category:     z.enum(['general', 'onboarding', 'followup', 'newsletter', 'transactional']).default('general'),
})

export const UpdateTemplateSchema = TemplateSchema.partial()

export type TemplateInput       = z.infer<typeof TemplateSchema>
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>
