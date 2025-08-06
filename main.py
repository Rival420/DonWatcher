import os
from pathlib import Path
from uuid import uuid4

import aiofiles
import uvicorn
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List

from models import (
    Report,
    ReportSummary,
    AcceptedRisk,
    AlertLog,
)
from storage import ReportStorage, get_storage
from parser import PingCastleParser
from alerter import Alerter
from routers import settings as settings_router

app = FastAPI()
parser = PingCastleParser()

# Directory to store uploaded reports
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploaded_reports"
UPLOAD_DIR.mkdir(exist_ok=True)

# Max upload size (bytes)
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 10 * 1024 * 1024))  # 10 MB

# Include routers
app.include_router(settings_router.router)


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

        # 5) Alert on unaccepted findings
        unaccepted = storage.get_unaccepted_findings(report.findings)
        settings = storage.get_settings()
        alerter = Alerter(storage)
        alerter.send_alert(settings, report, unaccepted)

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


@app.delete("/api/accepted_risks")
def delete_accepted_risk(risk: AcceptedRisk, storage: ReportStorage = Depends(get_storage)):
    storage.remove_accepted_risk(risk.category, risk.name)
    return {"status": "ok"}


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


@app.get("/api/logs/webserver")
def download_webserver_logs():
    """Download webserver logs (currently returns empty file as no webserver logs are generated)"""
    from io import StringIO
    import datetime
    
    # Create a placeholder log file since no actual webserver logs are generated
    log_content = StringIO()
    log_content.write(f"# DonWatcher Webserver Logs\n")
    log_content.write(f"# Generated: {datetime.datetime.now().isoformat()}\n")
    log_content.write(f"# Note: This application doesn't generate webserver logs\n")
    log_content.write(f"# All logging is done through the database\n\n")
    
    from fastapi.responses import Response
    return Response(
        content=log_content.getvalue(),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=webserver.log"}
    )


@app.get("/api/logs/backend")
def download_backend_logs():
    """Download backend logs (currently returns empty file as no backend logs are generated)"""
    from io import StringIO
    import datetime
    
    # Create a placeholder log file since no actual backend logs are generated
    log_content = StringIO()
    log_content.write(f"# DonWatcher Backend Logs\n")
    log_content.write(f"# Generated: {datetime.datetime.now().isoformat()}\n")
    log_content.write(f"# Note: This application doesn't generate backend logs\n")
    log_content.write(f"# All logging is done through the database\n\n")
    
    from fastapi.responses import Response
    return Response(
        content=log_content.getvalue(),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=backend.log"}
    )


@app.get("/api/logs/webhook")
def download_webhook_logs(storage: ReportStorage = Depends(get_storage)):
    """Download webhook alert logs from the database"""
    from io import StringIO
    import datetime
    
    # Get alert logs from database
    alert_logs = storage.get_alert_log()
    
    log_content = StringIO()
    log_content.write(f"# DonWatcher Webhook Alert Logs\n")
    log_content.write(f"# Generated: {datetime.datetime.now().isoformat()}\n")
    log_content.write(f"# Total entries: {len(alert_logs)}\n\n")
    
    for log_entry in alert_logs:
        log_content.write(f"[{log_entry.timestamp}] {log_entry.message}\n")
    
    from fastapi.responses import Response
    return Response(
        content=log_content.getvalue(),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=webhook.log"}
    )


# Mount all other paths to your frontend
app.mount("/", StaticFiles(directory=BASE_DIR / "frontend", html=True), name="frontend")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
