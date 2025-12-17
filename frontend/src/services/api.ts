import type { 
  Report, 
  DomainGroup, 
  RiskScore, 
  RiskBreakdown, 
  HealthStatus,
  UploadResponse,
  GroupMember,
  Finding,
  FindingsSummary,
  AcceptRiskRequest,
  GroupedFinding,
  GroupedFindingsSummary,
  APIUploadRequest,
  APIUploadResponse,
  APIBulkUploadRequest,
  APIBulkUploadResponse,
  APIFindingInput,
  APIGroupData,
  SecurityToolType,
  APIPingCastleScores,
  APIDomainMetadata,
  DashboardKPIResponse,
  DashboardKPIHistoryResponse,
  AllDomainsKPIResponse
} from '../types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// Health
export async function getHealth(): Promise<HealthStatus> {
  return fetchJSON<HealthStatus>(`${API_BASE}/health`)
}

// Reports
export async function getReports(): Promise<Report[]> {
  return fetchJSON<Report[]>(`${API_BASE}/reports`)
}

// Paginated Reports - More efficient for large datasets
export interface PaginatedReportsResponse {
  status: string
  page: number
  page_size: number
  total_count: number
  total_pages: number
  reports: Array<{
    id: string
    tool_type: string
    domain: string
    report_date: string
    upload_date: string | null
    global_score: number
    domain_sid: string | null
    html_file: string | null
    total_findings: number
    high_severity_findings: number
    medium_severity_findings: number
    low_severity_findings: number
  }>
}

export async function getReportsPaginated(params?: {
  page?: number
  page_size?: number
  domain?: string
  tool_type?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}): Promise<PaginatedReportsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.append('page', String(params.page))
  if (params?.page_size) searchParams.append('page_size', String(params.page_size))
  if (params?.domain) searchParams.append('domain', params.domain)
  if (params?.tool_type) searchParams.append('tool_type', params.tool_type)
  if (params?.sort_by) searchParams.append('sort_by', params.sort_by)
  if (params?.sort_order) searchParams.append('sort_order', params.sort_order)
  
  const query = searchParams.toString()
  return fetchJSON<PaginatedReportsResponse>(
    `${API_BASE}/reports/paginated${query ? `?${query}` : ''}`
  )
}

export async function getReport(id: string): Promise<Report> {
  return fetchJSON<Report>(`${API_BASE}/reports/${id}`)
}

// Get latest report - Optimized endpoint (no longer loads all reports!)
export async function getLatestReport(domain?: string, toolType?: string): Promise<Report | null> {
  const params = new URLSearchParams()
  if (domain) params.append('domain', domain)
  if (toolType) params.append('tool_type', toolType)
  
  const query = params.toString()
  const response = await fetchJSON<{ status: string; report: Report | null }>(
    `${API_BASE}/reports/latest${query ? `?${query}` : ''}`
  )
  return response.report
}

// Domain Groups
export async function getDomainGroups(domain: string): Promise<DomainGroup[]> {
  return fetchJSON<DomainGroup[]>(`${API_BASE}/domain_groups/${encodeURIComponent(domain)}`)
}

interface GroupMembersResponse {
  group_name: string
  domain: string
  total_members: number
  accepted_members: number
  members: GroupMember[]
  last_updated: string
}

export async function getGroupMembers(domain: string, groupName: string): Promise<GroupMember[]> {
  const response = await fetchJSON<GroupMembersResponse>(
    `${API_BASE}/domain_groups/${encodeURIComponent(domain)}/${encodeURIComponent(groupName)}/members`
  )
  return response.members || []
}

export async function acceptMember(
  domain: string, 
  groupName: string, 
  memberName: string,
  reason?: string
): Promise<void> {
  await fetchJSON(`${API_BASE}/domain_groups/members/accept`, {
    method: 'POST',
    body: JSON.stringify({
      domain,
      group_name: groupName,
      member_name: memberName,
      reason,
    }),
  })
}

export async function denyMember(
  domain: string,
  groupName: string,
  memberName: string
): Promise<void> {
  await fetchJSON(`${API_BASE}/domain_groups/members/accept`, {
    method: 'DELETE',
    body: JSON.stringify({
      domain,
      group_name: groupName,
      member_name: memberName,
    }),
  })
}

// Risk Scores
export async function getGlobalRisk(domain: string): Promise<RiskScore> {
  return fetchJSON<RiskScore>(`${API_BASE}/risk/global/${encodeURIComponent(domain)}`)
}

export async function getRiskBreakdown(domain: string): Promise<RiskBreakdown> {
  return fetchJSON<RiskBreakdown>(`${API_BASE}/risk/breakdown/${encodeURIComponent(domain)}`)
}

export async function getRiskHistory(domain: string, days = 30): Promise<RiskScore[]> {
  return fetchJSON<RiskScore[]>(`${API_BASE}/risk/history/${encodeURIComponent(domain)}?days=${days}`)
}

// Upload
export async function uploadReport(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/upload', {
    method: 'POST',
    body: formData,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

// Domains - Optimized endpoint (no longer loads all reports!)
export async function getDomains(): Promise<string[]> {
  const response = await fetchJSON<{ status: string; count: number; domains: string[] }>(
    `${API_BASE}/domains`
  )
  return response.domains || []
}

// Domains with statistics
export async function getDomainsWithStats(): Promise<{
  domain: string
  report_count: number
  latest_report_date: string | null
  first_report_date: string | null
}[]> {
  const response = await fetchJSON<{ 
    status: string
    count: number
    domains: Array<{
      domain: string
      report_count: number
      latest_report_date: string | null
      first_report_date: string | null
    }>
  }>(`${API_BASE}/domains/stats`)
  return response.domains || []
}

// =============================================================================
// Dashboard KPIs - Optimized endpoints for fast dashboard loading
// =============================================================================

/**
 * Get pre-aggregated dashboard KPIs for fast loading
 * This is the primary endpoint for dashboard data
 */
export async function getDashboardKPIs(domain?: string): Promise<DashboardKPIResponse> {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : ''
  return fetchJSON<DashboardKPIResponse>(`${API_BASE}/dashboard/kpis${query}`)
}

/**
 * Get historical KPI data for trend charts
 */
export async function getDashboardKPIHistory(
  domain: string, 
  limit: number = 10,
  toolType?: string
): Promise<DashboardKPIHistoryResponse> {
  const params = new URLSearchParams()
  params.append('limit', String(limit))
  if (toolType) params.append('tool_type', toolType)
  
  return fetchJSON<DashboardKPIHistoryResponse>(
    `${API_BASE}/dashboard/kpis/history/${encodeURIComponent(domain)}?${params.toString()}`
  )
}

/**
 * Get KPIs for all domains (multi-domain overview)
 */
export async function getAllDomainsKPIs(): Promise<AllDomainsKPIResponse> {
  return fetchJSON<AllDomainsKPIResponse>(`${API_BASE}/dashboard/kpis/all-domains`)
}

// =============================================================================
// Fast Endpoints - Using Materialized Views for Performance
// =============================================================================

/**
 * Get ultra-fast dashboard summary from materialized view
 */
export async function getDashboardSummaryFast(): Promise<{
  status: string
  source: string
  domains: Array<{
    domain: string
    tool_type: string
    latest_report_date: string | null
    report_count: number
    latest_global_score: number
    latest_total_findings: number
    latest_high_severity: number
    latest_medium_severity: number
    latest_low_severity: number
    latest_unaccepted_members: number
    total_groups: number
    total_group_members: number
    user_count: number
    computer_count: number
    dc_count: number
    stale_objects_score: number
    privileged_accounts_score: number
    trusts_score: number
    anomalies_score: number
    domain_group_risk_score: number
  }>
}> {
  return fetchJSON(`${API_BASE}/dashboard/summary`)
}

/**
 * Get grouped findings with pagination (fast, from materialized view)
 */
export interface GroupedFindingsFastResponse {
  status: string
  source: string
  page: number
  page_size: number
  total_count: number
  total_pages: number
  findings: Array<{
    tool_type: string
    category: string
    name: string
    max_score: number
    avg_score: number
    occurrence_count: number
    first_seen: string | null
    last_seen: string | null
    domains: string[]
    in_latest_report: boolean
    is_accepted: boolean
    accepted_reason: string | null
    accepted_by: string | null
    accepted_at: string | null
    expires_at: string | null
    description: string
    recommendation: string
    severity: string
  }>
}

export async function getGroupedFindingsFast(params?: {
  domain?: string
  category?: string
  tool_type?: string
  in_latest_only?: boolean
  include_accepted?: boolean
  page?: number
  page_size?: number
}): Promise<GroupedFindingsFastResponse> {
  const searchParams = new URLSearchParams()
  if (params?.domain) searchParams.append('domain', params.domain)
  if (params?.category) searchParams.append('category', params.category)
  // tool_type filter to ensure PingCastle tab only shows PingCastle findings
  if (params?.tool_type) searchParams.append('tool_type', params.tool_type)
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
 * Get grouped findings summary (fast, from materialized view)
 */
export interface GroupedFindingsSummaryFastResponse {
  status: string
  source: string
  total_unique_findings: number
  total_in_latest: number
  total_accepted: number
  total_unaccepted: number
  total_score: number
  categories: Record<string, {
    total: number
    in_latest: number
    accepted: number
    unaccepted: number
    score: number
  }>
}

export async function getGroupedFindingsSummaryFast(
  tool_type?: string
): Promise<GroupedFindingsSummaryFastResponse> {
  const query = tool_type ? `?tool_type=${tool_type}` : ''
  return fetchJSON(`${API_BASE}/findings/grouped/fast/summary${query}`)
}

/**
 * Get domain groups fast (from pre-calculated view)
 */
export async function getDomainGroupsFast(domain: string): Promise<DomainGroup[]> {
  return fetchJSON<DomainGroup[]>(`${API_BASE}/domain_groups/${encodeURIComponent(domain)}/fast`)
}

// Findings (Risk Catalog)
export async function getFindings(params?: {
  domain?: string
  category?: string
  tool_type?: string
  include_accepted?: boolean
}): Promise<Finding[]> {
  const searchParams = new URLSearchParams()
  if (params?.domain) searchParams.append('domain', params.domain)
  if (params?.category) searchParams.append('category', params.category)
  if (params?.tool_type) searchParams.append('tool_type', params.tool_type)
  if (params?.include_accepted !== undefined) {
    searchParams.append('include_accepted', String(params.include_accepted))
  }
  
  const query = searchParams.toString()
  return fetchJSON<Finding[]>(`${API_BASE}/findings${query ? `?${query}` : ''}`)
}

export async function getFindingsSummary(domain?: string): Promise<FindingsSummary> {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : ''
  return fetchJSON<FindingsSummary>(`${API_BASE}/findings/summary${query}`)
}

export async function getReportFindings(reportId: string): Promise<Finding[]> {
  return fetchJSON<Finding[]>(`${API_BASE}/reports/${reportId}/findings`)
}

export async function getReportHtmlUrl(reportId: string): Promise<{ html_url: string; filename: string }> {
  return fetchJSON<{ html_url: string; filename: string }>(`${API_BASE}/reports/${reportId}/html`)
}

export async function acceptRisk(request: AcceptRiskRequest): Promise<void> {
  await fetchJSON(`${API_BASE}/accepted_risks`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function removeAcceptedRisk(request: AcceptRiskRequest): Promise<void> {
  await fetchJSON(`${API_BASE}/accepted_risks`, {
    method: 'DELETE',
    body: JSON.stringify(request),
  })
}

// Grouped Findings (Risk Catalog - aggregated view)
export async function getGroupedFindings(params?: {
  domain?: string
  category?: string
  tool_type?: string
  include_accepted?: boolean
}): Promise<GroupedFinding[]> {
  const searchParams = new URLSearchParams()
  if (params?.domain) searchParams.append('domain', params.domain)
  if (params?.category) searchParams.append('category', params.category)
  if (params?.tool_type) searchParams.append('tool_type', params.tool_type)
  if (params?.include_accepted !== undefined) {
    searchParams.append('include_accepted', String(params.include_accepted))
  }
  
  const query = searchParams.toString()
  return fetchJSON<GroupedFinding[]>(`${API_BASE}/findings/grouped${query ? `?${query}` : ''}`)
}

export async function getGroupedFindingsSummary(domain?: string, tool_type?: string): Promise<GroupedFindingsSummary> {
  const searchParams = new URLSearchParams()
  if (domain) searchParams.append('domain', domain)
  if (tool_type) searchParams.append('tool_type', tool_type)
  
  const query = searchParams.toString()
  return fetchJSON<GroupedFindingsSummary>(`${API_BASE}/findings/grouped/summary${query ? `?${query}` : ''}`)
}

// =============================================================================
// API Upload Methods - For programmatic report submission
// =============================================================================

/**
 * Upload a report via JSON API (programmatic upload)
 * Use this for integrating with scripts, CI/CD, or external tools
 */
export async function uploadReportAPI(request: APIUploadRequest): Promise<APIUploadResponse> {
  return fetchJSON<APIUploadResponse>(`${API_BASE}/upload/report`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Bulk upload multiple reports via JSON API
 */
export async function uploadReportsBulkAPI(request: APIBulkUploadRequest): Promise<APIBulkUploadResponse> {
  return fetchJSON<APIBulkUploadResponse>(`${API_BASE}/upload/reports`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Upload PingCastle data via API
 */
export async function uploadPingCastleAPI(
  domain: string,
  findings: APIFindingInput[],
  options?: {
    pingcastle_scores?: APIPingCastleScores
    domain_metadata?: APIDomainMetadata
    report_date?: string
    send_alert?: boolean
  }
): Promise<APIUploadResponse> {
  const request: APIUploadRequest = {
    domain,
    tool_type: 'pingcastle',
    findings,
    ...options,
  }
  return uploadReportAPI(request)
}

/**
 * Upload domain group membership data via API
 */
export async function uploadDomainGroupsAPI(
  domain: string,
  groups: APIGroupData[],
  options?: {
    domain_metadata?: APIDomainMetadata
    report_date?: string
    send_alert?: boolean
  }
): Promise<APIUploadResponse> {
  const request: APIUploadRequest = {
    domain,
    tool_type: 'domain_analysis',
    groups,
    ...options,
  }
  return uploadReportAPI(request)
}

/**
 * Upload custom findings via API
 */
export async function uploadFindingsAPI(
  domain: string,
  findings: APIFindingInput[],
  tool_type: SecurityToolType = 'custom',
  options?: {
    report_date?: string
    send_alert?: boolean
  }
): Promise<APIUploadResponse> {
  const request: APIUploadRequest = {
    domain,
    tool_type,
    findings,
    ...options,
  }
  return uploadReportAPI(request)
}

/**
 * Check health of the upload API
 */
export async function getUploadAPIHealth(): Promise<{ status: string; module: string; endpoints: string[] }> {
  return fetchJSON(`${API_BASE}/upload/health`)
}

