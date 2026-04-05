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
CREATE POLICY "admins_contact_lists" ON contact_lists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_list_items
CREATE POLICY "admins_contact_list_items" ON contact_list_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- segments
CREATE POLICY "admins_segments" ON segments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- import_jobs
CREATE POLICY "admins_import_jobs" ON import_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contacts
CREATE POLICY "admins_contacts" ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaigns
CREATE POLICY "admins_campaigns" ON campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaign_steps
CREATE POLICY "admins_campaign_steps" ON campaign_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- campaign_runs
CREATE POLICY "admins_campaign_runs" ON campaign_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- templates
CREATE POLICY "admins_templates" ON templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mail_logs
CREATE POLICY "admins_mail_logs" ON mail_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_groups
CREATE POLICY "admins_contact_groups" ON contact_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- contact_group_members
CREATE POLICY "admins_contact_group_members" ON contact_group_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Policies: append-only tabellen (geen DELETE voor admins) ──
-- consent_logs: admins mogen lezen en toevoegen, nooit verwijderen
CREATE POLICY "admins_consent_logs_read"   ON consent_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_consent_logs_insert" ON consent_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- activity_logs: admins mogen alleen lezen (systeem schrijft)
CREATE POLICY "admins_activity_logs_read"  ON activity_logs
  FOR SELECT TO authenticated USING (true);

-- ── Policies: publieke toegang voor opt-in/unsubscribe flows ──
-- opt_in_tokens: publiek leesbaar voor bevestigingspagina (service role schrijft)
CREATE POLICY "public_opt_in_tokens_select" ON opt_in_tokens
  FOR SELECT TO anon USING (true);

-- unsubscribe_events: publiek leesbaar voor afmeldpagina (service role schrijft)
CREATE POLICY "public_unsubscribe_events_select" ON unsubscribe_events
  FOR SELECT TO anon USING (true);
