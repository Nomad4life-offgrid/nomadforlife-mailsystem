---
name: sendgrid-sender
description: Geeft vaste werkinstructies voor mailverzending via SendGrid inclusief batches, retries en logging.
---

Gebruik deze skill voor alle SendGrid-verzendlogica.

Werk met de volgende uitgangspunten:

- verzenden via SendGrid API
- maximaal 100 mails per batch
- retries bij tijdelijke fouten
- logging van succes en failure
- elke commerciële mail bevat een unsubscribe link

Log altijd minimaal deze events:

- queued
- sent
- failed
- bounced
- opened
- clicked
- unsubscribed

Vaste principes:

- gebruik server-side secrets
- stuur geen mails direct vanuit onveilige clientlogica
- gebruik duidelijke payloadstructuren
- valideer e-mailadres en verplichte velden voor verzending
- behandel SendGrid responsecodes expliciet

Aanbevolen verzendvelden:

- to
- subject
- html
- text
- from_email
- from_name
- unsubscribe_url

Werk production-ready en houd rekening met deliverability.