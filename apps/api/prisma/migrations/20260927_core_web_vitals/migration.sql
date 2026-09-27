ALTER TABLE shared.ai_setting ADD COLUMN IF NOT EXISTS pagespeed_api_key_enc TEXT;
ALTER TABLE shared.ai_setting ADD COLUMN IF NOT EXISTS pagespeed_site_url VARCHAR(200);
ALTER TABLE shared.ai_setting ADD COLUMN IF NOT EXISTS pagespeed_auto_scan BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS shared.web_vital_sample (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  metric_id VARCHAR(100) NOT NULL,
  path VARCHAR(500) NOT NULL,
  name VARCHAR(8) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  device VARCHAR(16) NOT NULL DEFAULT 'desktop',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT web_vital_sample_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS web_vital_sample_metric_id_key ON shared.web_vital_sample (metric_id);
CREATE INDEX IF NOT EXISTS web_vital_sample_created_at_idx ON shared.web_vital_sample (created_at);
CREATE INDEX IF NOT EXISTS web_vital_sample_path_name_created_at_idx ON shared.web_vital_sample (path, name, created_at);

CREATE TABLE IF NOT EXISTS shared.cwv_scan (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  path VARCHAR(500) NOT NULL,
  url VARCHAR(700) NOT NULL,
  strategy VARCHAR(10) NOT NULL,
  performance INTEGER,
  crux_url BOOLEAN NOT NULL DEFAULT false,
  field_lcp_ms INTEGER,
  field_inp_ms INTEGER,
  field_cls DOUBLE PRECISION,
  origin_lcp_ms INTEGER,
  origin_inp_ms INTEGER,
  origin_cls DOUBLE PRECISION,
  lab_lcp_ms INTEGER,
  lab_tbt_ms INTEGER,
  lab_cls DOUBLE PRECISION,
  lab_fcp_ms INTEGER,
  lab_ttfb_ms INTEGER,
  error VARCHAR(400),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cwv_scan_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS cwv_scan_path_strategy_created_at_idx ON shared.cwv_scan (path, strategy, created_at);
CREATE INDEX IF NOT EXISTS cwv_scan_created_at_idx ON shared.cwv_scan (created_at);
