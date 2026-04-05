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
