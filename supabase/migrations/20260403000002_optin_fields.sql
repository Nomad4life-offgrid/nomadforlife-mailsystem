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
