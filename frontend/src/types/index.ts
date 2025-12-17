// API Types
export interface Report {
  id: string
  tool_type: 'pingcastle' | 'domain_analysis' | 'locksmith' | 'domain_group_members'
  domain: string
  report_date: string
  upload_date: string
  global_score: number
  high_score: number
  medium_score: number
  low_score: number
  stale_objects_score: number
  privileged_accounts_score: number
  trusts_score: number
  anomalies_score: number
  domain_sid: string
  domain_functional_level: string | null
  forest_functional_level: string | null
  maturity_level: string | null
  dc_count: number
  user_count: number
  computer_count: number
  original_file: string
  html_file: string | null
  total_findings: number
  high_severity_findings: number
  medium_severity_findings: number
  low_severity_findings: number
}

export interface DomainGroup {
  group_name: string
  domain: string
  total_members: number
  accepted_members: number
  unaccepted_members: number
  risk_score: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  members?: GroupMember[]
}

export interface GroupMember {
  name: string
  samaccountname: string
  sid: string
  type: 'user' | 'computer' | 'group'
  enabled: boolean | null
  is_accepted: boolean
  accepted_by?: string
  accepted_at?: string
  reason?: string
}

export interface RiskScore {
  domain: string
  global_score: number
  pingcastle_score: number | null
  domain_group_score: number
  trend_direction: 'improving' | 'stable' | 'degrading'
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  assessment_date: string
}

export interface RiskBreakdown {
  access_governance_score: number
  privilege_escalation_score: number
  compliance_posture_score: number
  operational_risk_score: number
  groups: GroupRiskAssessment[]
}

export interface GroupRiskAssessment {
  group_name: string
  risk_score: number
  risk_level: string
  total_members: number
  accepted_members: number
  unaccepted_members: number
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  message: string
  duration_ms: number
}

export interface UploadResponse {
  status: 'success' | 'error'
  report_id?: string
  tool_type?: string
  message: string
}

// Finding Types (Risk Catalog)
export interface Finding {
  id: string
  report_id: string
  tool_type: string
  category: 'PrivilegedAccounts' | 'StaleObjects' | 'Trusts' | 'Anomalies' | string
  name: string  // RiskId (e.g., "P-PrivilegeEveryone")
  score: number
  description: string  // Rationale
  severity: 'critical' | 'high' | 'medium' | 'low'
  domain: string
  report_date: string | null
  is_accepted: boolean
  accepted_reason: string | null
  accepted_by: string | null
  accepted_at: string | null
  expires_at: string | null
}

export interface FindingsSummary {
  categories: {
    PrivilegedAccounts: CategorySummary
    StaleObjects: CategorySummary
    Trusts: CategorySummary
    Anomalies: CategorySummary
  }
  total_findings: number
  total_accepted: number
  total_score: number
}

export interface CategorySummary {
  total: number
  accepted: number
  total_score: number
}

export interface AcceptRiskRequest {
  tool_type: string
  category: string
  name: string
  reason?: string
  accepted_by?: string
  expires_at?: string
}

// Grouped Finding - represents a finding aggregated across multiple reports
export interface GroupedFinding {
  tool_type: string
  category: 'PrivilegedAccounts' | 'StaleObjects' | 'Trusts' | 'Anomalies' | string
  name: string  // RiskId (e.g., "P-PrivilegeEveryone")
  description: string
  recommendation: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  max_score: number
  min_score: number
  avg_score: number
  occurrence_count: number  // How many times this finding appeared
  first_seen: string | null
  last_seen: string | null
  domains: string[]
  report_ids: string[]
  in_latest_report: boolean  // Whether present in the most recent report
  is_accepted: boolean
  accepted_reason: string | null
  accepted_by: string | null
  accepted_at: string | null
  expires_at: string | null
}

export interface GroupedFindingsSummary {
  categories: {
    PrivilegedAccounts: GroupedCategorySummary
    StaleObjects: GroupedCategorySummary
    Trusts: GroupedCategorySummary
    Anomalies: GroupedCategorySummary
  }
  total_unique_findings: number
  total_accepted: number
  total_in_latest: number
  total_score: number
}

export interface GroupedCategorySummary {
  total: number
  accepted: number
  total_score: number
  in_latest: number
}

// =============================================================================
// Dashboard KPIs - Pre-aggregated metrics for fast dashboard loading
// =============================================================================

export interface DashboardKPIs {
  id: string
  report_id: string
  tool_type: SecurityToolType
  domain: string
  report_date: string
  domain_sid: string | null
  domain_functional_level: string | null
  forest_functional_level: string | null
  maturity_level: string | null
  
  // PingCastle Risk Scores
  global_score: number
  stale_objects_score: number
  privileged_accounts_score: number
  trusts_score: number
  anomalies_score: number
  
  // Domain Infrastructure Metrics
  user_count: number
  computer_count: number
  dc_count: number
  
  // Findings Metrics
  total_findings: number
  high_severity_findings: number
  medium_severity_findings: number
  low_severity_findings: number
  
  // Domain Group Metrics
  total_groups: number
  total_group_members: number
  accepted_group_members: number
  unaccepted_group_members: number
  
  // Risk Assessment
  domain_group_risk_score: number
}

export interface DashboardKPIResponse {
  status: 'ok' | 'no_data' | 'error'
  fallback?: boolean
  message?: string
  kpis?: DashboardKPIs
}

export interface DashboardKPIHistoryPoint {
  date: string
  global_score: number
  stale_objects_score: number
  privileged_accounts_score: number
  trusts_score: number
  anomalies_score: number
  unaccepted_group_members: number
  total_findings: number
  domain_group_risk_score: number
}

export interface DashboardKPIHistoryResponse {
  status: 'ok' | 'error'
  domain: string
  count: number
  history: DashboardKPIHistoryPoint[]
}

export interface DomainKPISummary {
  domain: string
  report_id: string
  report_date: string
  tool_type: SecurityToolType
  global_score: number
  total_findings: number
  high_severity_findings: number
  unaccepted_group_members: number
  domain_group_risk_score: number
  domain_sid: string | null
}

export interface AllDomainsKPIResponse {
  status: 'ok' | 'error'
  count: number
  domains: DomainKPISummary[]
}

// =============================================================================
// API Upload Types - For programmatic report submission
// =============================================================================

export type SecurityToolType = 'pingcastle' | 'locksmith' | 'domain_analysis' | 'domain_group_members' | 'custom'

export interface APIFindingInput {
  category: string
  name: string
  score?: number
  severity?: 'critical' | 'high' | 'medium' | 'low'
  description?: string
  recommendation?: string
  metadata?: Record<string, unknown>
}

export interface APIPingCastleScores {
  global_score?: number
  stale_objects_score?: number
  privileged_accounts_score?: number
  trusts_score?: number
  anomalies_score?: number
}

export interface APIDomainMetadata {
  domain_sid?: string
  domain_functional_level?: string
  forest_functional_level?: string
  maturity_level?: string
  dc_count?: number
  user_count?: number
  computer_count?: number
}

export interface APIGroupMemberInput {
  name: string
  samaccountname?: string
  sid?: string
  type?: 'user' | 'computer' | 'group'
  enabled?: boolean
}

export interface APIGroupData {
  group_name: string
  members: APIGroupMemberInput[]
  group_sid?: string
  group_type?: string
}

export interface APIUploadRequest {
  domain: string
  tool_type: SecurityToolType
  report_date?: string
  domain_metadata?: APIDomainMetadata
  pingcastle_scores?: APIPingCastleScores
  findings?: APIFindingInput[]
  groups?: APIGroupData[]
  metadata?: Record<string, unknown>
  send_alert?: boolean
}

export interface APIUploadResponse {
  status: 'success' | 'error' | 'partial'
  report_id: string
  tool_type: SecurityToolType
  domain: string
  findings_count: number
  groups_processed: number
  message: string
  alert_sent: boolean
  details?: Record<string, unknown>
}

export interface APIBulkUploadRequest {
  reports: APIUploadRequest[]
}

export interface APIBulkUploadResponse {
  status: 'success' | 'partial' | 'error'
  total_reports: number
  successful: number
  failed: number
  results: Array<{
    status: 'success' | 'error'
    domain: string
    tool_type: string
    report_id?: string
    findings_count?: number
    error?: string
  }>
}

// UI Types
export type Theme = 'dark' | 'light'

export interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

// =============================================================================
// Hoxhunt Security Awareness Types
// =============================================================================

export interface HoxhuntScore {
  id: string
  domain: string
  assessment_date: string
  
  // Calculated scores
  overall_score: number
  culture_engagement_score: number
  competence_score: number
  real_threat_detection_score: number
  
  // Culture & Engagement metrics (0-100)
  ce_onboarding_rate: number
  ce_simulations_reported: number
  ce_simulations_misses: number
  ce_threat_indicators: number
  
  // Competence metrics (0-100)
  comp_simulations_fails: number
  comp_simulations_reported: number
  comp_quiz_score: number
  comp_threat_detection_accuracy: number
  
  // Real Threat Detection metrics (0-100)
  rtd_simulations_reported: number
  rtd_simulations_misses: number
  rtd_reporting_speed: number
  rtd_threat_reporting_activity: number
  rtd_threat_detection_accuracy: number
  
  // Metadata
  notes: string | null
  entered_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface HoxhuntScoreInput {
  domain: string
  assessment_date: string
  
  // Culture & Engagement metrics
  ce_onboarding_rate: number
  ce_simulations_reported: number
  ce_simulations_misses: number
  ce_threat_indicators: number
  
  // Competence metrics
  comp_simulations_fails: number
  comp_simulations_reported: number
  comp_quiz_score: number
  comp_threat_detection_accuracy: number
  
  // Real Threat Detection metrics
  rtd_simulations_reported: number
  rtd_simulations_misses: number
  rtd_reporting_speed: number
  rtd_threat_reporting_activity: number
  rtd_threat_detection_accuracy: number
  
  // Optional metadata
  notes?: string
  entered_by?: string
}

export interface HoxhuntHistoryPoint {
  assessment_date: string
  overall_score: number
  culture_engagement_score: number
  competence_score: number
  real_threat_detection_score: number
}

export interface HoxhuntDashboardSummary {
  domain: string
  assessment_date: string
  overall_score: number
  culture_engagement_score: number
  competence_score: number
  real_threat_detection_score: number
  awareness_level: 'critical' | 'high' | 'medium' | 'low'
  previous_score: number | null
  score_change: number | null
  entered_by: string | null
  created_at: string | null
}

export interface HoxhuntScoresResponse {
  status: string
  domain: string
  count: number
  scores: HoxhuntScore[]
}

export interface HoxhuntLatestResponse {
  status: 'ok' | 'no_data'
  domain: string
  score: HoxhuntScore | null
}

export interface HoxhuntHistoryResponse {
  status: string
  domain: string
  count: number
  history: HoxhuntHistoryPoint[]
}

export interface HoxhuntDashboardResponse {
  status: string
  count: number
  domains: HoxhuntDashboardSummary[]
}

export interface HoxhuntSaveResponse {
  status: string
  score_id: string
  domain: string
  assessment_date: string
  calculated_scores: {
    culture_engagement_score: number
    competence_score: number
    real_threat_detection_score: number
    overall_score: number
  }
  message: string
}

