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

// UI Types
export type Theme = 'dark' | 'light'

export interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

