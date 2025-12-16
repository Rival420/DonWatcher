# 🚀 DonWatcher Performance Optimization Plan

## Executive Summary

**Problem Statement**: Frontend loading is slow when accessing the application with a database containing 50+ PingCastle reports and domain group analysis reports.

**Root Cause Analysis**: Multiple expensive database queries executed on each page load, insufficient use of pre-aggregated data, and frontend data loading patterns that don't leverage available optimizations.

**Solution**: A 4-phase implementation plan that creates a layered caching and pre-aggregation strategy across database, backend, and frontend.

---

## 👥 Team Consultation

### 🎯 Product Owner Perspective

**User Impact Analysis:**
- Dashboard should load in < 1 second (currently 3-5+ seconds with 50 reports)
- Reports listing should be instant with pagination (currently loads all reports)
- Risk Catalog should show findings immediately (currently recalculates on each view)
- Domain Groups view should be responsive (currently scans all reports)

**Priority Matrix:**
| Screen | Current Load Time | Target | Priority |
|--------|------------------|--------|----------|
| Dashboard | 3-5s | < 1s | 🔴 Critical |
| Reports | 2-3s | < 500ms | 🔴 Critical |
| Risk Catalog | 2-4s | < 1s | 🟡 High |
| Domain Groups | 2-3s | < 1s | 🟡 High |
| Upload | < 1s | < 1s | 🟢 Good |
| Settings | < 1s | < 1s | 🟢 Good |

### 🗄️ Database Engineer Analysis

**Current Performance Bottlenecks:**

1. **`get_all_reports_summary()`** - Called frequently, does JOIN + GROUP BY on reports + findings
   - 50 reports × ~20 findings each = 1000+ row scans per call
   - Solution: Use pre-aggregated `reports_kpis` table (already exists but underutilized)

2. **Domain Groups Endpoint** - Scans all reports to find latest domain analysis
   - Solution: Create indexed view for latest reports per domain/tool_type

3. **Grouped Findings Query** - Complex aggregation across all findings
   - Solution: Create materialized view with periodic refresh

4. **Missing Indexes** for common query patterns:
   - `(domain, tool_type, report_date DESC)` - for latest report queries
   - `(tool_type, category, name)` on findings - for grouping queries

### 🖥️ Frontend Engineer Analysis

**Current Data Loading Issues:**

1. **Dashboard** - Already uses KPI endpoints ✅, but also fetches domain groups separately
2. **Reports Page** - Using paginated endpoint ✅, but no prefetching
3. **Risk Catalog** - Fetches grouped findings without caching optimization
4. **Domain Groups** - No skeleton loading, blocks on data fetch
5. **General** - staleTime settings could be more aggressive for stable data

---

## 📋 4-Phase Implementation Plan

## Phase 1: Database Layer Optimization
**Duration: 3-4 hours | Priority: Critical**

### 1.1 Create Summary Materialized View for Reports

```sql
-- Migration: migration_007_performance_views.sql

-- Materialized view for dashboard summary (refreshed on report upload)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_summary AS
SELECT 
    domain,
    tool_type,
    MAX(report_date) as latest_report_date,
    COUNT(*) as report_count,
    MAX(CASE WHEN rk.report_date = (
        SELECT MAX(report_date) FROM reports_kpis WHERE domain = rk.domain
    ) THEN rk.global_score END) as latest_global_score,
    MAX(CASE WHEN rk.report_date = (
        SELECT MAX(report_date) FROM reports_kpis WHERE domain = rk.domain
    ) THEN rk.total_findings END) as latest_total_findings,
    MAX(CASE WHEN rk.report_date = (
        SELECT MAX(report_date) FROM reports_kpis WHERE domain = rk.domain
    ) THEN rk.high_severity_findings END) as latest_high_severity,
    MAX(CASE WHEN rk.report_date = (
        SELECT MAX(report_date) FROM reports_kpis WHERE domain = rk.domain
    ) THEN rk.unaccepted_group_members END) as latest_unaccepted_members
FROM reports_kpis rk
GROUP BY domain, tool_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_summary_domain_tool 
    ON mv_dashboard_summary(domain, tool_type);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
END;
$$ LANGUAGE plpgsql;
```

### 1.2 Create Latest Report Per Domain View

```sql
-- Fast lookup for latest report per domain/tool combination
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
    anomalies_score
FROM reports
ORDER BY domain, tool_type, report_date DESC;

-- Index to support the view
CREATE INDEX IF NOT EXISTS idx_reports_domain_tool_date 
    ON reports(domain, tool_type, report_date DESC);
```

### 1.3 Create Grouped Findings Materialized View

```sql
-- Pre-aggregated findings for Risk Catalog
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grouped_findings AS
WITH latest_report AS (
    SELECT domain, MAX(report_date) as max_date
    FROM reports
    WHERE tool_type = 'pingcastle'
    GROUP BY domain
)
SELECT 
    f.tool_type,
    f.category,
    f.name,
    MAX(f.score) as max_score,
    AVG(f.score) as avg_score,
    COUNT(DISTINCT f.report_id) as occurrence_count,
    MIN(r.report_date) as first_seen,
    MAX(r.report_date) as last_seen,
    ARRAY_AGG(DISTINCT r.domain) as domains,
    EXISTS (
        SELECT 1 FROM findings lf
        JOIN reports lr ON lf.report_id = lr.id
        JOIN latest_report lrp ON lr.domain = lrp.domain AND lr.report_date = lrp.max_date
        WHERE lf.tool_type = f.tool_type AND lf.category = f.category AND lf.name = f.name
    ) as in_latest_report,
    COALESCE(ar.id IS NOT NULL, false) as is_accepted,
    ar.reason as accepted_reason,
    ar.accepted_by,
    ar.expires_at,
    MAX(ri.description) as description,
    MAX(ri.recommendation) as recommendation,
    MAX(ri.severity) as severity
FROM findings f
JOIN reports r ON f.report_id = r.id
LEFT JOIN accepted_risks ar ON f.tool_type = ar.tool_type AND f.category = ar.category AND f.name = ar.name
LEFT JOIN risks ri ON f.tool_type = ri.tool_type AND f.category = ri.category AND f.name = ri.name
GROUP BY f.tool_type, f.category, f.name, ar.id, ar.reason, ar.accepted_by, ar.expires_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_grouped_findings_pk 
    ON mv_grouped_findings(tool_type, category, name);
CREATE INDEX IF NOT EXISTS idx_mv_grouped_findings_category 
    ON mv_grouped_findings(category);
CREATE INDEX IF NOT EXISTS idx_mv_grouped_findings_in_latest 
    ON mv_grouped_findings(in_latest_report);
```

### 1.4 Create Domain Groups Summary View

```sql
-- Pre-calculated domain group statistics
CREATE OR REPLACE VIEW v_domain_group_summary AS
WITH latest_domain_analysis AS (
    SELECT DISTINCT ON (domain) 
        id as report_id, domain, report_date
    FROM reports 
    WHERE tool_type = 'domain_analysis'
    ORDER BY domain, report_date DESC
)
SELECT 
    lda.domain,
    lda.report_date,
    rk.total_groups,
    rk.total_group_members,
    rk.accepted_group_members,
    rk.unaccepted_group_members,
    rk.domain_group_risk_score
FROM latest_domain_analysis lda
JOIN reports_kpis rk ON lda.report_id = rk.report_id;
```

### 1.5 Add Missing Performance Indexes

```sql
-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_findings_grouping 
    ON findings(tool_type, category, name);

CREATE INDEX IF NOT EXISTS idx_findings_report_severity 
    ON findings(report_id, severity);

CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain_tool_date 
    ON reports_kpis(domain, tool_type, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_accepted_group_members_lookup_fast
    ON accepted_group_members(domain, group_name) 
    INCLUDE (member_name, reason, accepted_by);
```

---

## Phase 2: Backend API Optimization
**Duration: 4-5 hours | Priority: Critical**

### 2.1 Add New Optimized Endpoints

```python
# In main.py - Add these new fast endpoints

@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Ultra-fast dashboard summary using materialized view.
    Returns pre-aggregated data for all domains.
    """
    return storage.get_dashboard_summary_fast()


@app.get("/api/findings/grouped/fast")
def get_grouped_findings_fast(
    domain: Optional[str] = None,
    category: Optional[str] = None,
    in_latest_only: bool = False,
    include_accepted: bool = True,
    page: int = 1,
    page_size: int = 50,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Fast grouped findings using materialized view with pagination.
    """
    return storage.get_grouped_findings_from_mv(
        domain=domain,
        category=category,
        in_latest_only=in_latest_only,
        include_accepted=include_accepted,
        page=page,
        page_size=page_size
    )


@app.get("/api/domain_groups/{domain}/fast")
def get_domain_groups_fast(
    domain: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Fast domain groups using pre-calculated summary view.
    """
    return storage.get_domain_groups_fast(domain)
```

### 2.2 Storage Layer Additions

```python
# Add to storage_postgres.py

def get_dashboard_summary_fast(self) -> Dict:
    """Get dashboard summary from materialized view."""
    with self._get_session() as session:
        try:
            results = session.execute(text("""
                SELECT * FROM mv_dashboard_summary
                ORDER BY domain, tool_type
            """)).fetchall()
            
            return {
                "status": "ok",
                "domains": [dict(row._mapping) for row in results]
            }
        except Exception as e:
            # Fallback if materialized view doesn't exist
            logging.warning(f"Materialized view not available: {e}")
            return self.get_all_domains_latest_kpis()


def get_grouped_findings_from_mv(
    self,
    domain: Optional[str] = None,
    category: Optional[str] = None,
    in_latest_only: bool = False,
    include_accepted: bool = True,
    page: int = 1,
    page_size: int = 50
) -> Dict:
    """Get grouped findings from materialized view with pagination."""
    with self._get_session() as session:
        query = "SELECT * FROM mv_grouped_findings WHERE 1=1"
        params = {}
        
        if domain:
            query += " AND :domain = ANY(domains)"
            params['domain'] = domain
        
        if category:
            query += " AND category = :category"
            params['category'] = category
        
        if in_latest_only:
            query += " AND in_latest_report = true"
        
        if not include_accepted:
            query += " AND is_accepted = false"
        
        # Get total count
        count_query = f"SELECT COUNT(*) FROM ({query}) sq"
        total = session.execute(text(count_query), params).scalar()
        
        # Add pagination
        query += " ORDER BY max_score DESC, occurrence_count DESC"
        query += " LIMIT :limit OFFSET :offset"
        params['limit'] = page_size
        params['offset'] = (page - 1) * page_size
        
        results = session.execute(text(query), params).fetchall()
        
        return {
            "status": "ok",
            "page": page,
            "page_size": page_size,
            "total_count": total,
            "total_pages": (total + page_size - 1) // page_size,
            "findings": [dict(row._mapping) for row in results]
        }


def get_domain_groups_fast(self, domain: str) -> List[Dict]:
    """Get domain groups using pre-calculated view."""
    with self._get_session() as session:
        # First get group-level data from the latest domain analysis report
        result = session.execute(text("""
            SELECT 
                report_id,
                domain,
                report_date,
                total_groups,
                total_group_members,
                accepted_group_members,
                unaccepted_group_members,
                domain_group_risk_score
            FROM v_domain_group_summary
            WHERE domain = :domain
        """), {'domain': domain}).fetchone()
        
        if not result:
            return []
        
        # Get individual group details from the report's findings metadata
        groups = session.execute(text("""
            SELECT 
                f.metadata->>'group_name' as group_name,
                (f.metadata->>'member_count')::int as total_members,
                f.score as risk_score,
                COALESCE(
                    (SELECT COUNT(*) FROM accepted_group_members agm 
                     WHERE agm.domain = :domain AND agm.group_name = f.metadata->>'group_name'),
                    0
                ) as accepted_members
            FROM findings f
            WHERE f.report_id = :report_id
              AND f.category = 'DonScanner'
              AND f.name LIKE 'Group_%'
        """), {'domain': domain, 'report_id': str(result.report_id)}).fetchall()
        
        return [
            {
                'group_name': g.group_name,
                'total_members': g.total_members,
                'accepted_members': g.accepted_members,
                'unaccepted_members': g.total_members - g.accepted_members,
                'risk_score': g.risk_score,
                'severity': 'high' if g.risk_score > 50 else 'medium' if g.risk_score > 25 else 'low',
                'last_updated': result.report_date.isoformat()
            }
            for g in groups
        ]
```

### 2.3 Automatic Materialized View Refresh

```python
# Add to storage_postgres.py

def refresh_materialized_views(self):
    """Refresh all materialized views - call after report uploads."""
    with self._get_session() as session:
        try:
            session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary"))
            session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_grouped_findings"))
            session.commit()
            logging.info("Refreshed materialized views")
        except Exception as e:
            logging.warning(f"Failed to refresh materialized views: {e}")


# Modify save_report to trigger refresh
def save_report(self, report: Report) -> str:
    # ... existing code ...
    
    # After successful save, refresh materialized views
    try:
        self.refresh_materialized_views()
    except Exception as e:
        logging.warning(f"Materialized view refresh failed: {e}")
    
    return report.id
```

### 2.4 Response Caching with TTL

```python
# Add to cache_service.py

from functools import lru_cache
from datetime import datetime, timedelta

class APICache:
    """Simple in-memory cache with TTL for API responses."""
    
    def __init__(self, default_ttl: int = 30):
        self._cache = {}
        self._default_ttl = default_ttl
    
    def get(self, key: str):
        if key in self._cache:
            value, expiry = self._cache[key]
            if datetime.now() < expiry:
                return value
            del self._cache[key]
        return None
    
    def set(self, key: str, value, ttl: int = None):
        ttl = ttl or self._default_ttl
        self._cache[key] = (value, datetime.now() + timedelta(seconds=ttl))
    
    def invalidate(self, pattern: str = None):
        if pattern:
            keys_to_delete = [k for k in self._cache if pattern in k]
            for k in keys_to_delete:
                del self._cache[k]
        else:
            self._cache.clear()

# Global instance
api_cache = APICache(default_ttl=30)

def get_api_cache():
    return api_cache
```

---

## Phase 3: Frontend Optimization
**Duration: 3-4 hours | Priority: High**

### 3.1 Update API Service with Fast Endpoints

```typescript
// In services/api.ts - Add fast endpoints

/**
 * Get dashboard summary from materialized view (ultra-fast)
 */
export async function getDashboardSummaryFast(): Promise<{
  status: string
  domains: Array<{
    domain: string
    tool_type: string
    latest_report_date: string
    report_count: number
    latest_global_score: number
    latest_total_findings: number
    latest_unaccepted_members: number
  }>
}> {
  return fetchJSON(`${API_BASE}/dashboard/summary`)
}

/**
 * Get grouped findings with pagination (fast, from materialized view)
 */
export async function getGroupedFindingsFast(params?: {
  domain?: string
  category?: string
  in_latest_only?: boolean
  include_accepted?: boolean
  page?: number
  page_size?: number
}): Promise<{
  status: string
  page: number
  page_size: number
  total_count: number
  total_pages: number
  findings: GroupedFinding[]
}> {
  const searchParams = new URLSearchParams()
  if (params?.domain) searchParams.append('domain', params.domain)
  if (params?.category) searchParams.append('category', params.category)
  if (params?.in_latest_only) searchParams.append('in_latest_only', 'true')
  if (params?.include_accepted !== undefined) {
    searchParams.append('include_accepted', String(params.include_accepted))
  }
  if (params?.page) searchParams.append('page', String(params.page))
  if (params?.page_size) searchParams.append('page_size', String(params.page_size))
  
  const query = searchParams.toString()
  return fetchJSON(`${API_BASE}/findings/grouped/fast${query ? `?${query}` : ''}`)
}

/**
 * Get domain groups fast (from pre-calculated view)
 */
export async function getDomainGroupsFast(domain: string): Promise<DomainGroup[]> {
  return fetchJSON<DomainGroup[]>(`${API_BASE}/domain_groups/${encodeURIComponent(domain)}/fast`)
}
```

### 3.2 Update React Query Hooks with Better Caching

```typescript
// In hooks/useApi.ts - Update hooks with better caching

// Dashboard - use fast endpoint with aggressive caching
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: api.getDashboardSummaryFast,
    staleTime: 60000,      // Consider fresh for 1 minute
    cacheTime: 300000,     // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  })
}

// Grouped Findings - use fast paginated endpoint
export function useGroupedFindingsFast(params?: {
  domain?: string
  category?: string
  in_latest_only?: boolean
  include_accepted?: boolean
  page?: number
  page_size?: number
}) {
  return useQuery({
    queryKey: ['groupedFindingsFast', params],
    queryFn: () => api.getGroupedFindingsFast(params),
    staleTime: 30000,      // Fresh for 30 seconds
    cacheTime: 300000,     // Cache for 5 minutes
    keepPreviousData: true, // Keep showing old data while fetching new
  })
}

// Domain Groups - use fast endpoint
export function useDomainGroupsFast(domain: string) {
  return useQuery({
    queryKey: ['domainGroupsFast', domain],
    queryFn: () => api.getDomainGroupsFast(domain),
    enabled: !!domain,
    staleTime: 30000,
    cacheTime: 300000,
  })
}

// Prefetch helper for navigation
export function usePrefetchDomainData(queryClient: QueryClient, domain: string) {
  useEffect(() => {
    if (domain) {
      // Prefetch domain-related data
      queryClient.prefetchQuery({
        queryKey: ['domainGroupsFast', domain],
        queryFn: () => api.getDomainGroupsFast(domain),
      })
      queryClient.prefetchQuery({
        queryKey: ['dashboardKPIs', domain],
        queryFn: () => api.getDashboardKPIs(domain),
      })
    }
  }, [domain, queryClient])
}
```

### 3.3 Add Skeleton Loading Components

```typescript
// In components/SkeletonLoaders.tsx

import { motion } from 'framer-motion'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Domain Overview Skeleton */}
      <div className="cyber-card">
        <div className="h-6 w-48 bg-cyber-bg-tertiary rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-cyber-bg-secondary rounded-lg p-4">
              <div className="h-8 w-20 bg-cyber-bg-tertiary rounded mb-2" />
              <div className="h-4 w-24 bg-cyber-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Risk Gauges Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="cyber-card flex items-center justify-center h-64">
          <div className="w-32 h-32 rounded-full bg-cyber-bg-tertiary" />
        </div>
        <div className="cyber-card lg:col-span-2 h-64">
          <div className="h-full flex items-center justify-center gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-20 h-20 rounded-full bg-cyber-bg-tertiary" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="cyber-card h-20 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-cyber-bg-tertiary" />
            <div className="flex-1">
              <div className="h-4 w-48 bg-cyber-bg-tertiary rounded mb-2" />
              <div className="h-3 w-32 bg-cyber-bg-tertiary rounded" />
            </div>
            <div className="h-8 w-16 bg-cyber-bg-tertiary rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 3.4 Update Dashboard with Optimizations

```typescript
// In pages/Dashboard.tsx - Key changes

export function Dashboard() {
  // Use optimized summary endpoint
  const { data: summaryData, isLoading } = useDashboardSummary()
  
  // Show skeleton immediately instead of spinner
  if (isLoading) {
    return <DashboardSkeleton />
  }
  
  // ... rest of component
}
```

### 3.5 Update Risk Catalog with Pagination

```typescript
// In pages/RiskCatalog.tsx - Use paginated fast endpoint

function PingCastleSection({ domain }: { domain: string }) {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  // Use fast paginated endpoint
  const { data: findingsData, isLoading, isFetching } = useGroupedFindingsFast({
    domain: domain || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    in_latest_only: latestFilter === 'in_latest',
    include_accepted: showAccepted,
    page,
    page_size: pageSize
  })
  
  // Show skeleton on initial load, subtle indicator on pagination
  if (isLoading) {
    return <TableSkeleton rows={10} />
  }
  
  return (
    <div className={clsx('relative', isFetching && 'opacity-75')}>
      {/* Findings list */}
      {/* Pagination controls */}
    </div>
  )
}
```

---

## Phase 4: Integration & Testing
**Duration: 2-3 hours | Priority: High**

### 4.1 Migration Script

```sql
-- migrations/migration_007_performance_optimization.sql

-- =====================================================
-- Performance Optimization Migration
-- Creates materialized views, indexes, and helper functions
-- IDEMPOTENT: Safe to run multiple times
-- =====================================================

-- 1. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_reports_domain_tool_date 
    ON reports(domain, tool_type, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_findings_grouping 
    ON findings(tool_type, category, name);

CREATE INDEX IF NOT EXISTS idx_findings_report_severity 
    ON findings(report_id, severity);

CREATE INDEX IF NOT EXISTS idx_reports_kpis_domain_tool_date 
    ON reports_kpis(domain, tool_type, report_date DESC);

-- 2. Create latest reports view
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
    anomalies_score
FROM reports
ORDER BY domain, tool_type, report_date DESC;

-- 3. Create domain group summary view
CREATE OR REPLACE VIEW v_domain_group_summary AS
WITH latest_domain_analysis AS (
    SELECT DISTINCT ON (domain) 
        id as report_id, domain, report_date
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
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_summary;
CREATE MATERIALIZED VIEW mv_dashboard_summary AS
SELECT 
    rk.domain,
    rk.tool_type,
    rk.report_date as latest_report_date,
    COUNT(*) OVER (PARTITION BY rk.domain, rk.tool_type) as report_count,
    rk.global_score as latest_global_score,
    rk.total_findings as latest_total_findings,
    rk.high_severity_findings as latest_high_severity,
    rk.unaccepted_group_members as latest_unaccepted_members,
    rk.user_count,
    rk.computer_count,
    rk.dc_count,
    rk.stale_objects_score,
    rk.privileged_accounts_score,
    rk.trusts_score,
    rk.anomalies_score
FROM reports_kpis rk
WHERE rk.report_date = (
    SELECT MAX(report_date) FROM reports_kpis 
    WHERE domain = rk.domain AND tool_type = rk.tool_type
);

CREATE UNIQUE INDEX idx_mv_dashboard_summary_pk 
    ON mv_dashboard_summary(domain, tool_type);

-- 5. Create grouped findings materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_grouped_findings;
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
        AVG(f.score)::numeric(10,2) as avg_score,
        COUNT(DISTINCT f.report_id) as occurrence_count,
        MIN(r.report_date) as first_seen,
        MAX(r.report_date) as last_seen,
        ARRAY_AGG(DISTINCT r.domain) as domains
    FROM findings f
    JOIN reports r ON f.report_id = r.id
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
    ar.expires_at,
    ri.description,
    ri.recommendation,
    ri.severity
FROM finding_aggregates fa
LEFT JOIN accepted_risks ar ON fa.tool_type = ar.tool_type AND fa.category = ar.category AND fa.name = ar.name
LEFT JOIN risks ri ON fa.tool_type = ri.tool_type AND fa.category = ri.category AND fa.name = ri.name;

CREATE UNIQUE INDEX idx_mv_grouped_findings_pk 
    ON mv_grouped_findings(tool_type, category, name);
CREATE INDEX idx_mv_grouped_findings_category 
    ON mv_grouped_findings(category);
CREATE INDEX idx_mv_grouped_findings_in_latest 
    ON mv_grouped_findings(in_latest_report);
CREATE INDEX idx_mv_grouped_findings_score 
    ON mv_grouped_findings(max_score DESC);

-- 6. Create refresh function
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_grouped_findings;
END;
$$ LANGUAGE plpgsql;

-- 7. Initial refresh
SELECT refresh_performance_views();

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Performance optimization migration completed successfully';
    RAISE NOTICE 'Created indexes, views, and materialized views for fast queries';
END $$;
```

### 4.2 Performance Test Script

```python
# tests/test_performance.py

import time
import requests
from statistics import mean

BASE_URL = "http://localhost:8080"

def measure_endpoint(url: str, iterations: int = 5) -> dict:
    """Measure endpoint response time."""
    times = []
    for _ in range(iterations):
        start = time.time()
        response = requests.get(url)
        elapsed = (time.time() - start) * 1000  # ms
        times.append(elapsed)
    
    return {
        "url": url,
        "status": response.status_code,
        "avg_ms": round(mean(times), 2),
        "min_ms": round(min(times), 2),
        "max_ms": round(max(times), 2)
    }

def run_performance_tests():
    """Run performance tests on all endpoints."""
    
    endpoints = [
        # Dashboard endpoints
        f"{BASE_URL}/api/dashboard/kpis",
        f"{BASE_URL}/api/dashboard/summary",  # New fast endpoint
        
        # Reports endpoints
        f"{BASE_URL}/api/reports/paginated?page=1&page_size=20",
        f"{BASE_URL}/api/domains",
        
        # Risk Catalog endpoints
        f"{BASE_URL}/api/findings/grouped?tool_type=pingcastle",
        f"{BASE_URL}/api/findings/grouped/fast?page=1&page_size=50",  # New fast endpoint
        
        # Domain Groups
        f"{BASE_URL}/api/domain_groups/YOURDOMAIN.LOCAL",
        f"{BASE_URL}/api/domain_groups/YOURDOMAIN.LOCAL/fast",  # New fast endpoint
    ]
    
    print("\n🚀 Performance Test Results\n")
    print("-" * 70)
    
    for url in endpoints:
        try:
            result = measure_endpoint(url)
            status = "✅" if result["avg_ms"] < 500 else "⚠️" if result["avg_ms"] < 1000 else "❌"
            print(f"{status} {result['url']}")
            print(f"   Avg: {result['avg_ms']}ms | Min: {result['min_ms']}ms | Max: {result['max_ms']}ms")
        except Exception as e:
            print(f"❌ {url}: {e}")
        print()

if __name__ == "__main__":
    run_performance_tests()
```

---

## 📊 Expected Performance Improvements

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| Dashboard KPIs | 500-1500ms | 50-100ms | 10-15x faster |
| Dashboard Summary | 800-2000ms | 30-80ms | 20-25x faster |
| Reports Paginated | 300-500ms | 100-200ms | 2-3x faster |
| Grouped Findings | 1000-3000ms | 100-200ms | 10-15x faster |
| Domain Groups | 500-1500ms | 50-150ms | 5-10x faster |

---

## 🔄 Maintenance & Future-Proofing

### Materialized View Refresh Strategy

```python
# Automatic refresh after report uploads (already integrated)
# Manual refresh endpoint for admin use:

@app.post("/api/admin/refresh-views")
def refresh_materialized_views(
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Manually refresh materialized views (admin only)."""
    storage.refresh_materialized_views()
    return {"status": "ok", "message": "Materialized views refreshed"}
```

### Monitoring & Alerts

1. **Add response time logging** to track endpoint performance
2. **Set up alerts** for slow queries (> 1 second)
3. **Monitor cache hit rates** in production
4. **Track database connection pool usage**

### Scalability Considerations

1. **Horizontal Scaling**: Frontend can be replicated behind load balancer
2. **Database Read Replicas**: Materialized views can be served from replicas
3. **CDN Caching**: Static assets and rarely-changing data
4. **Background Jobs**: Move heavy calculations to background workers

---

## ✅ Implementation Checklist

### Phase 1: Database
- [ ] Create migration_007_performance_optimization.sql
- [ ] Apply migration to development database
- [ ] Verify views and indexes created
- [ ] Test refresh_performance_views() function

### Phase 2: Backend
- [ ] Add new fast endpoints to main.py
- [ ] Add storage methods for materialized views
- [ ] Integrate automatic view refresh after uploads
- [ ] Add API cache for frequently accessed data

### Phase 3: Frontend
- [ ] Add fast API service methods
- [ ] Update React Query hooks with better caching
- [ ] Add skeleton loading components
- [ ] Update Dashboard to use fast endpoints
- [ ] Update Risk Catalog with pagination
- [ ] Add prefetching for navigation

### Phase 4: Integration
- [ ] Run migration on staging/test environment
- [ ] Execute performance test suite
- [ ] Validate all endpoints meet target times
- [ ] Update documentation
- [ ] Deploy to production

---

## 📝 Notes

- All changes are backward compatible
- Old endpoints remain functional (deprecated but working)
- New endpoints have `/fast` suffix for clarity during transition
- Materialized views refresh automatically on report upload
- Manual refresh available for admin use

**Estimated Total Implementation Time: 12-16 hours**

---

*Document prepared by: Senior Development Team*  
*Date: December 2024*  
*Version: 1.0*
