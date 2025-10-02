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
from typing import List, Optional

from server.models import (
    Report, ReportSummary, AcceptedRisk, MonitoredGroup, Agent, 
    UploadResponse, SecurityToolType
)
from server.storage_postgres import PostgresReportStorage, get_storage
from server.parser import PingCastleParser
from server.alerter import Alerter
from server.routers import settings as settings_router
from server.database import init_database

# Import parsers and agents with error handling
try:
    from server.parsers import parser_registry
    # Note: Agents are now client-side components
    agent_manager = None  # Agents now run on client machines
    if parser_registry:
        logging.info(f"Successfully imported parsers - Registry has {len(parser_registry.get_all_parsers())} parsers")
        logging.info(f"Supported extensions: {list(parser_registry._extension_map.keys())}")
    else:
        logging.error("Parser registry is None after import")
except Exception as e:
    logging.error(f"Failed to import parsers: {e}")
    logging.error(f"Exception type: {type(e)}")
    import traceback
    logging.error(f"Traceback: {traceback.format_exc()}")
    # Continue without advanced features
    parser_registry = None
    agent_manager = None

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

app = FastAPI(
    title="DonWatcher Security Dashboard",
    description="Multi-tool security monitoring dashboard for Active Directory environments",
    version="2.0.0"
)

# Initialize database
try:
    if not init_database():
        logging.error("Failed to initialize database. Please check your PostgreSQL connection.")
        logging.error("Make sure PostgreSQL is running and DATABASE_URL is set correctly.")
        exit(1)
    logging.info("Database initialization successful")
except Exception as e:
    logging.error(f"Database initialization failed with exception: {e}")
    logging.error("Please check PostgreSQL connection and schema.")
    exit(1)

# Register PingCastle parser (others are registered in parsers/__init__.py)
if parser_registry:
    parser_registry.register_parser(PingCastleParser())
    logging.info("Registered PingCastle parser")
else:
    logging.warning("Parser registry not available, using fallback mode")

# Directory to store uploaded reports
BASE_DIR = Path(__file__).parent.parent  # Go up one level from server/ to get to project root
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
        logging.info(f"Response: {request.method} {request.url} - {response.status_code}")
        return response
    except HTTPException as e:
        logging.error(f"HTTP Exception: {e.status_code} {e.detail}")
        raise  # Re-raise the HTTPException without modification
    except Exception as e:
        logging.exception(f"Unhandled exception for {request.method} {request.url}: {e}")
        # Don't raise a new HTTPException here, let FastAPI handle it
        raise


@app.post("/upload", response_model=UploadResponse)
async def upload_security_report(
    file: UploadFile = File(...),
    storage: PostgresReportStorage = Depends(get_storage)
):
    return await _process_single_file(file, storage)

@app.post("/upload/multiple")
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Upload multiple files at once."""
    results = []
    
    for file in files:
        try:
            result = await _process_single_file(file, storage)
            results.append({
                "filename": file.filename,
                "status": "success", 
                "result": result
            })
        except HTTPException as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": e.detail
            })
        except Exception as e:
            logging.exception(f"Failed to process file {file.filename}")
            results.append({
                "filename": file.filename,
                "status": "error", 
                "error": str(e)
            })
    
    return {"results": results}

async def _process_single_file(file: UploadFile, storage: PostgresReportStorage) -> UploadResponse:
    """Process a single uploaded file."""
    # 1) Validate filename
    filename = Path(file.filename or "").name
    if not filename.lower().endswith((".xml", ".html", ".htm", ".json", ".csv")):
        raise HTTPException(status_code=400, detail="Invalid file type. Supported: XML, HTML, JSON, CSV")

    # 2) Read and enforce size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    # 3) Save file
    unique_name = f"{uuid4().hex}_{filename}"
    saved_path = UPLOAD_DIR / unique_name
    async with aiofiles.open(saved_path, "wb") as out_file:
        await out_file.write(contents)

    # 4) Find appropriate parser and process
    try:
        ext = saved_path.suffix.lower()
        
        if ext in ('.html', '.htm'):
            # Handle HTML files (PingCastle reports)
            response = await _handle_html_upload(filename, saved_path, storage)
            return UploadResponse(**response)
        
        # Find parser for the file
        if parser_registry:
            parser = parser_registry.find_parser_for_file(saved_path)
        else:
            # Fallback to PingCastle parser for XML files
            if ext == '.xml':
                parser = PingCastleParser()
            else:
                parser = None
        
        if not parser:
            raise HTTPException(status_code=400, detail=f"No parser available for file type: {ext}")
        
        # Parse the report
        report: Report = parser.parse_report(saved_path)
        report.original_file = str(saved_path)
        
        # Save to database
        report_id = storage.save_report(report)
        
        # Handle group memberships for domain analysis reports
        if report.tool_type == SecurityToolType.DOMAIN_ANALYSIS:
            from server.parsers.domain_analysis_parser import DomainAnalysisParser
            if isinstance(parser, DomainAnalysisParser):
                memberships = parser.extract_group_memberships(report)
                if memberships:
                    storage.save_group_memberships(report_id, memberships)

        # Alert on unaccepted findings
        unaccepted = storage.get_unaccepted_findings(report.findings)
        if unaccepted:
            settings = storage.get_settings()
            from server.alerter import Alerter
            alerter = Alerter(storage)
            alerter.send_alert(settings, report, unaccepted)
        
        return UploadResponse(
            status="success",
            report_id=report_id,
            tool_type=report.tool_type,
            message=f"Successfully processed {parser.tool_type.value} report with {len(report.findings)} findings"
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logging.exception("Failed to process uploaded report")
        raise HTTPException(status_code=500, detail=f"Failed to process report: {e}")

async def _handle_html_upload(filename: str, saved_path: Path, storage: PostgresReportStorage) -> dict:
    """Handle HTML file uploads (typically PingCastle reports)."""
    base_stem = Path(filename).stem
    
    # Try to match with existing XML report by searching more broadly
    reports = storage.get_all_reports_summary()
    matched = None
    
    # Try different matching strategies
    for report in reports:
        if not report.original_file:
            continue
            
        original_path = Path(report.original_file)
        original_stem = original_path.stem
        
        # Remove UUID prefix from stored filename to get original stem
        if '_' in original_stem:
            actual_stem = '_'.join(original_stem.split('_')[1:])
        else:
            actual_stem = original_stem
            
        # Match by stem (without extensions)
        if (original_path.suffix.lower() == '.xml' and 
            (actual_stem == base_stem or 
             actual_stem.endswith(base_stem) or 
             base_stem.endswith(actual_stem))):
            matched = report
            break
    
    if matched:
        storage.update_report_html(matched.id, str(saved_path))
        return {
            "status": "success",
            "attached_to": matched.id,
            "tool_type": SecurityToolType.PINGCASTLE,
            "message": f"HTML report attached to existing report {matched.id}"
        }
    else:
        logging.info(f"No XML match found for HTML '{filename}'. Saved as orphaned file.")
        return {
            "status": "success", 
            "tool_type": SecurityToolType.PINGCASTLE,
            "message": f"HTML file saved but no matching XML report found"
        }


# Debug endpoint
@app.get("/api/debug/status")
def debug_status(storage: PostgresReportStorage = Depends(get_storage)):
    """Debug endpoint to check system status."""
    try:
        # Test database connection
        reports = storage.get_all_reports_summary()
        findings = storage.get_recurring_findings()
        
        return {
            "status": "ok",
            "database_connected": True,
            "reports_count": len(reports),
            "findings_count": len(findings),
            "parsers_registered": len(parser_registry.get_all_parsers()) if parser_registry else 1,  # At least PingCastle
            "database_url_set": bool(os.getenv("DATABASE_URL")),
            "agent_manager_available": agent_manager is not None
        }
    except Exception as e:
        logging.exception("Debug status check failed")
        return {
            "status": "error",
            "error": str(e),
            "database_connected": False
        }

# Report Management Endpoints
@app.get("/api/reports", response_model=List[ReportSummary])
def list_reports(
    tool_type: Optional[SecurityToolType] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all reports, optionally filtered by tool type."""
    try:
        reports = storage.get_all_reports_summary()
        if tool_type:
            reports = [r for r in reports if r.tool_type == tool_type]
        logging.info(f"Returning {len(reports)} reports")
        return reports
    except Exception as e:
        logging.exception("Failed to get reports")
        raise HTTPException(status_code=500, detail=f"Failed to get reports: {e}")

@app.get("/api/reports/{report_id}", response_model=Report)
def get_report(report_id: str, storage: PostgresReportStorage = Depends(get_storage)):
    try:
        return storage.get_report(report_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Report not found")

# Analysis Endpoints
@app.get("/analysis/scores")
def analysis_scores(storage: PostgresReportStorage = Depends(get_storage)):
    """Return historical score breakdown for charting (PingCastle only)."""
    return storage.get_score_history()

@app.get("/analysis/frequency")
def analysis_frequency(
    tool_type: Optional[SecurityToolType] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Return recurring findings aggregated across reports."""
    findings = storage.get_recurring_findings()
    if tool_type:
        findings = [f for f in findings if f.get('toolType') == tool_type.value]
    return findings

# Accepted Risks Management
@app.get("/api/accepted_risks", response_model=List[AcceptedRisk])
def get_accepted_risks(
    tool_type: Optional[SecurityToolType] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get accepted risks, optionally filtered by tool type."""
    risks = storage.get_accepted_risks()
    if tool_type:
        risks = [r for r in risks if r.tool_type == tool_type]
    return risks

@app.post("/api/accepted_risks")
def add_accepted_risks(risk: AcceptedRisk, storage: PostgresReportStorage = Depends(get_storage)):
    storage.add_accepted_risk(risk.tool_type, risk.category, risk.name, risk.reason, risk.accepted_by)
    return {"status": "ok"}

@app.delete("/api/accepted_risks")
def delete_accepted_risk(risk: AcceptedRisk, storage: PostgresReportStorage = Depends(get_storage)):
    storage.remove_accepted_risk(risk.tool_type, risk.category, risk.name)
    return {"status": "ok"}

# Monitored Groups Management
@app.get("/api/monitored_groups", response_model=List[MonitoredGroup])
def get_monitored_groups(storage: PostgresReportStorage = Depends(get_storage)):
    """Get all monitored groups."""
    return storage.get_monitored_groups()

@app.post("/api/monitored_groups")
def add_monitored_group(group: MonitoredGroup, storage: PostgresReportStorage = Depends(get_storage)):
    """Add a new monitored group."""
    group_id = storage.add_monitored_group(group)
    return {"status": "ok", "group_id": group_id}

# Note: Agent Management endpoints removed - agents now run on client machines and submit data via /upload


@app.get("/analyze")
def analyze_page():
    # Serve the standalone analysis page
    return FileResponse(Path(__file__).parent / "frontend" / "analyze.html")


@app.get("/reports")
def reports_page():
    # Serve the reports page
    return FileResponse(Path(__file__).parent / "frontend" / "reports.html")


@app.get("/settings")
def settings_page():
    return FileResponse(Path(__file__).parent / "frontend" / "settings.html")

@app.get("/agents")
def agents_page():
    return FileResponse(Path(__file__).parent / "frontend" / "agents.html")

@app.get("/debug")
def debug_page():
    return FileResponse(Path(__file__).parent / "frontend" / "debug.html")
    
# Serve uploaded reports (e.g., PingCastle HTML) at /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Mount all other paths to your frontend
app.mount("/", StaticFiles(directory=Path(__file__).parent / "frontend", html=True), name="frontend")


# Note: Agent initialization removed - agents now run on client machines

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
