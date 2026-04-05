import sgMail from '@sendgrid/mail'
import { sendgrid as sgConfig } from '@/lib/config'

sgMail.setApiKey(sgConfig.apiKey)

export type SendPayload = {
  to: string
  subject: string
  html: string
  text: string
  from_email: string
  from_name: string
  /** URL in the email body — links to the confirmation form page */
  unsubscribe_url: string
  /** URL for RFC 8058 one-click machine POST — points to /api/unsubscribe/[token] */
  unsubscribe_post_url: string
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; retryable: boolean; error: string }

export async function sendEmail(payload: SendPayload): Promise<SendResult> {
  try {
    const [response] = await sgMail.send({
      to: payload.to,
      from: { email: payload.from_email, name: payload.from_name },
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: {
        // RFC 2369: mailto fallback + HTTP one-click URL
        'List-Unsubscribe':      `<${payload.unsubscribe_post_url}>, <${payload.unsubscribe_url}>`,
        // RFC 8058: signals that POST to the first URL processes one-click unsubscribe
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    // 202 Accepted = queued by SendGrid
    if (response.statusCode === 202) {
      const messageId = response.headers['x-message-id'] as string ?? ''
      return { ok: true, messageId }
    }

    return {
      ok: false,
      retryable: response.statusCode >= 500,
      error: `Unexpected status ${response.statusCode}`,
    }
  } catch (err: unknown) {
    const sgErr = err as {
      code?: number
      response?: { body?: { errors?: Array<{ message: string }> } }
      message?: string
    }

    const statusCode = sgErr.code ?? 0
    const detail = sgErr.response?.body?.errors?.[0]?.message ?? sgErr.message ?? 'Unknown error'

    // 4xx = client error, no point retrying (except 429 rate limit)
    const retryable = statusCode === 429 || statusCode >= 500

    return { ok: false, retryable, error: `[${statusCode}] ${detail}` }
  }
}
