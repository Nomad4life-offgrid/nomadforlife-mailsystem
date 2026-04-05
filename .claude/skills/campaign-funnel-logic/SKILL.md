---
name: campaign-funnel-logic
description: Definieert de logica voor funnelstappen, wachttijden, vervolgmails en uitsluitingsregels.
---

Gebruik deze skill voor alle funnel- en follow-up logica.

Voorbeeldflow:

- mail 1
- wacht 2 dagen
- mail 2
- wacht 5 dagen
- mail 3

Belangrijke regels:

- elke stap heeft een volgorde
- elke stap heeft een delay
- alleen doorgaan naar volgende stap als contact nog geldig is
- sla een stap over als contact uitgeschreven is
- sla een stap over als business rule dat vereist

Mogelijke skip-condities:

- unsubscribed
- bounced
- invalid_email
- already_replied
- manually_excluded

Werk altijd met logische statusovergangen en controleer vóór elke volgende funnelstap opnieuw of verzending nog is toegestaan.