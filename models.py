from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Finding(BaseModel):
    id: str
    report_id: str
    category: str
    name: str
    score: int
    description: str


class ReportSummary(BaseModel):
    """Lightweight representation used for listings."""
    id: str
    domain: str
    report_date: datetime
    upload_date: datetime
    global_score: int
    high_score: int
    medium_score: int
    low_score: int
    stale_objects_score: int
    privileged_accounts_score: int
    trusts_score: int
    anomalies_score: int
    domain_sid: str
    domain_functional_level: str
    forest_functional_level: str
    maturity_level: str
    dc_count: int
    user_count: int
    computer_count: int

class Report(BaseModel):
    id: str
    domain: str
    report_date: datetime
    upload_date: datetime
    global_score: int
    high_score: int
    medium_score: int
    low_score: int
    # ← new fields below
    stale_objects_score: int
    privileged_accounts_score: int
    trusts_score: int
    anomalies_score: int
    domain_sid: str
    domain_functional_level: str
    forest_functional_level: str
    maturity_level: str
    dc_count: int
    user_count: int
    computer_count: int
    original_file: Optional[str] = None
    findings: List[Finding]


class AcceptedRisk(BaseModel):
    category: str
    name: str


class Settings(BaseModel):
    webhook_url: str = ""
    alert_message: str = ""


class AlertLog(BaseModel):
    timestamp: datetime
    message: str


class Risk(BaseModel):
    category: str
    name: str
    description: str
