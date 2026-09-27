CREATE TABLE IF NOT EXISTS shared.indexing_notification (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  url VARCHAR(600) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status_code INTEGER,
  ok BOOLEAN NOT NULL DEFAULT false,
  error VARCHAR(300),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT indexing_notification_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS indexing_notification_created_at_idx
  ON shared.indexing_notification (created_at);
