# Technische Review — Nomad For Life Mailsysteem

Versie 1.0 · Na fase 13 · Datum 2026-04-04

---

## Uitgevoerde fixes (direct doorgevoerd)

| # | Bestand | Probleem | Fix |
|---|---------|---------|-----|
| F1 | `send/actions.ts` | **Bug**: `delay_days` werd volledig genegeerd bij het inplannen van mail_logs. Stappen met `delay_days: 3` werden direct gepland. | Cumulative delay nu `(delay_days * 24 + delay_hours) * ms`. Shared `scheduleMailLogs()` helper extracted. |
| F2 | `mail/processor.ts` | **Bug**: bounced contacten werden niet overgeslagen in de queue-processor. `shouldSkip` checkte `global_opt_out` maar niet `bounced_at`. | `bounced_at !== null` toegevoegd aan skip-guard. `bounced_at` toegevoegd aan SELECT. |
| F3 | `contacts/actions.ts` | Extra `select()` na `insert()` om het nieuwe contact-ID op te halen. INSERT kan direct `.select('id').single()` teruggeven. | Dubbele roundtrip verwijderd. |
| F4 | `lib/consent/log.ts` | `ConsentEventType` en `ConsentChannel` waren dubbel gedefinieerd: ook in `src/types/index.ts`. | `log.ts` importeert nu vanuit `@/types`. |
| F5 | `lib/email/sendgrid.ts` | `process.env.SENDGRID_API_KEY!` gelezen bij module-load, omzeilt `config.ts` validatie. | Gebruikt nu `sgConfig.apiKey` vanuit `@/lib/config`. |
| F6 | `campaigns/actions.ts` | `invalid.map((s: any) => ...)` in `activateFunnelCampaign`. | `any` verwijderd — TypeScript kan het type infereren. |
| F7 | `services/audience.ts` | `(row as any).contacts` cast. | Getypte `{ contacts: Contact \| null }` cast. |
| F8 | `services/funnel.ts` | Twee `as any` casts op query result rows. | Inline typen toegevoegd (`PrevLogRow`). |
| F9 | `mail/processor.ts` | `raw as unknown as LogRow` en `(s: { id: string })` inline types op `.map()`. | `logs as LogRow[]` cast op de iterable, inline types verwijderd. |
| F10 | `api/webhooks/sendgrid/route.ts` | **Security**: geen handtekeningverificatie. Iedereen kon valse events sturen om mail_logs te manipuleren. | ECDSA-SHA256 verificatie toegevoegd via `X-Twilio-Email-Event-Webhook-Signature`. Optioneel via `SENDGRID_WEBHOOK_VERIFICATION_KEY`. |
| F11 | `api/internal/process-queue/route.ts` | Dead `try/catch` wrapper om `req.json().catch(() => ({}))` die al exception-safe was. Body-params niet type-safe gecheckt. | `try/catch` verwijderd. `typeof` guards op body params. |

---

## Concrete verbeterpunten (niet automatisch gefixed)

### Security

**S1 — Middleware controleert geen rol**
`src/middleware.ts` checkt alleen of er een Supabase-sessie is, niet of de gebruiker een rol heeft. Een geauthenticeerde gebruiker zonder rol in `user_roles` kan de volledige admin-UI laden. Pas bij een server action-aanroep volgt de redirect via `requireEditor()`. De UX toont een niet-werkende admin-interface.

*Fix*: In `middleware.ts` een rol-check toevoegen na de sessie-check, of een separate `/no-access` pagina instellen voor gebruikers zonder rol.

**S2 — `SENDGRID_WEBHOOK_VERIFICATION_KEY` is optioneel**
Op productie MOET dit worden ingesteld. Zonder key worden alle requests geaccepteerd. Voeg toe aan de configuratie-checklist in `/settings`.

**S3 — Geen transaction-veiligheid bij unsubscribe**
`lib/unsubscribe/process.ts` en `contacts/actions.ts#optOutContact` doen 4–5 afzonderlijke writes (contact, campaign_runs, mail_logs, unsubscribe_event, consent_log). Als de server crasht halverwege, kan een contact de status `opted_out` hebben maar nog actieve campaign_runs bevatten.

*Fix voor fase 2*: Gebruik een Supabase database functie (stored procedure) of voeg een compensatie-stap toe bij de volgende processor-run die runs controleert voor opted_out contacten.

**S4 — Template-variabelen worden niet gesanitized voor XSS**
`substituteVars()` in `renderer.ts` vervangt `{{variable}}` direct in HTML zonder encoding. Als een contact-veld (bijv. `first_name`) HTML-tekens bevat (`<script>...`), worden die letterlijk in de e-mail-HTML ingevoegd. E-mail wordt niet als HTML-document gerenderd in een browser (dus XSS is irrelevant voor de ontvanger), maar kan wel het e-mail opmaak breken.

*Fix*: HTML-encode variabelen die in de HTML-body worden geïnjecteerd: `firstName.replace(/&/g, '&amp;').replace(/</g, '&lt;')`.

### Type safety

**T1 — Geen gegenereerde Supabase types**
De codebase gebruikt handmatig bijgehouden types in `src/types/index.ts`. Na elke migratie moeten types handmatig worden gesynchroniseerd. Supabase kan types genereren via `supabase gen types typescript`.

*Risico*: als een kolom wordt toegevoegd of hernoemd in de database maar vergeten in `types/index.ts`, krijg je geen compile-fout.

**T2 — `Campaign` type gebruikt hardcoded `as Campaign` cast**
In `campaigns/[id]/page.tsx` lijn 80: `const campaign = raw as Campaign`. Na het gebruik van `select('*')` klopt dit, maar het is fragiel — een schemawijziging valt niet op tijdens compilatie.

### Foutafhandeling

**E1 — Server actions gooien fouten die Next.js als 500-pagina toont**
Functies als `archiveContact`, `triggerBatch`, `processFunnelStep` gooien een `Error` bij database-fouten. Next.js vangt dit af als een ongehandelde fout en toont een generieke 500-pagina. Gebruikers zien geen nuttige foutmelding.

*Fix*: Gebruik `redirect()` met een `?error=` parameter zoals bij andere acties, of retourneer een `FormState` zodat de fout in de UI verschijnt.

**E2 — `optOutContact` heeft geen rollback**
Zie S3. Als de contact-update slaagt maar de campaign_runs-update mislukt, is de contactstatus inconsistent.

**E3 — Processor-fout stopt niet de hele batch**
In `processor.ts` wordt elke log afzonderlijk verwerkt. Een onverwachte fout in `sendEmail` of de unsubscribe-token insert is gecatched, maar een onverwachte exception in de omliggende loop (bijv. een undefined property read) laat de hele batch crashen.

*Fix*: Wikkel de per-log verwerking in een `try/catch` zodat één failing log de rest niet blokkeert.

### Uitbreidbaarheid

**U1 — Audience resolution laadt alle contact-velden**
`resolveAudienceContacts` doet `select('contacts(*)')` wat alle kolommen ophaalt voor elk contact in de groep. Bij grote groepen (10.000+ contacten) is dit kostbaar.

*Fix voor fase 2*: Selecteer alleen de velden die `isDeliverable` nodig heeft: `id, status, opted_in, global_opt_out, bounced_at, deleted_at`.

**U2 — `getStepDeliveryStats` laadt alle mail_log rijen in geheugen**
`funnel.ts` haalt alle mail_logs op voor een stap en telt dan in TypeScript. Bij grote campagnes is dit inefficiënt.

*Fix*: Gebruik een Supabase aggregate query: `select('status, count', { count: 'exact' }).eq(...)`.

**U3 — `removeCampaignStep` hernummert sequentieel**
Verwijdering van een stap triggert N afzonderlijke UPDATE-queries om latere stappen te hernummeren. Bij veel stappen is dit N roundtrips.

*Fix*: Gebruik een stored procedure of batch-update. In de praktijk heeft een funnel zelden meer dan 5–10 stappen, dus dit is acceptabel voor v1.

---

## Onderdelen die nog niet production-hard genoeg zijn

### P1 — Rate limiting niet schaalbaar (in-memory)
`lib/utils/rate-limit.ts` gebruikt een module-level `Map`. In een serverless omgeving (Vercel Edge Functions, Lambda) is elke instance onafhankelijk. De limit van 5 req/10min geldt per instantie, niet globaal.

**Risico**: Bij hoog traffic (meerdere serverless instances) kan een botnet de rate limit volledig omzeilen.

**Fix fase 2**: Vervang door `@upstash/ratelimit` met een Redis backend.

### P2 — Geen idempotentie bij webhook event processing
Als SendGrid een event twee keer stuurt (bij retry), wordt `mail_logs` twee keer bijgewerkt. Voor `opened_at` en `clicked_at` is dit veilig (zelfde waarde). Voor `status = 'failed'` bij een bounce kan een dubbele verwerking problemen geven als de eerste verwerking al een herstelactie triggerde.

**Fix fase 2**: Voeg een `processed_event_ids` cache toe of gebruik de `sg_message_id` als idempotency key met een deduplication table.

### P3 — `sendCampaign` is niet idempotent bij onderbreking
Als `sendCampaign` crasht na het aanmaken van campaign_runs maar vóór het zetten van `sent_at`, kan de campagne opnieuw worden gestart. De `sent_at` guard werkt dan niet. Bij de volgende aanroep worden nieuwe `campaign_runs` aangemaakt voor contacten die al een run hebben (geblokt door UNIQUE constraint maar geen fout zichtbaar).

**Fix**: Zet `sent_at` als eerste write, niet als laatste.

### P4 — Geen email-adres throttling per contact
Een contact kan in meerdere actieve funnels tegelijk zitten én ingeschreven zijn op een one_off campagne die toevallig dezelfde dag verstuurd wordt. Er is geen maximum op het aantal e-mails per contact per dag.

**Risico**: Contacten in meerdere lijsten ontvangen mogelijk 5–10 e-mails op één dag, wat als spam wordt gezien.

**Fix fase 2**: In de processor een daily contact frequency check toevoegen.

### P5 — Queue monitoring ontbreekt
Als de cron niet draait (Vercel cron bug, env var fout, timeout), stapelen pending mails stilzwijgend op. Er is geen alert of dashboard-indicator voor een stale queue.

**Fix fase 2**: Voeg een `/api/internal/queue-health` endpoint toe dat het aantal pending mails en de oudste scheduled_at teruggeeft. Monitor via UptimeRobot of Vercel monitoring.

---

## Voorstel fase 2: Cron jobs & Background processing

### Optie A — Vercel Cron Jobs (eenvoudigst)

Voeg toe aan `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/internal/process-queue",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/internal/run-funnel-planner",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Voordelen: geen extra infrastructure, direct bij Vercel deployment.
Nadelen: minimum interval 1 minuut op Pro plan, 5 min op Hobby. Geen retries bij failure.

### Optie B — GitHub Actions (gratis, betrouwbaar)

```yaml
# .github/workflows/process-queue.yml
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST ${{ secrets.APP_URL }}/api/internal/process-queue \
            -H "x-internal-secret: ${{ secrets.INTERNAL_API_SECRET }}"
```

Voordelen: gratis, auditeerbaar, retry-logica configureerbaar.
Nadelen: maximaal per minuut, niet geschikt voor sub-minuut intervals.

### Optie C — Supabase pg_cron (aanbevolen voor fase 2)

```sql
SELECT cron.schedule(
  'process-mail-queue',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://jouwapp.vercel.app/api/internal/process-queue',
      headers := '{"x-internal-secret": "JOUW_SECRET"}'::jsonb
    );
  $$
);
```

Voordelen: co-located met de database, meest betrouwbaar, geen externe dependency.
Vereist: `pg_net` extensie ingeschakeld in Supabase.

### Aanbevolen aanpak fase 2

1. Vercel Cron voor process-queue (elke 5 min) als eerste stap
2. Separaat endpoint `POST /api/internal/run-funnel-planner` voor de funnel step planner
3. `POST /api/internal/queue-health` voor monitoring
4. Alerts via webhook naar Slack als `pending > 500` of `oldest_scheduled_at > 30 min geleden`

---

## Voorstel fase 2: SendGrid webhooks voor opens/clicks/bounces

### Architectuur

```
SendGrid → POST /api/webhooks/sendgrid (met ECDSA signature)
         → handleEvent() per event type
         → mail_logs bijwerken
         → bij bounce: contacts.bounced_at invullen
         → bij spamreport: contact globaal uitschrijven
```

### Benodigde uitbreidingen in `handleEvent()`

**Bounce verwerking** (nu: alleen mail_log → `failed`):

```typescript
case 'bounce':
  update.status        = 'failed'
  update.error_message = evt.reason ?? evt.event

  // Automatisch bounce registreren op het contact
  if (evt.type === 'bounce') {  // hard bounce
    await supabase
      .from('contacts')
      .update({
        bounced_at:  new Date(evt.timestamp * 1000).toISOString(),
        bounce_type: 'hard',
      })
      .eq('email', evt.email)
  }
  break
```

**Spam report** (nu: overgeslagen):

```typescript
case 'spamreport':
  // Globaal uitschrijven + consent log
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', evt.email)
    .maybeSingle()

  if (contact) {
    await supabase
      .from('contacts')
      .update({
        global_opt_out:  true,
        opted_in:        false,
        unsubscribed_at: new Date(evt.timestamp * 1000).toISOString(),
        status:          'opted_out',
      })
      .eq('id', contact.id)

    await logConsent({
      supabase,
      contactId: contact.id,
      eventType: 'opt_out_global',
      channel:   'email',
      notes:     'Spam report via SendGrid webhook',
      metadata:  { via: 'sendgrid_spamreport', sg_message_id: evt.sg_message_id },
    })
  }
  break
```

**Open tracking deduplicatie** (nu: elke open overschrijft `opened_at`):

```typescript
case 'open':
  // Gebruik .is('opened_at', null) om alleen de eerste open bij te houden
  await supabase
    .from('mail_logs')
    .update({ opened_at: new Date(evt.timestamp * 1000).toISOString() })
    .eq('external_message_id', msgId)
    .is('opened_at', null)
  return
```

### Configuratie op SendGrid

1. Dashboard → Settings → Mail Settings → Event Webhook
2. URL: `https://jouwapp.vercel.app/api/webhooks/sendgrid`
3. Activeer: Delivered, Open, Click, Bounce, Spam Report, Unsubscribe
4. Activeer "Signature Verification" → kopieer public key naar `SENDGRID_WEBHOOK_VERIFICATION_KEY`

### Nieuwe env var toevoegen aan `.env.example`

```
SENDGRID_WEBHOOK_VERIFICATION_KEY=
```

---

## Mapstructuur beoordeling

De huidige structuur is goed doordacht:

```
src/
  app/
    (admin)/         ✅ Correct gebruik van route groups
    api/
      internal/      ✅ Server-only, beschermd via secret
      public/        ✅ Publiek, rate limited
      webhooks/      ✅ Externe integraties
  lib/
    auth/            ✅ Guards en roles gescheiden
    consent/         ✅ AVG-specifieke module
    email/           ✅ SendGrid + renderer + sender gescheiden
    mail/            ✅ Queue processor en test-mail gescheiden
    services/        ✅ Domain services (audience, funnel, segments)
    signup/          ✅ Publieke signup flow
    supabase/        ✅ Client/server/service clients gescheiden
    utils/           ✅ Framework-agnostische utilities
    validations/     ✅ Zod schemas per entiteit
  types/             ✅ Centrale type-definitie
```

**Aanbeveling**: `src/lib/validations/` en `src/lib/services/` zijn licht asymmetrisch — er zijn services voor contacts, templates, segments, campaigns, audience, funnel maar geen voor mail_logs of consent. Dat is acceptabel voor v1.

---

## Dashboard UX beoordeling

**Sterk:**
- Statusbadges consistent (kleurcodering per campagnestatus)
- Breadcrumbs en terug-links aanwezig op detail-pagina's
- Fout/info-berichten via query params (`?error=` / `?info=`)
- Rolbadge in sidebar

**Verbeterpunten:**
- Geen bevestigingsdialoog bij "Versturen" behalve de client-side `onClick` confirm op de "Intrekken" knop — de SendButton heeft geen confirm stap
- Na het inplannen van mail via `processFunnelStep` of `triggerBatch` is er geen visuele indicator van hoeveel mails er in de queue zitten
- De logs-pagina (`/logs`) toont geen paginering — bij hoge volumes is dit een probleem

---

## Samenvatting kritische items voor productie

| Prioriteit | Item | Status |
|------------|------|--------|
| 🔴 Kritiek | `delay_days` bug — mail werd altijd direct gepland | **Gefixed** |
| 🔴 Kritiek | Bounced contacten ontvingen nog mail | **Gefixed** |
| 🔴 Kritiek | Webhook had geen signature verificatie | **Gefixed** |
| 🟠 Hoog | Rate limiting werkt niet bij meerdere serverless instances | Te doen (fase 2) |
| 🟠 Hoog | Geen email throttling per contact per dag | Te doen (fase 2) |
| 🟠 Hoog | Bounce/spamreport webhook verwerkt contact niet automatisch | Te doen (fase 2) |
| 🟡 Middel | Unsubscribe flow niet transactie-veilig | Acceptabel voor v1 |
| 🟡 Middel | Geen queue monitoring/alerting | Te doen (fase 2) |
| 🟡 Middel | Geen gegenereerde Supabase types | Te doen (fase 2) |
| 🟢 Laag | Template variabelen niet HTML-encoded | Te doen (fase 2) |
| 🟢 Laag | `sent_at` beveiliging fragiel bij crash | Te doen (fase 2) |
