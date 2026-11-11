-- Hạn mức hợp đồng ghi đè riêng theo công ty cho gói Enterprise (null = kế thừa gói gốc).

ALTER TABLE billing.billing_company_plan
  ADD COLUMN IF NOT EXISTS custom_job_post_quota INTEGER,
  ADD COLUMN IF NOT EXISTS custom_credit_quota INTEGER,
  ADD COLUMN IF NOT EXISTS custom_duration_days INTEGER;
