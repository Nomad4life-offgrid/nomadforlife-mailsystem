---
name: supabase-crud
description: Standaard werkwijze voor CRUD-acties, query-opzet en server-side dataverwerking in Supabase.
---

Gebruik deze skill voor create, read, update en delete logica in Supabase.

Werk met:

- duidelijke tabelnamen
- voorspelbare querystructuren
- server-side database-acties
- foutafhandeling per query
- timestamps op relevante records

Gebruik waar logisch tabellen zoals:

- contacts
- campaigns
- campaign_steps
- templates
- campaign_runs
- mail_logs
- unsubscribe_events

Richtlijnen:

- gebruik inserts voor nieuwe records
- gebruik updates voor statuswijzigingen
- gebruik selects met expliciete velden
- vermijd onnodig brede queries
- log belangrijke mutaties voor beheer en debugging

Denk steeds aan:

- performance
- dataconsistentie
- uitbreidbaarheid
- veilige server-side uitvoering