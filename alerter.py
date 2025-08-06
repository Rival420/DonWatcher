import json
import logging
import requests
from models import Report, Settings, Finding
from storage import ReportStorage
from typing import List

class Alerter:
    def __init__(self, storage: ReportStorage):
        self.storage = storage

    def send_alert(self, settings: Settings, report: Report, unaccepted: List[Finding]):
        if not unaccepted or not settings.webhook_url:
            return

        findings_str = "\n".join(
            [f"- {f.name} (in {f.category})" for f in unaccepted]
        )

        message = (settings.alert_message or "New unaccepted findings detected!").format(
            report_id=report.id,
            findings_count=len(unaccepted),
            findings=findings_str
        )

        if "ntfy" in settings.webhook_url:
            # ntfy expects simple POST with data and optional headers
            response = requests.post(
                settings.webhook_url,
                data=message.encode(encoding='utf-8'),
                headers={
                    "Title": f"DonWatcher - {len(unaccepted)} unaccepted risk(s)",
                    "Tags": "warning"
                },
                timeout=10
            )
            status = response.status_code
        else:
            # For other webhooks, use JSON payload
            payload = {
                "message": message,
                "report_id": report.id,
                "findings": [
                    {"category": f.category, "name": f.name, "score": f.score}
                    for f in unaccepted
                ],
            }
            response = requests.post(
                settings.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            status = response.status_code
        
        if response.status_code == 200:
            logging.info(
                f"Alert sent ({status}) for report {report.id}"
            )
        else:
            logging.warning(
                f"Alert failed for report {report.id}: HTTP {status}"
            )

    def send_test_alert(self, settings: Settings):
        if not settings.webhook_url:
            raise ValueError("Webhook URL is not set")

        message = settings.alert_message or "This is a test alert from DonWatcher."
        
        message_filled = message.format(
            report_id="TEST-REPORT-123",
            findings_count=2,
            findings="- Finding: TestFinding1 (Category1)\n- Finding: TestFinding2 (Category2)"
        )

        if "ntfy" in settings.webhook_url:
            # ntfy expects simple POST with data and optional headers
            response = requests.post(
                settings.webhook_url,
                data=message_filled.encode(encoding='utf-8'),
                headers={
                    "Title": "DonWatcher - Test Alert",
                    "Tags": "information"
                },
                timeout=10
            )
        else:
            # For other webhooks, use JSON payload
            payload = {
                "message": message_filled,
                "report_id": "TEST-REPORT-123",
                "findings": [
                    {"category": "Category1", "name": "TestFinding1", "score": 10},
                    {"category": "Category2", "name": "TestFinding2", "score": 20}
                ]
            }
            response = requests.post(
                settings.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

        if response.status_code == 200:
            logging.info(f"Test alert sent ({response.status_code})")
            return {"status": "success", "detail": f"Webhook returned status {response.status_code}"}
        else:
            logging.warning(f"Test alert failed: HTTP {response.status_code}")
            raise ConnectionError(f"Failed to send test webhook: HTTP {response.status_code}")
