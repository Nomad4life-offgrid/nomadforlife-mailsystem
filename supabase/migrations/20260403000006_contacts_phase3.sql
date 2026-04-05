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
