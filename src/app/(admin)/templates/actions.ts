'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { validateTemplateHtml } from '@/lib/email/renderer'
import { requireAdmin, requireEditor } from '@/lib/auth/guards'


export async function createTemplate(formData: FormData) {
  await requireEditor()
  const htmlBody = formData.get('html_body') as string

  const validationErrors = validateTemplateHtml(htmlBody)
  if (validationErrors.length > 0) {
    redirect(`/templates/new?error=${encodeURIComponent(validationErrors[0])}`)
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('templates').insert({
    name:         formData.get('name')         as string,
    subject:      formData.get('subject')      as string,
    preview_text: (formData.get('preview_text') as string) || null,
    html_body:    htmlBody,
    text_body:    (formData.get('text_body')   as string) || null,
    category:     (formData.get('category')    as string) || 'general',
  })
  if (error) redirect(`/templates/new?error=${encodeURIComponent(error.message)}`)
  redirect('/templates')
}

export async function updateTemplate(id: string, formData: FormData) {
  await requireEditor()
  const htmlBody = formData.get('html_body') as string

  const validationErrors = validateTemplateHtml(htmlBody)
  if (validationErrors.length > 0) {
    redirect(`/templates/${id}/edit?error=${encodeURIComponent(validationErrors[0])}`)
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('templates')
    .update({
      name:         formData.get('name')         as string,
      subject:      formData.get('subject')      as string,
      preview_text: (formData.get('preview_text') as string) || null,
      html_body:    htmlBody,
      text_body:    (formData.get('text_body')   as string) || null,
      category:     (formData.get('category')    as string) || 'general',
    })
    .eq('id', id)
  if (error) redirect(`/templates/${id}/edit?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/templates')
  redirect('/templates')
}

export async function deleteTemplate(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  // Ontkoppel eerst campaign_steps die naar deze template verwijzen
  const { error: unlinkErr } = await supabase
    .from('campaign_steps')
    .update({ template_id: null })
    .eq('template_id', id)
  if (unlinkErr) throw new Error(unlinkErr.message)

  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/templates')
}
