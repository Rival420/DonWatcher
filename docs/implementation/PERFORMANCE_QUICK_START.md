# 🚀 Performance Optimization - Quick Start Guide

## Overview

This guide helps you apply the performance optimizations designed for DonWatcher. The optimizations target the slow frontend loading experienced with 50+ reports.

## What Was Implemented

### Database Layer (Migration 007)
- **Materialized views** for pre-aggregated data:
  - `mv_dashboard_summary` - Dashboard KPIs
  - `mv_grouped_findings` - Risk Catalog findings
  - `mv_grouped_findings_summary` - Category summaries
- **Regular views** for fast lookups:
  - `v_latest_reports` - Latest report per domain/tool
  - `v_domain_group_summary` - Domain group statistics
- **Performance indexes** on frequently queried columns
- **Refresh function** `refresh_performance_views()` for automatic updates

### Backend Layer
- **Fast endpoints** using materialized views:
  - `GET /api/dashboard/summary` - Ultra-fast dashboard data
  - `GET /api/findings/grouped/fast` - Paginated findings from MV
  - `GET /api/findings/grouped/fast/summary` - Category summaries
  - `GET /api/domain_groups/{domain}/fast` - Fast group data
  - `POST /api/admin/refresh-views` - Manual view refresh
- **Automatic view refresh** after report uploads
- **Fallback logic** if materialized views don't exist

### Frontend Layer
- **Fast hooks** with aggressive caching:
  - `useDashboardSummaryFast()` - 60s stale time
  - `useGroupedFindingsFast()` - 30s stale time, pagination
  - `useGroupedFindingsSummaryFast()` - 30s stale time
  - `useDomainGroupsFast()` - 30s stale time
- **Skeleton loaders** for better perceived performance
- **Updated pages** to use fast endpoints

## Applying the Changes

### Step 1: Apply Database Migration

```bash
# Using Docker
docker compose exec backend python -c "
from server.database import engine
from server.migration_runner import run_migrations_on_startup
run_migrations_on_startup(engine)
"

# Or manually via psql
psql -h localhost -U donwatcher -d donwatcher -f migrations/migration_007_performance_optimization.sql
```

### Step 2: Restart Backend

```bash
docker compose restart backend
```

### Step 3: Verify Views Created

```bash
# Check via API
curl http://localhost:8080/api/debug/status

# Or check database directly
psql -c "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';"
```

Expected output:
```
       matviewname        
--------------------------
 mv_dashboard_summary
 mv_grouped_findings
 mv_grouped_findings_summary
```

### Step 4: Rebuild Frontend (if using Docker)

```bash
docker compose up --build frontend -d
```

### Step 5: Test Performance

```bash
# Test fast endpoints
curl -w "@-" -o /dev/null -s "http://localhost:8080/api/dashboard/summary" <<'EOF'
    time_total: %{time_total}s\n
EOF

curl -w "@-" -o /dev/null -s "http://localhost:8080/api/findings/grouped/fast" <<'EOF'
    time_total: %{time_total}s\n
EOF
```

Expected: < 100ms response times

## Manual View Refresh

If data seems stale, manually refresh views:

```bash
curl -X POST http://localhost:8080/api/admin/refresh-views
```

Or via database:

```sql
SELECT refresh_performance_views();
```

## Troubleshooting

### Views Not Created

Check migration status:
```bash
curl http://localhost:8080/api/debug/migrations
```

If migration_007 not applied, run manually.

### Slow Queries Still

1. Check if views exist: `SELECT * FROM pg_matviews;`
2. Check view data: `SELECT COUNT(*) FROM mv_dashboard_summary;`
3. If empty, refresh: `SELECT refresh_performance_views();`

### Fallback Mode

If materialized views fail, endpoints return `"source": "fallback"` and use regular queries. Check:
```bash
curl http://localhost:8080/api/dashboard/summary | jq '.source'
```

Should return `"materialized_view"` not `"fallback"`.

## Expected Performance Improvements

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| Dashboard KPIs | 500-1500ms | 50-100ms | 10-15x |
| Dashboard Summary | 800-2000ms | 30-80ms | 20-25x |
| Grouped Findings | 1000-3000ms | 100-200ms | 10-15x |
| Domain Groups | 500-1500ms | 50-150ms | 5-10x |

## Files Changed

```
migrations/
  └── migration_007_performance_optimization.sql  # NEW

server/
  ├── main.py                    # New fast endpoints
  └── storage_postgres.py        # New storage methods

frontend/src/
  ├── services/api.ts            # Fast API methods
  ├── hooks/useApi.ts            # Fast React Query hooks
  ├── components/
  │   ├── index.ts               # Export skeleton loaders
  │   └── SkeletonLoaders.tsx    # NEW - Loading skeletons
  └── pages/
      ├── Dashboard.tsx          # Use fast hooks + skeleton
      ├── Reports.tsx            # Use skeleton loader
      └── RiskCatalog.tsx        # Use fast hooks + skeleton
```

## Next Steps (Optional)

1. **Add pagination UI** to Risk Catalog for large datasets
2. **Implement data prefetching** on navigation
3. **Add response time monitoring** to track performance
4. **Configure PostgreSQL** connection pooling for scale
