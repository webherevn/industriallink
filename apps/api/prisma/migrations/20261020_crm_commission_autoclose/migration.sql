-- Kỳ hệ thống tự chốt không gắn với một tài khoản SuperAdmin.
ALTER TABLE "crm"."crm_commission_period" ALTER COLUMN "closed_by_user_id" DROP NOT NULL;
