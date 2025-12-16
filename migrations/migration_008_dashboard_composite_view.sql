-- =====================================================
-- Migration 008: Dashboard Composite View
-- Fixes bug where PingCastle scores disappear after 
-- uploading a domain_analysis report
-- 
-- Root Cause: Dashboard was fetching "latest report" 
-- regardless of tool_type, so domain_analysis reports
-- would overwrite PingCastle scores with zeros.
--
-- Solution: Create a composite view that fetches:
-- - PingCastle scores from latest PingCastle report
-- - Domain Group metrics from latest domain_analysis report
-- - Merged infrastructure data from whichever has it
-- =====================================================

-- Create composite dashboard view
CREATE OR REPLACE VIEW v_dashboard_composite AS
WITH latest_pingcastle AS (
    -- Get the most recent PingCastle report KPIs per domain
    SELECT DISTINCT ON (domain)
        report_id,
        domain,
        report_date,
        global_score,
        stale_objects_score,
        privileged_accounts_score,
        trusts_score,
        anomalies_score,
        user_count,
        computer_count,
        dc_count,
        total_findings,
        high_severity_findings,
        medium_severity_findings,
        low_severity_findings
    FROM reports_kpis
    WHERE tool_type = 'pingcastle'
    ORDER BY domain, report_date DESC
),
latest_domain_analysis AS (
    -- Get the most recent domain_analysis report KPIs per domain
    SELECT DISTINCT ON (domain)
        report_id,
        domain,
        report_date,
        total_groups,
        total_group_members,
        accepted_group_members,
        unaccepted_group_members,
        domain_group_risk_score,
        user_count,
        computer_count,
        dc_count
    FROM reports_kpis
    WHERE tool_type IN ('domain_analysis', 'domain_group_members')
    ORDER BY domain, report_date DESC
),
all_domains AS (
    -- Get all unique domains
    SELECT DISTINCT domain FROM reports_kpis
)
SELECT 
    ad.domain,
    
    -- PingCastle risk scores (ONLY from PingCastle reports)
    COALESCE(pc.global_score, 0) as pingcastle_global_score,
    COALESCE(pc.stale_objects_score, 0) as stale_objects_score,
    COALESCE(pc.privileged_accounts_score, 0) as privileged_accounts_score,
    COALESCE(pc.trusts_score, 0) as trusts_score,
    COALESCE(pc.anomalies_score, 0) as anomalies_score,
    pc.report_date as pingcastle_report_date,
    pc.report_id as pingcastle_report_id,
    
    -- Domain Group metrics (ONLY from domain_analysis reports)
    COALESCE(da.total_groups, 0) as total_groups,
    COALESCE(da.total_group_members, 0) as total_group_members,
    COALESCE(da.accepted_group_members, 0) as accepted_group_members,
    COALESCE(da.unaccepted_group_members, 0) as unaccepted_group_members,
    COALESCE(da.domain_group_risk_score, 0) as domain_group_risk_score,
    da.report_date as domain_analysis_report_date,
    da.report_id as domain_analysis_report_id,
    
    -- Findings (from PingCastle)
    COALESCE(pc.total_findings, 0) as total_findings,
    COALESCE(pc.high_severity_findings, 0) as high_severity_findings,
    COALESCE(pc.medium_severity_findings, 0) as medium_severity_findings,
    COALESCE(pc.low_severity_findings, 0) as low_severity_findings,
    
    -- Infrastructure metrics (prefer PingCastle, fallback to domain_analysis)
    COALESCE(pc.user_count, da.user_count, 0) as user_count,
    COALESCE(pc.computer_count, da.computer_count, 0) as computer_count,
    COALESCE(pc.dc_count, da.dc_count, 0) as dc_count,
    
    -- Metadata
    GREATEST(pc.report_date, da.report_date) as latest_report_date,
    CASE 
        WHEN pc.report_id IS NOT NULL AND da.report_id IS NOT NULL THEN 'both'
        WHEN pc.report_id IS NOT NULL THEN 'pingcastle_only'
        WHEN da.report_id IS NOT NULL THEN 'domain_analysis_only'
        ELSE 'none'
    END as data_sources
    
FROM all_domains ad
LEFT JOIN latest_pingcastle pc ON ad.domain = pc.domain
LEFT JOIN latest_domain_analysis da ON ad.domain = da.domain;

-- Add comment explaining the view
COMMENT ON VIEW v_dashboard_composite IS 
    'Composite view for dashboard that fetches PingCastle scores from PingCastle reports '
    'and Domain Group metrics from domain_analysis reports, preventing data overwrites.';

-- Create index hint view for the underlying tables
-- (PostgreSQL doesn't support indexes on views, but we can ensure the underlying indexes exist)
CREATE INDEX IF NOT EXISTS idx_reports_kpis_pingcastle_lookup 
    ON reports_kpis(domain, report_date DESC) 
    WHERE tool_type = 'pingcastle';

CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain_analysis_lookup 
    ON reports_kpis(domain, report_date DESC) 
    WHERE tool_type IN ('domain_analysis', 'domain_group_members');

-- Verification
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM v_dashboard_composite;
    RAISE NOTICE '✅ Migration 008 completed successfully';
    RAISE NOTICE '   v_dashboard_composite view created with % domain(s)', v_count;
END $$;
