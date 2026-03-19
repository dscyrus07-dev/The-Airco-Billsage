-- =============================================================================  
-- BILLSAGE SETTINGS MODULE MIGRATION
-- PostgreSQL 17 | Compatible with existing schema.sql
-- Adds missing company_settings table for notification and audit preferences
-- =============================================================================

-- Create company_settings table for preferences
CREATE TABLE IF NOT EXISTS company_settings (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                      UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Notification Preferences
    notification_duplicate_invoice   BOOLEAN NOT NULL DEFAULT true,
    notification_gst_mismatch       BOOLEAN NOT NULL DEFAULT true,
    notification_overdue_receivable BOOLEAN NOT NULL DEFAULT true,
    notification_overdue_payable    BOOLEAN NOT NULL DEFAULT true,
    notification_concentration_risk BOOLEAN NOT NULL DEFAULT true,
    notification_gstr_reminders     BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit Preferences
    lock_after_approval             BOOLEAN NOT NULL DEFAULT false,
    dual_approval                   BOOLEAN NOT NULL DEFAULT false,
    dual_approval_threshold         NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (dual_approval_threshold >= 0),
    
    -- Metadata
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by                      UUID REFERENCES users(id),
    updated_by                      UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);

-- Attach updated_at trigger
SELECT _attach_updated_at('company_settings');

-- =============================================================================  
-- Seed default GST tax rates for existing companies
-- =============================================================================

-- Function to seed GST rates for a company
CREATE OR REPLACE FUNCTION seed_gst_rates_for_company(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    -- Check if company already has GST rates
    SELECT COUNT(*) INTO existing_count
    FROM tax_rates 
    WHERE company_id = p_company_id AND tax_type = 'gst';
    
    -- Only seed if no GST rates exist
    IF existing_count = 0 THEN
        INSERT INTO tax_rates (company_id, tax_name, tax_type, cgst_rate, sgst_rate, igst_rate) VALUES
            (p_company_id, 'GST 5%', 'gst', 2.5, 2.5, 5.0),
            (p_company_id, 'GST 12%', 'gst', 6.0, 6.0, 12.0),
            (p_company_id, 'GST 18%', 'gst', 9.0, 9.0, 18.0),
            (p_company_id, 'GST 28%', 'gst', 14.0, 14.0, 28.0),
            (p_company_id, 'Exempt', 'exempt', 0.0, 0.0, 0.0),
            (p_company_id, 'Nil Rated', 'nil', 0.0, 0.0, 0.0);
        
        RAISE NOTICE 'Seeded GST rates for company %', p_company_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Seed GST rates for all existing companies
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN SELECT id FROM companies WHERE deleted_at IS NULL LOOP
        PERFORM seed_gst_rates_for_company(company_record.id);
    END LOOP;
END $$;

-- =============================================================================  
-- Create company_settings for existing companies
-- =============================================================================

-- Insert default settings for companies that don't have them
INSERT INTO company_settings (company_id)
SELECT id 
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM company_settings cs WHERE cs.company_id = c.id
)
  AND c.deleted_at IS NULL;

-- =============================================================================  
-- Ensure company_details exists for all companies
-- =============================================================================

-- Insert company_details for companies that don't have them
INSERT INTO company_details (company_id, country)
SELECT id, 'India'
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM company_details cd WHERE cd.company_id = c.id
)
  AND c.deleted_at IS NULL;

-- =============================================================================  
-- Verification queries (run these to verify migration)
-- =============================================================================

-- Check company_settings
-- SELECT COUNT(*) as company_settings_count FROM company_settings;

-- Check tax_rates
-- SELECT company_id, COUNT(*) as gst_rate_count FROM tax_rates WHERE tax_type = 'gst' GROUP BY company_id;

-- Check company_details
-- SELECT COUNT(*) as company_details_count FROM company_details;

-- =============================================================================  
-- Migration Complete
-- =============================================================================
