import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../services/api'

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

// Domains
export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: api.getDomains,
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
    },
  })
}

