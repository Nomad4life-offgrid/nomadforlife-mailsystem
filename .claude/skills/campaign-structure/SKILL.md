---
name: campaign-structure
description: Ontwerpt de basisstructuur van campagnes, stappen, runs en bijbehorende tabellen voor het mailsysteem.
---

Gebruik deze skill wanneer een campagne-architectuur, datamodel of workflow voor e-mailcampagnes moet worden opgezet.

Werk altijd vanuit een structuur met:

- campaigns
- campaign_steps
- campaign_targets
- campaign_runs
- campaign_logs

Elke campagne moet meerdere stappen kunnen bevatten, zoals:

1. eerste mail
2. follow-up mail
3. reminder mail

Belangrijke regels:

- campagnes zijn statusgestuurd
- stappen hebben een vaste volgorde
- elke stap kan een eigen template en subject hebben
- runs moeten los staan van campagneconfiguratie
- logging moet per run en per contact mogelijk zijn

Aanbevolen velden:

campaigns
- id
- name
- description
- status
- created_at
- updated_at

campaign_steps
- id
- campaign_id
- step_order
- delay_hours
- template_id
- subject
- created_at

campaign_runs
- id
- campaign_id
- started_at
- finished_at
- status

Gebruik altijd een schaalbare opzet waarbij latere uitbreiding naar extra funnelstappen mogelijk blijft.