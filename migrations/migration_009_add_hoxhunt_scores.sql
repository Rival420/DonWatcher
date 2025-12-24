-- Migration 009: Add Hoxhunt Security Awareness Scores
-- 
-- This migration adds support for tracking Hoxhunt security awareness training
-- metrics. Scores are entered manually on a monthly basis and include three
-- main categories: Culture & Engagement, Competence, and Real Threat Detection.
--
-- Each category has multiple sub-metrics, all scored 0-100.

-- =============================================================================
-- Hoxhunt Security Awareness Scores Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS hoxhunt_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    assessment_date DATE NOT NULL,
    
    -- Overall calculated score (weighted average of category scores)
    overall_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- ==========================================================================
    -- Culture & Engagement Category
    -- ==========================================================================
    culture_engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    ce_onboarding_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    ce_simulations_reported DECIMAL(5,2) NOT NULL DEFAULT 0,
    ce_simulations_misses DECIMAL(5,2) NOT NULL DEFAULT 0,
    ce_threat_indicators DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- ==========================================================================
    -- Competence Category
    -- ==========================================================================
    competence_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    comp_simulations_fails DECIMAL(5,2) NOT NULL DEFAULT 0,
    comp_simulations_reported DECIMAL(5,2) NOT NULL DEFAULT 0,
    comp_quiz_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    comp_threat_detection_accuracy DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- ==========================================================================
    -- Real Threat Detection Category
    -- ==========================================================================
    real_threat_detection_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    rtd_simulations_reported DECIMAL(5,2) NOT NULL DEFAULT 0,
    rtd_simulations_misses DECIMAL(5,2) NOT NULL DEFAULT 0,
    rtd_reporting_speed DECIMAL(5,2) NOT NULL DEFAULT 0,
    rtd_threat_reporting_activity DECIMAL(5,2) NOT NULL DEFAULT 0,
    rtd_threat_detection_accuracy DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- ==========================================================================
    -- Metadata
    -- ==========================================================================
    notes TEXT,
    entered_by TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: One entry per domain per assessment date (typically monthly)
    UNIQUE(domain, assessment_date)
);

-- Comments for documentation
COMMENT ON TABLE hoxhunt_scores IS 'Hoxhunt security awareness training scores, entered manually on a monthly basis';
COMMENT ON COLUMN hoxhunt_scores.overall_score IS 'Calculated overall score (average of three category scores)';
COMMENT ON COLUMN hoxhunt_scores.culture_engagement_score IS 'Culture & Engagement category score (average of ce_* metrics)';
COMMENT ON COLUMN hoxhunt_scores.competence_score IS 'Competence category score (average of comp_* metrics)';
COMMENT ON COLUMN hoxhunt_scores.real_threat_detection_score IS 'Real Threat Detection category score (average of rtd_* metrics)';

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_hoxhunt_scores_domain 
    ON hoxhunt_scores(domain);

CREATE INDEX IF NOT EXISTS idx_hoxhunt_scores_date 
    ON hoxhunt_scores(assessment_date DESC);

CREATE INDEX IF NOT EXISTS idx_hoxhunt_scores_domain_date 
    ON hoxhunt_scores(domain, assessment_date DESC);

-- =============================================================================
-- Update Global Risk Scores to Include Hoxhunt
-- =============================================================================

-- Add hoxhunt score column to global risk scores
ALTER TABLE global_risk_scores 
    ADD COLUMN IF NOT EXISTS hoxhunt_score DECIMAL(5,2);

ALTER TABLE global_risk_scores 
    ADD COLUMN IF NOT EXISTS hoxhunt_contribution DECIMAL(5,2);

COMMENT ON COLUMN global_risk_scores.hoxhunt_score IS 'Hoxhunt overall score at time of assessment (NULL if no Hoxhunt data)';
COMMENT ON COLUMN global_risk_scores.hoxhunt_contribution IS 'Percentage contribution of Hoxhunt to global score';

-- =============================================================================
-- Update Risk Configuration for Hoxhunt Weight
-- =============================================================================

ALTER TABLE risk_configuration
    ADD COLUMN IF NOT EXISTS hoxhunt_weight DECIMAL(3,2) DEFAULT 0.15;

COMMENT ON COLUMN risk_configuration.hoxhunt_weight IS 'Weight of Hoxhunt score in global risk calculation (default 15%)';

-- Update existing configurations to have hoxhunt_weight
-- and rebalance existing weights if needed
UPDATE risk_configuration 
SET hoxhunt_weight = 0.15
WHERE hoxhunt_weight IS NULL;

-- =============================================================================
-- View for Latest Hoxhunt Scores per Domain
-- =============================================================================

CREATE OR REPLACE VIEW v_latest_hoxhunt_scores AS
SELECT DISTINCT ON (domain)
    id,
    domain,
    assessment_date,
    overall_score,
    culture_engagement_score,
    competence_score,
    real_threat_detection_score,
    ce_onboarding_rate,
    ce_simulations_reported,
    ce_simulations_misses,
    ce_threat_indicators,
    comp_simulations_fails,
    comp_simulations_reported,
    comp_quiz_score,
    comp_threat_detection_accuracy,
    rtd_simulations_reported,
    rtd_simulations_misses,
    rtd_reporting_speed,
    rtd_threat_reporting_activity,
    rtd_threat_detection_accuracy,
    notes,
    entered_by,
    created_at,
    updated_at
FROM hoxhunt_scores
ORDER BY domain, assessment_date DESC;

COMMENT ON VIEW v_latest_hoxhunt_scores IS 'Latest Hoxhunt scores for each domain';

-- =============================================================================
-- Hoxhunt Dashboard Summary View
-- =============================================================================

CREATE OR REPLACE VIEW v_hoxhunt_dashboard AS
SELECT 
    hs.domain,
    hs.assessment_date,
    hs.overall_score,
    hs.culture_engagement_score,
    hs.competence_score,
    hs.real_threat_detection_score,
    -- Risk level based on overall score (inverted - higher score = lower risk)
    CASE 
        WHEN hs.overall_score >= 80 THEN 'low'
        WHEN hs.overall_score >= 60 THEN 'medium'
        WHEN hs.overall_score >= 40 THEN 'high'
        ELSE 'critical'
    END as awareness_level,
    -- Trend calculation (compare to previous month)
    LAG(hs.overall_score) OVER (PARTITION BY hs.domain ORDER BY hs.assessment_date) as previous_score,
    hs.overall_score - COALESCE(LAG(hs.overall_score) OVER (PARTITION BY hs.domain ORDER BY hs.assessment_date), hs.overall_score) as score_change,
    hs.entered_by,
    hs.created_at
FROM hoxhunt_scores hs
WHERE hs.assessment_date = (
    SELECT MAX(assessment_date) 
    FROM hoxhunt_scores 
    WHERE domain = hs.domain
);

COMMENT ON VIEW v_hoxhunt_dashboard IS 'Dashboard summary view for Hoxhunt scores with trend information';
