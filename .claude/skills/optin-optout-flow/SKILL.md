---
name: optin-optout-flow
description: Legt de standaard flow vast voor inschrijven, bevestigen, uitschrijven en statusupdates van contacten.
---

Gebruik deze skill voor alle inschrijf- en uitschrijfprocessen.

De opt-in flow moet deze stappen kunnen ondersteunen:

1. contact wordt aangemaakt
2. opt-in status wordt vastgelegd
3. eventueel bevestigingsstap
4. contact wordt actief voor campagnes

De opt-out flow moet deze stappen ondersteunen:

1. unsubscribe link wordt geopend
2. contact wordt gemarkeerd als uitgeschreven
3. unsubscribed_at wordt gevuld
4. actieve campagnes slaan dit contact over
5. unsubscribe event wordt gelogd

Aanbevolen contactvelden:

- id
- email
- first_name
- last_name
- opted_in
- opted_in_at
- unsubscribed_at
- status
- created_at
- updated_at

Belangrijke regels:

- opt-out moet direct effect hebben
- uitgeschreven contacten mogen geen vervolgmails ontvangen
- consent en status moeten controleerbaar blijven
- unsubscribe links moeten veilig en eenduidig zijn