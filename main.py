import os
from pathlib import Path
from uuid import uuid4

import aiofiles
import uvicorn
import json
from urllib import error as urlerror, request as urlrequest
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List

from models import (
    Report,
    ReportSummary,
    AcceptedRisk,
    Settings,
    AlertLog,
)
from storage import ReportStorage, get_storage
from parser import PingCastleParser

# Make sure you have python-multipart installed:
# pip install python-multipart

app = FastAPI()
parser = PingCastleParser()

# Directory to store uploaded reports
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploaded_reports"
UPLOAD_DIR.mkdir(exist_ok=True)

# Max upload size (bytes)
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 10 * 1024 * 1024))  # 10 MB

@app.post("/upload")
async def upload_pingcastle_report(
    file: UploadFile = File(...),
    storage: ReportStorage = Depends(get_storage)
):
    # 1) Validate filename
    filename = Path(file.filename or "").name
    if not filename.lower().endswith((".xml", ".html")):
        raise HTTPException(status_code=400, detail="Invalid file type")

    # 2) Read and enforce size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    # 3) Save file
    unique_name = f"{uuid4().hex}_{filename}"
    saved_path = UPLOAD_DIR / unique_name
    async with aiofiles.open(saved_path, "wb") as out_file:
        await out_file.write(contents)

    # 4) Parse and store
    try:
        report: Report = parser.parse_report(saved_path)
        report.original_file = str(saved_path)
        storage.save_report(report)

        # Alert on unaccepted findings
        unaccepted = storage.get_unaccepted_findings(report.findings)
        settings = storage.get_settings()
        if unaccepted and settings.webhook_url:
            payload = {
                "message": settings.alert_message,
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
                storage.log_alert(
                    f"Alert sent ({status}) for report {report.id}"
                )
            except urlerror.URLError as e:
                storage.log_alert(
                    f"Alert failed for report {report.id}: {e}"
                )
    except ValueError as ve:
        # Known parsing error (e.g. bad date)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception:
        # Unexpected error
        raise HTTPException(status_code=500, detail="Failed to process report")

    return JSONResponse({"status": "success", "report_id": report.id})


@app.get("/api/reports", response_model=List[ReportSummary])
def list_reports(storage: ReportStorage = Depends(get_storage)):
    return storage.get_all_reports_summary()


@app.get("/api/reports/{report_id}", response_model=Report)
def get_report(report_id: str, storage: ReportStorage = Depends(get_storage)):
    try:
        return storage.get_report(report_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Report not found")


@app.get("/analysis/scores")
def analysis_scores(storage: ReportStorage = Depends(get_storage)):
    """Return historical score breakdown for charting."""
    return storage.get_score_history()


@app.get("/analysis/frequency")
def analysis_frequency(storage: ReportStorage = Depends(get_storage)):
    """Return recurring findings aggregated across reports."""
    return storage.get_recurring_findings()


@app.get("/api/accepted_risks", response_model=List[AcceptedRisk])
def get_accepted_risks(storage: ReportStorage = Depends(get_storage)):
    return storage.get_accepted_risks()


@app.post("/api/accepted_risks")
def add_accepted_risks(risk: AcceptedRisk, storage: ReportStorage = Depends(get_storage)):
    storage.add_accepted_risk(risk.category, risk.name)
    return {"status": "ok"}


@app.get("/api/settings", response_model=Settings)
def get_settings_api(storage: ReportStorage = Depends(get_storage)):
    return storage.get_settings()


@app.post("/api/settings")
def update_settings_api(settings: Settings, storage: ReportStorage = Depends(get_storage)):
    storage.update_settings(settings.webhook_url, settings.alert_message)
    return {"status": "ok"}


@app.get("/api/alerts/log", response_model=List[AlertLog])
def get_alert_log(storage: ReportStorage = Depends(get_storage)):
    return storage.get_alert_log()


@app.get("/analyze")
def analyze_page():
    # Serve the standalone analysis page
    return FileResponse(BASE_DIR / "frontend" / "analyze.html")


@app.get("/reports")
def reports_page():
    # Serve the reports page
    return FileResponse(BASE_DIR / "frontend" / "reports.html")


@app.get("/settings")
def settings_page():
    return FileResponse(BASE_DIR / "frontend" / "settings.html")


# Mount all other paths to your frontend
app.mount("/", StaticFiles(directory=BASE_DIR / "frontend", html=True), name="frontend")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
