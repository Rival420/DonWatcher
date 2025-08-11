import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
from datetime import datetime
from uuid import uuid4

import aiofiles
import uvicorn
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List

from models import (
    Report,
    ReportSummary,
    AcceptedRisk,
)
from storage import ReportStorage, get_storage
from parser import PingCastleParser
from alerter import Alerter
from routers import settings as settings_router

# --------------------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------------------
LOG_DIR = Path("./logs")
LOG_DIR.mkdir(exist_ok=True)
log_formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
# Use a rotating file handler
log_handler = RotatingFileHandler(
    LOG_DIR / "backend.log", maxBytes=10 * 1024 * 1024, backupCount=5  # 10 MB
)
log_handler.setFormatter(log_formatter)
# Get the root logger
root_logger = logging.getLogger()
root_logger.addHandler(log_handler)
root_logger.setLevel(logging.INFO)
# --------------------------------------------------------------------------------------

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


@app.middleware("http")
async def log_request(request: Request, call_next):
    """Log all incoming requests to the backend log."""
    logging.info(f"Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        return response
    except HTTPException as e:
        logging.error(f"HTTP Exception: {e.status_code} {e.detail}")
        raise
    except Exception:
        logging.exception("An unhandled exception occurred")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.post("/upload")
async def upload_pingcastle_report(
    file: UploadFile = File(...),
    storage: ReportStorage = Depends(get_storage)
):
    # 1) Validate filename
    filename = Path(file.filename or "").name
    if not filename.lower().endswith((".xml", ".html", ".htm")):
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
        ext = saved_path.suffix.lower()
        if ext == '.xml':
            report: Report = parser.parse_report(saved_path)
            report.original_file = str(saved_path)
        elif ext in ('.html', '.htm'):
            # Minimal record for HTML uploads so it appears in listings and can be opened
            now = datetime.utcnow()
            report = Report(
                id=str(uuid4()),
                domain=Path(filename).stem,
                report_date=now,
                upload_date=now,
                global_score=0,
                high_score=0,
                medium_score=0,
                low_score=0,
                stale_objects_score=0,
                privileged_accounts_score=0,
                trusts_score=0,
                anomalies_score=0,
                domain_sid="",
                domain_functional_level="",
                forest_functional_level="",
                maturity_level="",
                dc_count=0,
                user_count=0,
                computer_count=0,
                original_file=str(saved_path),
                findings=[],
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported file extension")
        storage.save_report(report)

        # 5) Alert on unaccepted findings
        unaccepted = storage.get_unaccepted_findings(report.findings)
        settings = storage.get_settings()
        alerter = Alerter(storage)
        alerter.send_alert(settings, report, unaccepted)

    except ValueError as ve:
        # Known parsing error (e.g. bad date)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Unexpected error
        logging.exception("Failed to process uploaded report")
        raise HTTPException(status_code=500, detail=f"Failed to process report: {e}")

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
    
# Serve uploaded reports (e.g., PingCastle HTML) at /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Mount all other paths to your frontend
app.mount("/", StaticFiles(directory=BASE_DIR / "frontend", html=True), name="frontend")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
