-- Migration: Create extraction_reviews table for storing purchase upload extraction data
-- This table stores the intermediate extraction/review state before purchase confirmation

CREATE TABLE IF NOT EXISTS extraction_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Upload metadata
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Extraction metadata
    ocr_confidence NUMERIC(5,4),
    llm_confidence NUMERIC(5,4),
    overall_confidence NUMERIC(5,4),
    ocr_pages INTEGER,
    text_length INTEGER,
    
    -- Extracted data (JSONB for flexibility)
    extracted_data JSONB NOT NULL,
    normalized_data JSONB,
    
    -- Matching results
    supplier_matched BOOLEAN DEFAULT FALSE,
    supplier_match_data JSONB,
    products_matched INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    matching_failed BOOLEAN DEFAULT FALSE,
    
    -- Validation and warnings
    normalization_warnings JSONB,
    normalization_errors JSONB,
    matching_warnings JSONB,
    
    -- Workflow status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status values: pending, needs_vendor_review, completed, confirmed, rejected, failed
    
    -- If confirmed, link to created purchase
    confirmed_purchase_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP,
    confirmed_by UUID REFERENCES users(id),
    
    -- If rejected
    rejected_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    -- Audit trail
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT chk_extraction_reviews_status CHECK (
        status IN ('pending', 'needs_vendor_review', 'completed', 'confirmed', 'rejected', 'failed')
    )
);

-- Indexes for performance
CREATE INDEX idx_extraction_reviews_company_id ON extraction_reviews(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_extraction_reviews_uploaded_by ON extraction_reviews(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_extraction_reviews_status ON extraction_reviews(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_extraction_reviews_uploaded_at ON extraction_reviews(uploaded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_extraction_reviews_confirmed_purchase ON extraction_reviews(confirmed_purchase_id) WHERE confirmed_purchase_id IS NOT NULL;

-- GIN index for JSONB search
CREATE INDEX idx_extraction_reviews_extracted_data ON extraction_reviews USING gin(extracted_data);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_extraction_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_extraction_reviews_updated_at
    BEFORE UPDATE ON extraction_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_extraction_reviews_updated_at();

-- Comments
COMMENT ON TABLE extraction_reviews IS 'Stores extraction/review data from purchase bill uploads before confirmation';
COMMENT ON COLUMN extraction_reviews.status IS 'Workflow status: pending, needs_vendor_review, completed, confirmed, rejected, failed';
COMMENT ON COLUMN extraction_reviews.extracted_data IS 'Frontend-compatible extracted data structure';
COMMENT ON COLUMN extraction_reviews.normalized_data IS 'Backend-normalized data structure';
COMMENT ON COLUMN extraction_reviews.supplier_match_data IS 'Supplier matching results including prefill data for new vendors';
