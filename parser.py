from models import Report, Finding
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from defusedxml.ElementTree import parse as safe_parse

class PingCastleParser:
    def parse_report(self, file_path: Path) -> Report:
        tree = safe_parse(file_path)
        root = tree.getroot()

        # Extract domain
        domain = root.findtext("./DomainFQDN") or ""

        # Parse generation date
        date_str = root.findtext("./GenerationDate") or ""
        try:
            report_date = datetime.fromisoformat(date_str)
        except ValueError:
            try:
                report_date = datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                raise ValueError(f"Invalid GenerationDate format: {date_str}")

        # Helper to parse integer fields safely
        def get_int(xpath: str) -> int:
            t = root.findtext(xpath) or "0"
            try:
                return int(t)
            except ValueError:
                raise ValueError(f"Invalid integer '{t}' at '{xpath}'")

        # Still parse these if you need them
        high_score   = get_int("./ScoreSystem/HighScore")
        medium_score = get_int("./ScoreSystem/MediumScore")
        low_score    = get_int("./ScoreSystem/LowScore")

        # Build per‑category totals
        categories = {
            "StaleObjects":         0,
            "PrivilegedAccounts":   0,
            "Trusts":               0,
            "Anomalies":            0,
        }

        findings = []
        # Try both healthcheck and legacy RiskRule nodes
        rules = root.findall(".//HealthcheckRiskRule") or root.findall(".//RiskRule")
        for rule in rules:
            # pick correct tags
            pts = rule.findtext("Points") or rule.findtext("Score") or "0"
            cat = (rule.findtext("Category") or "").replace(" ", "")
            rid = rule.findtext("RiskId") or rule.findtext("Id") or ""
            title = rule.findtext("Rationale") or rule.findtext("Title") or ""

            score = int(pts) if pts.isdigit() else 0
            # accumulate if it matches one of our target columns
            if cat in categories:
                categories[cat] += score

            findings.append(Finding(
                id=str(uuid4()),
                report_id="",  # fill below
                category=cat,
                name=rid,
                score=score,
                description=title
            ))

        # Compute the new global score as sum of the four columns
        global_score = sum(categories.values())

        # Assign report_id to all findings
        report_id = str(uuid4())
        for f in findings:
            f.report_id = report_id

        return Report(
            id=report_id,
            domain=domain,
            report_date=report_date,
            upload_date=datetime.utcnow(),
            global_score=global_score,                    # <-- replaced PingCastle global
            high_score=high_score,
            medium_score=medium_score,
            low_score=low_score,
            stale_objects_score=categories["StaleObjects"],
            privileged_accounts_score=categories["PrivilegedAccounts"],
            trusts_score=categories["Trusts"],
            anomalies_score=categories["Anomalies"],
            findings=findings,
            original_file=str(file_path)
        )
