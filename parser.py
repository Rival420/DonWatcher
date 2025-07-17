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

        def get_text(*paths: str) -> str:
            for p in paths:
                val = root.findtext(p)
                if val:
                    return val
            return ""

        domain_sid = get_text("./DomainSID", "./DomainSid")
        domain_functional = get_text("./DomainFunctionalLevel")
        forest_functional = get_text("./ForestFunctionalLevel")
        maturity_level = get_text("./MaturityLevel")

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

        def get_int_any(*xpaths: str) -> int:
            for xp in xpaths:
                t = root.findtext(xp)
                if t:
                    try:
                        return int(t)
                    except ValueError:
                        raise ValueError(f"Invalid integer '{t}' at '{xp}'")
            return 0

        # Still parse these if you need them
        high_score   = get_int("./ScoreSystem/HighScore")
        medium_score = get_int("./ScoreSystem/MediumScore")
        low_score    = get_int("./ScoreSystem/LowScore")

        dc_count = get_int_any(
            "./NumberOfDC",
            "./DomainControllerCount",
            "./NumberOfDCs",
            "./NbDC",
        )
        user_count = get_int_any(
            "./UserAccountData/Number",
            "./NumberOfUsers",
            "./NbUsers",
        )
        computer_count = get_int_any(
            "./ComputerAccountData/Number",
            "./NumberOfComputers",
            "./NbComputers",
        )

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
            domain_sid=domain_sid,
            domain_functional_level=domain_functional,
            forest_functional_level=forest_functional,
            maturity_level=maturity_level,
            dc_count=dc_count,
            user_count=user_count,
            computer_count=computer_count,
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
