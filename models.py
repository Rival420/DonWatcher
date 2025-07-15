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
    original_file: Optional[str] = None
    findings: List[Finding]
