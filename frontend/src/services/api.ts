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
  GroupedFindingsSummary
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

export async function getReport(id: string): Promise<Report> {
  return fetchJSON<Report>(`${API_BASE}/reports/${id}`)
}

export async function getLatestReport(domain?: string): Promise<Report | null> {
  const reports = await getReports()
  const filtered = domain ? reports.filter(r => r.domain === domain) : reports
  return filtered.sort((a, b) => 
    new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
  )[0] || null
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

// Domains
export async function getDomains(): Promise<string[]> {
  const reports = await getReports()
  const domains = [...new Set(reports.map(r => r.domain))]
  return domains.sort()
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

