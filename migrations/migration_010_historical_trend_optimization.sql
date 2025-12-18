-- =====================================================
-- Migration 010: Historical Trend Optimization
-- 
-- Purpose: Optimize the dashboard historical trend queries
-- for flexible date range filtering and aggregation.
--
-- Changes:
-- 1. Add composite index for efficient date-based queries
-- 2. Add covering index with INCLUDE for score columns
-- 3. Create materialized view for pre-aggregated monthly summaries
-- =====================================================

-- Create optimized composite index for historical trend queries
-- This index supports:
-- - Filtering by domain and tool_type (common case)
-- - Date range filtering with DESC order for recent-first queries
-- - Efficient GROUP BY for weekly/monthly aggregation
CREATE INDEX IF NOT EXISTS idx_reports_kpis_historical_trend 
ON reports_kpis (domain, tool_type, report_date DESC);

-- Create covering index that includes score columns for index-only scans
-- This eliminates the need to read the heap for trend chart queries
CREATE INDEX IF NOT EXISTS idx_reports_kpis_trend_covering
ON reports_kpis (domain, tool_type, report_date DESC)
INCLUDE (
    global_score,
    stale_objects_score,
    privileged_accounts_score,
    trusts_score,
    anomalies_score,
    unaccepted_group_members,
    total_findings,
    domain_group_risk_score
);

-- Create materialized view for monthly aggregated KPIs
-- This provides ultra-fast access for "last year" views
-- Refresh strategy: On-demand or scheduled (e.g., daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpis_monthly_summary AS
SELECT 
    domain,
    tool_type,
    DATE_TRUNC('month', report_date) as month_date,
    ROUND(AVG(global_score))::INTEGER as avg_global_score,
    ROUND(AVG(stale_objects_score))::INTEGER as avg_stale_objects_score,
    ROUND(AVG(privileged_accounts_score))::INTEGER as avg_privileged_accounts_score,
    ROUND(AVG(trusts_score))::INTEGER as avg_trusts_score,
    ROUND(AVG(anomalies_score))::INTEGER as avg_anomalies_score,
    ROUND(AVG(unaccepted_group_members))::INTEGER as avg_unaccepted_members,
    ROUND(AVG(total_findings))::INTEGER as avg_total_findings,
    ROUND(AVG(domain_group_risk_score)::NUMERIC, 2) as avg_domain_group_risk_score,
    MAX(global_score) as max_global_score,
    MIN(global_score) as min_global_score,
    COUNT(*) as report_count
FROM reports_kpis
GROUP BY domain, tool_type, DATE_TRUNC('month', report_date);

-- Create index on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_monthly_pk 
ON mv_kpis_monthly_summary (domain, tool_type, month_date);

-- Create similar materialized view for weekly summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpis_weekly_summary AS
SELECT 
    domain,
    tool_type,
    DATE_TRUNC('week', report_date) as week_date,
    ROUND(AVG(global_score))::INTEGER as avg_global_score,
    ROUND(AVG(stale_objects_score))::INTEGER as avg_stale_objects_score,
    ROUND(AVG(privileged_accounts_score))::INTEGER as avg_privileged_accounts_score,
    ROUND(AVG(trusts_score))::INTEGER as avg_trusts_score,
    ROUND(AVG(anomalies_score))::INTEGER as avg_anomalies_score,
    ROUND(AVG(unaccepted_group_members))::INTEGER as avg_unaccepted_members,
    ROUND(AVG(total_findings))::INTEGER as avg_total_findings,
    ROUND(AVG(domain_group_risk_score)::NUMERIC, 2) as avg_domain_group_risk_score,
    MAX(global_score) as max_global_score,
    MIN(global_score) as min_global_score,
    COUNT(*) as report_count
FROM reports_kpis
GROUP BY domain, tool_type, DATE_TRUNC('week', report_date);

-- Create index on weekly materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_weekly_pk 
ON mv_kpis_weekly_summary (domain, tool_type, week_date);

-- Function to refresh historical aggregation views
-- Call this after bulk report uploads or on a schedule
CREATE OR REPLACE FUNCTION refresh_kpis_aggregation_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_monthly_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_kpis_weekly_summary;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON INDEX idx_reports_kpis_historical_trend IS 
    'Optimized index for historical trend queries with date filtering';

COMMENT ON INDEX idx_reports_kpis_trend_covering IS 
    'Covering index for trend chart queries - enables index-only scans';

COMMENT ON MATERIALIZED VIEW mv_kpis_monthly_summary IS 
    'Pre-aggregated monthly KPIs for fast "last year" trend views. Refresh with refresh_kpis_aggregation_views()';

COMMENT ON MATERIALIZED VIEW mv_kpis_weekly_summary IS 
    'Pre-aggregated weekly KPIs for fast "last 90 days" trend views. Refresh with refresh_kpis_aggregation_views()';

COMMENT ON FUNCTION refresh_kpis_aggregation_views IS 
    'Refreshes mv_kpis_monthly_summary and mv_kpis_weekly_summary materialized views';

-- Analyze the table to update statistics for query planner
ANALYZE reports_kpis;
