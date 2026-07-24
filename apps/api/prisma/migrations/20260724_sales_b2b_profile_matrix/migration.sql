-- Migration: ma trận hồ sơ Sales B2B + CandidateExperience
-- Chạy trên Postgres (schema candidate).

ALTER TABLE candidate.candidate_profile
  ADD COLUMN IF NOT EXISTS availability_band TEXT,
  ADD COLUMN IF NOT EXISTS expected_ote INTEGER,
  ADD COLUMN IF NOT EXISTS driver_license_type TEXT,
  ADD COLUMN IF NOT EXISTS travel_ability TEXT,
  ADD COLUMN IF NOT EXISTS desired_positions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS desired_locations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS career_motivations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_styles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS career_orientation TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS education_school TEXT,
  ADD COLUMN IF NOT EXISTS education_major TEXT,
  ADD COLUMN IF NOT EXISTS certificates TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS birth_year INTEGER,
  ADD COLUMN IF NOT EXISTS current_city TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE TABLE IF NOT EXISTS candidate.candidate_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate.candidate(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  start_year INTEGER,
  end_year INTEGER,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  industries TEXT[] NOT NULL DEFAULT '{}',
  products_sold TEXT[] NOT NULL DEFAULT '{}',
  customer_segments TEXT[] NOT NULL DEFAULT '{}',
  markets_covered TEXT[] NOT NULL DEFAULT '{}',
  selling_stages TEXT[] NOT NULL DEFAULT '{}',
  revenue_band TEXT,
  latest_revenue DOUBLE PRECISION,
  kpi_band TEXT,
  kpi_achievement_pct DOUBLE PRECISION,
  new_customer_ratio_band TEXT,
  new_customer_ratio_pct DOUBLE PRECISION,
  deal_type TEXT,
  typical_deal_value_band TEXT,
  typical_deal_value DOUBLE PRECISION,
  max_deal_value DOUBLE PRECISION,
  max_deal_role TEXT,
  highlights TEXT,
  job_description TEXT,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS candidate_experience_candidate_id_sort_order_idx
  ON candidate.candidate_experience (candidate_id, sort_order);
