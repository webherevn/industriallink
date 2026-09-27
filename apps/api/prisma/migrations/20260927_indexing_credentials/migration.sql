ALTER TABLE shared.ai_setting ADD COLUMN IF NOT EXISTS indexing_credentials_enc TEXT;
ALTER TABLE shared.ai_setting ADD COLUMN IF NOT EXISTS indexing_auto_notify BOOLEAN NOT NULL DEFAULT true;
