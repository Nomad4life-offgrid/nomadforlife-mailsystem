-- Testmodus voor funnel-campagnes:
-- test_mode:          vervangt delay_days/delay_hours door minuten
-- test_delay_minutes: aantal minuten per stap (default 5)

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS test_mode          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_delay_minutes integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN campaigns.test_mode          IS 'Als true: delay_days/delay_hours vervangen door test_delay_minutes per stap';
COMMENT ON COLUMN campaigns.test_delay_minutes IS 'Minuten vertraging per stap in testmodus (default 5)';
