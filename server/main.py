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
    UploadResponse, SecurityToolType, AcceptedGroupMember, GroupRiskConfig
)
from server.risk_service import get_risk_service
from server.storage_postgres import PostgresReportStorage, get_storage
from server.parser import PingCastleParser
from server.alerter import Alerter
from server.routers import settings as settings_router
from server.database import init_database, engine
from server.migration_runner import run_migrations_on_startup, get_migration_status
from server.health_check import get_database_health, get_quick_health
from server.cache_service import get_cache_stats, get_risk_cache

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
    
    # Run pending migrations automatically
    logging.info("Checking for pending database migrations...")
    if not run_migrations_on_startup(engine):
        logging.error("Database migration failed. Please check migration files and database state.")
        logging.error("You may need to manually apply migrations from the migrations/ directory.")
        # Don't exit - allow app to start but log warning
        logging.warning("Application starting with potentially outdated schema")
    else:
        logging.info("Database migrations completed successfully")
        
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
                memberships = parser.extract_group_memberships(report, storage)
                if memberships:
                    storage.save_group_memberships(report_id, memberships)
                
                # Trigger risk calculation for domain group changes
                try:
                    risk_service = get_risk_service(storage)
                    await risk_service.calculate_and_store_global_risk(report.domain)
                    logging.info(f"Updated risk scores for domain {report.domain} after group data upload")
                except Exception as e:
                    logging.warning(f"Failed to update risk scores after upload: {e}")
                    # Don't fail the upload if risk calculation fails

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
    """Add an accepted risk with enhanced error handling."""
    try:
        storage.add_accepted_risk(risk.tool_type, risk.category, risk.name, risk.reason, risk.accepted_by)
        logging.info(f"Successfully accepted risk: {risk.tool_type.value}/{risk.category}/{risk.name}")
        return {"status": "ok"}
    except Exception as e:
        logging.exception(f"Failed to accept risk {risk.tool_type.value}/{risk.category}/{risk.name}")
        raise HTTPException(status_code=500, detail=f"Failed to accept risk: {e}")

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

# Accepted Group Members Management
@app.get("/api/accepted_group_members", response_model=List[AcceptedGroupMember])
def get_accepted_group_members(
    domain: Optional[str] = None,
    group_name: Optional[str] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get accepted group members, optionally filtered by domain or group."""
    return storage.get_accepted_group_members(domain, group_name)

@app.post("/api/accepted_group_members")
def add_accepted_group_member(member: AcceptedGroupMember, storage: PostgresReportStorage = Depends(get_storage)):
    """Accept a group member.
    
    DEPRECATED: Use /api/domain_groups/members/accept instead.
    This endpoint is maintained for backward compatibility but will be removed in a future version.
    """
    logging.warning("DEPRECATED: /api/accepted_group_members endpoint used. Please migrate to /api/domain_groups/members/accept")
    member_id = storage.add_accepted_group_member(member)
    return {
        "status": "ok", 
        "member_id": member_id,
        "warning": "This endpoint is deprecated. Use /api/domain_groups/members/accept instead."
    }

@app.delete("/api/accepted_group_members")
def remove_accepted_group_member(member: AcceptedGroupMember, storage: PostgresReportStorage = Depends(get_storage)):
    """Remove acceptance for a group member.
    
    DEPRECATED: Use /api/domain_groups/members/accept instead.
    This endpoint is maintained for backward compatibility but will be removed in a future version.
    """
    logging.warning("DEPRECATED: /api/accepted_group_members endpoint used. Please migrate to /api/domain_groups/members/accept")
    storage.remove_accepted_group_member(member.domain, member.group_name, member.member_name)
    return {
        "status": "ok",
        "warning": "This endpoint is deprecated. Use /api/domain_groups/members/accept instead."
    }

# Group Risk Configuration Management
@app.get("/api/group_risk_configs", response_model=List[GroupRiskConfig])
def get_group_risk_configs(
    domain: Optional[str] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get group risk configurations."""
    return storage.get_group_risk_configs(domain)

@app.post("/api/group_risk_configs")
def add_group_risk_config(config: GroupRiskConfig, storage: PostgresReportStorage = Depends(get_storage)):
    """Add or update a group risk configuration."""
    config_id = storage.save_group_risk_config(config)
    return {"status": "ok", "config_id": config_id}

# Domain Group Management - New endpoints for member acceptance workflow
@app.get("/api/domain_groups/{domain}")
async def get_domain_groups(
    domain: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all groups for a domain with member counts and acceptance status."""
    try:
        # Get latest domain analysis report for this domain
        reports = storage.get_all_reports_summary()
        domain_reports = [r for r in reports if r.domain == domain and r.tool_type == SecurityToolType.DOMAIN_ANALYSIS]
        
        if not domain_reports:
            return []
        
        # Get the latest report
        latest_report = max(domain_reports, key=lambda r: r.report_date)
        report_detail = storage.get_report(latest_report.id)
        
        # Process group findings
        groups = []
        for finding in report_detail.findings:
            if finding.category == "DonScanner" and finding.name.startswith("Group_"):
                group_name = finding.metadata.get('group_name', '')
                total_members = finding.metadata.get('member_count', 0)
                members = finding.metadata.get('members', [])
                
                # Get accepted members count
                accepted_members = storage.get_accepted_group_members(domain, group_name)
                accepted_count = len(accepted_members)
                unaccepted_count = total_members - accepted_count
                
                # Calculate risk score (only for unaccepted members)
                risk_score = 0
                if unaccepted_count > 0:
                    # Get group risk config
                    risk_configs = storage.get_group_risk_configs(domain)
                    group_config = next((c for c in risk_configs if c.group_name == group_name), None)
                    if group_config:
                        risk_score = min(group_config.base_risk_score * (unaccepted_count / max(group_config.max_acceptable_members, 1)), 100)
                    else:
                        risk_score = finding.score
                
                groups.append({
                    'group_name': group_name,
                    'total_members': total_members,
                    'accepted_members': accepted_count,
                    'unaccepted_members': unaccepted_count,
                    'risk_score': int(risk_score),
                    'severity': 'high' if risk_score > 50 else 'medium' if risk_score > 25 else 'low',
                    'last_updated': latest_report.report_date.isoformat()
                })
        
        return groups
        
    except Exception as e:
        logging.exception(f"Failed to get domain groups for {domain}")
        raise HTTPException(status_code=500, detail=f"Failed to get domain groups: {e}")

@app.get("/api/domain_groups/{domain}/{group_name}/members")
async def get_group_members(
    domain: str,
    group_name: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get detailed member list for a specific group with acceptance status."""
    try:
        # Get latest domain analysis report
        reports = storage.get_all_reports_summary()
        domain_reports = [r for r in reports if r.domain == domain and r.tool_type == SecurityToolType.DOMAIN_ANALYSIS]
        
        if not domain_reports:
            raise HTTPException(status_code=404, detail="No domain analysis reports found")
        
        latest_report = max(domain_reports, key=lambda r: r.report_date)
        report_detail = storage.get_report(latest_report.id)
        
        # Find the group finding
        group_finding = None
        for finding in report_detail.findings:
            if (finding.category == "DonScanner" and 
                finding.name.startswith("Group_") and 
                finding.metadata.get('group_name') == group_name):
                group_finding = finding
                break
        
        if not group_finding:
            raise HTTPException(status_code=404, detail=f"Group '{group_name}' not found")
        
        # Get accepted members
        accepted_members = storage.get_accepted_group_members(domain, group_name)
        accepted_names = {m.member_name for m in accepted_members}
        
        # Process members
        members = []
        for member in group_finding.metadata.get('members', []):
            if isinstance(member, dict):
                member_name = member.get('name', '')
                member_data = {
                    'name': member_name,
                    'samaccountname': member.get('samaccountname', ''),
                    'sid': member.get('sid', ''),
                    'type': member.get('type', 'user'),
                    'enabled': member.get('enabled', None),
                    'is_accepted': member_name in accepted_names
                }
            else:
                member_name = str(member)
                member_data = {
                    'name': member_name,
                    'samaccountname': '',
                    'sid': '',
                    'type': 'user',
                    'enabled': None,
                    'is_accepted': member_name in accepted_names
                }
            members.append(member_data)
        
        return {
            'group_name': group_name,
            'domain': domain,
            'total_members': len(members),
            'accepted_members': len(accepted_names),
            'members': members,
            'last_updated': latest_report.report_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Failed to get members for group {group_name} in domain {domain}")
        raise HTTPException(status_code=500, detail=f"Failed to get group members: {e}")

@app.post("/api/domain_groups/members/accept")
async def accept_group_member(
    member: AcceptedGroupMember,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Accept a group member."""
    try:
        member_id = storage.add_accepted_group_member(member)
        
        # Trigger risk score update with enhanced error reporting
        risk_update_success = True
        risk_error_message = None
        try:
            risk_service = get_risk_service(storage)
            await risk_service.update_risk_scores_for_member_change(member.domain, member.group_name)
            logging.info(f"Successfully updated risk scores after accepting {member.member_name}")
        except Exception as e:
            risk_update_success = False
            risk_error_message = str(e)
            logging.warning(f"Failed to update risk scores after member acceptance: {e}")
            # Don't fail the operation if risk calculation fails
        
        response = {
            "status": "ok", 
            "member_id": member_id,
            "risk_calculation_status": "success" if risk_update_success else "failed"
        }
        
        if not risk_update_success:
            response["risk_error"] = risk_error_message
            
        return response
    except Exception as e:
        logging.exception(f"Failed to accept member {member.member_name} in group {member.group_name}")
        raise HTTPException(status_code=500, detail=f"Failed to accept member: {e}")

@app.delete("/api/domain_groups/members/accept")
async def remove_accepted_group_member(
    member: AcceptedGroupMember,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Remove acceptance for a group member."""
    try:
        storage.remove_accepted_group_member(member.domain, member.group_name, member.member_name)
        
        # Trigger risk score update with enhanced error reporting
        risk_update_success = True
        risk_error_message = None
        try:
            risk_service = get_risk_service(storage)
            await risk_service.update_risk_scores_for_member_change(member.domain, member.group_name)
            logging.info(f"Successfully updated risk scores after denying {member.member_name}")
        except Exception as e:
            risk_update_success = False
            risk_error_message = str(e)
            logging.warning(f"Failed to update risk scores after member denial: {e}")
            # Don't fail the operation if risk calculation fails
        
        response = {
            "status": "ok",
            "risk_calculation_status": "success" if risk_update_success else "failed"
        }
        
        if not risk_update_success:
            response["risk_error"] = risk_error_message
            
        return response
    except Exception as e:
        logging.exception(f"Failed to remove acceptance for member {member.member_name} in group {member.group_name}")
        raise HTTPException(status_code=500, detail=f"Failed to remove member acceptance: {e}")

@app.get("/api/domain_groups/unaccepted")
async def get_unaccepted_members(
    domain: Optional[str] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all unaccepted members across all groups, optionally filtered by domain."""
    try:
        # Get latest domain analysis reports
        reports = storage.get_all_reports_summary()
        domain_analysis_reports = [r for r in reports if r.tool_type == SecurityToolType.DOMAIN_ANALYSIS]
        
        if domain:
            domain_analysis_reports = [r for r in domain_analysis_reports if r.domain == domain]
        
        unaccepted_members = []
        
        # Group reports by domain and get latest for each
        domain_reports = {}
        for report in domain_analysis_reports:
            if report.domain not in domain_reports or report.report_date > domain_reports[report.domain].report_date:
                domain_reports[report.domain] = report
        
        # Process each domain's latest report
        for domain_name, report_summary in domain_reports.items():
            report_detail = storage.get_report(report_summary.id)
            accepted_members_cache = {}
            
            for finding in report_detail.findings:
                if finding.category == "DonScanner" and finding.name.startswith("Group_"):
                    group_name = finding.metadata.get('group_name', '')
                    
                    # Get accepted members for this group (with caching)
                    if group_name not in accepted_members_cache:
                        accepted_members_cache[group_name] = {
                            m.member_name for m in storage.get_accepted_group_members(domain_name, group_name)
                        }
                    
                    accepted_names = accepted_members_cache[group_name]
                    
                    # Find unaccepted members
                    for member in finding.metadata.get('members', []):
                        member_name = member.get('name', '') if isinstance(member, dict) else str(member)
                        if member_name and member_name not in accepted_names:
                            unaccepted_members.append({
                                'domain': domain_name,
                                'group_name': group_name,
                                'member_name': member_name,
                                'member_type': member.get('type', 'user') if isinstance(member, dict) else 'user',
                                'enabled': member.get('enabled', None) if isinstance(member, dict) else None,
                                'last_seen': report_summary.report_date.isoformat()
                            })
        
        return {
            'total_unaccepted': len(unaccepted_members),
            'members': unaccepted_members
        }
        
    except Exception as e:
        logging.exception("Failed to get unaccepted members")
        raise HTTPException(status_code=500, detail=f"Failed to get unaccepted members: {e}")

# Risk Integration API - Phase 3 Endpoints
@app.get("/api/risk/global/{domain}")
async def get_global_risk_score(
    domain: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get combined global risk score for domain (PingCastle + Domain Groups)."""
    try:
        risk_service = get_risk_service(storage)
        global_risk = await risk_service.calculate_and_store_global_risk(domain)
        
        return {
            'domain': global_risk.domain,
            'global_score': float(global_risk.global_score),
            'pingcastle_score': float(global_risk.pingcastle_score) if global_risk.pingcastle_score else None,
            'domain_group_score': float(global_risk.domain_group_score),
            'pingcastle_contribution': float(global_risk.pingcastle_contribution) if global_risk.pingcastle_contribution else None,
            'domain_group_contribution': float(global_risk.domain_group_contribution),
            'trend_direction': global_risk.trend_direction,
            'trend_percentage': float(global_risk.trend_percentage),
            'assessment_date': global_risk.assessment_date.isoformat()
        }
        
    except Exception as e:
        logging.exception(f"Failed to get global risk score for {domain}")
        raise HTTPException(status_code=500, detail=f"Failed to get global risk score: {e}")

@app.get("/api/risk/breakdown/{domain}")
async def get_risk_breakdown(
    domain: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get detailed risk category breakdown for domain."""
    try:
        risk_service = get_risk_service(storage)
        breakdown = await risk_service.get_domain_risk_breakdown(domain)
        return breakdown
        
    except Exception as e:
        logging.exception(f"Failed to get risk breakdown for {domain}")
        raise HTTPException(status_code=500, detail=f"Failed to get risk breakdown: {e}")

@app.get("/api/risk/history/{domain}")
async def get_risk_history(
    domain: str,
    days: int = 30,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get historical risk score trends for domain."""
    try:
        risk_service = get_risk_service(storage)
        history = await risk_service.get_risk_history(domain, days)
        return {
            'domain': domain,
            'days': days,
            'history': history
        }
        
    except Exception as e:
        logging.exception(f"Failed to get risk history for {domain}")
        raise HTTPException(status_code=500, detail=f"Failed to get risk history: {e}")

@app.get("/api/risk/comparison")
async def get_domain_risk_comparison(
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Compare risk scores across all domains."""
    try:
        risk_service = get_risk_service(storage)
        comparison = await risk_service.get_risk_comparison_across_domains()
        return {
            'domains': comparison,
            'total_domains': len(comparison),
            'comparison_date': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logging.exception("Failed to get domain risk comparison")
        raise HTTPException(status_code=500, detail=f"Failed to get risk comparison: {e}")

@app.post("/api/risk/recalculate/{domain}")
async def recalculate_domain_risk(
    domain: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Force recalculation of risk scores for domain."""
    try:
        risk_service = get_risk_service(storage)
        
        # Force recalculation
        domain_assessment = await risk_service.calculate_and_store_domain_risk(domain, force_recalculation=True)
        global_risk = await risk_service.calculate_and_store_global_risk(domain)
        
        return {
            'status': 'success',
            'domain': domain,
            'domain_group_score': float(domain_assessment.domain_group_score),
            'global_score': float(global_risk.global_score),
            'recalculation_date': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logging.exception(f"Failed to recalculate risk for {domain}")
        raise HTTPException(status_code=500, detail=f"Failed to recalculate risk: {e}")

# Migration status endpoint
@app.get("/api/debug/migrations")
def debug_migrations():
    """Get database migration status."""
    try:
        status = get_migration_status(engine)
        return {
            "status": "ok",
            **status
        }
    except Exception as e:
        logging.exception("Migration status check failed")
        return {
            "status": "error",
            "error": str(e)
        }

# Database health check endpoints
@app.get("/api/health")
def quick_health_check():
    """Quick health check endpoint for load balancers and monitoring."""
    health = get_quick_health(engine)
    return health

@app.get("/api/health/full")
def full_health_check():
    """Comprehensive database health check with detailed diagnostics."""
    health = get_database_health(engine)
    return health

@app.get("/api/debug/health")
def debug_health_check():
    """Debug endpoint with full health report."""
    try:
        health = get_database_health(engine)
        migration_status = get_migration_status(engine)
        
        return {
            "status": "ok",
            "database_health": health,
            "migrations": migration_status
        }
    except Exception as e:
        logging.exception("Debug health check failed")
        return {
            "status": "error",
            "error": str(e)
        }

# Cache status endpoint
@app.get("/api/debug/cache")
def debug_cache_status():
    """Get risk cache statistics."""
    try:
        stats = get_cache_stats()
        return {
            "status": "ok",
            "cache_stats": stats
        }
    except Exception as e:
        logging.exception("Cache status check failed")
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/api/debug/cache/clear")
def clear_cache():
    """Clear the risk calculation cache."""
    try:
        cache = get_risk_cache()
        cleared = cache.clear()
        return {
            "status": "ok",
            "entries_cleared": cleared
        }
    except Exception as e:
        logging.exception("Cache clear failed")
        return {
            "status": "error",
            "error": str(e)
        }

# Enhanced debug endpoint with risk information
@app.get("/api/debug/risk_status")
def debug_risk_status(storage: PostgresReportStorage = Depends(get_storage)):
    """Debug endpoint for risk calculation system status."""
    try:
        with storage.get_connection() as conn:
            # Check risk tables
            risk_assessments = conn.execute(text("SELECT COUNT(*) FROM domain_risk_assessments")).scalar()
            global_scores = conn.execute(text("SELECT COUNT(*) FROM global_risk_scores")).scalar()
            risk_configs = conn.execute(text("SELECT COUNT(*) FROM risk_configuration")).scalar()
            
            # Get latest calculations
            latest_global = conn.execute(text("""
                SELECT domain, global_score, assessment_date
                FROM global_risk_scores
                ORDER BY assessment_date DESC
                LIMIT 5
            """)).fetchall()
            
            return {
                "status": "ok",
                "risk_system_enabled": True,
                "domain_assessments": risk_assessments,
                "global_risk_scores": global_scores,
                "risk_configurations": risk_configs,
                "latest_calculations": [
                    {
                        "domain": row.domain,
                        "global_score": float(row.global_score),
                        "date": row.assessment_date.isoformat()
                    }
                    for row in latest_global
                ],
                "risk_dashboard_available": True
            }
            
    except Exception as e:
        logging.exception("Risk status check failed")
        return {
            "status": "error",
            "error": str(e),
            "risk_system_enabled": False
        }

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
