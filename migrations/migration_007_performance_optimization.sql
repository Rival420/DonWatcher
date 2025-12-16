-- =====================================================
-- Migration 007: Performance Optimization
-- Creates materialized views, indexes, and helper functions
-- for fast dashboard and report loading
-- IDEMPOTENT: Safe to run multiple times
-- =====================================================

-- 1. Create performance indexes for common query patterns
-- =====================================================

-- Index for finding latest report per domain/tool combination
CREATE INDEX IF NOT EXISTS idx_reports_domain_tool_date 
    ON reports(domain, tool_type, report_date DESC);

-- Index for grouping findings by tool/category/name
CREATE INDEX IF NOT EXISTS idx_findings_grouping 
    ON findings(tool_type, category, name);

-- Index for counting findings by severity per report
CREATE INDEX IF NOT EXISTS idx_findings_report_severity 
    ON findings(report_id, severity);

-- Index for KPI lookups by domain/tool/date
CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain_tool_date 
    ON reports_kpis(domain, tool_type, report_date DESC);

-- Covering index for accepted group members lookup
CREATE INDEX IF NOT EXISTS idx_accepted_group_members_covering
    ON accepted_group_members(domain, group_name) 
    INCLUDE (member_name, reason, accepted_by);


-- 2. Create view for latest reports per domain/tool
-- =====================================================

CREATE OR REPLACE VIEW v_latest_reports AS
SELECT DISTINCT ON (domain, tool_type)
    id as report_id,
    domain,
    tool_type,
    report_date,
    pingcastle_global_score as global_score,
    domain_sid,
    user_count,
    computer_count,
    dc_count,
    stale_objects_score,
    privileged_accounts_score,
    trusts_score,
    anomalies_score,
    domain_functional_level,
    forest_functional_level,
    maturity_level
FROM reports
ORDER BY domain, tool_type, report_date DESC;


-- 3. Create view for domain group summary
-- =====================================================

CREATE OR REPLACE VIEW v_domain_group_summary AS
WITH latest_domain_analysis AS (
    SELECT DISTINCT ON (domain) 
        id as report_id, 
        domain, 
        report_date
    FROM reports 
    WHERE tool_type = 'domain_analysis'
    ORDER BY domain, report_date DESC
)
SELECT 
    lda.domain,
    lda.report_id,
    lda.report_date,
    COALESCE(rk.total_groups, 0) as total_groups,
    COALESCE(rk.total_group_members, 0) as total_group_members,
    COALESCE(rk.accepted_group_members, 0) as accepted_group_members,
    COALESCE(rk.unaccepted_group_members, 0) as unaccepted_group_members,
    COALESCE(rk.domain_group_risk_score, 0) as domain_group_risk_score
FROM latest_domain_analysis lda
LEFT JOIN reports_kpis rk ON lda.report_id = rk.report_id;


-- 4. Create dashboard summary materialized view
-- =====================================================
-- This provides ultra-fast dashboard loading by pre-aggregating
-- the latest KPIs for each domain/tool combination

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_summary CASCADE;

CREATE MATERIALIZED VIEW mv_dashboard_summary AS
WITH latest_kpis AS (
    SELECT DISTINCT ON (domain, tool_type)
        report_id,
        domain,
        tool_type,
        report_date,
        global_score,
        total_findings,
        high_severity_findings,
        medium_severity_findings,
        low_severity_findings,
        unaccepted_group_members,
        total_groups,
        total_group_members,
        user_count,
        computer_count,
        dc_count,
        stale_objects_score,
        privileged_accounts_score,
        trusts_score,
        anomalies_score,
        domain_group_risk_score
    FROM reports_kpis
    ORDER BY domain, tool_type, report_date DESC
),
report_counts AS (
    SELECT domain, tool_type, COUNT(*) as report_count
    FROM reports
    GROUP BY domain, tool_type
)
SELECT 
    lk.domain,
    lk.tool_type,
    lk.report_date as latest_report_date,
    rc.report_count,
    lk.global_score as latest_global_score,
    lk.total_findings as latest_total_findings,
    lk.high_severity_findings as latest_high_severity,
    lk.medium_severity_findings as latest_medium_severity,
    lk.low_severity_findings as latest_low_severity,
    lk.unaccepted_group_members as latest_unaccepted_members,
    lk.total_groups,
    lk.total_group_members,
    lk.user_count,
    lk.computer_count,
    lk.dc_count,
    lk.stale_objects_score,
    lk.privileged_accounts_score,
    lk.trusts_score,
    lk.anomalies_score,
    lk.domain_group_risk_score
FROM latest_kpis lk
JOIN report_counts rc ON lk.domain = rc.domain AND lk.tool_type = rc.tool_type;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_dashboard_summary_pk 
    ON mv_dashboard_summary(domain, tool_type);


-- 5. Create grouped findings materialized view
-- =====================================================
-- Pre-aggregates findings for the Risk Catalog page
-- Significantly faster than runtime aggregation

DROP MATERIALIZED VIEW IF EXISTS mv_grouped_findings CASCADE;

CREATE MATERIALIZED VIEW mv_grouped_findings AS
WITH latest_report_per_domain AS (
    SELECT domain, MAX(report_date) as max_date
    FROM reports
    WHERE tool_type = 'pingcastle'
    GROUP BY domain
),
finding_aggregates AS (
    SELECT 
        f.tool_type,
        f.category,
        f.name,
        MAX(f.score) as max_score,
        ROUND(AVG(f.score)::numeric, 2) as avg_score,
        COUNT(DISTINCT f.report_id) as occurrence_count,
        MIN(r.report_date) as first_seen,
        MAX(r.report_date) as last_seen,
        ARRAY_AGG(DISTINCT r.domain ORDER BY r.domain) as domains
    FROM findings f
    JOIN reports r ON f.report_id = r.id
    WHERE f.tool_type IN ('pingcastle', 'locksmith', 'domain_analysis')
    GROUP BY f.tool_type, f.category, f.name
)
SELECT 
    fa.tool_type,
    fa.category,
    fa.name,
    fa.max_score,
    fa.avg_score,
    fa.occurrence_count,
    fa.first_seen,
    fa.last_seen,
    fa.domains,
    EXISTS (
        SELECT 1 FROM findings lf
        JOIN reports lr ON lf.report_id = lr.id
        JOIN latest_report_per_domain lrp ON lr.domain = lrp.domain AND lr.report_date = lrp.max_date
        WHERE lf.tool_type = fa.tool_type AND lf.category = fa.category AND lf.name = fa.name
    ) as in_latest_report,
    COALESCE(ar.id IS NOT NULL, false) as is_accepted,
    ar.reason as accepted_reason,
    ar.accepted_by,
    ar.accepted_at,
    ar.expires_at,
    COALESCE(ri.description, fa.name) as description,
    ri.recommendation,
    COALESCE(ri.severity, 'medium') as severity
FROM finding_aggregates fa
LEFT JOIN accepted_risks ar ON fa.tool_type = ar.tool_type AND fa.category = ar.category AND fa.name = ar.name
LEFT JOIN risks ri ON fa.tool_type = ri.tool_type AND fa.category = ri.category AND fa.name = ri.name;

-- Indexes for fast filtering
CREATE UNIQUE INDEX idx_mv_grouped_findings_pk 
    ON mv_grouped_findings(tool_type, category, name);
CREATE INDEX idx_mv_grouped_findings_category 
    ON mv_grouped_findings(category);
CREATE INDEX idx_mv_grouped_findings_in_latest 
    ON mv_grouped_findings(in_latest_report) WHERE in_latest_report = true;
CREATE INDEX idx_mv_grouped_findings_score 
    ON mv_grouped_findings(max_score DESC);
CREATE INDEX idx_mv_grouped_findings_is_accepted 
    ON mv_grouped_findings(is_accepted);


-- 6. Create grouped findings summary materialized view
-- =====================================================
-- Pre-calculated summary for category tabs in Risk Catalog

DROP MATERIALIZED VIEW IF EXISTS mv_grouped_findings_summary CASCADE;

CREATE MATERIALIZED VIEW mv_grouped_findings_summary AS
SELECT 
    tool_type,
    category,
    COUNT(*) as total_findings,
    COUNT(*) FILTER (WHERE in_latest_report) as in_latest_count,
    COUNT(*) FILTER (WHERE is_accepted) as accepted_count,
    COUNT(*) FILTER (WHERE NOT is_accepted) as unaccepted_count,
    SUM(max_score) as total_score
FROM mv_grouped_findings
GROUP BY tool_type, category
UNION ALL
SELECT 
    tool_type,
    'all' as category,
    COUNT(*) as total_findings,
    COUNT(*) FILTER (WHERE in_latest_report) as in_latest_count,
    COUNT(*) FILTER (WHERE is_accepted) as accepted_count,
    COUNT(*) FILTER (WHERE NOT is_accepted) as unaccepted_count,
    SUM(max_score) as total_score
FROM mv_grouped_findings
GROUP BY tool_type;

CREATE UNIQUE INDEX idx_mv_grouped_findings_summary_pk 
    ON mv_grouped_findings_summary(tool_type, category);


-- 7. Create function to refresh all performance views
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void AS $$
BEGIN
    -- Refresh dashboard summary
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
    EXCEPTION WHEN OTHERS THEN
        -- If concurrent refresh fails (e.g., first run), do regular refresh
        REFRESH MATERIALIZED VIEW mv_dashboard_summary;
    END;
    
    -- Refresh grouped findings
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_grouped_findings;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW mv_grouped_findings;
    END;
    
    -- Refresh grouped findings summary
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_grouped_findings_summary;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW mv_grouped_findings_summary;
    END;
    
    RAISE NOTICE 'Performance views refreshed successfully';
END;
$$ LANGUAGE plpgsql;


-- 8. Create function to refresh views after report upload
-- =====================================================
-- This can be called from the application after saving a report

CREATE OR REPLACE FUNCTION refresh_views_async()
RETURNS void AS $$
BEGIN
    -- Use advisory lock to prevent concurrent refreshes
    IF pg_try_advisory_lock(123456789) THEN
        PERFORM refresh_performance_views();
        PERFORM pg_advisory_unlock(123456789);
    ELSE
        RAISE NOTICE 'View refresh already in progress, skipping';
    END IF;
END;
$$ LANGUAGE plpgsql;


-- 9. Initial population of materialized views
-- =====================================================

-- Only refresh if there's data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM reports LIMIT 1) THEN
        PERFORM refresh_performance_views();
        RAISE NOTICE 'Initial view population completed';
    ELSE
        RAISE NOTICE 'No reports found, views created but empty';
    END IF;
END $$;


-- 10. Add comments for documentation
-- =====================================================

COMMENT ON VIEW v_latest_reports IS 
    'Returns the most recent report for each domain/tool combination. Fast lookup for dashboard.';

COMMENT ON VIEW v_domain_group_summary IS 
    'Pre-calculated domain group statistics from the latest domain analysis report per domain.';

COMMENT ON MATERIALIZED VIEW mv_dashboard_summary IS 
    'Pre-aggregated dashboard KPIs for ultra-fast dashboard loading. Refresh after report uploads.';

COMMENT ON MATERIALIZED VIEW mv_grouped_findings IS 
    'Pre-aggregated findings grouped by tool/category/name for fast Risk Catalog loading.';

COMMENT ON MATERIALIZED VIEW mv_grouped_findings_summary IS 
    'Summary statistics for grouped findings by category. Used for category tabs in Risk Catalog.';

COMMENT ON FUNCTION refresh_performance_views() IS 
    'Refreshes all performance materialized views. Call after report uploads.';


-- Verification
DO $$
DECLARE
    v_count INT;
BEGIN
    -- Check materialized views exist
    SELECT COUNT(*) INTO v_count 
    FROM pg_matviews 
    WHERE matviewname IN ('mv_dashboard_summary', 'mv_grouped_findings', 'mv_grouped_findings_summary');
    
    IF v_count = 3 THEN
        RAISE NOTICE '✅ Migration 007 completed successfully - all 3 materialized views created';
    ELSE
        RAISE NOTICE '⚠️ Migration 007 completed with warnings - only % materialized views created', v_count;
    END IF;
END $$;
