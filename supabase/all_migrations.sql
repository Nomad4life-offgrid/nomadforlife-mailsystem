-- ============================================================
-- NOMAD FOR LIFE — Mailsysteem Database Schema
-- Migration: 20260403000001_initial_mailsystem_schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CONTACTS
-- Alle personen die e-mails kunnen ontvangen
-- ============================================================
CREATE TABLE contacts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text        NOT NULL UNIQUE,
  first_name     text,
  last_name      text,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  global_opt_out boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_email
  ON contacts (email);

-- Partial index: alleen opt-out contacten, klein en snel te checken
CREATE INDEX idx_contacts_global_opt_out
  ON contacts (global_opt_out)
  WHERE global_opt_out = true;

-- ============================================================
-- TEMPLATES
-- E-mail templates met HTML en optionele plain-text versie
-- ============================================================
CREATE TABLE templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  subject    text        NOT NULL,
  html_body  text        NOT NULL,
  text_body  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CAMPAIGNS
-- Een campagne groepeert meerdere funnel stappen
-- ============================================================
CREATE TABLE campaigns (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  status      text        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  from_email  text        NOT NULL,
  from_name   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON campaigns (status);

-- ============================================================
-- CAMPAIGN STEPS
-- Elke stap in de funnel: volgorde + vertraging + template
-- delay_hours is cumulatief opgeteld per stap
-- ============================================================
CREATE TABLE campaign_steps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid        NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  template_id uuid        NOT NULL REFERENCES templates (id) ON DELETE RESTRICT,
  step_order  integer     NOT NULL CHECK (step_order >= 1),
  delay_hours integer     NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_order)
);

CREATE INDEX idx_campaign_steps_campaign_id ON campaign_steps (campaign_id);
CREATE INDEX idx_campaign_steps_template_id ON campaign_steps (template_id);

-- ============================================================
-- CAMPAIGN RUNS
-- Een contact ingeschreven in een campagne
-- Één run per contact per campagne
-- ============================================================
CREATE TABLE campaign_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  contact_id    uuid        NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'opted_out', 'bounced')),
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  opted_out_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX idx_campaign_runs_campaign_id ON campaign_runs (campaign_id);
CREATE INDEX idx_campaign_runs_contact_id  ON campaign_runs (contact_id);
CREATE INDEX idx_campaign_runs_status      ON campaign_runs (status);

-- ============================================================
-- MAIL LOGS
-- Verzending queue + tracking per stap per contact
-- ============================================================
CREATE TABLE mail_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_run_id     uuid        NOT NULL REFERENCES campaign_runs (id) ON DELETE CASCADE,
  campaign_step_id    uuid        NOT NULL REFERENCES campaign_steps (id) ON DELETE CASCADE,
  contact_id          uuid        NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  scheduled_at        timestamptz NOT NULL,
  sent_at             timestamptz,
  opened_at           timestamptz,
  clicked_at          timestamptz,
  external_message_id text,           -- ID teruggegeven door Resend / SendGrid
  error_message       text,
  retry_count         integer     NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Kritieke queue-index: enkel pending rows, gesorteerd op scheduled_at
CREATE INDEX idx_mail_logs_queue
  ON mail_logs (scheduled_at)
  WHERE status = 'pending';

CREATE INDEX idx_mail_logs_campaign_run_id  ON mail_logs (campaign_run_id);
CREATE INDEX idx_mail_logs_contact_id       ON mail_logs (contact_id);
CREATE INDEX idx_mail_logs_campaign_step_id ON mail_logs (campaign_step_id);

-- ============================================================
-- UNSUBSCRIBE EVENTS
-- Opt-out tokens, per campagne of globaal (campaign_id IS NULL)
-- Token is eenmalig bruikbaar (used_at wordt gevuld na gebruik)
-- ============================================================
CREATE TABLE unsubscribe_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid        NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  campaign_id uuid        REFERENCES campaigns (id) ON DELETE SET NULL,
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  reason      text,
  used_at     timestamptz,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unsubscribe_events_token      ON unsubscribe_events (token);
CREATE INDEX idx_unsubscribe_events_contact_id ON unsubscribe_events (contact_id);
CREATE INDEX idx_unsubscribe_events_campaign_id ON unsubscribe_events (campaign_id);

-- ============================================================
-- AUTO updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_campaign_steps_updated_at
  BEFORE UPDATE ON campaign_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_campaign_runs_updated_at
  BEFORE UPDATE ON campaign_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_mail_logs_updated_at
  BEFORE UPDATE ON mail_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ============================================================
-- NOMAD FOR LIFE — Opt-in / Opt-out fields
-- Migration: 20260403000002_optin_fields
-- ============================================================

-- Add consent tracking columns to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opted_in        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_in_at     timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'opted_out'));

-- Sync existing opted-out contacts
UPDATE contacts
SET status = 'opted_out'
WHERE global_opt_out = true;

-- Index for status-based filtering
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);

-- ============================================================
-- OPT-IN TOKENS
-- One-time tokens for double opt-in email confirmation
-- ============================================================
CREATE TABLE opt_in_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid        NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  campaign_id uuid        REFERENCES campaigns (id) ON DELETE SET NULL,
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opt_in_tokens_token      ON opt_in_tokens (token);
CREATE INDEX idx_opt_in_tokens_contact_id ON opt_in_tokens (contact_id);
-- ============================================================
-- NOMAD FOR LIFE — Contactgroepen / Segmenten
-- Migration: 20260403000003_segments
-- ============================================================

-- Contactgroepen (segmenten): campings, sponsors, adverteerders, leden etc.
CREATE TABLE contact_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  color       text        NOT NULL DEFAULT '#71717a',  -- voor UI labels
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_groups_name ON contact_groups (name);

-- Koppeltabel: één contact kan in meerdere groepen zitten
CREATE TABLE contact_group_members (
  contact_id uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES contact_groups (id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, group_id)
);

CREATE INDEX idx_contact_group_members_group_id   ON contact_group_members (group_id);
CREATE INDEX idx_contact_group_members_contact_id ON contact_group_members (contact_id);

-- Trigger updated_at op contact_groups
CREATE TRIGGER trg_contact_groups_updated_at
  BEFORE UPDATE ON contact_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: de zes doelgroepen voor Nomad For Life
INSERT INTO contact_groups (name, description, color) VALUES
  ('Campings & camperplaatsen', 'Campings en camperplaatsen in Nederland en België', '#16a34a'),
  ('Sponsors',                  'Bedrijven die Nomad For Life financieel steunen',   '#2563eb'),
  ('Adverteerders',             'Partijen die adverteren via Nomad For Life',         '#7c3aed'),
  ('Leden',                     'Betalende leden van Nomad For Life',                 '#ea580c'),
  ('Partners',                  'Samenwerkingspartners',                              '#0891b2'),
  ('Prospects',                 'Potentiële klanten en geïnteresseerden',             '#ca8a04');
-- ============================================================
-- NOMAD FOR LIFE — Fase 1: Compleet datamodel
-- Migration: 20260403000004_phase1_complete
--
-- Uitbreiding van bestaand schema + nieuwe tabellen:
--   contacts          → +company, phone, source, tags, custom_fields,
--                        bounced_at, bounce_type, deleted_at
--   campaigns         → +reply_to_email, track_opens, track_clicks,
--                        created_by, deleted_at
--   campaign_steps    → +delay_days, subject_override
--   templates         → +preview_text, category, created_by, deleted_at
--   contact_lists     → nieuw (formele lijsten, losstaan van contact_groups)
--   contact_list_items→ nieuw (junction)
--   segments          → nieuw (dynamische filters)
--   consent_logs      → nieuw (AVG-audit trail)
--   import_jobs       → nieuw (CSV-import tracking)
--   activity_logs     → nieuw (admin audit trail)
-- ============================================================


-- ============================================================
-- DEEL 1 — UITBREIDING BESTAANDE TABELLEN
-- ============================================================

-- ── contacts ─────────────────────────────────────────────────
-- Doel: Volledig contactprofiel met brontracking, custom velden,
--       bounce-informatie en soft delete.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company       text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS source        text    NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import', 'api', 'website', 'admin')),
  ADD COLUMN IF NOT EXISTS tags          text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_fields jsonb   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bounced_at    timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type   text
    CHECK (bounce_type IN ('hard', 'soft')),
  ADD COLUMN IF NOT EXISTS deleted_at    timestamptz;   -- soft delete

-- Contacten die verwijderd zijn uitsluiten van normale queries
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at
  ON contacts (deleted_at)
  WHERE deleted_at IS NULL;

-- Snel filteren op bron (voor import-rapportage)
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts (source);

-- Array-search op tags (GIN voor @>, &&, etc.)
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING gin (tags);

-- ── campaigns ────────────────────────────────────────────────
-- Doel: Reply-to adres, open/click tracking toggles,
--       eigenaar per campagne, soft delete.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS reply_to_email text,
  ADD COLUMN IF NOT EXISTS track_opens    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_clicks   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by     uuid
    REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;   -- soft delete

CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at
  ON campaigns (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns (created_by);

-- ── campaign_steps ────────────────────────────────────────────
-- Doel: delay_days als primaire eenheid voor funnel-vertragingen
--       (leesbare input), plus optionele subject-override per stap.
--
-- Totale vertraging = delay_days * 24 + delay_hours
-- delay_hours blijft voor sub-dag precisie (bijv. 8u30).
ALTER TABLE campaign_steps
  ADD COLUMN IF NOT EXISTS delay_days        integer NOT NULL DEFAULT 0
    CHECK (delay_days >= 0),
  ADD COLUMN IF NOT EXISTS subject_override  text;

COMMENT ON COLUMN campaign_steps.delay_days IS
  'Vertraging in dagen (cumulatief, optioneel naast delay_hours). '
  'Totale vertraging = delay_days * 24 + delay_hours.';

-- ── templates ─────────────────────────────────────────────────
-- Doel: Preview-tekst voor inbox-weergave, categorie-indeling,
--       eigenaar en soft delete.
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS preview_text text,
  ADD COLUMN IF NOT EXISTS category     text    NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'onboarding', 'followup', 'newsletter', 'transactional')),
  ADD COLUMN IF NOT EXISTS created_by   uuid
    REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_templates_deleted_at
  ON templates (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates (category);

-- ── contact_groups ────────────────────────────────────────────
-- Uitbreiding: eigenaar + type-onderscheid (group = label, list = vaste lijst)
ALTER TABLE contact_groups
  ADD COLUMN IF NOT EXISTS list_type   text NOT NULL DEFAULT 'group'
    CHECK (list_type IN ('group', 'list')),
  ADD COLUMN IF NOT EXISTS is_locked   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by  uuid
    REFERENCES auth.users (id) ON DELETE SET NULL;


-- ============================================================
-- DEEL 2 — NIEUWE TABELLEN
-- ============================================================

-- ── contact_lists ─────────────────────────────────────────────
-- Doel: Formele, benoemde mailinglijsten voor campagne-targeting.
--       Losstaan van contact_groups (labels/doelgroepen).
--       Kunnen worden gevuld via import_jobs of handmatig.
--
-- Relaties:
--   contact_lists  1──* contact_list_items *──1 contacts
--   contact_lists  *──1 import_jobs (optioneel, bij import-origine)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  source      text        NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import', 'api', 'website')),
  is_locked   boolean     NOT NULL DEFAULT false,   -- verhindert muteren na campagne-lock
  import_job_id uuid,                               -- FK na import_jobs definitie
  created_by  uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_lists_source     ON contact_lists (source);
CREATE INDEX IF NOT EXISTS idx_contact_lists_created_by ON contact_lists (created_by);

CREATE TRIGGER trg_contact_lists_updated_at
  BEFORE UPDATE ON contact_lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── contact_list_items ────────────────────────────────────────
-- Doel: Koppeling contact ↔ contact_list.
--       contact_id + list_id vormen de samengestelde PK (uniek per paar).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_list_items (
  list_id    uuid        NOT NULL REFERENCES contact_lists (id) ON DELETE CASCADE,
  contact_id uuid        NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (list_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_list_items_list_id    ON contact_list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_contact_list_items_contact_id ON contact_list_items (contact_id);

-- ── segments ──────────────────────────────────────────────────
-- Doel: Dynamische, filtergebaseerde doelgroepen.
--       De filterdefinitie wordt opgeslagen als JSON en server-side
--       geëvalueerd bij verzending (niet vooraf gematerialiseerd).
--
-- filter_json-structuur (voorbeeld):
--   {
--     "operator": "AND",
--     "conditions": [
--       { "field": "status",      "op": "eq",       "value": "active" },
--       { "field": "tags",        "op": "contains",  "value": "camping" },
--       { "field": "created_at",  "op": "gte",       "value": "2025-01-01" },
--       { "field": "group_id",    "op": "eq",        "value": "<uuid>" }
--     ]
--   }
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  filter_json   jsonb       NOT NULL DEFAULT '{}',
  preview_count integer,                              -- gecached contactaantal
  refreshed_at  timestamptz,                          -- wanneer preview_count bijgewerkt
  created_by    uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_segments_created_by ON segments (created_by);
CREATE INDEX IF NOT EXISTS idx_segments_filter_json ON segments USING gin (filter_json);

CREATE TRIGGER trg_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── consent_logs ──────────────────────────────────────────────
-- Doel: Juridisch afdwingbare audit trail van elk consent-event
--       per contact. Onveranderlijk (geen UPDATE/DELETE).
--       Vereist voor AVG/GDPR artikel 7 (bewijslast consent).
--
-- event_type:
--   opt_in            → contact heeft zichzelf aangemeld (maar nog niet bevestigd)
--   opt_in_confirmed  → double opt-in link geklikt
--   opt_out           → uitgeschreven van specifieke campagne
--   opt_out_global    → globale opt-out via unsubscribe-link
--   consent_withdrawn → actieve intrekking door contact
--   consent_renewed   → contact heeft opnieuw toestemming gegeven
--   imported          → contact geïmporteerd (consent apart gedocumenteerd)
--   manually_added    → admin heeft contact handmatig toegevoegd
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid        NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  event_type   text        NOT NULL
    CHECK (event_type IN (
      'opt_in', 'opt_in_confirmed', 'opt_out', 'opt_out_global',
      'consent_withdrawn', 'consent_renewed', 'imported', 'manually_added'
    )),
  channel      text        NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'web', 'import', 'admin', 'api')),
  ip_address   text,
  user_agent   text,
  notes        text,                                  -- vrije tekst, bijv. "toestemming verkregen telefonisch"
  performed_by uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
                                                      -- NULL = systeem of contact zelf
  metadata     jsonb       NOT NULL DEFAULT '{}',     -- extra context, bijv. campagne-id, formulier-id
  created_at   timestamptz NOT NULL DEFAULT now()
  -- Geen updated_at: consent logs zijn append-only
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_contact_id  ON consent_logs (contact_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_event_type  ON consent_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_consent_logs_created_at  ON consent_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_logs_performed_by ON consent_logs (performed_by);

-- ── import_jobs ───────────────────────────────────────────────
-- Doel: Beheert CSV-imports van contacten. Houdt voortgang bij
--       en koppelt aan een target-lijst en/of doelgroep.
--       Importresultaten kunnen worden teruggekeken voor audit.
--
-- Relaties:
--   import_jobs *──1 contact_lists  (target_list_id)
--   import_jobs *──1 contact_groups (target_group_id, optioneel)
--   import_jobs *──1 auth.users     (created_by)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  file_name       text,
  file_size_bytes integer,
  total_rows      integer,
  processed_rows  integer     NOT NULL DEFAULT 0,
  imported_rows   integer     NOT NULL DEFAULT 0,
  skipped_rows    integer     NOT NULL DEFAULT 0,
  failed_rows     integer     NOT NULL DEFAULT 0,
  target_list_id  uuid        REFERENCES contact_lists (id) ON DELETE SET NULL,
  target_group_id uuid        REFERENCES contact_groups (id) ON DELETE SET NULL,
  column_mapping  jsonb       NOT NULL DEFAULT '{}',
                                          -- {"email": "E-mail", "first_name": "Voornaam", ...}
  error_details   jsonb,                  -- array van fouten per rij
  created_by      uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status     ON import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by ON import_jobs (created_by);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs (created_at DESC);

CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Voeg FK contact_lists → import_jobs toe (nu beide tabellen bestaan)
ALTER TABLE contact_lists
  ADD CONSTRAINT fk_contact_lists_import_job
  FOREIGN KEY (import_job_id) REFERENCES import_jobs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contact_lists_import_job_id
  ON contact_lists (import_job_id)
  WHERE import_job_id IS NOT NULL;

-- ── activity_logs ─────────────────────────────────────────────
-- Doel: Append-only audit trail van admin-acties.
--       Registreert wie wat wanneer heeft gedaan, ongeacht
--       of de entiteit daarna gewijzigd of verwijderd is.
--       Essentieel voor multi-user admin en debugging.
--
-- action-conventie: "<entiteit>.<werkwoord>"
--   Voorbeelden: campaign.created, campaign.activated, contact.deleted,
--                template.updated, import.started, send.triggered
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  action      text        NOT NULL,       -- "campaign.created"
  entity_type text,                       -- "campaign"
  entity_id   uuid,                       -- uuid van de betreffende entiteit
  description text,                       -- leesbare samenvatting
  before_data jsonb,                      -- snapshot vóór wijziging (optioneel)
  after_data  jsonb,                      -- snapshot ná wijziging (optioneel)
  ip_address  text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
  -- Geen updated_at: activity logs zijn append-only
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id     ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity      ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action      ON activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at  ON activity_logs (created_at DESC);


-- ============================================================
-- DEEL 3 — AANVULLENDE INDEXES OP BESTAANDE TABELLEN
-- ============================================================

-- mail_logs: send_at index (voor queue sortering op scheduled_at + status)
-- (idx_mail_logs_queue bestaat al: WHERE status='pending' op scheduled_at)

-- campaign_runs: compound index voor actieve runs per campagne
CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign_status
  ON campaign_runs (campaign_id, status);

-- unsubscribe_events: index op used_at voor verlopen-token queries
CREATE INDEX IF NOT EXISTS idx_unsubscribe_events_used_at
  ON unsubscribe_events (used_at)
  WHERE used_at IS NULL;


-- ============================================================
-- DEEL 4 — ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Strategie:
--   - Admin-tabellen: alleen toegankelijk voor authenticated users
--   - Publieke tabellen (opt-in bevestiging, unsubscribe): service role via
--     server actions (bypast RLS sowieso), geen directe client-toegang
--   - Consent_logs + activity_logs: read-only voor admins, nooit DELETE
--   - Service role (server actions) bypast alle RLS — dat is de bedoeling

-- ── RLS inschakelen ───────────────────────────────────────────
ALTER TABLE contact_lists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_list_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs        ENABLE ROW LEVEL SECURITY;

-- Bestaande tabellen (reeds aanwezig, voeg RLS toe)
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE opt_in_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;

-- ── Policies: admin-tabellen (authenticated = volledige toegang) ──
-- contact_lists
DROP POLICY IF EXISTS "admins_contact_lists" ON contact_lists;
CREATE POLICY "admins_contact_lists" ON contact_lists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_list_items
DROP POLICY IF EXISTS "admins_contact_list_items" ON contact_list_items;
CREATE POLICY "admins_contact_list_items" ON contact_list_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- segments
DROP POLICY IF EXISTS "admins_segments" ON segments;
CREATE POLICY "admins_segments" ON segments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- import_jobs
DROP POLICY IF EXISTS "admins_import_jobs" ON import_jobs;
CREATE POLICY "admins_import_jobs" ON import_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contacts
DROP POLICY IF EXISTS "admins_contacts" ON contacts;
CREATE POLICY "admins_contacts" ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaigns
DROP POLICY IF EXISTS "admins_campaigns" ON campaigns;
CREATE POLICY "admins_campaigns" ON campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaign_steps
DROP POLICY IF EXISTS "admins_campaign_steps" ON campaign_steps;
CREATE POLICY "admins_campaign_steps" ON campaign_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaign_runs
DROP POLICY IF EXISTS "admins_campaign_runs" ON campaign_runs;
CREATE POLICY "admins_campaign_runs" ON campaign_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- templates
DROP POLICY IF EXISTS "admins_templates" ON templates;
CREATE POLICY "admins_templates" ON templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mail_logs
DROP POLICY IF EXISTS "admins_mail_logs" ON mail_logs;
CREATE POLICY "admins_mail_logs" ON mail_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_groups
DROP POLICY IF EXISTS "admins_contact_groups" ON contact_groups;
CREATE POLICY "admins_contact_groups" ON contact_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_group_members
DROP POLICY IF EXISTS "admins_contact_group_members" ON contact_group_members;
CREATE POLICY "admins_contact_group_members" ON contact_group_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Policies: append-only tabellen (geen DELETE voor admins) ──
-- consent_logs: admins mogen lezen en toevoegen, nooit verwijderen
DROP POLICY IF EXISTS "admins_consent_logs_read" ON consent_logs;
CREATE POLICY "admins_consent_logs_read"   ON consent_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_consent_logs_insert" ON consent_logs;
CREATE POLICY "admins_consent_logs_insert" ON consent_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- activity_logs: admins mogen alleen lezen (systeem schrijft)
DROP POLICY IF EXISTS "admins_activity_logs_read" ON activity_logs;
CREATE POLICY "admins_activity_logs_read"  ON activity_logs
  FOR SELECT TO authenticated USING (true);

-- ── Policies: publieke toegang voor opt-in/unsubscribe flows ──
-- opt_in_tokens: publiek leesbaar voor bevestigingspagina (service role schrijft)
DROP POLICY IF EXISTS "public_opt_in_tokens_select" ON opt_in_tokens;
CREATE POLICY "public_opt_in_tokens_select" ON opt_in_tokens
  FOR SELECT TO anon USING (true);

-- unsubscribe_events: publiek leesbaar voor afmeldpagina (service role schrijft)
DROP POLICY IF EXISTS "public_unsubscribe_events_select" ON unsubscribe_events;
CREATE POLICY "public_unsubscribe_events_select" ON unsubscribe_events
  FOR SELECT TO anon USING (true);
-- ============================================================
-- NOMAD FOR LIFE — Development seed data
-- Migration: 20260403000005_seed_development
--
-- Alleen voor lokale development en staging.
-- Bevat realistische testdata voor alle tabellen.
-- NIET uitvoeren op productie.
-- ============================================================

-- ============================================================
-- TEMPLATES
-- ============================================================
INSERT INTO templates (id, name, subject, preview_text, category, html_body, text_body) VALUES

  ('11111111-0000-0000-0000-000000000001',
   'Welkomstmail — Campings',
   'Welkom bij Nomad For Life, {{first_name}}!',
   'We zijn blij dat je erbij bent.',
   'onboarding',
   '<p>Hallo {{first_name}},</p>
    <p>Welkom bij Nomad For Life! We zijn blij dat je erbij bent.</p>
    <p>In de komende dagen sturen we je meer informatie over onze diensten.</p>
    <p style="margin-top:24px">
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Hallo {{first_name}},

Welkom bij Nomad For Life! We zijn blij dat je erbij bent.

In de komende dagen sturen we je meer informatie over onze diensten.

Afmelden: {{unsubscribe_url}}'),

  ('11111111-0000-0000-0000-000000000002',
   'Follow-up dag 3 — Campings',
   'Nog een vraag, {{first_name}}?',
   'We willen graag weten hoe het gaat.',
   'followup',
   '<p>Hallo {{first_name}},</p>
    <p>Hoe bevalt het tot nu toe? We staan klaar als je vragen hebt.</p>
    <p>
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Hallo {{first_name}},

Hoe bevalt het tot nu toe? We staan klaar als je vragen hebt.

Afmelden: {{unsubscribe_url}}'),

  ('11111111-0000-0000-0000-000000000003',
   'Slotmail — Campings',
   'Laatste bericht van ons, {{first_name}}',
   'Dit is ons laatste bericht in deze reeks.',
   'followup',
   '<p>Hallo {{first_name}},</p>
    <p>Dit is het laatste bericht in onze reeks. Bedankt voor je aandacht!</p>
    <p>
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Hallo {{first_name}},

Dit is het laatste bericht in onze reeks. Bedankt voor je aandacht!

Afmelden: {{unsubscribe_url}}'),

  ('11111111-0000-0000-0000-000000000004',
   'Sponsorpakket introductie',
   'Onze sponsormogelijkheden voor {{company}}',
   'Ontdek wat Nomad For Life voor jou kan betekenen.',
   'general',
   '<p>Beste {{first_name}},</p>
    <p>We willen u graag informeren over onze sponsormogelijkheden bij Nomad For Life.</p>
    <p>
      <a href="{{unsubscribe_url}}" style="color:#71717a;font-size:12px">Afmelden</a>
    </p>',
   'Beste {{first_name}},

We willen u graag informeren over onze sponsormogelijkheden bij Nomad For Life.

Afmelden: {{unsubscribe_url}}');


-- ============================================================
-- CAMPAIGNS
-- ============================================================
INSERT INTO campaigns (id, name, description, status, from_email, from_name, reply_to_email, track_opens, track_clicks) VALUES

  ('22222222-0000-0000-0000-000000000001',
   'Campings Outreach 2026',
   'Drip-campagne voor campings en camperplaatsen — 3 stappen over 7 dagen.',
   'active',
   'info@nomadforlife.nl',
   'Nomad For Life',
   'info@nomadforlife.nl',
   true,
   true),

  ('22222222-0000-0000-0000-000000000002',
   'Sponsorpakket Introductie',
   'Eenmalige introductiemail voor potentiële sponsors.',
   'draft',
   'info@nomadforlife.nl',
   'Nomad For Life',
   null,
   true,
   true),

  ('22222222-0000-0000-0000-000000000003',
   'Ledennieuwsbrief Q2 2026',
   'Kwartaalupdate voor betalende leden.',
   'draft',
   'leden@nomadforlife.nl',
   'Nomad For Life — Ledenservice',
   null,
   true,
   false);


-- ============================================================
-- CAMPAIGN STEPS (funnel voor campagne 1)
-- ============================================================
INSERT INTO campaign_steps (campaign_id, template_id, step_order, delay_days, delay_hours) VALUES

  -- Stap 1: direct bij inschrijving
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   1, 0, 0),

  -- Stap 2: na 3 dagen
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000002',
   2, 3, 0),

  -- Stap 3: na 7 dagen (cumulatief = dag 7 na inschrijving)
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000003',
   3, 4, 0),   -- 3 + 4 = 7 dagen cumulatief

  -- Sponsorcampagne: 1 stap
  ('22222222-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000004',
   1, 0, 0);


-- ============================================================
-- CONTACTS
-- ============================================================
INSERT INTO contacts (id, email, first_name, last_name, company, source, status, opted_in, opted_in_at, tags) VALUES

  ('33333333-0000-0000-0000-000000000001',
   'jan.devries@kampeerparadijs.nl', 'Jan', 'de Vries', 'Kampeerparadijs Drenthe',
   'import', 'active', true, now() - interval '30 days',
   ARRAY['camping', 'nl', 'drenthe']),

  ('33333333-0000-0000-0000-000000000002',
   'maria.smit@camperplaats-zeeland.nl', 'Maria', 'Smit', 'Camperplaats Zeeland',
   'import', 'active', true, now() - interval '25 days',
   ARRAY['camping', 'nl', 'zeeland']),

  ('33333333-0000-0000-0000-000000000003',
   'piet.bakker@naturecamping.be', 'Piet', 'Bakker', 'Nature Camping België',
   'manual', 'active', true, now() - interval '15 days',
   ARRAY['camping', 'be']),

  ('33333333-0000-0000-0000-000000000004',
   'lisa.jansen@outdoorshop.nl', 'Lisa', 'Jansen', 'OutdoorShop Nederland',
   'website', 'active', true, now() - interval '10 days',
   ARRAY['sponsor', 'nl']),

  ('33333333-0000-0000-0000-000000000005',
   'tom.vandenberg@camperworks.nl', 'Tom', 'van den Berg', 'CamperWorks',
   'import', 'active', true, now() - interval '5 days',
   ARRAY['adverteerder', 'nl']),

  ('33333333-0000-0000-0000-000000000006',
   'sarah.mol@nomadlid.nl', 'Sarah', 'Mol', null,
   'website', 'active', true, now() - interval '60 days',
   ARRAY['lid']),

  ('33333333-0000-0000-0000-000000000007',
   'kees.oud@prospect.nl', 'Kees', 'Oud', 'Outdoor Events BV',
   'manual', 'pending', false, null,
   ARRAY['prospect']),

  ('33333333-0000-0000-0000-000000000008',
   'afgemeld@example.nl', 'Test', 'Afgemeld', null,
   'manual', 'opted_out', false, null,
   ARRAY[]::text[]);

-- Zet opted-out contact ook juist
UPDATE contacts
SET global_opt_out = true, unsubscribed_at = now() - interval '3 days'
WHERE id = '33333333-0000-0000-0000-000000000008';


-- ============================================================
-- CONTACT GROUPS (doelgroepen — seed al in migratie 3)
-- Voeg dev-contacten toe aan groepen
-- ============================================================
-- Haal groep-IDs op via subquery (naam is stabiel)
INSERT INTO contact_group_members (contact_id, group_id)
SELECT c.id, g.id
FROM (VALUES
  ('33333333-0000-0000-0000-000000000001', 'Campings & camperplaatsen'),
  ('33333333-0000-0000-0000-000000000002', 'Campings & camperplaatsen'),
  ('33333333-0000-0000-0000-000000000003', 'Campings & camperplaatsen'),
  ('33333333-0000-0000-0000-000000000004', 'Sponsors'),
  ('33333333-0000-0000-0000-000000000005', 'Adverteerders'),
  ('33333333-0000-0000-0000-000000000006', 'Leden'),
  ('33333333-0000-0000-0000-000000000007', 'Prospects')
) AS v(contact_id, group_name)
JOIN contacts       c ON c.id = v.contact_id::uuid
JOIN contact_groups g ON g.name = v.group_name
ON CONFLICT DO NOTHING;


-- ============================================================
-- CONTACT LISTS (formele importlijsten)
-- ============================================================
INSERT INTO contact_lists (id, name, description, source) VALUES
  ('44444444-0000-0000-0000-000000000001',
   'Import campings april 2026',
   'CSV-import van 3 campings uit de prospectlijst april 2026.',
   'import'),
  ('44444444-0000-0000-0000-000000000002',
   'Handmatige selectie sponsors Q2',
   'Handmatig samengestelde lijst voor sponsorpitch Q2.',
   'manual');

-- Voeg contacten toe aan lijsten
INSERT INTO contact_list_items (list_id, contact_id) VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001'),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002'),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003'),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004'),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000005');


-- ============================================================
-- SEGMENTS (dynamische filterscenario's)
-- ============================================================
INSERT INTO segments (name, description, filter_json) VALUES

  ('Actieve campings NL',
   'Alle actieve campings in Nederland op basis van tags.',
   '{"operator":"AND","conditions":[
     {"field":"status","op":"eq","value":"active"},
     {"field":"tags","op":"contains","value":"camping"},
     {"field":"tags","op":"contains","value":"nl"}
   ]}'::jsonb),

  ('Alle opted-in zonder actieve campagne',
   'Contacten die opted-in zijn maar nog geen actieve campaign_run hebben.',
   '{"operator":"AND","conditions":[
     {"field":"status","op":"eq","value":"active"},
     {"field":"opted_in","op":"eq","value":true}
   ]}'::jsonb),

  ('Prospects ouder dan 14 dagen',
   'Prospects die al meer dan 14 dagen pending zijn.',
   '{"operator":"AND","conditions":[
     {"field":"status","op":"eq","value":"pending"},
     {"field":"created_at","op":"lte","value":"-14 days"}
   ]}'::jsonb);


-- ============================================================
-- IMPORT JOBS (één afgeronde importrun)
-- ============================================================
INSERT INTO import_jobs (
  id, status, file_name, file_size_bytes,
  total_rows, processed_rows, imported_rows, skipped_rows, failed_rows,
  target_list_id, column_mapping, started_at, completed_at
) VALUES (
  '55555555-0000-0000-0000-000000000001',
  'completed',
  'campings_april_2026.csv',
  4820,
  3, 3, 3, 0, 0,
  '44444444-0000-0000-0000-000000000001',
  '{"email":"E-mailadres","first_name":"Voornaam","last_name":"Achternaam","company":"Bedrijfsnaam"}'::jsonb,
  now() - interval '2 hours',
  now() - interval '2 hours' + interval '4 seconds'
);

-- Koppel lijst aan import job
UPDATE contact_lists
SET import_job_id = '55555555-0000-0000-0000-000000000001'
WHERE id = '44444444-0000-0000-0000-000000000001';


-- ============================================================
-- CONSENT LOGS (audit trail voor dev-contacten)
-- ============================================================
INSERT INTO consent_logs (contact_id, event_type, channel, notes, metadata) VALUES

  ('33333333-0000-0000-0000-000000000001', 'imported',         'import', 'Import campings april 2026', '{"import_job_id":"55555555-0000-0000-0000-000000000001"}'::jsonb),
  ('33333333-0000-0000-0000-000000000001', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000002', 'imported',         'import', 'Import campings april 2026', '{"import_job_id":"55555555-0000-0000-0000-000000000001"}'::jsonb),
  ('33333333-0000-0000-0000-000000000002', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000003', 'manually_added',   'admin',  'Handmatig toegevoegd na telefonisch contact', '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000003', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000006', 'opt_in',           'web',    null, '{"form":"website_inschrijfformulier"}'::jsonb),
  ('33333333-0000-0000-0000-000000000006', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),

  ('33333333-0000-0000-0000-000000000008', 'opt_in',           'web',    null, '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000008', 'opt_in_confirmed', 'email',  null, '{}'::jsonb),
  ('33333333-0000-0000-0000-000000000008', 'opt_out_global',   'email',  'Afgemeld via unsubscribe-link', '{}'::jsonb);


-- ============================================================
-- CAMPAIGN RUNS + MAIL LOGS (actieve funnel voor 3 campings)
-- ============================================================
DO $$
DECLARE
  run_id   uuid;
  step1_id uuid;
  step2_id uuid;
  step3_id uuid;
  contacts uuid[] := ARRAY[
    '33333333-0000-0000-0000-000000000001'::uuid,
    '33333333-0000-0000-0000-000000000002'::uuid,
    '33333333-0000-0000-0000-000000000003'::uuid
  ];
  c uuid;
BEGIN
  -- Haal step IDs op
  SELECT id INTO step1_id FROM campaign_steps
    WHERE campaign_id = '22222222-0000-0000-0000-000000000001' AND step_order = 1;
  SELECT id INTO step2_id FROM campaign_steps
    WHERE campaign_id = '22222222-0000-0000-0000-000000000001' AND step_order = 2;
  SELECT id INTO step3_id FROM campaign_steps
    WHERE campaign_id = '22222222-0000-0000-0000-000000000001' AND step_order = 3;

  FOREACH c IN ARRAY contacts LOOP
    -- Campaign run
    INSERT INTO campaign_runs (id, campaign_id, contact_id, status, subscribed_at)
    VALUES (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', c, 'active', now() - interval '1 day')
    RETURNING id INTO run_id;

    -- Mail log stap 1: gisteren verzonden
    INSERT INTO mail_logs (campaign_run_id, campaign_step_id, contact_id, status, scheduled_at, sent_at)
    VALUES (run_id, step1_id, c, 'sent', now() - interval '1 day', now() - interval '23 hours');

    -- Mail log stap 2: over 2 dagen gepland (pending)
    INSERT INTO mail_logs (campaign_run_id, campaign_step_id, contact_id, status, scheduled_at)
    VALUES (run_id, step2_id, c, 'pending', now() + interval '2 days');

    -- Mail log stap 3: over 6 dagen gepland (pending)
    INSERT INTO mail_logs (campaign_run_id, campaign_step_id, contact_id, status, scheduled_at)
    VALUES (run_id, step3_id, c, 'pending', now() + interval '6 days');
  END LOOP;
END $$;

-- Simuleer één geopende mail
UPDATE mail_logs SET opened_at = now() - interval '20 hours'
WHERE contact_id = '33333333-0000-0000-0000-000000000001'
  AND status = 'sent';

-- Simuleer één geklikte mail
UPDATE mail_logs SET clicked_at = now() - interval '19 hours'
WHERE contact_id = '33333333-0000-0000-0000-000000000001'
  AND status = 'sent';
-- Phase 3: Contact management additions
-- Adds contact_type and notes to the contacts table.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS contact_type text
    CHECK (contact_type IN ('camping','sponsor','adverteerder','lid','partner','prospect','overig')),
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN contacts.contact_type IS 'Nomad For Life contact classification';
COMMENT ON COLUMN contacts.notes        IS 'Internal admin notes — not sent to contact';

-- Index for type-based filtering
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type)
  WHERE contact_type IS NOT NULL AND deleted_at IS NULL;
-- ============================================================
-- NOMAD FOR LIFE — Phase 4: Statische lijsten & dynamische segmenten
-- Migration: 20260403000007_phase4_lists_segments
-- ============================================================

-- 1. Extend contact_groups: list_type, is_locked, created_by
--    list_type = 'group'  → organisatorische doelgroep (campings, sponsors, …)
--    list_type = 'list'   → formele mailinglist (handmatig samengesteld)

ALTER TABLE contact_groups
  ADD COLUMN IF NOT EXISTS list_type  text NOT NULL DEFAULT 'group'
    CHECK (list_type IN ('group', 'list')),
  ADD COLUMN IF NOT EXISTS is_locked  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- 2. Dynamic segments — filter_json driven, preview_count cached

CREATE TABLE IF NOT EXISTS segments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL UNIQUE,
  description   text,
  -- JSON: { operator: 'AND'|'OR', conditions: [{ field, op, value }] }
  filter_json   jsonb       NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  preview_count integer,        -- cached, updated by refresh action
  refreshed_at  timestamptz,    -- when preview_count was last computed
  created_by    uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_segments_name ON segments (name);

DROP TRIGGER IF EXISTS trg_segments_updated_at ON segments;
CREATE TRIGGER trg_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ============================================================
-- NOMAD FOR LIFE — Phase 5: Campagnesysteem uitbreiding
-- Migration: 20260404000001_phase5_campaigns
--
-- Voegt eenmalige campagnes toe met volledig statusflow,
-- doelgroepkoppeling, onderwerpregel en verzendbeveiliging.
-- ============================================================

-- 1. Breidt status-CHECK uit: nieuwe statussen naast bestaande
--    Bestaand:  draft | active | paused | archived
--    Toegevoegd: ready | scheduled | sending | completed | cancelled
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN (
    'draft', 'ready', 'scheduled', 'sending', 'completed',
    'paused', 'cancelled', 'active', 'archived'
  ));

-- 2. Nieuwe kolommen voor eenmalige campagnes
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS campaign_type        text        NOT NULL DEFAULT 'funnel'
    CHECK (campaign_type IN ('one_off', 'funnel')),
  ADD COLUMN IF NOT EXISTS subject              text,
  ADD COLUMN IF NOT EXISTS preview_text         text,
  ADD COLUMN IF NOT EXISTS template_id          uuid
    REFERENCES templates (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_type        text
    CHECK (audience_type IN ('group', 'segment')),
  ADD COLUMN IF NOT EXISTS audience_group_id    uuid
    REFERENCES contact_groups (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_segment_id  uuid
    REFERENCES segments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_send_at      timestamptz,
  ADD COLUMN IF NOT EXISTS batch_size           integer     NOT NULL DEFAULT 0
    CHECK (batch_size >= 0),
  ADD COLUMN IF NOT EXISTS sent_at              timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_count      integer;   -- gecached bij verzending

-- 3. Indexen
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type
  ON campaigns (campaign_type);

CREATE INDEX IF NOT EXISTS idx_campaigns_planned_send
  ON campaigns (planned_send_at)
  WHERE planned_send_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_template_id
  ON campaigns (template_id)
  WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_audience_group
  ON campaigns (audience_group_id)
  WHERE audience_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_audience_seg
  ON campaigns (audience_segment_id)
  WHERE audience_segment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_sent_at
  ON campaigns (sent_at)
  WHERE sent_at IS NOT NULL;

-- 4. Commentaar
COMMENT ON COLUMN campaigns.campaign_type IS
  'one_off = eenmalig blast-bericht; funnel = reeks stappen (drip-campagne)';

COMMENT ON COLUMN campaigns.subject IS
  'Onderwerpregel voor eenmalige campagnes. '
  'Funnelcampagnes gebruiken subject_override per stap.';

COMMENT ON COLUMN campaigns.preview_text IS
  'Preheader-tekst zichtbaar naast de onderwerpregel in de inbox.';

COMMENT ON COLUMN campaigns.template_id IS
  'E-mailtemplate voor eenmalige campagnes. '
  'Funnelcampagnes koppelen een template per stap.';

COMMENT ON COLUMN campaigns.audience_type IS
  '"group" = statische lijst/groep, "segment" = dynamisch segment.';

COMMENT ON COLUMN campaigns.audience_group_id IS
  'Statische contact_group als doelgroep (bij audience_type = group).';

COMMENT ON COLUMN campaigns.audience_segment_id IS
  'Dynamisch segment als doelgroep (bij audience_type = segment).';

COMMENT ON COLUMN campaigns.planned_send_at IS
  'Gewenst verzendtijdstip. NULL = direct versturen zodra campagne verstuurd wordt.';

COMMENT ON COLUMN campaigns.batch_size IS
  'Max aantal e-mails per verzendrun. 0 = geen limiet (alles tegelijk).';

COMMENT ON COLUMN campaigns.sent_at IS
  'Tijdstip waarop verzending gestart is. NULL = nog niet verstuurd. '
  'Verzendbeveiliging: campagne kan niet opnieuw verstuurd worden als dit gezet is.';

COMMENT ON COLUMN campaigns.recipient_count IS
  'Gecached totaal aantal ontvangers op moment van verzending.';
-- ============================================================
-- NOMAD FOR LIFE — Phase 6: Funnel-stappen uitbreiding
-- Migration: 20260404000002_phase6_funnel_steps
--
-- Voegt per-stap onderwerpregel, preview-tekst, verzendconditie
-- en stap-status toe aan campaign_steps.
-- Voegt indexen toe voor efficiënte plannerqueries op mail_logs.
-- ============================================================

-- 1. Extend campaign_steps
ALTER TABLE campaign_steps
  ADD COLUMN IF NOT EXISTS subject          text,
  ADD COLUMN IF NOT EXISTS preview_text     text,
  ADD COLUMN IF NOT EXISTS send_condition   jsonb,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused'));

-- 2. Indexen voor plannerqueries op mail_logs
--    De planner zoekt per stap welke runs al een log hebben
--    (deduplicatie) en haalt de vorige-stap-logs op.

CREATE INDEX IF NOT EXISTS idx_mail_logs_step_id
  ON mail_logs (campaign_step_id);

-- Partial index: alleen openstaande logs (polling door planner)
CREATE INDEX IF NOT EXISTS idx_mail_logs_pending
  ON mail_logs (campaign_step_id)
  WHERE status = 'pending';

-- Composite index voor run+stap deduplicatie
CREATE INDEX IF NOT EXISTS idx_mail_logs_run_step
  ON mail_logs (campaign_run_id, campaign_step_id);

-- 3. Index voor campaign_runs per status (planner filtert op 'active')
CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign_status
  ON campaign_runs (campaign_id, status);

-- 4. Commentaar
COMMENT ON COLUMN campaign_steps.subject IS
  'Onderwerpregel voor deze funnel-stap. '
  'Wordt gebruikt bij verzending van de stap-mail.';

COMMENT ON COLUMN campaign_steps.preview_text IS
  'Preheader-tekst zichtbaar naast de onderwerpregel in de inbox.';

COMMENT ON COLUMN campaign_steps.send_condition IS
  'Optionele verzendconditie als JSON: '
  '{ "type": "always" | "opened_previous" | "not_opened_previous" | "clicked_previous" }. '
  'NULL = altijd verzenden. Genegeerd voor stap 1.';

COMMENT ON COLUMN campaign_steps.status IS
  'active = stap wordt verwerkt door de planner; '
  'paused = stap wordt tijdelijk overgeslagen.';
-- Phase 7: seed professioneel basis e-mailtemplate voor Nomad For Life
-- Wordt overgeslagen als er al een template met deze naam bestaat.

INSERT INTO templates (name, subject, preview_text, category, html_body, text_body)
SELECT
  'Basis e-mailtemplate',
  'Bericht van {{company_name}}',
  NULL,
  'general',
  $html$<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{{company_name}}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f4f4f5; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
      .mobile-padding { padding: 24px 20px !important; }
      .btn-full { width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Preview-tekst (verborgen, zichtbaar in inbox-overzicht) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f4f5;">
    Bericht van {{company_name}}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Buitenste wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- E-mailkaart (max 600px) -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background-color:#18181b;padding:28px 40px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.03em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                {{company_name}}
              </p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td class="mobile-padding" style="padding:40px 48px 32px;">

              <!-- Aanhef -->
              <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Hoi {{first_name}},
              </p>

              <!-- Hoofdtekst — vervang dit door uw bericht -->
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Schrijf hier uw bericht. U kunt meerdere alinea's gebruiken en variabelen zoals
                <strong>{{first_name}}</strong> en <strong>{{company_name}}</strong> inzetten voor personalisatie.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Voeg hier eventueel een tweede alinea toe met meer informatie voor de ontvanger.
              </p>

              <!-- CTA-knop -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="#" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" stroke="f" fillcolor="#18181b">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:700;">Meer informatie</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="#"
                       style="background-color:#18181b;border-radius:6px;color:#ffffff;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;line-height:44px;text-align:center;text-decoration:none;padding:0 28px;-webkit-text-size-adjust:none;">
                      Meer informatie &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Afsluiting -->
              <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Met vriendelijke groet,<br>
                Het {{company_name}}-team
              </p>

            </td>
          </tr>

          <!-- ── SCHEIDINGSLIJN ── -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td class="mobile-padding" style="padding:24px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                {{company_name}} &bull; Nomad For Life Community
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                U ontvangt dit bericht omdat u zich heeft ingeschreven.
                <a href="{{unsubscribe_url}}" style="color:#a1a1aa;text-decoration:underline;">Afmelden</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /E-mailkaart -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>$html$,
  -- Tekstversie (plain text)
  $text$Hoi {{first_name}},

Schrijf hier uw bericht. U kunt variabelen zoals {{first_name}} en {{company_name}} gebruiken voor personalisatie.

Voeg hier eventueel een tweede alinea toe met meer informatie voor de ontvanger.

→ Meer informatie: [voeg URL in]

Met vriendelijke groet,
Het {{company_name}}-team

---
{{company_name}} · Nomad For Life Community
U ontvangt dit bericht omdat u zich heeft ingeschreven.
Afmelden: {{unsubscribe_url}}$text$
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = 'Basis e-mailtemplate' AND deleted_at IS NULL
);
-- ============================================================
-- NOMAD FOR LIFE — Fase 9: Compliance, Unsubscribe & Consent
-- Migration: 20260404000004_phase9_consent
--
-- Wat dit doet:
--   1. Aanvullende indexes op consent_logs voor audit-queries
--   2. Samengestelde index voor snel filteren per contact + type
--   3. Index op unsubscribe_events.used_at voor query op actieve tokens
--
-- AVG (GDPR) datastrategie en wording — zie onderaan dit bestand
-- ============================================================


-- ── 1. Consent logs: samengestelde index per contact + type ─────────────────
-- Versnelt de per-contact consent-history query in het admin-contactscherm.
CREATE INDEX IF NOT EXISTS idx_consent_logs_contact_event
  ON consent_logs (contact_id, event_type, created_at DESC);

-- ── 2. Consent logs: index per kanaal ──────────────────────────────────────
-- Versnelt filter op channel in de audit-pagina (/consent).
CREATE INDEX IF NOT EXISTS idx_consent_logs_channel
  ON consent_logs (channel, created_at DESC);

-- ── 3. Unsubscribe events: samengestelde index voor actieve tokens ──────────
-- Versnelt opzoeking van ongebruikte tokens per contact.
CREATE INDEX IF NOT EXISTS idx_unsubscribe_events_contact_active
  ON unsubscribe_events (contact_id, used_at)
  WHERE used_at IS NULL;


-- ============================================================
-- AVG-PROOF DATASTRATEGIE — AANBEVELINGEN VOOR NOMAD FOR LIFE
-- ============================================================
--
-- BASIS: AVG ARTIKEL 6 (RECHTSGROND) & ARTIKEL 7 (AANTOONBARE TOESTEMMING)
-- ----------------------------------------------------------------------
--
-- 1. RECHTSGROND
--    Gebruik uitsluitend "toestemming" (art. 6 lid 1 sub a) als grondslag
--    voor marketing-e-mails. Leg de grondslag vast in consent_logs.channel
--    en metadata. Transactionele mails (bevestigingen, facturen) vallen
--    onder "uitvoering overeenkomst" en zijn vrijgesteld van opt-in-vereiste.
--
-- 2. BEWIJSLAST (art. 7 lid 1)
--    De verwerkingsverantwoordelijke moet kunnen aantonen dat het datasubject
--    toestemming heeft gegeven. Dit systeem voldoet hieraan via:
--      - consent_logs: tijdstip, kanaal, IP-adres, user-agent per event
--      - unsubscribe_events: tijdstip en IP bij intrekking
--      - Append-only tabel (nooit UPDATE of DELETE op consent_logs)
--
-- 3. BEWAARTERMIJN
--    Bewaar consent_logs minimaal 3 jaar na het laatste contact.
--    Contactgegevens zelf: verwijder of anonimiseer na het verzoek van
--    het datasubject (art. 17 — recht op vergetelheid). Consent_logs
--    mogen als geanonimiseerde audit-trail bewaard blijven.
--
-- 4. WORDING E-MAIL VOETTEKST (AVG-proof)
--    Minimale vereiste tekst onderaan elke marketing-e-mail:
--
--    NL:
--      "Je ontvangt deze e-mail omdat je je hebt aangemeld bij [Bedrijfsnaam].
--       Je kunt je op elk moment afmelden via de link hieronder.
--       [Afmelden] | [Bedrijfsnaam] · [Adres] · [KVK-nummer]"
--
--    Zorg dat {{unsubscribe_url}} altijd een werkende, eenmalig bruikbare
--    link is. De List-Unsubscribe en List-Unsubscribe-Post headers worden
--    automatisch toegevoegd via de SendGrid-integratie.
--
-- 5. DUBBELE OPT-IN
--    Het systeem verplicht dubbele bevestiging voor alle publieks-aanmeldingen
--    (opt_in → opt_in_confirmed). Dit is de sterkste bewijsvorm.
--    Bewaar opt_in_tokens.used_at als tijdstempel van bevestiging.
--
-- 6. RECHT OP INZAGE (art. 15) & OVERDRAAGBAARHEID (art. 20)
--    Implementatie-aanbeveling: bouw een data-export route waarmee een
--    admin de volledige consent- en mailhistorie van één contact kan
--    downloaden als JSON of CSV.
--
-- 7. MINDERJARIGEN
--    Als de doelgroep minderjarigen kan bevatten (<16 jaar): vereis
--    toestemming van de wettelijk vertegenwoordiger (art. 8). Voeg
--    dan een geboortedatum-veld en extra consent-check toe.
--
-- 8. GEGEVENSMINIMALISATIE (art. 5 lid 1 sub c)
--    Bewaar in mail_logs geen onnodige persoonlijke data.
--    IP-adressen in consent_logs zijn noodzakelijk voor bewijslast,
--    maar hashes volstaan als privacy-by-design maatregel.
--
-- 9. VERWERKINGSREGISTER (art. 30)
--    Documenteer deze verwerking in het verwerkingsregister van
--    Nomad For Life:
--      Doel: direct-marketing via e-mail
--      Rechtsgrond: toestemming (art. 6 lid 1 sub a)
--      Datasubjecten: prospects, klanten, leden
--      Doorgifte buiten EER: SendGrid (VS) — Standard Contractual Clauses
--      Bewaartermijn: zie punt 3
-- ============================================================
-- ============================================================
-- NOMAD FOR LIFE — Fase 10: Dashboard & Rapportage
-- Migration: 20260404000005_phase10_reporting
--
-- Wat dit doet:
--   1. Samengestelde index op mail_logs voor campagne-rapport queries
--      (aggregatie per stap + status in één index-scan)
--   2. Index op contacts (status, opted_in) voor dashboard-tellingen
--   3. Index op contacts (global_opt_out) was al aanwezig (initieel schema)
-- ============================================================


-- ── 1. mail_logs: samengestelde index voor rapport-queries ─────────────────
-- Versnelt SELECT ... WHERE campaign_step_id IN (...) GROUP BY status
-- (gebruikt door /campaigns/[id]/report pagina).
CREATE INDEX IF NOT EXISTS idx_mail_logs_step_status
  ON mail_logs (campaign_step_id, status);

-- ── 2. mail_logs: index op status + scheduled_at voor dashboard recent ──────
-- Versnelt "laatste N mislukte/verzonden mails" op het dashboard.
CREATE INDEX IF NOT EXISTS idx_mail_logs_status_scheduled
  ON mail_logs (status, scheduled_at DESC);

-- ── 3. contacts: samengestelde index voor actieve-contact-telling ────────────
-- Versnelt COUNT WHERE status = 'active' AND opted_in = true AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_contacts_active_optedin
  ON contacts (status, opted_in)
  WHERE deleted_at IS NULL;
-- ============================================================
-- NOMAD FOR LIFE — Fase 11: Publiek inschrijvendpoint
-- Migration: 20260404000006_phase11_subscribe_endpoint
--
-- Ondersteunt POST /api/public/subscribe:
--   - Snelle duplicate-check via email (al aanwezig: idx_contacts_email)
--   - Snel opzoeken van open tokens per contact
--   - Index op source voor rapportage-queries
-- ============================================================

-- ── 1. Contacts: index op source voor analytics ──────────────────────────────
-- Versnelt COUNT(*) WHERE source = 'website' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_contacts_source
  ON contacts (source)
  WHERE deleted_at IS NULL;

-- ── 2. opt_in_tokens: samengestelde index ongebruikte tokens per contact ──────
-- Versnelt lookup "heeft dit contact al een openstaand token?"
-- Vult de bestaande idx_opt_in_tokens_contact_id aan met used_at-filter.
CREATE INDEX IF NOT EXISTS idx_opt_in_tokens_contact_pending
  ON opt_in_tokens (contact_id, created_at DESC)
  WHERE used_at IS NULL;

-- ── 3. contact_group_members: ensure index on group_id + contact_id ──────────
-- Versnelt de upsert-check bij lijst-koppeling na aanmelding.
CREATE INDEX IF NOT EXISTS idx_contact_group_members_lookup
  ON contact_group_members (group_id, contact_id);
-- ============================================================
-- NOMAD FOR LIFE — Fase 12: Admin authenticatie & autorisatie
-- Migration: 20260404000007_phase12_roles
--
-- Voegt een rollenstructuur toe op basis van Supabase Auth:
--   admin  — volledige toegang inclusief verzenden en verwijderen
--   editor — kan alles voorbereiden, maar niet live verzenden
--
-- Bewust ontwerp:
--   - user_roles koppelt een Supabase-gebruiker aan een rol
--   - De service client (service role key) bypast RLS en mag schrijven
--   - Authenticated users mogen alleen hun eigen rol lezen (RLS policy)
--   - Roles worden server-side gecontroleerd in server actions (niet client-side)
--
-- Verdere hardening aanbevolen (zie opmerkingen onderaan).
-- ============================================================


-- ── 1. user_roles tabel ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('admin', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid        REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE  user_roles              IS 'Koppelt Supabase Auth-gebruikers aan een beheerdersrol (admin of editor).';
COMMENT ON COLUMN user_roles.user_id      IS 'FK naar auth.users.id — cascade-delete bij verwijdering account.';
COMMENT ON COLUMN user_roles.role         IS 'admin: volledige toegang. editor: kan voorbereiden, niet verzenden.';
COMMENT ON COLUMN user_roles.granted_by   IS 'Welke admin de rol heeft verleend. NULL = systeem of eerste setup.';


-- ── 2. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Gebruikers mogen hun eigen rol lezen (voor client-side rolweergave)
DROP POLICY IF EXISTS "user_roles_own_read" ON user_roles;
CREATE POLICY "user_roles_own_read"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Schrijfacties verlopen uitsluitend via de service client (bypast RLS)
-- — geen INSERT/UPDATE/DELETE policies nodig voor normale gebruikers


-- ── 3. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles (role);


-- ============================================================
-- HARDENING AANBEVELINGEN
-- ============================================================
--
-- 1. EERSTE ADMIN VIA SUPABASE DASHBOARD
--    Voer handmatig in na deployment:
--      INSERT INTO user_roles (user_id, role)
--      VALUES ('<uid-van-eerste-admin>', 'admin');
--    Daarna kan de admin via de beheerinterface andere gebruikers rollen geven.
--
-- 2. ROL-CACHING
--    Voor hoge traffic: cache getUserRole() in een korte in-memory cache
--    of JWT custom claims (via Supabase Auth Hook) om DB-queries per request
--    te vermijden. Eerste versie: directe DB-query per action is acceptabel.
--
-- 3. JWT CUSTOM CLAIMS (verdere hardening)
--    Voeg de rol toe als custom claim aan het Supabase JWT via een
--    Auth Hook (Database Webhook of Edge Function). Dan is de rol
--    beschikbaar zonder extra DB-query en controleerbaar in RLS policies
--    op andere tabellen.
--
-- 4. AUDIT LOG
--    Overweeg een trigger op user_roles om rol-wijzigingen te loggen
--    in activity_logs, zodat traceerbaar is wie wanneer welke rol had.
--
-- 5. EIGEN ADMIN-BESCHERMING
--    Voorkom dat een admin zijn eigen rol intrekt via een DB CHECK of
--    application-level guard (anders kun je jezelf buitensluiten).
-- ============================================================
-- ============================================================
-- NOMAD FOR LIFE — Phase 13: Extended seed data
-- Migration: 20260404000008_phase13_seed_extended
--
-- Uitbreiding van de development seed (20260403000005) met:
--   1. Phase 5-velden invullen op bestaande campagnes
--      (campaign_type, subject, template_id, audience_type, audience_group_id)
--   2. Phase 6-velden op funnel-stappen
--      (subject per stap, preview_text, send_condition)
--   3. Eenmalige (one_off) campagne met doelgroep en template
--   4. contact_type invullen op seed-contacten
--   5. Bounced contact ter testdoeleinden
--   6. opt_in_token voor pending contact
--   7. Unsubscribe event voor afgemeld contact
--   8. Activity logs (admin audit trail)
--   9. Extra mail_log varianten (failed, skipped)
--
-- NIET uitvoeren op productie.
-- ============================================================


-- ============================================================
-- 1. BESTAANDE CAMPAGNES — Phase 5-velden invullen
-- ============================================================

-- Campagne 1: funnel (Campings Outreach 2026)
-- Koppel aan doelgroep "Campings & camperplaatsen"
UPDATE campaigns
SET
  campaign_type       = 'funnel',
  subject             = NULL,          -- funnels gebruiken subject per stap
  template_id         = NULL,          -- funnels gebruiken template per stap
  audience_type       = 'group',
  audience_group_id   = (SELECT id FROM contact_groups WHERE name = 'Campings & camperplaatsen'),
  audience_segment_id = NULL
WHERE id = '22222222-0000-0000-0000-000000000001';

-- Campagne 2: één sponsormail — wordt one_off campagne
-- (was 'draft', blijft 'draft' totdat admin markeert als ready)
UPDATE campaigns
SET
  campaign_type       = 'one_off',
  subject             = 'Ontdek onze sponsormogelijkheden voor {{company}}',
  preview_text        = 'Vergroot uw zichtbaarheid bij de Nomad For Life community',
  template_id         = '11111111-0000-0000-0000-000000000004',
  audience_type       = 'group',
  audience_group_id   = (SELECT id FROM contact_groups WHERE name = 'Sponsors'),
  audience_segment_id = NULL
WHERE id = '22222222-0000-0000-0000-000000000002';

-- Campagne 3: ledennieuwsbrief — one_off, aan Leden
UPDATE campaigns
SET
  campaign_type       = 'one_off',
  subject             = 'Ledennieuwsbrief Q2 2026 — Wat er allemaal speelt',
  preview_text        = 'Updates, evenementen en ledenvoordelen voor het tweede kwartaal',
  template_id         = (SELECT id FROM templates WHERE name = 'Basis e-mailtemplate' LIMIT 1),
  audience_type       = 'group',
  audience_group_id   = (SELECT id FROM contact_groups WHERE name = 'Leden'),
  audience_segment_id = NULL
WHERE id = '22222222-0000-0000-0000-000000000003';


-- ============================================================
-- 2. FUNNEL-STAPPEN — Phase 6-velden invullen
-- ============================================================

-- Stap 1: welkomstmail — altijd verzenden
UPDATE campaign_steps
SET
  subject        = 'Welkom bij Nomad For Life, {{first_name}}!',
  preview_text   = 'We zijn blij dat je erbij bent.',
  send_condition = '{"type":"always"}'::jsonb,
  status         = 'active'
WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
  AND step_order  = 1;

-- Stap 2: follow-up dag 3 — alleen als stap 1 geopend is
UPDATE campaign_steps
SET
  subject        = 'Hoe bevalt Nomad For Life, {{first_name}}?',
  preview_text   = 'We willen graag weten hoe het gaat.',
  send_condition = '{"type":"opened_previous"}'::jsonb,
  status         = 'active'
WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
  AND step_order  = 2;

-- Stap 3: slotmail dag 7 — altijd verzenden (ook zonder open)
UPDATE campaign_steps
SET
  subject        = 'Ons laatste bericht in deze reeks, {{first_name}}',
  preview_text   = 'Bedankt voor je aandacht — we hopen je te ontmoeten.',
  send_condition = '{"type":"always"}'::jsonb,
  status         = 'active'
WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
  AND step_order  = 3;


-- ============================================================
-- 3. NIEUWE ONE_OFF CAMPAGNE — "Campings prospectmailing mei 2026"
--    Status: ready (klaar om verstuurd te worden)
-- ============================================================

INSERT INTO campaigns (
  id, name, description, status,
  campaign_type, subject, preview_text,
  template_id,
  audience_type, audience_group_id,
  from_email, from_name,
  track_opens, track_clicks,
  planned_send_at
) VALUES (
  '22222222-0000-0000-0000-000000000004',
  'Campings prospectmailing mei 2026',
  'Eerste contact met nieuwe campings en camperplaatsen uit de meidatabase.',
  'ready',

  'one_off',
  'Nomad For Life zoekt samenwerking met {{company}}',
  'Ontdek wat lidmaatschap voor uw camping betekent',

  '11111111-0000-0000-0000-000000000001',  -- Welkomstmail template

  'group',
  (SELECT id FROM contact_groups WHERE name = 'Prospects'),

  'info@nomadforlife.nl',
  'Nomad For Life',
  true,
  true,

  now() + interval '2 days'  -- gepland voor overmorgen
);


-- ============================================================
-- 4. CONTACT_TYPE INVULLEN OP BESTAANDE SEED-CONTACTEN
-- ============================================================

UPDATE contacts SET contact_type = 'camping'
WHERE id IN (
  '33333333-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000003'
);

UPDATE contacts SET contact_type = 'sponsor'
WHERE id = '33333333-0000-0000-0000-000000000004';

UPDATE contacts SET contact_type = 'adverteerder'
WHERE id = '33333333-0000-0000-0000-000000000005';

UPDATE contacts SET contact_type = 'lid'
WHERE id = '33333333-0000-0000-0000-000000000006';

UPDATE contacts SET contact_type = 'prospect'
WHERE id = '33333333-0000-0000-0000-000000000007';


-- ============================================================
-- 5. BOUNCED CONTACT
--    Simuleert een hard-bounce zodat de UI deze status toont
-- ============================================================

INSERT INTO contacts (
  id, email, first_name, last_name, company,
  source, status, contact_type,
  opted_in, opted_in_at,
  bounced_at, bounce_type,
  tags
) VALUES (
  '33333333-0000-0000-0000-000000000009',
  'bounced@campingdehoeve.nl', 'Hans', 'Hoeve', 'Camping de Hoeve',
  'import', 'active', 'camping',
  true, now() - interval '20 days',
  now() - interval '5 days', 'hard',
  ARRAY['camping', 'nl', 'bounced']
);

INSERT INTO contact_group_members (contact_id, group_id)
SELECT '33333333-0000-0000-0000-000000000009', id
FROM contact_groups WHERE name = 'Campings & camperplaatsen'
ON CONFLICT DO NOTHING;

INSERT INTO consent_logs (contact_id, event_type, channel, notes, metadata) VALUES
  ('33333333-0000-0000-0000-000000000009', 'imported', 'import',
   'Import campings april 2026', '{"import_job_id":"55555555-0000-0000-0000-000000000001"}'::jsonb);


-- ============================================================
-- 6. OPT-IN TOKEN voor pending contact (Kees Oud)
--    Simuleert een verstuurd double opt-in bevestigingsverzoek
-- ============================================================

INSERT INTO opt_in_tokens (
  id, contact_id, token, used_at, created_at
) VALUES (
  gen_random_uuid(),
  '33333333-0000-0000-0000-000000000007',
  'dev-test-optin-token-kees-oud-0000000000000001',
  NULL,
  now() - interval '2 hours'
);


-- ============================================================
-- 7. UNSUBSCRIBE EVENT voor afgemeld contact
--    Bevestigt de opt-out die al in de contactstatus staat
-- ============================================================

INSERT INTO unsubscribe_events (
  id, contact_id, campaign_id, token, reason, used_at, ip_address, created_at
) VALUES (
  gen_random_uuid(),
  '33333333-0000-0000-0000-000000000008',
  '22222222-0000-0000-0000-000000000001',
  'dev-test-unsub-token-afgemeld-000000000000001',
  'Te veel e-mails',
  now() - interval '3 days',
  '145.22.100.55',
  now() - interval '3 days'
);


-- ============================================================
-- 8. ACTIVITY LOGS
--    Realistische admin-acties voor de activiteitshistorie
-- ============================================================

INSERT INTO activity_logs (action, entity_type, entity_id, description, metadata) VALUES

  ('campaign.created',
   'campaign', '22222222-0000-0000-0000-000000000001',
   'Campagne "Campings Outreach 2026" aangemaakt',
   '{"campaign_type":"funnel"}'::jsonb),

  ('campaign.activated',
   'campaign', '22222222-0000-0000-0000-000000000001',
   'Campagne geactiveerd — funnelstappen actief',
   '{}'::jsonb),

  ('contact.created',
   'contact', '33333333-0000-0000-0000-000000000001',
   'Contact jan.devries@kampeerparadijs.nl aangemaakt via import',
   '{"source":"import"}'::jsonb),

  ('contact.created',
   'contact', '33333333-0000-0000-0000-000000000006',
   'Contact sarah.mol@nomadlid.nl aangemaakt via website',
   '{"source":"website"}'::jsonb),

  ('contact.opted_out',
   'contact', '33333333-0000-0000-0000-000000000008',
   'Contact afgemeld@example.nl heeft zich globaal afgemeld',
   '{"reason":"Te veel e-mails"}'::jsonb),

  ('import.completed',
   'import_job', '55555555-0000-0000-0000-000000000001',
   'Import "campings_april_2026.csv" voltooid: 3/3 rijen geïmporteerd',
   '{"imported_rows":3,"skipped_rows":0,"failed_rows":0}'::jsonb),

  ('template.created',
   'template', '11111111-0000-0000-0000-000000000001',
   'Template "Welkomstmail — Campings" aangemaakt',
   '{}'::jsonb),

  ('campaign.ready',
   'campaign', '22222222-0000-0000-0000-000000000004',
   'Campagne "Campings prospectmailing mei 2026" gemarkeerd als ready',
   jsonb_build_object('planned_send_at', (now() + interval '2 days')::date)),

  ('contact.bounced',
   'contact', '33333333-0000-0000-0000-000000000009',
   'Hard bounce geregistreerd voor bounced@campingdehoeve.nl',
   '{"bounce_type":"hard"}'::jsonb);


-- ============================================================
-- 9. EXTRA MAIL LOG VARIANTEN
--    Voeg toe aan bestaande campaign runs: één failed, één skipped
-- ============================================================

DO $$
DECLARE
  run_id_jan   uuid;
  run_id_maria uuid;
  step2_id     uuid;
BEGIN
  -- Haal run IDs op
  SELECT id INTO run_id_jan
  FROM campaign_runs
  WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
    AND contact_id  = '33333333-0000-0000-0000-000000000001';

  SELECT id INTO run_id_maria
  FROM campaign_runs
  WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
    AND contact_id  = '33333333-0000-0000-0000-000000000002';

  SELECT id INTO step2_id
  FROM campaign_steps
  WHERE campaign_id = '22222222-0000-0000-0000-000000000001'
    AND step_order  = 2;

  -- Simuleer: Jan heeft stap 2 geopend maar stap 2 log is al pending — update naar een historisch failed log
  -- (aparte extra run voor een bounced contact)

  -- Voeg een campaign run toe voor het bounced contact
  INSERT INTO campaign_runs (campaign_id, contact_id, status, subscribed_at)
  VALUES ('22222222-0000-0000-0000-000000000001',
          '33333333-0000-0000-0000-000000000009',
          'bounced', now() - interval '5 days');

  -- Haal die run op en voeg een failed mail log toe
  INSERT INTO mail_logs (
    campaign_run_id, campaign_step_id, contact_id,
    status, scheduled_at, sent_at, error_message
  )
  SELECT
    cr.id, step2_id, cr.contact_id,
    'failed',
    now() - interval '5 days',
    now() - interval '5 days',
    'Permanent delivery failure: mailbox does not exist (550 5.1.1)'
  FROM campaign_runs cr
  WHERE cr.campaign_id = '22222222-0000-0000-0000-000000000001'
    AND cr.contact_id  = '33333333-0000-0000-0000-000000000009';

  -- Maria: stap 2 overgeslagen (send_condition not met — stap 1 niet geopend)
  UPDATE mail_logs
  SET status = 'skipped'
  WHERE campaign_run_id = run_id_maria
    AND campaign_step_id = step2_id
    AND status = 'pending';

END $$;
