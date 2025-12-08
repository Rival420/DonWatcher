-- Migration 005: Ensure risk dashboard objects exist
-- IDEMPOTENT: Safe to run multiple times
-- Note: Most objects are now created in migration_004, this migration ensures completeness

-- Create risk_calculation_history table if not exists
CREATE TABLE IF NOT EXISTS risk_calculation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    calculation_trigger TEXT NOT NULL,
    risk_scores JSONB DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_domain ON risk_calculation_history(domain);
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_calculated_at ON risk_calculation_history(calculated_at DESC);

-- Create additional indexes for domain/assessment_date queries
CREATE INDEX IF NOT EXISTS idx_domain_risk_assessments_domain_assessment ON domain_risk_assessments(domain, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_global_risk_scores_domain_assessment ON global_risk_scores(domain, assessment_date DESC);

-- Add helpful comments
DO $$
BEGIN
    COMMENT ON TABLE risk_calculation_history IS 'Audit trail for risk calculations - tracks when and why risk scores were recalculated';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'risk_calculation_history table does not exist yet';
END $$;

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Migration 005 completed successfully';
END $$;
