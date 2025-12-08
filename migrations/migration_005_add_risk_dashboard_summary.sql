-- Migration 005: Add risk dashboard summary view and risk calculation history table
-- This migration adds missing database objects referenced in the risk_service.py

-- Create risk_calculation_history table for audit trail
CREATE TABLE IF NOT EXISTS risk_calculation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    calculation_trigger TEXT NOT NULL,  -- 'member_change', 'scheduled', 'manual', etc.
    risk_scores JSONB DEFAULT '{}',     -- Context and calculation details
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_domain ON risk_calculation_history(domain);
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_calculated_at ON risk_calculation_history(calculated_at DESC);

-- Create unique expression indexes for domain/day uniqueness (if not exists)
-- These replace the invalid UNIQUE constraints that used DATE() function
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_risk_assessments_domain_day 
    ON domain_risk_assessments(domain, DATE(assessment_date));
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_risk_scores_domain_day 
    ON global_risk_scores(domain, DATE(assessment_date));

-- Create the risk_dashboard_summary view for cross-domain comparison
CREATE OR REPLACE VIEW risk_dashboard_summary AS
SELECT 
    grs.domain,
    grs.global_score,
    grs.pingcastle_score,
    grs.domain_group_score,
    grs.trend_direction,
    CASE 
        WHEN grs.global_score >= 75 THEN 'critical'
        WHEN grs.global_score >= 50 THEN 'high'
        WHEN grs.global_score >= 25 THEN 'medium'
        ELSE 'low'
    END as risk_level,
    dra.total_groups,
    dra.critical_groups,
    dra.high_risk_groups,
    dra.total_members,
    dra.total_unaccepted,
    grs.assessment_date
FROM global_risk_scores grs
LEFT JOIN LATERAL (
    SELECT 
        dra_inner.domain,
        COUNT(DISTINCT gra.group_name) as total_groups,
        COUNT(DISTINCT CASE WHEN gra.risk_level = 'critical' THEN gra.group_name END) as critical_groups,
        COUNT(DISTINCT CASE WHEN gra.risk_score > 50 THEN gra.group_name END) as high_risk_groups,
        COALESCE(SUM(gra.total_members), 0) as total_members,
        COALESCE(SUM(gra.unaccepted_members), 0) as total_unaccepted
    FROM domain_risk_assessments dra_inner
    LEFT JOIN group_risk_assessments gra ON gra.domain_assessment_id = dra_inner.id
    WHERE dra_inner.domain = grs.domain
      AND DATE(dra_inner.assessment_date) = DATE(grs.assessment_date)
    GROUP BY dra_inner.domain
) dra ON true
WHERE grs.assessment_date = (
    SELECT MAX(assessment_date) 
    FROM global_risk_scores 
    WHERE domain = grs.domain
);

-- Add helpful comment
COMMENT ON VIEW risk_dashboard_summary IS 'Aggregated risk summary for dashboard comparison across domains';
COMMENT ON TABLE risk_calculation_history IS 'Audit trail for risk calculations - tracks when and why risk scores were recalculated';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 005 completed: risk_dashboard_summary view and risk_calculation_history table created';
END $$;

