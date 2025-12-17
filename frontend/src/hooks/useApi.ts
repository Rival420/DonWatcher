import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../services/api'

// =============================================================================
// Dashboard KPIs - Optimized hooks for fast dashboard loading
// =============================================================================

/**
 * Get pre-aggregated dashboard KPIs
 * This is the primary hook for dashboard data - much faster than fetching all reports
 */
export function useDashboardKPIs(domain?: string) {
  return useQuery({
    queryKey: ['dashboardKPIs', domain],
    queryFn: () => api.getDashboardKPIs(domain),
    staleTime: 30000, // Cache for 30 seconds
  })
}

/**
 * Get historical KPI data for trend charts
 */
export function useDashboardKPIHistory(domain: string, limit: number = 10, toolType?: string) {
  return useQuery({
    queryKey: ['dashboardKPIHistory', domain, limit, toolType],
    queryFn: () => api.getDashboardKPIHistory(domain, limit, toolType),
    enabled: !!domain,
    staleTime: 60000, // Cache for 1 minute
  })
}

/**
 * Get KPIs for all domains (multi-domain overview)
 */
export function useAllDomainsKPIs() {
  return useQuery({
    queryKey: ['allDomainsKPIs'],
    queryFn: api.getAllDomainsKPIs,
    staleTime: 60000, // Cache for 1 minute
  })
}

// Health check
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  })
}

// Reports
export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: api.getReports,
  })
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () => api.getReport(id),
    enabled: !!id,
  })
}

export function useLatestReport(domain?: string) {
  return useQuery({
    queryKey: ['latestReport', domain],
    queryFn: () => api.getLatestReport(domain),
  })
}

// Domains - Now uses optimized endpoint (no longer loads all reports!)
export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: api.getDomains,
    staleTime: 60000, // Cache for 1 minute
  })
}

// Domains with statistics
export function useDomainsWithStats() {
  return useQuery({
    queryKey: ['domainsWithStats'],
    queryFn: api.getDomainsWithStats,
    staleTime: 60000, // Cache for 1 minute
  })
}

// Paginated Reports - More efficient for large datasets
export function useReportsPaginated(params?: {
  page?: number
  page_size?: number
  domain?: string
  tool_type?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}) {
  return useQuery({
    queryKey: ['reportsPaginated', params],
    queryFn: () => api.getReportsPaginated(params),
    staleTime: 30000, // Cache for 30 seconds
  })
}

// Domain Groups
export function useDomainGroups(domain: string) {
  return useQuery({
    queryKey: ['domainGroups', domain],
    queryFn: () => api.getDomainGroups(domain),
    enabled: !!domain,
  })
}

export function useGroupMembers(domain: string, groupName: string) {
  return useQuery({
    queryKey: ['groupMembers', domain, groupName],
    queryFn: () => api.getGroupMembers(domain, groupName),
    enabled: !!domain && !!groupName,
  })
}

export function useAcceptMember() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ domain, groupName, memberName, reason }: {
      domain: string
      groupName: string
      memberName: string
      reason?: string
    }) => api.acceptMember(domain, groupName, memberName, reason),
    onSuccess: (_, { domain, groupName }) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', domain, groupName] })
      queryClient.invalidateQueries({ queryKey: ['domainGroups', domain] })
    },
  })
}

export function useDenyMember() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ domain, groupName, memberName }: {
      domain: string
      groupName: string
      memberName: string
    }) => api.denyMember(domain, groupName, memberName),
    onSuccess: (_, { domain, groupName }) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', domain, groupName] })
      queryClient.invalidateQueries({ queryKey: ['domainGroups', domain] })
    },
  })
}

// Risk Scores
export function useGlobalRisk(domain: string) {
  return useQuery({
    queryKey: ['globalRisk', domain],
    queryFn: () => api.getGlobalRisk(domain),
    enabled: !!domain,
  })
}

export function useRiskBreakdown(domain: string) {
  return useQuery({
    queryKey: ['riskBreakdown', domain],
    queryFn: () => api.getRiskBreakdown(domain),
    enabled: !!domain,
  })
}

export function useRiskHistory(domain: string, days = 30) {
  return useQuery({
    queryKey: ['riskHistory', domain, days],
    queryFn: () => api.getRiskHistory(domain, days),
    enabled: !!domain,
  })
}

// Upload
export function useUpload() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.uploadReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      queryClient.invalidateQueries({ queryKey: ['findings'] })
    },
  })
}

// Findings (Risk Catalog)
export function useFindings(params?: {
  domain?: string
  category?: string
  tool_type?: string
  include_accepted?: boolean
}) {
  return useQuery({
    queryKey: ['findings', params],
    queryFn: () => api.getFindings(params),
  })
}

export function useFindingsSummary(domain?: string) {
  return useQuery({
    queryKey: ['findingsSummary', domain],
    queryFn: () => api.getFindingsSummary(domain),
  })
}

export function useReportFindings(reportId: string) {
  return useQuery({
    queryKey: ['reportFindings', reportId],
    queryFn: () => api.getReportFindings(reportId),
    enabled: !!reportId,
  })
}

export function useReportHtmlUrl(reportId: string) {
  return useQuery({
    queryKey: ['reportHtmlUrl', reportId],
    queryFn: () => api.getReportHtmlUrl(reportId),
    enabled: !!reportId,
  })
}

export function useAcceptRisk() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.acceptRisk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['findings'] })
      queryClient.invalidateQueries({ queryKey: ['findingsSummary'] })
      queryClient.invalidateQueries({ queryKey: ['reportFindings'] })
      queryClient.invalidateQueries({ queryKey: ['groupedFindings'] })
      queryClient.invalidateQueries({ queryKey: ['groupedFindingsSummary'] })
    },
  })
}

export function useRemoveAcceptedRisk() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.removeAcceptedRisk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['findings'] })
      queryClient.invalidateQueries({ queryKey: ['findingsSummary'] })
      queryClient.invalidateQueries({ queryKey: ['reportFindings'] })
      queryClient.invalidateQueries({ queryKey: ['groupedFindings'] })
      queryClient.invalidateQueries({ queryKey: ['groupedFindingsSummary'] })
    },
  })
}

// Grouped Findings (Risk Catalog - aggregated view)
export function useGroupedFindings(params?: {
  domain?: string
  category?: string
  tool_type?: string
  include_accepted?: boolean
}) {
  return useQuery({
    queryKey: ['groupedFindings', params],
    queryFn: () => api.getGroupedFindings(params),
  })
}

export function useGroupedFindingsSummary(domain?: string, tool_type?: string) {
  return useQuery({
    queryKey: ['groupedFindingsSummary', domain, tool_type],
    queryFn: () => api.getGroupedFindingsSummary(domain, tool_type),
  })
}

// =============================================================================
// Fast Hooks - Using Materialized Views for Performance
// =============================================================================

/**
 * Get ultra-fast dashboard summary from materialized view
 * Best for multi-domain overview
 */
export function useDashboardSummaryFast() {
  return useQuery({
    queryKey: ['dashboardSummaryFast'],
    queryFn: api.getDashboardSummaryFast,
    staleTime: 60000,      // Fresh for 1 minute
    gcTime: 300000,        // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Get grouped findings with pagination (fast)
 * Used for Risk Catalog with 10-15x faster loading
 */
export function useGroupedFindingsFast(params?: {
  domain?: string
  category?: string
  tool_type?: string
  in_latest_only?: boolean
  include_accepted?: boolean
  page?: number
  page_size?: number
}) {
  return useQuery({
    queryKey: ['groupedFindingsFast', params],
    queryFn: () => api.getGroupedFindingsFast(params),
    staleTime: 30000,       // Fresh for 30 seconds
    gcTime: 300000,         // Cache for 5 minutes
    placeholderData: (previousData) => previousData, // Keep showing old data while fetching
  })
}

/**
 * Get grouped findings summary (fast)
 * Used for category tabs in Risk Catalog
 */
export function useGroupedFindingsSummaryFast(tool_type?: string) {
  return useQuery({
    queryKey: ['groupedFindingsSummaryFast', tool_type],
    queryFn: () => api.getGroupedFindingsSummaryFast(tool_type),
    staleTime: 30000,
    gcTime: 300000,
  })
}

/**
 * Get domain groups fast (from pre-calculated view)
 * 5-10x faster than regular endpoint
 */
export function useDomainGroupsFast(domain: string) {
  return useQuery({
    queryKey: ['domainGroupsFast', domain],
    queryFn: () => api.getDomainGroupsFast(domain),
    enabled: !!domain,
    staleTime: 30000,
    gcTime: 300000,
  })
}

// =============================================================================
// Hoxhunt Security Awareness Hooks
// =============================================================================

/**
 * Get all Hoxhunt scores for a domain
 */
export function useHoxhuntScores(domain: string, limit: number = 12) {
  return useQuery({
    queryKey: ['hoxhuntScores', domain, limit],
    queryFn: () => api.getHoxhuntScores(domain, limit),
    enabled: !!domain,
    staleTime: 60000, // Cache for 1 minute
  })
}

/**
 * Get the latest Hoxhunt score for a domain
 */
export function useLatestHoxhuntScore(domain: string) {
  return useQuery({
    queryKey: ['hoxhuntLatest', domain],
    queryFn: () => api.getLatestHoxhuntScore(domain),
    enabled: !!domain,
    staleTime: 60000,
  })
}

/**
 * Get historical Hoxhunt scores for trend charts
 */
export function useHoxhuntHistory(domain: string, limit: number = 12) {
  return useQuery({
    queryKey: ['hoxhuntHistory', domain, limit],
    queryFn: () => api.getHoxhuntHistory(domain, limit),
    enabled: !!domain,
    staleTime: 60000,
  })
}

/**
 * Get Hoxhunt dashboard summary across all domains
 */
export function useHoxhuntDashboard() {
  return useQuery({
    queryKey: ['hoxhuntDashboard'],
    queryFn: api.getHoxhuntDashboard,
    staleTime: 60000,
  })
}

/**
 * Save a Hoxhunt score (mutation)
 */
export function useSaveHoxhuntScore() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.saveHoxhuntScore,
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['hoxhuntScores', variables.domain] })
      queryClient.invalidateQueries({ queryKey: ['hoxhuntLatest', variables.domain] })
      queryClient.invalidateQueries({ queryKey: ['hoxhuntHistory', variables.domain] })
      queryClient.invalidateQueries({ queryKey: ['hoxhuntDashboard'] })
    },
  })
}

/**
 * Delete a Hoxhunt score (mutation)
 */
export function useDeleteHoxhuntScore() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.deleteHoxhuntScore,
    onSuccess: () => {
      // Invalidate all Hoxhunt queries since we don't know which domain
      queryClient.invalidateQueries({ queryKey: ['hoxhuntScores'] })
      queryClient.invalidateQueries({ queryKey: ['hoxhuntLatest'] })
      queryClient.invalidateQueries({ queryKey: ['hoxhuntHistory'] })
      queryClient.invalidateQueries({ queryKey: ['hoxhuntDashboard'] })
    },
  })
}

