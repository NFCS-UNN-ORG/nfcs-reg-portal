-- ============================================================
-- MIGRATION 007: PAYSTACK & FLUTTERWAVE GATEWAY MIGRATION
-- ============================================================

-- Add 'abandoned' status to payment_status enum
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'abandoned';

-- Add gateway_reference for unique tracking of Paystack/Flutterwave refs
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_reference TEXT UNIQUE;

-- Add generic checkout_url for storing Paystack authorization_url or Flutterwave link
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_url TEXT;

-- Create index on gateway_reference for fast lookup during callbacks & webhooks
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference ON payments(gateway_reference);

-- Create index on gateway column
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments(gateway);
