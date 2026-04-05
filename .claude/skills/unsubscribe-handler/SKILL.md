---
name: unsubscribe-handler
description: Standaard handlerlogica voor unsubscribe-links, statusupdates en stopzetten van vervolgstappen.
---

Gebruik deze skill voor alle unsubscribe-verwerking.

De unsubscribe handler moet:

1. contact identificeren
2. contact als uitgeschreven markeren
3. unsubscribed_at vullen
4. actieve funnelstappen blokkeren
5. unsubscribe event loggen

Aanbevolen unsubscribe route:

- /unsubscribe?id=...

Belangrijke regels:

- unsubscribe moet direct effect hebben
- vervolgverzending moet direct stoppen
- route moet veilig omgaan met ongeldige of verlopen identifiers
- gebruiker moet een duidelijke bevestiging zien

Denk ook aan:

- logging
- foutafhandeling
- gebruiksvriendelijke bevestigingspagina