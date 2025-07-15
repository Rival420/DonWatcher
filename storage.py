import sqlite3
from datetime import datetime
from models import Report, Finding, ReportSummary
from typing import List, Dict
from fastapi import Depends

def get_storage():
    return ReportStorage(db_path="./reports.db")

class ReportStorage:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._create_tables()

    def _create_tables(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                domain TEXT,
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
        conn.commit()
        conn.close()

    def save_report(self, report: Report):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            INSERT INTO reports (
                id, domain, report_date, upload_date,
                global_score, high_score, medium_score, low_score,
                stale_objects_score, privileged_accounts_score,
                trusts_score, anomalies_score,
                original_file
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report.id,
            report.domain,
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
            c.execute("""
                INSERT INTO findings
                (id, report_id, category, name, score, description)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (f.id, f.report_id, f.category, f.name, f.score, f.description))
        conn.commit()
        conn.close()

    def get_all_reports(self) -> List[Report]:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT * FROM reports")
        rows = c.fetchall()
        reports: List[Report] = []
        for row in rows:
            # row indices now shifted by 4 new columns:
            # 0:id,1:domain,2:report_date,3:upload_date,
            # 4:global,5:high,6:medium,7:low,
            # 8:stale,9:privileged,10:trusts,11:anomalies,12:original_file
            report_id = row[0]
            c.execute("SELECT * FROM findings WHERE report_id = ?", (report_id,))
            fr = c.fetchall()
            findings = [
                Finding(id=f[0], report_id=f[1], category=f[2],
                        name=f[3], score=f[4], description=f[5])
                for f in fr
            ]
            reports.append(Report(
                id=row[0],
                domain=row[1],
                report_date=datetime.fromisoformat(row[2]),
                upload_date=datetime.fromisoformat(row[3]),
                global_score=row[4],
                high_score=row[5],
                medium_score=row[6],
                low_score=row[7],
                stale_objects_score=row[8],
                privileged_accounts_score=row[9],
                trusts_score=row[10],
                anomalies_score=row[11],
                original_file=row[12],
                findings=findings
            ))
        conn.close()
        return reports

    def get_all_reports_summary(self) -> List[ReportSummary]:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(
            "SELECT id, domain, report_date, upload_date, global_score, high_score, "
            "medium_score, low_score, stale_objects_score, privileged_accounts_score, "
            "trusts_score, anomalies_score FROM reports"
        )
        rows = c.fetchall()
        conn.close()
        return [
            ReportSummary(
                id=row[0],
                domain=row[1],
                report_date=datetime.fromisoformat(row[2]),
                upload_date=datetime.fromisoformat(row[3]),
                global_score=row[4],
                high_score=row[5],
                medium_score=row[6],
                low_score=row[7],
                stale_objects_score=row[8],
                privileged_accounts_score=row[9],
                trusts_score=row[10],
                anomalies_score=row[11],
            )
            for row in rows
        ]

    def get_report(self, report_id: str) -> Report:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            raise ValueError("Report not found")
        c.execute("SELECT * FROM findings WHERE report_id = ?", (report_id,))
        fr = c.fetchall()
        findings = [
            Finding(id=f[0], report_id=f[1], category=f[2], name=f[3], score=f[4], description=f[5])
            for f in fr
        ]
        conn.close()
        return Report(
            id=row[0],
            domain=row[1],
            report_date=datetime.fromisoformat(row[2]),
            upload_date=datetime.fromisoformat(row[3]),
            global_score=row[4],
            high_score=row[5],
            medium_score=row[6],
            low_score=row[7],
            stale_objects_score=row[8],
            privileged_accounts_score=row[9],
            trusts_score=row[10],
            anomalies_score=row[11],
            original_file=row[12],
            findings=findings,
        )

    def get_score_history(self) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
          SELECT report_date, stale_objects_score,
                 privileged_accounts_score, trusts_score, anomalies_score
          FROM reports
          ORDER BY report_date
        """)
        rows = c.fetchall()
        conn.close()
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
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
          SELECT category, name, COUNT(*) as count
          FROM findings
          GROUP BY category, name
          ORDER BY count DESC
        """)
        rows = c.fetchall()
        conn.close()
        return [
          {"category": row[0], "name": row[1], "count": row[2]}
          for row in rows
        ]
