import { z } from 'zod'

export const CONTACT_TYPES = ['camping','sponsor','adverteerder','lid','partner','prospect','overig'] as const
export const CONTACT_SOURCES = ['manual','import','api','website','admin'] as const

export const ContactSchema = z.object({
  email:        z.string().email('Ongeldig e-mailadres'),
  first_name:   z.string().max(100).nullish(),
  last_name:    z.string().max(100).nullish(),
  company:      z.string().max(200).nullish(),
  phone:        z.string().max(30).nullish(),
  contact_type: z.enum(CONTACT_TYPES).nullish(),
  source:       z.enum(CONTACT_SOURCES).default('admin'),
  notes:        z.string().max(5000).nullish(),
  tags:         z.array(z.string()).default([]),
})

export const UpdateContactSchema = ContactSchema.partial().extend({
  email: z.string().email('Ongeldig e-mailadres').optional(),
})

export type ContactInput       = z.infer<typeof ContactSchema>
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>
