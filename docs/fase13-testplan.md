# Fase 13 — Testplan & Kwaliteitscheck

Versie 1.0 · Nomad For Life Mailsysteem

---

## 1. Smoke test checklist

Voer deze tests uit na elke deployment of database-reset. Ze dekken de kritieke paden af en mogen nooit falen.

### Authenticatie & autorisatie

- [ ] `/login` — pagina laadt zonder fout
- [ ] Inloggen met geldig admin-account → redirect naar `/dashboard`
- [ ] Inloggen met ongeldig wachtwoord → foutmelding zichtbaar, geen redirect
- [ ] Direct navigeren naar `/dashboard` zonder sessie → redirect naar `/login`
- [ ] Direct navigeren naar `/settings/users` als editor → `404` (notFound)
- [ ] Uitloggen via UserMenu → sessie weg, redirect naar `/login`
- [ ] Rolbadge in sidebar zichtbaar na inloggen

### Dashboard

- [ ] `/dashboard` laadt met contacttellingen (actief, opted-in, opt-out)
- [ ] Recente activiteit toont ten minste de seed-logs
- [ ] Campagne-statistieken tonen verzonden/open/klik-getallen

### Contacten

- [ ] `/contacts` laadt en toont seed-contacten
- [ ] Zoekfunctie filtert op naam en e-mail
- [ ] Contactpagina `/contacts/[id]` toont details + consent history
- [ ] Nieuw contact aanmaken via `/contacts/new` → verschijnt in lijst
- [ ] Contact bewerken → wijziging zichtbaar
- [ ] Contact archiveren (admin only) → verdwijnt uit actieve lijst
- [ ] Bounced contact zichtbaar met bounce-badge
- [ ] Pending contact (Kees Oud) zichtbaar met pending-status

### Templates

- [ ] `/templates` toont seed-templates inclusief "Basis e-mailtemplate"
- [ ] Template aanmaken → opgeslagen en zichtbaar
- [ ] Template bewerken → wijziging bewaard
- [ ] Template preview (`/templates/[id]/preview`) laadt zonder fout
- [ ] Template verwijderen (admin only) → verdwenen uit lijst

### Segmenten & lijsten

- [ ] `/segments` toont groepen én dynamische segmenten
- [ ] Groep aanmaken en contact toevoegen
- [ ] Dynamisch segment aanmaken met filter → preview count berekend
- [ ] Segment bewerken → filter en count bijgewerkt

### Campagnes

- [ ] `/campaigns` toont alle seed-campagnes
- [ ] Nieuwe funnel-campagne aanmaken
- [ ] Funnel-stap toevoegen met template, delay, subject
- [ ] Campagne markeren als ready
- [ ] SendButton is zichtbaar voor admin, geblokkeerd voor editor
- [ ] Campagne-detailpagina toont stappen en status

### Verzenden

- [ ] `/send` laadt groepen en segmenten als doelgroep
- [ ] Contact inschrijven op campagne (editor mag dit niet — test unauthorized)
- [ ] Admin kan campagne starten

### Logs & consent

- [ ] `/logs` toont mail log entries uit seed
- [ ] `/consent` toont consent log entries
- [ ] Consent history per contact correct op contactpagina

### Settings

- [ ] `/settings` toont alle env-variabelen (met masking)
- [ ] `/settings/users` zichtbaar voor admin, `404` voor editor
- [ ] Rol toewijzen via dropdown → gewijzigd na opslaan
- [ ] Rol intrekken → "Geen toegang" badge

### Publieke API

- [ ] `POST /api/public/subscribe` met geldig e-mailadres → `201` + opt_in_token aangemaakt
- [ ] Herhalen met zelfde e-mail (pending) → `200` (confirmation_resent)
- [ ] Herhalen met actief contact → `200` (already_active)
- [ ] Ongeldige payload (geen e-mail) → `422`
- [ ] Meer dan 5 verzoeken per 10 min van zelfde IP → `429` met `Retry-After`
- [ ] `OPTIONS` pre-flight → `204` met CORS-headers

### Opt-in & unsubscribe

- [ ] `/optin/dev-test-optin-token-kees-oud-0000000000000001` → contact wordt actief
- [ ] Zelfde token nogmaals → foutmelding (token al gebruikt)
- [ ] Verlopen/onbekend token → foutmelding
- [ ] `/unsubscribe/dev-test-unsub-token-afgemeld-000000000000001` → al gebruikt, juiste melding

---

## 2. Handmatige testscenario's

### Scenario A — Nieuwe camping registreert via website

1. Stuur `POST /api/public/subscribe` met `{ email: "nieuw@camping.nl", first_name: "Anna", group_id: "<campings-groep-id>" }`
2. Controleer: contact aangemaakt met status `pending` in `/contacts`
3. Controleer: opt_in_token record aangemaakt in Supabase
4. Open de opt-in URL uit de e-mail (of gebruik Supabase SQL editor om het token op te zoeken)
5. Controleer: contact status wijzigt naar `active`, `opted_in = true`
6. Controleer: consent_logs bevat `opt_in` én `opt_in_confirmed` events
7. Schrijf het contact in op de funnel-campagne via `/send`
8. Controleer: campaign_run aangemaakt, stap-1 mail log in queue

### Scenario B — Admin stuurt eenmalige campagne

1. Zorg dat campagne "Campings prospectmailing mei 2026" status `ready` heeft
2. Login als admin
3. Ga naar de campagnepagina en klik "Versturen"
4. Controleer: status wijzigt naar `sending` → `completed`
5. Controleer: mail_logs aangemaakt voor elk contact in de doelgroep
6. Controleer: `sent_at` gevuld op de campagne zelf (verzendbeveiliging actief)
7. Probeer opnieuw te klikken op Versturen → moet geblokkeerd zijn

### Scenario C — Editor mag niet versturen

1. Login als editor (wijs tijdelijk editor-rol toe via `/settings/users`)
2. Navigeer naar een campagne met status `ready`
3. Controleer: SendButton toont "(admin only)" en is uitgeschakeld
4. Probeer via de browser console direct de server action aan te roepen
5. Controleer: `requireAdmin()` gooit een redirect naar `/dashboard?error=...`

### Scenario D — Contact meldt zich af via link

1. Zoek een actief contact op in de database, haal hun unsubscribe-token op
2. Navigeer naar `/unsubscribe/[token]`
3. Controleer: pagina vraagt om bevestiging
4. Bevestig afmelding
5. Controleer: `status = opted_out`, `global_opt_out = true`, `unsubscribed_at` ingevuld
6. Controleer: consent_log `opt_out_global` event aangemaakt
7. Verstuur via queue-job → contact wordt overgeslagen (status = skipped)

### Scenario E — Funnel send_condition werkt correct

De funnel heeft stap 2 ingesteld als `opened_previous`:

1. Drie contacts lopen door de funnel (zie seed: Jan, Maria, Piet)
2. Simuleer dat Jan stap 1 opent (seed doet dit al: `opened_at` ingevuld)
3. Draai de process-queue via `POST /api/internal/process-queue` (met correct `INTERNAL_API_SECRET`)
4. Controleer: Jan ontvangt stap 2 (mail log status = sent/pending met nabij scheduled_at)
5. Controleer: Maria krijgt stap 2 overgeslagen (seed zet al status = skipped)
6. Controleer: Piet volgt normale send_condition logica

### Scenario F — Bounce-afhandeling

1. Controleer dat bounced contact (Hans Hoeve) `bounced_at` én `bounce_type = hard` heeft
2. Ga naar contactpagina → bounce-status zichtbaar
3. Probeer dit contact in te schrijven op een campagne
4. Controleer: het contact wordt uitgesloten van verzending (hard bounce filter)

### Scenario G — Rolbeheer volledig pad

1. Login als admin
2. Ga naar `/settings/users`
3. Wijs `editor`-rol toe aan een tweede gebruiker
4. Log in als die gebruiker → rolbadge "Editor" zichtbaar
5. Editor kan templates en contacten bewerken, maar niet verwijderen
6. Editor kan campagne klaar zetten maar niet versturen
7. Admin intrekt de rol → "Geen toegang" zichtbaar
8. Geprobeerd: admin kan eigen rol niet intrekken → foutmelding

---

## 3. Bekende risico's versie 1

| # | Risico | Ernst | Omschrijving |
|---|--------|-------|--------------|
| R1 | Rate limiting in-memory | Middel | De IP-limiet op `/api/public/subscribe` werkt niet bij meerdere server instances (Vercel serverless). Bij scale-out zijn per-instance counters geïsoleerd. **Oplossing v2:** Redis/Upstash. |
| R2 | Bounce-afhandeling handmatig | Hoog | Hard bounces worden niet automatisch gedetecteerd vanuit SendGrid webhooks. Admins moeten bounces handmatig verwerken. **Risico:** verzending naar bounced adressen kan IP-reputatie schaden. |
| R3 | Geen e-mailvalidatie op leverancierniveau | Middel | De Zod-validatie in `/api/public/subscribe` controleert syntaxis, maar niet of het adres echt bestaat (MX-check). Typo-adressen bereiken de verzendqueue. |
| R4 | Geen queue-monitoring | Middel | Als de cron mislukt (timeout, crash), stapelen pending mails op zonder alert. Stale pending logs zijn niet zichtbaar op het dashboard. |
| R5 | Geen duplicate-campagne beveiliging | Laag | Een contact kan meerdere keren worden ingeschreven als een admin de inschrijfactie herhaalt in een race-condition. De UNIQUE constraint in campaign_runs vangt dit op maar geeft een onvriendelijke databasefout. |
| R6 | Geen e-mailverificatie na registratie | Laag | Admin-accounts worden aangemaakt via Supabase Auth zonder e-mailbevestiging in development. Op productie moet `SUPABASE_AUTH_EMAIL_CONFIRM_REQUIRED = true` gezet worden. |
| R7 | Template-variabelen niet gevalideerd | Laag | Variabelen zoals `{{first_name}}` worden vervangen bij verzending, maar een template met een syntaxfout crasht niet — het verzendt een lege waarde. Geen pre-send preview met echte data. |
| R8 | Geen soft-delete op campaign_runs | Laag | Als een contact wordt gearchiveerd terwijl ze in een actieve funnel zitten, blijven de campaign_runs en mail_logs actief. De planner kan proberen te sturen naar een gearchiveerd contact. |
| R9 | CORS wildcard in development | Laag | `SUBSCRIBE_ALLOWED_ORIGIN=*` in dev/staging is acceptabel. Op productie moet dit worden beperkt tot de exacte origin van de website. |
| R10 | Geen throttling per ontvanger | Middel | Er is geen controle of een contact meerdere actieve funnels tegelijk doorloopt. Een contact kan in theorie per dag meerdere mails ontvangen van verschillende campagnes. |

---

## 4. Voorstel fase 2 verbeteringen

### 4.1 Infrastructuur & betrouwbaarheid

**SendGrid Webhook ingest**
Verwerk delivery events (bounce, spam report, unsubscribe, open, click) van SendGrid webhooks. Vereist:
- `POST /api/webhooks/sendgrid` met signature-verificatie
- Automatisch updaten van `mail_logs.status`, `opened_at`, `clicked_at`
- Hard bounce → `contacts.bounced_at` + `bounce_type` automatisch invullen
- Spam report → contact globaal uitschrijven

**Persistent rate limiting**
Vervang de in-memory rate limiter door Upstash Redis (edge-compatibel). Verwijder de module-level Map, gebruik `@upstash/ratelimit` met sliding window.

**Queue monitoring**
Voeg een dashboard-widget toe voor:
- Aantal pending mails in de queue
- Oldest pending mail (laat stale queue zien)
- Failed mails per uur (grafiek)
- Alert als queue ouder is dan 15 minuten (Slack webhook of e-mail)

### 4.2 Functionaliteit

**E-mail preview met testdata**
Op de template-editpagina: knop "Preview met testcontact" die variabelen vervangt met echte contactdata. Optioneel: "Verstuur testmail naar mezelf" voor realistische inboxtest.

**A/B testing (subjectregels)**
Voeg een `subject_b` kolom toe aan campagnes. Wijs bij verzending 50/50 toe. Track open rate per variant. Rapporteer winnende subject in het campagnerapport.

**Geplande verzending**
Implementeer `planned_send_at` volledig:
- UI-datepicker op campagnepagina
- Queue-worker controleert `planned_send_at <= now()` voor verzending
- Admin kan geplande verzending annuleren

**Contactimport verbeteringen**
- Duplicate-detectie op e-mail bij import (update vs. overslaan)
- Foutrapport downloadbaar als CSV na import
- Ondersteuning voor custom_fields in CSV

**Segmentenuitbreiding**
Huidige segmentfilters werken op contactvelden. Voeg toe:
- Filter op "niet ontvangen campagne X" (voor re-engagement)
- Filter op "geopend in laatste N dagen" (actieve contacten)
- Filter op `contact_type`

### 4.3 Compliance & beveiliging

**AVG-gegevensverwijdering**
Implementeer "Recht op vergetelheid" (art. 17 AVG):
- Admin-knop "Verwijder alle gegevens" op contactpagina
- Anonimiseer e-mail, naam en metadata (vervang door `[VERWIJDERD]`)
- Bewaar consent_logs met geanonimiseerde contactverwijzing (wettelijke bewaartermijn)

**Audit log uitbreiding**
Registreer automatisch admin-acties via een middleware of server action wrapper. Huidige activity_logs worden handmatig ingevuld. Koppel `user_id` aan elk log zodat "wie heeft wat gedaan" altijd herleidbaar is.

**Two-factor authenticatie**
Activeer Supabase Auth TOTP (Google Authenticator) voor admin-accounts. Verplicht voor gebruikers met `admin`-rol.

### 4.4 Gebruikerservaring

**Bulkacties op contacten**
Selecteer meerdere contacten via checkbox → groep toewijzen, tag toevoegen, exporteren als CSV.

**Campagne-klonen**
"Dupliceer campagne" knop maakt een kopie met status `draft` inclusief alle stappen en instellingen.

**Inbox-preview**
Integreer een eenvoudige inline e-mailpreview op de template-editpagina (render HTML in een sandbox iframe met `max-width: 600px`).
