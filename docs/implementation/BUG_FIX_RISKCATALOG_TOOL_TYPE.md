# 🐛 Bug Report: Risk Catalog PingCastle Tab Shows DonScanner Findings

## Bug ID: BUG-2024-002
**Reporter**: Debug Team  
**Priority**: 🔴 High  
**Status**: ✅ **FIXED**

---

## 📋 Bug Description

### Symptom
The PingCastle Findings tab in the Risk Catalog page displays findings from both PingCastle AND DonScanner (domain group analysis) reports.

### Expected Behavior
- **PingCastle Findings tab** → Only PingCastle findings (`tool_type = 'pingcastle'`)
- **Domain Group Analysis tab** → Only DonScanner/domain_analysis findings

### Actual Behavior
The PingCastle Findings tab shows ALL findings regardless of `tool_type`.

---

## 🔍 Root Cause Analysis

### Team: Debug & Testing Specialists

#### Investigation Path

1. **Frontend Analysis** (`RiskCatalog.tsx`)
   ```typescript
   // PingCastleSection calls:
   useGroupedFindingsFast({
     domain: domain || undefined,
     category: selectedCategory !== 'all' ? selectedCategory : undefined,
     in_latest_only: latestFilter === 'in_latest',
     include_accepted: showAccepted,
     page,
     page_size: pageSize
     // ❌ NO tool_type parameter!
   })
   ```

2. **Frontend Hook** (`useApi.ts`)
   ```typescript
   export function useGroupedFindingsFast(params?: {
     domain?: string
     category?: string
     in_latest_only?: boolean
     include_accepted?: boolean
     page?: number
     page_size?: number
     // ❌ NO tool_type parameter!
   })
   ```

3. **Backend Endpoint** (`main.py`)
   ```python
   @app.get("/api/findings/grouped/fast")
   def get_grouped_findings_fast(
       domain: Optional[str] = None,
       category: Optional[str] = None,
       in_latest_only: bool = False,
       include_accepted: bool = True,
       page: int = 1,
       page_size: int = 50
       # ❌ NO tool_type parameter!
   )
   ```

4. **Storage Method** (`storage_postgres.py`)
   ```python
   def get_grouped_findings_from_mv(...):
       # Query builds WHERE clause with:
       # - domain filter
       # - category filter
       # - in_latest_only filter
       # - include_accepted filter
       # ❌ NO tool_type filter!
   ```

#### Root Cause Identified ✅
When the "fast" endpoints were created for performance optimization, the `tool_type` filter was **not included**. The original non-fast endpoints have this filter, but it was forgotten in the optimized version.

**Comparison:**
| Method | Has tool_type filter? |
|--------|----------------------|
| `get_grouped_findings()` (original) | ✅ Yes |
| `get_grouped_findings_from_mv()` (fast) | ❌ **Missing!** |
| `get_grouped_findings_summary()` (original) | ✅ Yes |
| `get_grouped_findings_summary_fast()` (fast) | ⚠️ Partial (has param but may not filter) |

---

## 🎯 Solution Design

### Team: Full Stack Development Team

#### Design Principle
Add `tool_type` filtering to all fast endpoints, defaulting to `'pingcastle'` for the PingCastle tab and making it explicit for other tool types.

#### Multi-Step Implementation Plan

### Phase 1: Backend - Storage Layer
**Owner**: Database Engineer

1. Update `get_grouped_findings_from_mv()` to accept `tool_type` parameter
2. Add `tool_type` to the WHERE clause
3. Default to `'pingcastle'` to match existing behavior expectations

### Phase 2: Backend - API Layer
**Owner**: Backend Developer

1. Add `tool_type` parameter to `/api/findings/grouped/fast` endpoint
2. Pass `tool_type` to storage method
3. Update `get_grouped_findings_summary_fast()` to properly filter by tool_type

### Phase 3: Frontend - API Service
**Owner**: Frontend Developer

1. Update `getGroupedFindingsFast()` to accept `tool_type` parameter
2. Update `getGroupedFindingsSummaryFast()` if needed
3. Update TypeScript types

### Phase 4: Frontend - Hooks & Components
**Owner**: Frontend Developer

1. Update `useGroupedFindingsFast` hook to include `tool_type`
2. Update `PingCastleSection` to pass `tool_type: 'pingcastle'`
3. (Future) Domain Groups section can pass `tool_type: 'domain_analysis'` if needed

---

## 📊 Technical Specification

### Storage Method Change

```python
def get_grouped_findings_from_mv(
    self,
    domain: Optional[str] = None,
    category: Optional[str] = None,
    tool_type: Optional[str] = 'pingcastle',  # NEW - default to pingcastle
    in_latest_only: bool = False,
    include_accepted: bool = True,
    page: int = 1,
    page_size: int = 50
) -> Dict:
    # ... existing code ...
    
    # NEW: Add tool_type filter
    if tool_type:
        where_clauses.append("tool_type = :tool_type")
        params['tool_type'] = tool_type
```

### API Endpoint Change

```python
@app.get("/api/findings/grouped/fast")
def get_grouped_findings_fast(
    domain: Optional[str] = None,
    category: Optional[str] = None,
    tool_type: Optional[str] = 'pingcastle',  # NEW
    in_latest_only: bool = False,
    include_accepted: bool = True,
    page: int = 1,
    page_size: int = 50
):
    return storage.get_grouped_findings_from_mv(
        domain=domain,
        category=category,
        tool_type=tool_type,  # NEW
        in_latest_only=in_latest_only,
        include_accepted=include_accepted,
        page=page,
        page_size=page_size
    )
```

### Frontend Hook Change

```typescript
export function useGroupedFindingsFast(params?: {
  domain?: string
  category?: string
  tool_type?: string  // NEW
  in_latest_only?: boolean
  include_accepted?: boolean
  page?: number
  page_size?: number
})
```

### Component Change

```typescript
// In PingCastleSection:
const { data: findingsResponse } = useGroupedFindingsFast({
  domain: domain || undefined,
  tool_type: 'pingcastle',  // NEW - explicit filter
  category: selectedCategory !== 'all' ? selectedCategory : undefined,
  in_latest_only: latestFilter === 'in_latest',
  include_accepted: showAccepted,
  page,
  page_size: pageSize
})
```

---

## ✅ Acceptance Criteria

1. [x] PingCastle Findings tab shows ONLY pingcastle findings
2. [x] DonScanner findings are NOT visible in PingCastle tab
3. [x] Summary counts reflect PingCastle-only findings
4. [x] No performance regression
5. [x] Domain Group Analysis tab continues to work correctly

---

## 📅 Implementation Timeline

| Phase | Duration | Owner | Status |
|-------|----------|-------|--------|
| Phase 1: Storage Layer | 15 min | Database Engineer | ✅ Complete |
| Phase 2: API Layer | 15 min | Backend Developer | ✅ Complete |
| Phase 3: Frontend Service | 10 min | Frontend Developer | ✅ Complete |
| Phase 4: Hooks & Components | 10 min | Frontend Developer | ✅ Complete |
| **Total** | **50 min** | | |

---

## 🎉 Implementation Summary

### Files Modified

| File | Change |
|------|--------|
| `server/storage_postgres.py` | Added `tool_type` parameter to `get_grouped_findings_from_mv()` |
| `server/storage_postgres.py` | Updated `get_grouped_findings_summary_fast()` default to 'pingcastle' |
| `server/main.py` | Added `tool_type` parameter to `/api/findings/grouped/fast` endpoint |
| `server/main.py` | Updated summary endpoint default to 'pingcastle' |
| `frontend/src/services/api.ts` | Added `tool_type` to `getGroupedFindingsFast()` |
| `frontend/src/hooks/useApi.ts` | Added `tool_type` to `useGroupedFindingsFast` hook |
| `frontend/src/pages/RiskCatalog.tsx` | Added `tool_type: 'pingcastle'` to PingCastleSection |

### Key Changes

1. **Storage Layer**: Added `tool_type` filter to WHERE clause in `get_grouped_findings_from_mv()`
2. **API Layer**: Exposed `tool_type` parameter on fast endpoints (defaults to 'pingcastle')
3. **Frontend**: Explicitly passes `tool_type: 'pingcastle'` for PingCastle tab

### Deployment

```bash
# Restart services to apply changes
docker compose restart backend frontend
```

---

*Document prepared by: Debug & Analysis Team*  
*Implementation completed: December 2024*
