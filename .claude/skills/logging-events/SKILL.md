---
name: logging-events
description: Stelt een vaste structuur vast voor het loggen van verzend- en interactie-events.
---

Gebruik deze skill voor alle mail- en campagne-events.

Log minimaal:

- queued
- sent
- delivered
- opened
- clicked
- failed
- bounced
- unsubscribed

Gebruik bij voorkeur een tabel zoals:

- mail_events

Aanbevolen velden:

- id
- contact_id
- campaign_id
- campaign_step_id
- event_type
- event_timestamp
- provider
- provider_message_id
- metadata

Belangrijke regels:

- events moeten herleidbaar zijn naar campagne en contact
- logging moet bruikbaar zijn voor dashboard, support en debugging
- metadata moet compact maar bruikbaar blijven
- eventstructuur moet voorbereid zijn op webhooks