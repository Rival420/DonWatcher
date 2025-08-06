import logging
import sqlite3
from datetime import datetime
from models import Report, Finding, ReportSummary, Settings, AcceptedRisk, Risk
from typing import List, Dict


def get_storage():
    return ReportStorage(db_path="./reports.db")


class ReportStorage:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._create_tables()

    def _create_tables(self):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    domain TEXT,
                    domain_sid TEXT,
                    domain_functional_level TEXT,
                    forest_functional_level TEXT,
                    maturity_level TEXT,
                    dc_count INTEGER,
                    user_count INTEGER,
                    computer_count INTEGER,
                    report_date TEXT,
                    upload_date TEXT,
                    global_score INTEGER,
                    high_score INTEGER,
                    medium_score INTEGER,
                    low_score INTEGER,
                    stale_objects_score INTEGER,
                    privileged_accounts_score INTEGER,
                    trusts_score INTEGER,
                    anomalies_score INTEGER,
                    original_file TEXT
                )
            """)
            
            # Get existing columns
            c.execute("PRAGMA table_info(reports)")
            existing_columns = {row[1] for row in c.fetchall()}

            # Ensure new columns exist if upgrading from an older version
            for col_def in [
                ("domain_sid", "TEXT"),
                ("domain_functional_level", "TEXT"),
                ("forest_functional_level", "TEXT"),
                ("maturity_level", "TEXT"),
                ("dc_count", "INTEGER"),
                ("user_count", "INTEGER"),
                ("computer_count", "INTEGER")
            ]:
                if col_def[0] not in existing_columns:
                    c.execute(f"ALTER TABLE reports ADD COLUMN {col_def[0]} {col_def[1]}")

            c.execute("""
                CREATE TABLE IF NOT EXISTS findings (
                    id TEXT PRIMARY KEY,
                    report_id TEXT,
                    category TEXT,
                    name TEXT,
                    score INTEGER,
                    description TEXT,
                    FOREIGN KEY(report_id) REFERENCES reports(id)
                )
            """)

            c.execute("""
                CREATE TABLE IF NOT EXISTS risks (
                    category TEXT,
                    name TEXT,
                    description TEXT,
                    PRIMARY KEY(category, name)
                )
            """)

            c.execute("""
                CREATE TABLE IF NOT EXISTS accepted_risks (
                    category TEXT,
                    name TEXT,
                    PRIMARY KEY(category, name),
                    FOREIGN KEY(category, name) REFERENCES risks(category, name)
                )
            """)

            c.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)

    def clear_all_data(self):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("DROP TABLE IF EXISTS reports")
            c.execute("DROP TABLE IF EXISTS findings")
            c.execute("DROP TABLE IF EXISTS risks")
            c.execute("DROP TABLE IF EXISTS accepted_risks")
            c.execute("DROP TABLE IF EXISTS settings")
        self._create_tables()

    def save_report(self, report: Report):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO reports (
                    id, domain, domain_sid,
                    domain_functional_level, forest_functional_level,
                    maturity_level, dc_count, user_count, computer_count,
                    report_date, upload_date,
                    global_score, high_score, medium_score, low_score,
                    stale_objects_score, privileged_accounts_score,
                    trusts_score, anomalies_score,
                    original_file
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                report.id,
                report.domain,
                report.domain_sid,
                report.domain_functional_level,
                report.forest_functional_level,
                report.maturity_level,
                report.dc_count,
                report.user_count,
                report.computer_count,
                report.report_date.isoformat(),
                report.upload_date.isoformat(),
                report.global_score,
                report.high_score,
                report.medium_score,
                report.low_score,
                report.stale_objects_score,
                report.privileged_accounts_score,
                report.trusts_score,
                report.anomalies_score,
                report.original_file
            ))
            for f in report.findings:
                c.execute(
                    "INSERT OR REPLACE INTO risks (category, name, description) VALUES (?, ?, ?)",
                    (f.category, f.name, f.description),
                )
                c.execute(
                    """
                    INSERT INTO findings
                    (id, report_id, category, name, score, description)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (f.id, f.report_id, f.category, f.name, f.score, f.description),
                )

    def get_all_reports(self) -> List[Report]:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM reports")
            report_rows = c.fetchall()

            # Fetch all findings at once and group them by report_id
            c.execute("SELECT * FROM findings")
            finding_rows = c.fetchall()

        findings_by_report = {}
        for f in finding_rows:
            f_obj = Finding(id=f[0], report_id=f[1], category=f[2],
                            name=f[3], score=f[4], description=f[5])
            findings_by_report.setdefault(f_obj.report_id, []).append(f_obj)

        reports: List[Report] = []
        for row in report_rows:
            reports.append(Report(
                id=row[0],
                domain=row[1],
                domain_sid=row[2],
                domain_functional_level=row[3],
                forest_functional_level=row[4],
                maturity_level=row[5],
                dc_count=row[6],
                user_count=row[7],
                computer_count=row[8],
                report_date=datetime.fromisoformat(row[9]),
                upload_date=datetime.fromisoformat(row[10]),
                global_score=row[11],
                high_score=row[12],
                medium_score=row[13],
                low_score=row[14],
                stale_objects_score=row[15],
                privileged_accounts_score=row[16],
                trusts_score=row[17],
                anomalies_score=row[18],
                original_file=row[19],
                findings=findings_by_report.get(row[0], [])
            ))

        return reports

    def get_all_reports_summary(self) -> List[ReportSummary]:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                "SELECT id, domain, domain_sid, domain_functional_level, "
                "forest_functional_level, maturity_level, dc_count, user_count, "
                "computer_count, report_date, upload_date, global_score, high_score, "
                "medium_score, low_score, stale_objects_score, privileged_accounts_score, "
                "trusts_score, anomalies_score FROM reports ORDER BY report_date"
            )
            rows = c.fetchall()
        return [
            ReportSummary(
                id=row[0],
                domain=row[1],
                domain_sid=row[2],
                domain_functional_level=row[3],
                forest_functional_level=row[4],
                maturity_level=row[5],
                dc_count=row[6],
                user_count=row[7],
                computer_count=row[8],
                report_date=datetime.fromisoformat(row[9]),
                upload_date=datetime.fromisoformat(row[10]),
                global_score=row[11],
                high_score=row[12],
                medium_score=row[13],
                low_score=row[14],
                stale_objects_score=row[15],
                privileged_accounts_score=row[16],
                trusts_score=row[17],
                anomalies_score=row[18],
            )
            for row in rows
        ]

    def get_report(self, report_id: str) -> Report:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
            row = c.fetchone()
            if not row:
                raise ValueError("Report not found")
            c.execute("SELECT * FROM findings WHERE report_id = ?", (report_id,))
            fr = c.fetchall()
        findings = [
            Finding(id=f[0], report_id=f[1], category=f[2], name=f[3], score=f[4], description=f[5])
            for f in fr
        ]
        return Report(
            id=row[0],
            domain=row[1],
            domain_sid=row[2],
            domain_functional_level=row[3],
            forest_functional_level=row[4],
            maturity_level=row[5],
            dc_count=row[6],
            user_count=row[7],
            computer_count=row[8],
            report_date=datetime.fromisoformat(row[9]),
            upload_date=datetime.fromisoformat(row[10]),
            global_score=row[11],
            high_score=row[12],
            medium_score=row[13],
            low_score=row[14],
            stale_objects_score=row[15],
            privileged_accounts_score=row[16],
            trusts_score=row[17],
            anomalies_score=row[18],
            original_file=row[19],
            findings=findings,
        )

    def get_score_history(self) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("""
              SELECT report_date, stale_objects_score,
                     privileged_accounts_score, trusts_score, anomalies_score
              FROM reports
              ORDER BY report_date
            """)
            rows = c.fetchall()
        return [
          {
            "date": row[0],
            "staleObjects": row[1],
            "privilegedAccounts": row[2],
            "trusts": row[3],
            "anomalies": row[4],
          }
          for row in rows
        ]

    def get_recurring_findings(self) -> List[Dict]:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                """
              SELECT f.category, f.name, r.description, COUNT(*) as count, AVG(f.score) as avg_score
              FROM findings f
              LEFT JOIN risks r ON f.category = r.category AND f.name = r.name
              GROUP BY f.category, f.name, r.description
              ORDER BY count DESC
                """
            )
            rows = c.fetchall()
        return [
            {
                "category": row[0],
                "name": row[1],
                "description": row[2] or "",
                "count": row[3],
                "avg_score": round(row[4], 1) if row[4] else 0,
            }
            for row in rows
        ]

    def add_accepted_risk(self, category: str, name: str):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                "INSERT OR IGNORE INTO accepted_risks (category, name) VALUES (?, ?)",
                (category, name),
            )

    def remove_accepted_risk(self, category: str, name: str):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                "DELETE FROM accepted_risks WHERE category = ? AND name = ?",
                (category, name),
            )

    def get_accepted_risks(self) -> List[AcceptedRisk]:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("SELECT category, name FROM accepted_risks")
            rows = c.fetchall()
        return [AcceptedRisk(category=r[0], name=r[1]) for r in rows]

    def get_unaccepted_findings(self, findings: List[Finding]) -> List[Finding]:
        accepted = {(r.category, r.name) for r in self.get_accepted_risks()}
        return [f for f in findings if (f.category, f.name) not in accepted]

    def get_settings(self) -> Settings:
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute("SELECT key, value FROM settings")
            rows = c.fetchall()
        data = {k: v for k, v in rows}
        return Settings(
            webhook_url=data.get("webhook_url", ""),
            alert_message=data.get("alert_message", ""),
        )

    def update_settings(self, webhook_url: str, alert_message: str):
        with sqlite3.connect(self.db_path) as conn:
            c = conn.cursor()
            c.execute(
                "REPLACE INTO settings (key, value) VALUES ('webhook_url', ?)",
                (webhook_url,),
            )
            c.execute(
                "REPLACE INTO settings (key, value) VALUES ('alert_message', ?)",
                (alert_message,),
            )

    def log_alert(self, message: str):
        logging.info(message)
