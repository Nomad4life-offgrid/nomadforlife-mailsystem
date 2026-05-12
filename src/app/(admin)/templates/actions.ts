'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { validateTemplateHtml, htmlToText } from '@/lib/email/renderer'
import { requireAdmin, requireEditor } from '@/lib/auth/guards'

/**
 * Subject-veld moet platte tekst zijn — strip HTML en flatten whitespace.
 * Admins kunnen per ongeluk styled HTML plakken (bv. uit de body-editor);
 * we schonen dat server-side op zodat e-mailclients altijd een nette
 * onderwerpregel tonen.
 */
function cleanSubject(raw: string): string {
  return htmlToText(raw).replace(/\s+/g, ' ').trim()
}


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
    subject:      cleanSubject(formData.get('subject') as string),
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
      subject:      cleanSubject(formData.get('subject') as string),
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

export async function sendTemplateTestMail(formData: FormData) {
  await requireEditor()
  const htmlBody  = formData.get('html_body')  as string
  const subject   = (formData.get('subject') as string) || 'Testmail template'
  const TEST_TO   = 'hello@nomad4life.com'

  const { sendEmail } = await import('@/lib/email/sendgrid')
  const { renderEmail } = await import('@/lib/email/renderer')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nomadforlife-mailsystem.vercel.app'

  const { html, text } = renderEmail({
    htmlBody:       htmlBody,
    textBody:       null,
    contact:        { first_name: 'Test', last_name: 'Gebruiker', email: TEST_TO },
    campaignName:   'Template preview',
    companyName:    'Nomad For Life',
    unsubscribeUrl: `${appUrl}/unsubscribe/preview`,
  })

  await sendEmail({
    to:                   TEST_TO,
    subject:              `[TEST] ${subject}`,
    html,
    text,
    from_email:           process.env.DEFAULT_FROM_EMAIL ?? 'info@nomad4life.com',
    from_name:            process.env.DEFAULT_FROM_NAME  ?? 'Nomad For Life',
    unsubscribe_url:      `${appUrl}/unsubscribe/preview`,
    unsubscribe_post_url: `${appUrl}/api/unsubscribe`,
  })
}

export async function deleteTemplate(id: string) {
  await requireAdmin()
  const supabase = createServiceClient()

  // campaign_steps.template_id is NOT NULL + ON DELETE RESTRICT. We cascaden
  // dus expliciet: alle funnel-stappen die deze template gebruiken worden
  // verwijderd (mail_logs naar die stappen cascaden mee via ON DELETE CASCADE).
  const { data: usedSteps, error: stepErr } = await supabase
    .from('campaign_steps')
    .select('id, campaigns(name)')
    .eq('template_id', id)

  if (stepErr) {
    redirect(`/templates?error=${encodeURIComponent('Kon template-gebruik niet controleren: ' + stepErr.message)}`)
  }

  let removedSteps = 0
  let campaignNames: string[] = []

  if (usedSteps && usedSteps.length > 0) {
    removedSteps = usedSteps.length
    campaignNames = Array.from(
      new Set(
        usedSteps
          .map((s) => (s.campaigns as unknown as { name?: string } | null)?.name)
          .filter(Boolean) as string[],
      ),
    )

    const stepIds = usedSteps.map((s) => s.id)
    const { error: delStepsErr } = await supabase
      .from('campaign_steps')
      .delete()
      .in('id', stepIds)
    if (delStepsErr) {
      redirect(`/templates?error=${encodeURIComponent('Funnel-stappen verwijderen mislukt: ' + delStepsErr.message)}`)
    }
  }

  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) {
    redirect(`/templates?error=${encodeURIComponent('Verwijderen mislukt: ' + error.message)}`)
  }

  revalidatePath('/templates')

  if (removedSteps > 0) {
    const detail = campaignNames.length > 0 ? ` uit campagne${campaignNames.length === 1 ? '' : 's'} ${campaignNames.join(', ')}` : ''
    redirect(`/templates?info=${encodeURIComponent(`Template verwijderd. ${removedSteps} funnel-stap${removedSteps === 1 ? '' : 'pen'}${detail} en bijbehorende verzendlogs zijn meegewist.`)}`)
  }
  redirect('/templates')
}
