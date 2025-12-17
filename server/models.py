from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class SecurityToolType(str, Enum):
    PINGCASTLE = "pingcastle"
    LOCKSMITH = "locksmith"
    DOMAIN_ANALYSIS = "domain_analysis"
    DOMAIN_GROUP_MEMBERS = "domain_group_members"
    CUSTOM = "custom"

class FindingStatus(str, Enum):
    NEW = "new"
    ACCEPTED = "accepted"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"

class MemberType(str, Enum):
    USER = "user"
    COMPUTER = "computer"
    GROUP = "group"

class Finding(BaseModel):
    id: str
    report_id: str
    tool_type: SecurityToolType
    category: str
    name: str
    score: int = 0
    severity: str = "medium"
    description: str = ""
    recommendation: str = ""
    status: FindingStatus = FindingStatus.NEW
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ReportSummary(BaseModel):
    """Lightweight representation used for listings."""
    id: str
    tool_type: SecurityToolType
    domain: str
    report_date: datetime
    upload_date: datetime
    
    # PingCastle specific scores (optional for other tools)
    global_score: Optional[int] = 0
    high_score: Optional[int] = 0
    medium_score: Optional[int] = 0
    low_score: Optional[int] = 0
    stale_objects_score: Optional[int] = 0
    privileged_accounts_score: Optional[int] = 0
    trusts_score: Optional[int] = 0
    anomalies_score: Optional[int] = 0
    
    # Domain metadata
    domain_sid: Optional[str] = None
    domain_functional_level: Optional[str] = None
    forest_functional_level: Optional[str] = None
    maturity_level: Optional[str] = None
    dc_count: Optional[int] = 0
    user_count: Optional[int] = 0
    computer_count: Optional[int] = 0
    
    # File references for HTML correlation
    original_file: Optional[str] = None
    html_file: Optional[str] = None
    
    # Summary statistics
    total_findings: int = 0
    high_severity_findings: int = 0
    medium_severity_findings: int = 0
    low_severity_findings: int = 0

class Report(BaseModel):
    id: str
    tool_type: SecurityToolType
    domain: str
    report_date: datetime
    upload_date: datetime
    
    # PingCastle specific scores
    global_score: Optional[int] = 0
    high_score: Optional[int] = 0
    medium_score: Optional[int] = 0
    low_score: Optional[int] = 0
    stale_objects_score: Optional[int] = 0
    privileged_accounts_score: Optional[int] = 0
    trusts_score: Optional[int] = 0
    anomalies_score: Optional[int] = 0
    
    # Domain metadata
    domain_sid: Optional[str] = None
    domain_functional_level: Optional[str] = None
    forest_functional_level: Optional[str] = None
    maturity_level: Optional[str] = None
    dc_count: Optional[int] = 0
    user_count: Optional[int] = 0
    computer_count: Optional[int] = 0
    
    # File references
    original_file: Optional[str] = None
    html_file: Optional[str] = None
    
    # Extensible metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Related data
    findings: List[Finding] = Field(default_factory=list)

class AcceptedRisk(BaseModel):
    tool_type: SecurityToolType
    category: str
    name: str
    reason: Optional[str] = None
    accepted_by: Optional[str] = None
    accepted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class MonitoredGroup(BaseModel):
    id: Optional[str] = None
    group_name: str
    group_sid: Optional[str] = None
    domain: str
    description: Optional[str] = None
    is_active: bool = True
    alert_on_changes: bool = True

class GroupMembership(BaseModel):
    id: Optional[str] = None
    report_id: str
    group_id: str
    member_name: str
    member_sid: Optional[str] = None
    member_type: MemberType = MemberType.USER
    is_direct_member: bool = True

class Settings(BaseModel):
    webhook_url: str = ""
    alert_message: str = ""
    retention_days: int = 365
    auto_accept_low_severity: bool = False

class Risk(BaseModel):
    id: Optional[str] = None
    tool_type: SecurityToolType
    category: str
    name: str
    description: str = ""
    recommendation: str = ""
    severity: str = "medium"

class Agent(BaseModel):
    id: Optional[str] = None
    name: str
    agent_type: str
    domain: str
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    configuration: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    last_seen: Optional[datetime] = None

# Request/Response models for API
class UploadResponse(BaseModel):
    status: str
    report_id: Optional[str] = None
    attached_to: Optional[str] = None
    tool_type: Optional[SecurityToolType] = None
    message: Optional[str] = None

class GroupMembershipChange(BaseModel):
    group_name: str
    member_name: str
    change_type: str  # "added", "removed"
    previous_members: List[str] = Field(default_factory=list)
    current_members: List[str] = Field(default_factory=list)

class AcceptedGroupMember(BaseModel):
    id: Optional[str] = None
    group_name: str
    member_name: str
    member_sid: Optional[str] = None
    domain: str
    reason: Optional[str] = None
    accepted_by: Optional[str] = None
    accepted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class GroupRiskConfig(BaseModel):
    id: Optional[str] = None
    group_name: str
    domain: str
    base_risk_score: int = 10
    max_acceptable_members: int = 5
    alert_threshold: int = 10
    description: Optional[str] = None


# =============================================================================
# Dashboard KPIs - Pre-aggregated metrics for fast dashboard loading
# =============================================================================

class ReportKPI(BaseModel):
    """
    Pre-aggregated KPIs for a single report.
    One-to-one relationship with reports table for fast dashboard queries.
    """
    id: Optional[str] = None
    report_id: str
    tool_type: SecurityToolType
    domain: str
    report_date: datetime
    
    # PingCastle Risk Scores
    global_score: int = 0
    stale_objects_score: int = 0
    privileged_accounts_score: int = 0
    trusts_score: int = 0
    anomalies_score: int = 0
    
    # Domain Infrastructure Metrics
    user_count: int = 0
    computer_count: int = 0
    dc_count: int = 0
    
    # Findings Metrics
    total_findings: int = 0
    high_severity_findings: int = 0
    medium_severity_findings: int = 0
    low_severity_findings: int = 0
    
    # Domain Group Metrics (for domain_analysis reports)
    total_groups: int = 0
    total_group_members: int = 0
    accepted_group_members: int = 0
    unaccepted_group_members: int = 0
    
    # Risk Assessment Metrics
    domain_group_risk_score: float = 0.0


class DashboardKPISummary(BaseModel):
    """
    Dashboard summary combining latest KPIs across all data sources.
    Optimized response model for the dashboard page.
    """
    # Domain Information
    domain: str
    domain_sid: Optional[str] = None
    domain_functional_level: Optional[str] = None
    forest_functional_level: Optional[str] = None
    maturity_level: Optional[str] = None
    
    # Latest report info
    latest_report_id: str
    latest_report_date: datetime
    tool_type: SecurityToolType
    
    # PingCastle Risk Scores (from latest PingCastle report)
    global_score: int = 0
    stale_objects_score: int = 0
    privileged_accounts_score: int = 0
    trusts_score: int = 0
    anomalies_score: int = 0
    
    # Domain Infrastructure Metrics
    user_count: int = 0
    computer_count: int = 0
    dc_count: int = 0
    
    # Findings Metrics (aggregated)
    total_findings: int = 0
    high_severity_findings: int = 0
    medium_severity_findings: int = 0
    low_severity_findings: int = 0
    
    # Domain Group Metrics
    total_groups: int = 0
    total_group_members: int = 0
    accepted_group_members: int = 0
    unaccepted_group_members: int = 0
    
    # Risk Assessment
    domain_group_risk_score: float = 0.0


class DashboardKPIHistory(BaseModel):
    """Historical KPI data point for trend charts."""
    report_date: datetime
    global_score: int = 0
    stale_objects_score: int = 0
    privileged_accounts_score: int = 0
    trusts_score: int = 0
    anomalies_score: int = 0
    unaccepted_group_members: int = 0


# =============================================================================
# API Upload Models - For programmatic report submission
# =============================================================================

class APIFindingInput(BaseModel):
    """Input model for a single finding in API upload."""
    category: str
    name: str
    score: int = 0
    severity: str = "medium"
    description: str = ""
    recommendation: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class APIPingCastleScores(BaseModel):
    """PingCastle-specific scores for API upload."""
    global_score: Optional[int] = None
    stale_objects_score: Optional[int] = 0
    privileged_accounts_score: Optional[int] = 0
    trusts_score: Optional[int] = 0
    anomalies_score: Optional[int] = 0


class APIDomainMetadata(BaseModel):
    """Domain metadata for API upload."""
    domain_sid: Optional[str] = None
    domain_functional_level: Optional[str] = None
    forest_functional_level: Optional[str] = None
    maturity_level: Optional[str] = None
    dc_count: Optional[int] = None
    user_count: Optional[int] = None
    computer_count: Optional[int] = None


class APIGroupMember(BaseModel):
    """Group member data for domain group analysis uploads."""
    name: str
    samaccountname: Optional[str] = ""
    sid: Optional[str] = ""
    type: str = "user"  # user, computer, group
    enabled: Optional[bool] = None


class APIGroupData(BaseModel):
    """Group data for domain analysis uploads."""
    group_name: str
    members: List[APIGroupMember] = Field(default_factory=list)
    group_sid: Optional[str] = ""
    group_type: str = "security"


class APIUploadRequest(BaseModel):
    """
    Request model for programmatic API report uploads.
    
    Supports multiple upload modes:
    1. Full report with findings - provide domain, tool_type, and findings
    2. PingCastle data - provide domain, tool_type=pingcastle, pingcastle_scores, and optionally findings
    3. Domain group data - provide domain, tool_type=domain_analysis, and groups
    
    Examples:
        # Upload PingCastle-style findings
        {
            "domain": "CORP.LOCAL",
            "tool_type": "pingcastle",
            "report_date": "2024-01-15T10:30:00Z",
            "pingcastle_scores": {"global_score": 45, "stale_objects_score": 10},
            "findings": [{"category": "PrivilegedAccounts", "name": "AdminSDHolder", "score": 15}]
        }
        
        # Upload domain group membership data
        {
            "domain": "CORP.LOCAL", 
            "tool_type": "domain_analysis",
            "groups": [
                {"group_name": "Domain Admins", "members": [{"name": "admin1", "type": "user"}]}
            ]
        }
    """
    # Required fields
    domain: str = Field(..., description="Domain name (e.g., CORP.LOCAL)")
    tool_type: SecurityToolType = Field(..., description="Security tool type")
    
    # Optional report metadata
    report_date: Optional[datetime] = Field(None, description="Report generation date (defaults to now)")
    
    # Domain metadata (optional)
    domain_metadata: Optional[APIDomainMetadata] = None
    
    # PingCastle-specific scores (optional, for pingcastle tool_type)
    pingcastle_scores: Optional[APIPingCastleScores] = None
    
    # Findings list (optional, can be empty)
    findings: List[APIFindingInput] = Field(default_factory=list, description="List of security findings")
    
    # Domain group data (optional, for domain_analysis tool_type)
    groups: List[APIGroupData] = Field(default_factory=list, description="List of domain groups with members")
    
    # Additional metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional report metadata")
    
    # Alert configuration
    send_alert: bool = Field(True, description="Send webhook alert for unaccepted findings")


class APIUploadResponse(BaseModel):
    """Response model for API upload endpoints."""
    status: str = "success"
    report_id: str
    tool_type: SecurityToolType
    domain: str
    findings_count: int = 0
    groups_processed: int = 0
    message: str = ""
    alert_sent: bool = False
    
    # Additional details
    details: Dict[str, Any] = Field(default_factory=dict)


class APIBulkUploadRequest(BaseModel):
    """Request model for bulk API uploads."""
    reports: List[APIUploadRequest] = Field(..., description="List of reports to upload")


class APIBulkUploadResponse(BaseModel):
    """Response model for bulk API uploads."""
    status: str = "success"
    total_reports: int = 0
    successful: int = 0
    failed: int = 0
    results: List[Dict[str, Any]] = Field(default_factory=list)


# =============================================================================
# Hoxhunt Security Awareness Models
# =============================================================================

class HoxhuntScoreInput(BaseModel):
    """
    Input model for manual Hoxhunt security awareness score entry.
    
    All score fields are 0-100 values representing percentages.
    
    The main scores (overall, category scores) are entered manually by the user
    as they appear in the Hoxhunt platform - Hoxhunt uses internal weights that
    we cannot replicate.
    
    Individual metrics are optional and stored for reference/detail tracking.
    """
    domain: str = Field(..., description="Domain name (e.g., CORP.LOCAL)")
    assessment_date: datetime = Field(..., description="Month/date of assessment (typically 1st of month)")
    
    # ==========================================================================
    # Main scores - manually entered from Hoxhunt platform
    # ==========================================================================
    overall_score: float = Field(..., ge=0, le=100, description="Overall Hoxhunt score as shown in platform")
    culture_engagement_score: float = Field(..., ge=0, le=100, description="Culture & Engagement score from platform")
    competence_score: float = Field(..., ge=0, le=100, description="Competence score from platform")
    real_threat_detection_score: float = Field(..., ge=0, le=100, description="Real Threat Detection score from platform")
    
    # ==========================================================================
    # Culture & Engagement detailed metrics (optional - for reference)
    # ==========================================================================
    ce_onboarding_rate: float = Field(0, ge=0, le=100, description="User onboarding completion rate")
    ce_simulations_reported: float = Field(0, ge=0, le=100, description="Phishing simulations correctly reported")
    ce_simulations_misses: float = Field(0, ge=0, le=100, description="Phishing simulations missed (inverse metric)")
    ce_threat_indicators: float = Field(0, ge=0, le=100, description="Threat indicator recognition score")
    
    # ==========================================================================
    # Competence detailed metrics (optional - for reference)
    # ==========================================================================
    comp_simulations_fails: float = Field(0, ge=0, le=100, description="Simulations failed (inverse metric)")
    comp_simulations_reported: float = Field(0, ge=0, le=100, description="Simulations correctly reported")
    comp_quiz_score: float = Field(0, ge=0, le=100, description="Training quiz average score")
    comp_threat_detection_accuracy: float = Field(0, ge=0, le=100, description="Threat detection accuracy")
    
    # ==========================================================================
    # Real Threat Detection detailed metrics (optional - for reference)
    # ==========================================================================
    rtd_simulations_reported: float = Field(0, ge=0, le=100, description="Real threat simulations reported")
    rtd_simulations_misses: float = Field(0, ge=0, le=100, description="Real threat simulations missed")
    rtd_reporting_speed: float = Field(0, ge=0, le=100, description="Speed of threat reporting")
    rtd_threat_reporting_activity: float = Field(0, ge=0, le=100, description="Overall reporting activity level")
    rtd_threat_detection_accuracy: float = Field(0, ge=0, le=100, description="Accuracy in detecting real threats")
    
    # ==========================================================================
    # Optional metadata
    # ==========================================================================
    notes: Optional[str] = Field(None, description="Additional notes about this assessment")
    entered_by: Optional[str] = Field(None, description="User who entered the scores")


class HoxhuntScore(BaseModel):
    """
    Full Hoxhunt score record including calculated category scores.
    
    This model is returned from the database and includes all
    calculated scores and metadata.
    """
    id: Optional[str] = None
    domain: str
    assessment_date: datetime
    
    # Calculated scores
    overall_score: float = 0
    culture_engagement_score: float = 0
    competence_score: float = 0
    real_threat_detection_score: float = 0
    
    # Culture & Engagement metrics
    ce_onboarding_rate: float = 0
    ce_simulations_reported: float = 0
    ce_simulations_misses: float = 0
    ce_threat_indicators: float = 0
    
    # Competence metrics
    comp_simulations_fails: float = 0
    comp_simulations_reported: float = 0
    comp_quiz_score: float = 0
    comp_threat_detection_accuracy: float = 0
    
    # Real Threat Detection metrics
    rtd_simulations_reported: float = 0
    rtd_simulations_misses: float = 0
    rtd_reporting_speed: float = 0
    rtd_threat_reporting_activity: float = 0
    rtd_threat_detection_accuracy: float = 0
    
    # Metadata
    notes: Optional[str] = None
    entered_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class HoxhuntScoreHistory(BaseModel):
    """Historical Hoxhunt score data point for trend charts."""
    assessment_date: datetime
    overall_score: float
    culture_engagement_score: float
    competence_score: float
    real_threat_detection_score: float


class HoxhuntDashboardSummary(BaseModel):
    """
    Dashboard summary for Hoxhunt scores across all domains.
    Used for the main dashboard overview widget.
    """
    domain: str
    assessment_date: datetime
    overall_score: float
    culture_engagement_score: float
    competence_score: float
    real_threat_detection_score: float
    awareness_level: str  # 'critical', 'high', 'medium', 'low'
    previous_score: Optional[float] = None
    score_change: Optional[float] = None
    entered_by: Optional[str] = None
