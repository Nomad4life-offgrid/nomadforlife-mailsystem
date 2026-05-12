---
name: safe-auto-approve
description: Automatisch goedkeuren behalve bij risicovolle wijzigingen
---

Gedrag:

Sta automatisch toe:
- code wijzigingen binnen bestaande files
- refactors zonder deletions
- nieuwe functies
- styling wijzigingen
- comments
- logging
- tests
- kleine config updates

Vraag ALLEEN bevestiging bij:
- verwijderen van bestanden
- database schema wijzigingen
- .env wijzigingen
- auth wijzigingen
- deployment configs
- package.json dependency removals
- migrations
- production urls
- secrets / keys
- filesystem deletes
- recursive changes

Als wijziging veilig is:
- voer direct uit
- geen confirm vraag
- geen YES knop nodig

Als onveilig:
- vraag expliciet confirm
- leg kort risico uit