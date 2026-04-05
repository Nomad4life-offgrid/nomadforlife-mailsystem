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
