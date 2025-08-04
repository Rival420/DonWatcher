import json
from urllib import request as urlrequest, error as urlerror
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
            data = message.encode("utf-8")
            req = urlrequest.Request(
                settings.webhook_url,
                data=data,
                headers={
                    "Title": f"DonWatcher – {len(unaccepted)} unaccepted risk(s)",
                    "Tags": "warning"
                },
            )
        else:
            payload = {
                "message": message,
                "report_id": report.id,
                "findings": [
                    {"category": f.category, "name": f.name, "score": f.score}
                    for f in unaccepted
                ],
            }
            data = json.dumps(payload).encode("utf-8")
            req = urlrequest.Request(
                settings.webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
            )
        
        try:
            with urlrequest.urlopen(req, timeout=10) as resp:
                status = resp.getcode()
            self.storage.log_alert(
                f"Alert sent ({status}) for report {report.id}"
            )
        except urlerror.URLError as e:
            self.storage.log_alert(
                f"Alert failed for report {report.id}: {e}"
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
            data = message_filled.encode("utf-8")
            req = urlrequest.Request(
                settings.webhook_url,
                data=data,
                headers={
                    "Title": "DonWatcher – Test Alert",
                    "Tags": "information"
                },
            )
        else:
            payload = {
                "message": message_filled,
                "report_id": "TEST-REPORT-123",
                "findings": [
                    {"category": "Category1", "name": "TestFinding1", "score": 10},
                    {"category": "Category2", "name": "TestFinding2", "score": 20}
                ]
            }
            data = json.dumps(payload).encode("utf-8")
            req = urlrequest.Request(
                settings.webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
            )

        try:
            with urlrequest.urlopen(req, timeout=10) as resp:
                status = resp.getcode()
            self.storage.log_alert(f"Test alert sent ({status})")
            return {"status": "success", "detail": f"Webhook returned status {status}"}
        except urlerror.URLError as e:
            self.storage.log_alert(f"Test alert failed: {e}")
            raise ConnectionError(f"Failed to send test webhook: {e}") from e
