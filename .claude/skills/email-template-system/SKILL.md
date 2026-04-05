---
name: email-template-system
description: Standaardiseert de opbouw van e-mailtemplates met subjects, html, tekstversies en variabelen.
---

Gebruik deze skill voor elk templatesysteem binnen het mailsysteem.

Elke template moet minimaal bevatten:

- subject
- html
- text
- created_at
- updated_at

Ondersteun variabelen zoals:

- {{name}}
- {{first_name}}
- {{company}}
- {{unsubscribe}}
- {{campaign_name}}

Belangrijke regels:

- templates moeten herbruikbaar zijn
- html en text-versie moeten logisch samenhangen
- unsubscribe placeholder moet ondersteund worden
- ontbrekende variabelen moeten veilig afgehandeld worden

Werk met een systeem waarin templates gekoppeld kunnen worden aan campaign_steps.

Denk in:

- basis template
- dynamische placeholders
- preview mogelijkheid
- veilige rendering