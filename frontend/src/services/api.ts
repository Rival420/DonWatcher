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
  AllDomainsKPIResponse,
  HoxhuntScoreInput,
  HoxhuntScoresResponse,
  HoxhuntLatestResponse,
  HoxhuntHistoryResponse,
  HoxhuntDashboardResponse,
  HoxhuntSaveResponse
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
 * Supports flexible date ranges with server-side aggregation for performance
 * 
 * @param domain - Domain to get history for
 * @param limit - Maximum number of data points (default: 10)
 * @param days - Optional: Filter to last N days
 * @param aggregation - Optional: 'none' | 'weekly' | 'monthly' - aggregates data points for large ranges
 * @param toolType - Optional: Filter by tool type (default: pingcastle)
 */
export async function getDashboardKPIHistory(
  domain: string, 
  limit: number = 10,
  days?: number,
  aggregation?: 'none' | 'weekly' | 'monthly',
  toolType?: string
): Promise<DashboardKPIHistoryResponse> {
  const params = new URLSearchParams()
  params.append('limit', String(limit))
  if (days !== undefined) params.append('days', String(days))
  if (aggregation && aggregation !== 'none') params.append('aggregation', aggregation)
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

// =============================================================================
// Hoxhunt Security Awareness API
// =============================================================================

/**
 * Get all Hoxhunt scores for a domain
 */
export async function getHoxhuntScores(domain: string, limit: number = 12): Promise<HoxhuntScoresResponse> {
  return fetchJSON(`${API_BASE}/hoxhunt/scores/${encodeURIComponent(domain)}?limit=${limit}`)
}

/**
 * Get the latest Hoxhunt score for a domain
 */
export async function getLatestHoxhuntScore(domain: string): Promise<HoxhuntLatestResponse> {
  return fetchJSON(`${API_BASE}/hoxhunt/scores/${encodeURIComponent(domain)}/latest`)
}

/**
 * Get historical Hoxhunt scores for trend charts
 */
export async function getHoxhuntHistory(domain: string, limit: number = 12): Promise<HoxhuntHistoryResponse> {
  return fetchJSON(`${API_BASE}/hoxhunt/scores/${encodeURIComponent(domain)}/history?limit=${limit}`)
}

/**
 * Save a new Hoxhunt score entry (manual data entry)
 */
export async function saveHoxhuntScore(score: HoxhuntScoreInput): Promise<HoxhuntSaveResponse> {
  return fetchJSON(`${API_BASE}/hoxhunt/scores`, {
    method: 'POST',
    body: JSON.stringify(score),
  })
}

/**
 * Delete a Hoxhunt score entry
 */
export async function deleteHoxhuntScore(scoreId: string): Promise<{ status: string; message: string }> {
  return fetchJSON(`${API_BASE}/hoxhunt/scores/${encodeURIComponent(scoreId)}`, {
    method: 'DELETE',
  })
}

/**
 * Get Hoxhunt dashboard summary across all domains
 */
export async function getHoxhuntDashboard(): Promise<HoxhuntDashboardResponse> {
  return fetchJSON(`${API_BASE}/hoxhunt/dashboard`)
}

// =============================================================================
// Vulnerability Analysis API (Outpost24)
// =============================================================================

import type {
  VulnerabilityScoreInput,
  VulnerabilityScoresResponse,
  VulnerabilityLatestResponse,
  VulnerabilityHistoryResponse,
  VulnerabilityDashboardResponse,
  VulnerabilitySaveResponse
} from '../types'

/**
 * Get all vulnerability scores for a domain
 */
export async function getVulnerabilityScores(domain: string, limit: number = 30): Promise<VulnerabilityScoresResponse> {
  return fetchJSON(`${API_BASE}/vulnerability/scores/${encodeURIComponent(domain)}?limit=${limit}`)
}

/**
 * Get the latest vulnerability score for a domain
 */
export async function getLatestVulnerabilityScore(domain: string): Promise<VulnerabilityLatestResponse> {
  return fetchJSON(`${API_BASE}/vulnerability/scores/${encodeURIComponent(domain)}/latest`)
}

/**
 * Get historical vulnerability scores for trend charts
 */
export async function getVulnerabilityHistory(domain: string, limit: number = 30): Promise<VulnerabilityHistoryResponse> {
  return fetchJSON(`${API_BASE}/vulnerability/scores/${encodeURIComponent(domain)}/history?limit=${limit}`)
}

/**
 * Save a new vulnerability score entry (from scanner)
 */
export async function saveVulnerabilityScore(score: VulnerabilityScoreInput): Promise<VulnerabilitySaveResponse> {
  return fetchJSON(`${API_BASE}/vulnerability/scores`, {
    method: 'POST',
    body: JSON.stringify(score),
  })
}

/**
 * Delete a vulnerability score entry
 */
export async function deleteVulnerabilityScore(scoreId: string): Promise<{ status: string; message: string }> {
  return fetchJSON(`${API_BASE}/vulnerability/scores/${encodeURIComponent(scoreId)}`, {
    method: 'DELETE',
  })
}

/**
 * Get vulnerability dashboard summary across all domains
 */
export async function getVulnerabilityDashboard(): Promise<VulnerabilityDashboardResponse> {
  return fetchJSON(`${API_BASE}/vulnerability/dashboard`)
}

// =============================================================================
// Beacon System API (C2-like Agent Management)
// =============================================================================

import type {
  Beacon,
  BeaconJob,
  BeaconJobCreate,
  TaskTemplate,
  BeaconDashboardStats,
  BeaconActivityLog,
  BulkJobCreate
} from '../types'

/**
 * Get all beacons
 */
export async function getBeacons(params?: {
  status?: string
  domain?: string
}): Promise<Beacon[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.append('status', params.status)
  if (params?.domain) searchParams.append('domain', params.domain)
  
  const query = searchParams.toString()
  return fetchJSON(`${API_BASE}/beacons/${query ? `?${query}` : ''}`)
}

/**
 * Get beacon dashboard statistics
 */
export async function getBeaconStats(): Promise<BeaconDashboardStats> {
  return fetchJSON(`${API_BASE}/beacons/stats`)
}

/**
 * Get a specific beacon
 */
export async function getBeacon(beaconId: string): Promise<Beacon> {
  return fetchJSON(`${API_BASE}/beacons/${encodeURIComponent(beaconId)}`)
}

/**
 * Update beacon configuration
 */
export async function updateBeacon(
  beaconId: string, 
  updates: Partial<{
    sleep_interval: number
    jitter_percent: number
    tags: string[]
    notes: string
    status: string
  }>
): Promise<{ status: string; beacon_id: string; updates: Record<string, unknown> }> {
  return fetchJSON(`${API_BASE}/beacons/${encodeURIComponent(beaconId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
}

/**
 * Kill a beacon (mark as terminated)
 */
export async function killBeacon(beaconId: string): Promise<{ status: string; beacon_id: string; action: string }> {
  return fetchJSON(`${API_BASE}/beacons/${encodeURIComponent(beaconId)}`, {
    method: 'DELETE'
  })
}

/**
 * Create a new job for a beacon
 */
export async function createBeaconJob(job: BeaconJobCreate): Promise<BeaconJob> {
  return fetchJSON(`${API_BASE}/beacons/jobs`, {
    method: 'POST',
    body: JSON.stringify(job)
  })
}

/**
 * Create jobs for multiple beacons
 */
export async function createBulkJobs(job: BulkJobCreate): Promise<{
  status: string
  total: number
  success: number
  failed: number
  results: Array<{ beacon_id: string; status: string; job_id?: string; error?: string }>
}> {
  return fetchJSON(`${API_BASE}/beacons/jobs/bulk`, {
    method: 'POST',
    body: JSON.stringify(job)
  })
}

/**
 * Get all jobs across all beacons
 */
export async function getAllBeaconJobs(params?: {
  status?: string
  limit?: number
}): Promise<BeaconJob[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.append('status', params.status)
  if (params?.limit) searchParams.append('limit', String(params.limit))
  
  const query = searchParams.toString()
  return fetchJSON(`${API_BASE}/beacons/jobs/all${query ? `?${query}` : ''}`)
}

/**
 * Get jobs for a specific beacon
 */
export async function getBeaconJobs(beaconId: string, params?: {
  status?: string
  limit?: number
}): Promise<BeaconJob[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.append('status', params.status)
  if (params?.limit) searchParams.append('limit', String(params.limit))
  
  const query = searchParams.toString()
  return fetchJSON(`${API_BASE}/beacons/${encodeURIComponent(beaconId)}/jobs${query ? `?${query}` : ''}`)
}

/**
 * Get a specific job with full details
 */
export async function getBeaconJob(jobId: string): Promise<{
  job: BeaconJob
  results: Array<{
    id: string
    output_type: string
    output_data: string
    output_size: number
    received_at: string
  }>
}> {
  return fetchJSON(`${API_BASE}/beacons/jobs/${encodeURIComponent(jobId)}`)
}

/**
 * Cancel a pending job
 */
export async function cancelBeaconJob(jobId: string): Promise<{ status: string; job_id: string; action: string }> {
  return fetchJSON(`${API_BASE}/beacons/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE'
  })
}

/**
 * Get all task templates
 */
export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  return fetchJSON(`${API_BASE}/beacons/templates/all`)
}

/**
 * Create a new task template
 */
export async function createTaskTemplate(template: Omit<TaskTemplate, 'id'>): Promise<{ status: string; template_id: string }> {
  return fetchJSON(`${API_BASE}/beacons/templates`, {
    method: 'POST',
    body: JSON.stringify(template)
  })
}

/**
 * Get activity log for a beacon
 */
export async function getBeaconActivity(beaconId: string, limit: number = 100): Promise<BeaconActivityLog[]> {
  return fetchJSON(`${API_BASE}/beacons/${encodeURIComponent(beaconId)}/activity?limit=${limit}`)
}

/**
 * Get global activity log
 */
export async function getAllBeaconActivity(limit: number = 100): Promise<{ activities: BeaconActivityLog[] }> {
  return fetchJSON(`${API_BASE}/beacons/activity/all?limit=${limit}`)
}

// =============================================================================
// Scheduled Jobs API
// =============================================================================

import type { ScheduledJob, ScheduledJobCreate } from '../types'

/**
 * Get all scheduled jobs
 */
export async function getScheduledJobs(): Promise<{ schedules: ScheduledJob[] }> {
  return fetchJSON(`${API_BASE}/beacons/schedules/all`)
}

/**
 * Create a new scheduled job
 */
export async function createScheduledJob(schedule: ScheduledJobCreate): Promise<{ status: string; schedule_id: string }> {
  return fetchJSON(`${API_BASE}/beacons/schedules`, {
    method: 'POST',
    body: JSON.stringify(schedule)
  })
}

/**
 * Update a scheduled job
 */
export async function updateScheduledJob(
  scheduleId: string, 
  updates: Partial<{ is_enabled: boolean; schedule_type: string; schedule_value: string; name: string }>
): Promise<{ status: string; schedule_id: string }> {
  return fetchJSON(`${API_BASE}/beacons/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
}

/**
 * Delete a scheduled job
 */
export async function deleteScheduledJob(scheduleId: string): Promise<{ status: string; action: string }> {
  return fetchJSON(`${API_BASE}/beacons/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'DELETE'
  })
}

/**
 * Manually run a scheduled job now
 */
export async function runScheduledJobNow(scheduleId: string): Promise<{ 
  status: string
  schedule_id: string
  jobs_created: number
  beacon_ids: string[] 
}> {
  return fetchJSON(`${API_BASE}/beacons/schedules/${encodeURIComponent(scheduleId)}/run`, {
    method: 'POST'
  })
}
