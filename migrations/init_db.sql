-- Initialize database schema for DonWatcher
-- This file is run once when the PostgreSQL container is first created

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better data integrity
CREATE TYPE security_tool_type AS ENUM ('pingcastle', 'locksmith', 'domain_analysis', 'domain_group_members', 'custom');
CREATE TYPE finding_status AS ENUM ('new', 'accepted', 'resolved', 'false_positive');
CREATE TYPE risk_category AS ENUM ('access_governance', 'privilege_escalation', 'compliance_posture', 'operational_risk');
CREATE TYPE risk_trend AS ENUM ('improving', 'stable', 'degrading');

-- Reports table - now supports multiple security tools
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type security_tool_type NOT NULL,
    domain TEXT NOT NULL,
    report_date TIMESTAMP WITH TIME ZONE NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- PingCastle specific fields
    global_score INTEGER DEFAULT 0,
    high_score INTEGER DEFAULT 0,
    medium_score INTEGER DEFAULT 0,
    low_score INTEGER DEFAULT 0,
    stale_objects_score INTEGER DEFAULT 0,
    privileged_accounts_score INTEGER DEFAULT 0,
    trusts_score INTEGER DEFAULT 0,
    anomalies_score INTEGER DEFAULT 0,
    
    -- Domain metadata
    domain_sid TEXT,
    domain_functional_level TEXT,
    forest_functional_level TEXT,
    maturity_level TEXT,
    dc_count INTEGER DEFAULT 0,
    user_count INTEGER DEFAULT 0,
    computer_count INTEGER DEFAULT 0,
    
    -- File references
    original_file TEXT,
    html_file TEXT,
    
    -- Extensible metadata for different tools
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Findings table - now supports multiple tools and enhanced tracking
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    tool_type security_tool_type NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    severity TEXT DEFAULT 'medium',
    description TEXT,
    recommendation TEXT,
    status finding_status DEFAULT 'new',
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk catalog - master list of all known security findings
CREATE TABLE risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type security_tool_type NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    severity TEXT DEFAULT 'medium',
    
    -- Make tool_type + category + name unique
    UNIQUE(tool_type, category, name),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accepted risks - risks marked as acceptable by the organization
CREATE TABLE accepted_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type security_tool_type NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    reason TEXT,
    accepted_by TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Reference to the risk catalog
    FOREIGN KEY(tool_type, category, name) REFERENCES risks(tool_type, category, name),
    UNIQUE(tool_type, category, name)
);

-- Monitored groups - groups that should be tracked for membership changes
CREATE TABLE monitored_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name TEXT NOT NULL,
    group_sid TEXT,
    domain TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    alert_on_changes BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain, group_name)
);

-- Group memberships - track who is in which monitored groups
CREATE TABLE group_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES monitored_groups(id),
    member_name TEXT NOT NULL,
    member_sid TEXT,
    member_type TEXT DEFAULT 'user', -- user, computer, group
    is_direct_member BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(report_id, group_id, member_sid)
);

-- Settings table - application configuration
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent configurations - for future agent-based data collection
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    agent_type TEXT NOT NULL, -- 'domain_scanner', 'locksmith', etc.
    domain TEXT NOT NULL,
    endpoint_url TEXT,
    api_key TEXT,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_reports_tool_type ON reports(tool_type);
CREATE INDEX idx_reports_domain ON reports(domain);
CREATE INDEX idx_reports_report_date ON reports(report_date);
CREATE INDEX idx_findings_report_id ON findings(report_id);
CREATE INDEX idx_findings_tool_type ON findings(tool_type);
CREATE INDEX idx_findings_category ON findings(category);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_group_memberships_report_id ON group_memberships(report_id);
CREATE INDEX idx_group_memberships_group_id ON group_memberships(group_id);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
    ('webhook_url', '', 'Webhook URL for alerts'),
    ('alert_message', 'New security findings detected in {domain}: {findings_count} unaccepted findings', 'Template for alert messages'),
    ('retention_days', '365', 'Number of days to retain old reports'),
    ('auto_accept_low_severity', 'false', 'Automatically accept low severity findings');

-- Accepted group members - individual members marked as acceptable in groups
CREATE TABLE accepted_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_sid TEXT,
    domain TEXT NOT NULL,
    reason TEXT,
    accepted_by TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain, group_name, member_name)
);

-- Group risk configurations - configurable risk scores per group
CREATE TABLE group_risk_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name TEXT NOT NULL,
    domain TEXT NOT NULL,
    base_risk_score INTEGER DEFAULT 10,
    max_acceptable_members INTEGER DEFAULT 5,
    alert_threshold INTEGER DEFAULT 10,
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain, group_name)
);

-- Insert default monitored groups (common high-privilege groups)
INSERT INTO monitored_groups (group_name, domain, description, alert_on_changes) VALUES
    ('Domain Admins', '*', 'Domain administrators group', true),
    ('Enterprise Admins', '*', 'Enterprise administrators group', true),
    ('Schema Admins', '*', 'Schema administrators group', true),
    ('Administrators', '*', 'Local administrators group', true),
    ('Account Operators', '*', 'Account operators group', true),
    ('Backup Operators', '*', 'Backup operators group', true),
    ('Server Operators', '*', 'Server operators group', true),
    ('Print Operators', '*', 'Print operators group', true);

-- Insert default group risk configurations
INSERT INTO group_risk_configs (group_name, domain, base_risk_score, max_acceptable_members, alert_threshold) VALUES
    ('Domain Admins', '*', 35, 3, 5),
    ('Enterprise Admins', '*', 40, 2, 3),
    ('Schema Admins', '*', 30, 1, 2),
    ('Administrators', '*', 25, 5, 8),
    ('Account Operators', '*', 20, 3, 6),
    ('Backup Operators', '*', 15, 5, 8),
    ('Server Operators', '*', 15, 3, 6),
    ('Print Operators', '*', 10, 5, 8);

-- Phase 1 Enhancement: Add member status tracking
ALTER TABLE group_memberships ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT NULL;
COMMENT ON COLUMN group_memberships.is_enabled IS 'Member account enabled status from AD (NULL for groups or unknown status)';

-- Phase 3 Enhancement: Risk Integration Tables

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

-- Ensure one assessment per domain per day (using expression index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_risk_assessments_domain_day 
    ON domain_risk_assessments(domain, DATE(assessment_date));

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
    pingcastle_score DECIMAL(5,2), -- NULL if no PingCastle data
    domain_group_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Combined global score
    global_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Score contributions (percentages)
    pingcastle_contribution DECIMAL(5,2), -- NULL if no PingCastle data
    domain_group_contribution DECIMAL(5,2) NOT NULL DEFAULT 100,
    
    -- Risk trend analysis
    trend_direction risk_trend DEFAULT 'stable',
    trend_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Links to source assessments
    pingcastle_report_id UUID, -- References reports table
    domain_assessment_id UUID REFERENCES domain_risk_assessments(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure one global score per domain per day (using expression index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_risk_scores_domain_day 
    ON global_risk_scores(domain, DATE(assessment_date));

-- Risk configuration table
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

-- Create additional indexes for Phase 1 and Phase 3
CREATE INDEX IF NOT EXISTS idx_group_memberships_member_name ON group_memberships(member_name);
CREATE INDEX IF NOT EXISTS idx_accepted_group_members_lookup ON accepted_group_members(domain, group_name, member_name);
CREATE INDEX IF NOT EXISTS idx_domain_risk_assessments_domain_date ON domain_risk_assessments(domain, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_global_risk_scores_domain_date ON global_risk_scores(domain, assessment_date DESC);

-- Risk calculation history table for audit trail
CREATE TABLE IF NOT EXISTS risk_calculation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL,
    calculation_trigger TEXT NOT NULL,  -- 'member_change', 'scheduled', 'manual', etc.
    risk_scores JSONB DEFAULT '{}',     -- Context and calculation details
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_domain ON risk_calculation_history(domain);
CREATE INDEX IF NOT EXISTS idx_risk_calculation_history_calculated_at ON risk_calculation_history(calculated_at DESC);

-- Risk dashboard summary view for cross-domain comparison
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