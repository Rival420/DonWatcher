-- Migration 004: Add Risk Integration Tables
-- Phase 3 - Complementary Risk Score Integration
-- IDEMPOTENT: Safe to run multiple times

-- Create enum for risk categories (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_category') THEN
        CREATE TYPE risk_category AS ENUM (
            'access_governance',
            'privilege_escalation', 
            'compliance_posture',
            'operational_risk'
        );
        RAISE NOTICE 'Created risk_category enum';
    ELSE
        RAISE NOTICE 'risk_category enum already exists';
    END IF;
END $$;

-- Create enum for risk trend directions (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_trend') THEN
        CREATE TYPE risk_trend AS ENUM ('improving', 'stable', 'degrading');
        RAISE NOTICE 'Created risk_trend enum';
    ELSE
        RAISE NOTICE 'risk_trend enum already exists';
    END IF;
END $$;

-- Domain risk assessments table
CREATE TABLE IF NOT EXISTS domain_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Domain group risk category scores (0-100)
    access_governance_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    privilege_escalation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    compliance_posture_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    operational_risk_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Overall domain group risk score (0-100)
    domain_group_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Risk calculation metadata
    calculation_metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual group risk assessments
CREATE TABLE IF NOT EXISTS group_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_assessment_id UUID NOT NULL REFERENCES domain_risk_assessments(id) ON DELETE CASCADE,
    
    -- Group information
    group_name TEXT NOT NULL,
    total_members INTEGER NOT NULL DEFAULT 0,
    accepted_members INTEGER NOT NULL DEFAULT 0,
    unaccepted_members INTEGER NOT NULL DEFAULT 0,
    
    -- Risk assessment
    risk_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'low',
    
    -- Risk contributing factors
    contributing_factors JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Global risk scores table (combines PingCastle + Domain Groups)
CREATE TABLE IF NOT EXISTS global_risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Component scores
    pingcastle_score DECIMAL(5,2),
    domain_group_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Combined global score
    global_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Score contributions (percentages)
    pingcastle_contribution DECIMAL(5,2),
    domain_group_contribution DECIMAL(5,2) NOT NULL DEFAULT 100,
    
    -- Risk trend analysis
    trend_direction risk_trend DEFAULT 'stable',
    trend_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Links to source assessments
    pingcastle_report_id UUID,
    domain_assessment_id UUID REFERENCES domain_risk_assessments(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk calculation history for trending
CREATE TABLE IF NOT EXISTS risk_calculation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    calculation_trigger TEXT NOT NULL,
    risk_scores JSONB DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk thresholds and configuration
CREATE TABLE IF NOT EXISTS risk_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    
    -- Risk calculation weights
    pingcastle_weight DECIMAL(3,2) DEFAULT 0.70,
    domain_group_weight DECIMAL(3,2) DEFAULT 0.30,
    
    -- Category weights for domain group score
    access_governance_weight DECIMAL(3,2) DEFAULT 0.30,
    privilege_escalation_weight DECIMAL(3,2) DEFAULT 0.40,
    compliance_posture_weight DECIMAL(3,2) DEFAULT 0.20,
    operational_risk_weight DECIMAL(3,2) DEFAULT 0.10,
    
    -- Alert thresholds
    global_risk_alert_threshold INTEGER DEFAULT 75,
    domain_group_alert_threshold INTEGER DEFAULT 60,
    critical_group_alert_threshold INTEGER DEFAULT 50,
    
    -- Configuration metadata
    configuration_metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_domain_risk_assessments_domain_date ON domain_risk_assessments(domain, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_group_risk_assessments_domain_assessment ON group_risk_assessments(domain_assessment_id);
CREATE INDEX IF NOT EXISTS idx_group_risk_assessments_group_name ON group_risk_assessments(group_name);
CREATE INDEX IF NOT EXISTS idx_global_risk_scores_domain_date ON global_risk_scores(domain, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_domain ON risk_calculation_history(domain);
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_calculated_at ON risk_calculation_history(calculated_at DESC);

-- Drop existing views (regular or materialized) to recreate as materialized view
DROP VIEW IF EXISTS risk_dashboard_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS risk_dashboard_summary CASCADE;

-- Create materialized view for risk dashboard
CREATE MATERIALIZED VIEW risk_dashboard_summary AS
SELECT 
    grs.domain,
    grs.assessment_date,
    grs.global_score,
    grs.pingcastle_score,
    grs.domain_group_score,
    grs.trend_direction,
    grs.trend_percentage,
    
    -- Domain group breakdown
    dra.access_governance_score,
    dra.privilege_escalation_score,
    dra.compliance_posture_score,
    dra.operational_risk_score,
    
    -- Group statistics
    (dra.calculation_metadata->>'group_count')::INTEGER as total_groups,
    (dra.calculation_metadata->>'critical_groups')::INTEGER as critical_groups,
    (dra.calculation_metadata->>'high_risk_groups')::INTEGER as high_risk_groups,
    (dra.calculation_metadata->>'total_members')::INTEGER as total_members,
    (dra.calculation_metadata->>'total_unaccepted')::INTEGER as total_unaccepted,
    
    -- Risk level classification
    CASE 
        WHEN grs.global_score >= 75 THEN 'critical'
        WHEN grs.global_score >= 50 THEN 'high'
        WHEN grs.global_score >= 25 THEN 'medium'
        ELSE 'low'
    END as risk_level,
    
    grs.created_at
FROM global_risk_scores grs
LEFT JOIN domain_risk_assessments dra ON grs.domain_assessment_id = dra.id
WHERE grs.assessment_date = (
    SELECT MAX(assessment_date) 
    FROM global_risk_scores grs2 
    WHERE grs2.domain = grs.domain
);

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_dashboard_summary_domain ON risk_dashboard_summary(domain);

-- Function to refresh risk dashboard summary (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION refresh_risk_dashboard_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY risk_dashboard_summary;
EXCEPTION
    WHEN OTHERS THEN
        -- Fall back to non-concurrent refresh if concurrent fails
        REFRESH MATERIALIZED VIEW risk_dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate risk trends
CREATE OR REPLACE FUNCTION calculate_risk_trend(
    p_domain TEXT,
    p_current_score DECIMAL,
    p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE(trend_direction risk_trend, trend_percentage DECIMAL) AS $$
DECLARE
    previous_score DECIMAL;
    score_change DECIMAL;
BEGIN
    -- Get previous score from specified days back
    SELECT grs.global_score INTO previous_score
    FROM global_risk_scores grs
    WHERE grs.domain = p_domain
      AND grs.assessment_date <= NOW() - INTERVAL '1 day' * p_days_back
    ORDER BY grs.assessment_date DESC
    LIMIT 1;
    
    IF previous_score IS NULL THEN
        -- No historical data
        RETURN QUERY SELECT 'stable'::risk_trend, 0.0::DECIMAL;
        RETURN;
    END IF;
    
    score_change := p_current_score - previous_score;
    
    IF ABS(score_change) < 5 THEN
        RETURN QUERY SELECT 'stable'::risk_trend, ABS(score_change);
    ELSIF score_change > 0 THEN
        RETURN QUERY SELECT 'degrading'::risk_trend, ABS(score_change);
    ELSE
        RETURN QUERY SELECT 'improving'::risk_trend, ABS(score_change);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert default risk configurations for existing domains
INSERT INTO risk_configuration (domain, created_by)
SELECT DISTINCT domain, 'migration_004'
FROM reports
WHERE domain IS NOT NULL
ON CONFLICT (domain) DO NOTHING;

-- Create trigger to auto-refresh risk dashboard when scores change
CREATE OR REPLACE FUNCTION trigger_refresh_risk_dashboard()
RETURNS trigger AS $$
BEGIN
    -- Refresh the materialized view after any change to global risk scores
    PERFORM refresh_risk_dashboard_summary();
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the transaction if refresh fails
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic refresh (drop first if exists)
DROP TRIGGER IF EXISTS trigger_global_risk_scores_refresh ON global_risk_scores;
CREATE TRIGGER trigger_global_risk_scores_refresh
    AFTER INSERT OR UPDATE OR DELETE ON global_risk_scores
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_risk_dashboard();

DROP TRIGGER IF EXISTS trigger_domain_risk_assessments_refresh ON domain_risk_assessments;
CREATE TRIGGER trigger_domain_risk_assessments_refresh
    AFTER INSERT OR UPDATE OR DELETE ON domain_risk_assessments
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_risk_dashboard();

-- Add comments for documentation
COMMENT ON TABLE domain_risk_assessments IS 'Domain-level risk assessments based on group membership analysis';
COMMENT ON TABLE group_risk_assessments IS 'Individual group risk assessments with contributing factors';
COMMENT ON TABLE global_risk_scores IS 'Combined global risk scores integrating PingCastle and domain group risks';
COMMENT ON TABLE risk_calculation_history IS 'Historical record of risk calculations for trending and audit';
COMMENT ON TABLE risk_configuration IS 'Configurable risk calculation parameters per domain';

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Migration 004 completed successfully';
END $$;
