-- Migration: Add company_settings table
-- Date: 2026-03-16
-- Description: Adds company_settings table for notification and audit settings

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
    id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                          UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    -- Notification Settings
    notification_duplicate_invoice      BOOLEAN NOT NULL DEFAULT TRUE,
    notification_gst_mismatch           BOOLEAN NOT NULL DEFAULT TRUE,
    notification_overdue_receivable     BOOLEAN NOT NULL DEFAULT TRUE,
    notification_overdue_payable        BOOLEAN NOT NULL DEFAULT TRUE,
    notification_concentration_risk     BOOLEAN NOT NULL DEFAULT TRUE,
    notification_gstr_reminders         BOOLEAN NOT NULL DEFAULT TRUE,
    -- Audit Settings
    lock_after_approval                 BOOLEAN NOT NULL DEFAULT FALSE,
    dual_approval                       BOOLEAN NOT NULL DEFAULT FALSE,
    dual_approval_threshold             NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_company_settings_set_updated_at ON company_settings;
CREATE TRIGGER trg_company_settings_set_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Insert default settings for existing companies
INSERT INTO company_settings (
    company_id,
    notification_duplicate_invoice,
    notification_gst_mismatch,
    notification_overdue_receivable,
    notification_overdue_payable,
    notification_concentration_risk,
    notification_gstr_reminders,
    lock_after_approval,
    dual_approval,
    dual_approval_threshold
)
SELECT 
    id,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    0
FROM companies
WHERE id NOT IN (SELECT company_id FROM company_settings)
AND deleted_at IS NULL;
