import json
import logging
import requests
from server.models import Report, Settings, Finding
from server.storage_postgres import PostgresReportStorage
from typing import List

class Alerter:
    def __init__(self, storage: PostgresReportStorage):
        self.storage = storage

    def send_alert(self, settings: Settings, report: Report, unaccepted: List[Finding]):
        if not unaccepted or not settings.webhook_url:
            return

        findings_str = "\n".join(
            [f"- {f.name} (in {f.category}) [{f.tool_type.value}]" for f in unaccepted]
        )

        message = (settings.alert_message or "New unaccepted findings detected in {domain}!").format(
            report_id=report.id,
            domain=report.domain,
            findings_count=len(unaccepted),
            findings=findings_str,
            tool_type=report.tool_type.value
        )

        if "ntfy" in settings.webhook_url:
            # ntfy expects simple POST with data and optional headers
            response = requests.post(
                settings.webhook_url,
                data=message.encode(encoding='utf-8'),
                headers={
                    "Title": f"DonWatcher - {len(unaccepted)} unaccepted risk(s) [{report.tool_type.value}]",
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
                "tool_type": report.tool_type.value,
                "domain": report.domain,
                "findings": [
                    {
                        "category": f.category, 
                        "name": f.name, 
                        "score": f.score,
                        "severity": f.severity,
                        "tool_type": f.tool_type.value
                    }
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
            domain="test.domain.com",
            tool_type="pingcastle",
            findings_count=2,
            findings="- TestFinding1 (Category1) [pingcastle]\n- TestFinding2 (Category2) [locksmith]"
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
                "tool_type": "test",
                "domain": "test.domain.com",
                "findings": [
                    {"category": "Category1", "name": "TestFinding1", "score": 10, "severity": "medium", "tool_type": "pingcastle"},
                    {"category": "Category2", "name": "TestFinding2", "score": 20, "severity": "high", "tool_type": "locksmith"}
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
