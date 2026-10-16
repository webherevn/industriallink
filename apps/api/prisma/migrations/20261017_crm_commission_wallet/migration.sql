-- Ví số dư hoa hồng trên inlink. Mỗi khoản đã ghi được cộng một lần.
CREATE TABLE "crm"."crm_commission_wallet" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_commission_wallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_commission_wallet_partner_id_key" ON "crm"."crm_commission_wallet"("partner_id");

ALTER TABLE "crm"."crm_commission_wallet"
  ADD CONSTRAINT "crm_commission_wallet_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "crm"."crm_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "crm"."crm_commission_wallet_txn" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL,
  "partner_id" UUID NOT NULL,
  "commission_entry_id" UUID NOT NULL,
  "amount_vnd" BIGINT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'credit',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_commission_wallet_txn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_commission_wallet_txn_kind" CHECK ("kind" = 'credit'),
  CONSTRAINT "crm_commission_wallet_txn_amount" CHECK ("amount_vnd" > 0)
);

CREATE UNIQUE INDEX "crm_commission_wallet_txn_commission_entry_id_key" ON "crm"."crm_commission_wallet_txn"("commission_entry_id");
CREATE INDEX "crm_commission_wallet_txn_partner_id_idx" ON "crm"."crm_commission_wallet_txn"("partner_id");

ALTER TABLE "crm"."crm_commission_wallet_txn"
  ADD CONSTRAINT "crm_commission_wallet_txn_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "crm"."crm_commission_wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm"."crm_commission_wallet_txn"
  ADD CONSTRAINT "crm_commission_wallet_txn_entry_id_fkey"
  FOREIGN KEY ("commission_entry_id") REFERENCES "crm"."crm_commission_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "crm"."crm_commission_wallet" ("id", "partner_id", "created_at", "updated_at")
SELECT gen_random_uuid(), "partner_id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "partner_id" FROM "crm"."crm_commission_entry") AS "earned";

INSERT INTO "crm"."crm_commission_wallet_txn" (
  "id", "wallet_id", "partner_id", "commission_entry_id", "amount_vnd", "kind", "created_at"
)
SELECT gen_random_uuid(), "wallet"."id", "entry"."partner_id", "entry"."id", "entry"."commission_vnd", 'credit', "entry"."created_at"
FROM "crm"."crm_commission_entry" AS "entry"
JOIN "crm"."crm_commission_wallet" AS "wallet" ON "wallet"."partner_id" = "entry"."partner_id";
