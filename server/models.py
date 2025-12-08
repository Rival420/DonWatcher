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
