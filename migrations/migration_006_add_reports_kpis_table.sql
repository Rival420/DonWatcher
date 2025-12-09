-- Migration 006: Add reports_kpis table for dashboard performance optimization
-- This table stores pre-aggregated KPIs per report for fast dashboard loading
-- One-to-one relationship with reports table via report_id

-- Create the reports_kpis table
CREATE TABLE IF NOT EXISTS reports_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    
    -- Tool and domain info (denormalized for fast queries)
    tool_type security_tool_type NOT NULL,
    domain TEXT NOT NULL,
    report_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- PingCastle Risk Scores
    global_score INTEGER DEFAULT 0,
    stale_objects_score INTEGER DEFAULT 0,
    privileged_accounts_score INTEGER DEFAULT 0,
    trusts_score INTEGER DEFAULT 0,
    anomalies_score INTEGER DEFAULT 0,
    
    -- Domain Infrastructure Metrics
    user_count INTEGER DEFAULT 0,
    computer_count INTEGER DEFAULT 0,
    dc_count INTEGER DEFAULT 0,
    
    -- Findings Metrics
    total_findings INTEGER DEFAULT 0,
    high_severity_findings INTEGER DEFAULT 0,
    medium_severity_findings INTEGER DEFAULT 0,
    low_severity_findings INTEGER DEFAULT 0,
    
    -- Domain Group Metrics (for domain_analysis reports)
    total_groups INTEGER DEFAULT 0,
    total_group_members INTEGER DEFAULT 0,
    accepted_group_members INTEGER DEFAULT 0,
    unaccepted_group_members INTEGER DEFAULT 0,
    
    -- Risk Assessment Metrics
    domain_group_risk_score DECIMAL(5,2) DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain ON reports_kpis(domain);
CREATE INDEX IF NOT EXISTS idx_reports_kpis_tool_type ON reports_kpis(tool_type);
CREATE INDEX IF NOT EXISTS idx_reports_kpis_report_date ON reports_kpis(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain_date ON reports_kpis(domain, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain_tool_date ON reports_kpis(domain, tool_type, report_date DESC);

-- Create a view for easy dashboard summary retrieval
CREATE OR REPLACE VIEW dashboard_kpis_latest AS
SELECT DISTINCT ON (domain)
    rk.id,
    rk.report_id,
    rk.tool_type,
    rk.domain,
    rk.report_date,
    rk.global_score,
    rk.stale_objects_score,
    rk.privileged_accounts_score,
    rk.trusts_score,
    rk.anomalies_score,
    rk.user_count,
    rk.computer_count,
    rk.dc_count,
    rk.total_findings,
    rk.high_severity_findings,
    rk.medium_severity_findings,
    rk.low_severity_findings,
    rk.total_groups,
    rk.total_group_members,
    rk.accepted_group_members,
    rk.unaccepted_group_members,
    rk.domain_group_risk_score,
    r.domain_sid,
    r.domain_functional_level,
    r.forest_functional_level,
    r.maturity_level
FROM reports_kpis rk
JOIN reports r ON rk.report_id = r.id
ORDER BY domain, report_date DESC;

-- Create a function to automatically update reports_kpis when a report is saved
-- This is a utility function that can be called from the application
CREATE OR REPLACE FUNCTION calculate_report_kpis(p_report_id UUID)
RETURNS UUID AS $$
DECLARE
    v_kpi_id UUID;
    v_report RECORD;
    v_findings_stats RECORD;
BEGIN
    -- Get report details
    SELECT * INTO v_report FROM reports WHERE id = p_report_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report not found: %', p_report_id;
    END IF;
    
    -- Calculate findings statistics
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low
    INTO v_findings_stats
    FROM findings 
    WHERE report_id = p_report_id;
    
    -- Insert or update KPIs
    INSERT INTO reports_kpis (
        report_id, tool_type, domain, report_date,
        global_score, stale_objects_score, privileged_accounts_score,
        trusts_score, anomalies_score,
        user_count, computer_count, dc_count,
        total_findings, high_severity_findings, medium_severity_findings, low_severity_findings
    ) VALUES (
        p_report_id, v_report.tool_type, v_report.domain, v_report.report_date,
        COALESCE(v_report.pingcastle_global_score, 0),
        COALESCE(v_report.stale_objects_score, 0),
        COALESCE(v_report.privileged_accounts_score, 0),
        COALESCE(v_report.trusts_score, 0),
        COALESCE(v_report.anomalies_score, 0),
        COALESCE(v_report.user_count, 0),
        COALESCE(v_report.computer_count, 0),
        COALESCE(v_report.dc_count, 0),
        COALESCE(v_findings_stats.total, 0),
        COALESCE(v_findings_stats.high, 0),
        COALESCE(v_findings_stats.medium, 0),
        COALESCE(v_findings_stats.low, 0)
    )
    ON CONFLICT (report_id) DO UPDATE SET
        tool_type = EXCLUDED.tool_type,
        domain = EXCLUDED.domain,
        report_date = EXCLUDED.report_date,
        global_score = EXCLUDED.global_score,
        stale_objects_score = EXCLUDED.stale_objects_score,
        privileged_accounts_score = EXCLUDED.privileged_accounts_score,
        trusts_score = EXCLUDED.trusts_score,
        anomalies_score = EXCLUDED.anomalies_score,
        user_count = EXCLUDED.user_count,
        computer_count = EXCLUDED.computer_count,
        dc_count = EXCLUDED.dc_count,
        total_findings = EXCLUDED.total_findings,
        high_severity_findings = EXCLUDED.high_severity_findings,
        medium_severity_findings = EXCLUDED.medium_severity_findings,
        low_severity_findings = EXCLUDED.low_severity_findings,
        updated_at = NOW()
    RETURNING id INTO v_kpi_id;
    
    RETURN v_kpi_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update group-related KPIs
CREATE OR REPLACE FUNCTION update_report_kpis_groups(
    p_report_id UUID,
    p_total_groups INTEGER,
    p_total_members INTEGER,
    p_accepted_members INTEGER,
    p_unaccepted_members INTEGER,
    p_risk_score DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    UPDATE reports_kpis SET
        total_groups = p_total_groups,
        total_group_members = p_total_members,
        accepted_group_members = p_accepted_members,
        unaccepted_group_members = p_unaccepted_members,
        domain_group_risk_score = p_risk_score,
        updated_at = NOW()
    WHERE report_id = p_report_id;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing reports with KPIs
INSERT INTO reports_kpis (
    report_id, tool_type, domain, report_date,
    global_score, stale_objects_score, privileged_accounts_score,
    trusts_score, anomalies_score,
    user_count, computer_count, dc_count,
    total_findings, high_severity_findings, medium_severity_findings, low_severity_findings
)
SELECT 
    r.id,
    r.tool_type,
    r.domain,
    r.report_date,
    COALESCE(r.pingcastle_global_score, 0),
    COALESCE(r.stale_objects_score, 0),
    COALESCE(r.privileged_accounts_score, 0),
    COALESCE(r.trusts_score, 0),
    COALESCE(r.anomalies_score, 0),
    COALESCE(r.user_count, 0),
    COALESCE(r.computer_count, 0),
    COALESCE(r.dc_count, 0),
    COUNT(f.id),
    COUNT(f.id) FILTER (WHERE f.severity = 'high'),
    COUNT(f.id) FILTER (WHERE f.severity = 'medium'),
    COUNT(f.id) FILTER (WHERE f.severity = 'low')
FROM reports r
LEFT JOIN findings f ON r.id = f.report_id
WHERE NOT EXISTS (SELECT 1 FROM reports_kpis WHERE report_id = r.id)
GROUP BY r.id, r.tool_type, r.domain, r.report_date,
         r.pingcastle_global_score, r.stale_objects_score, r.privileged_accounts_score,
         r.trusts_score, r.anomalies_score, r.user_count, r.computer_count, r.dc_count;

-- Add comment explaining the table purpose
COMMENT ON TABLE reports_kpis IS 'Pre-aggregated KPIs per report for fast dashboard loading. One-to-one with reports table.';
COMMENT ON COLUMN reports_kpis.report_id IS 'Foreign key to reports table - one-to-one relationship';
COMMENT ON COLUMN reports_kpis.unaccepted_group_members IS 'Count of group members not yet accepted (for domain_analysis reports)';
