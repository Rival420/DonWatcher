"""
Upload Router - API endpoints for programmatic report uploads.

This module provides RESTful API endpoints for submitting security reports
programmatically, enabling integration with CI/CD pipelines, scripts, and
external tools.

Endpoints:
- POST /api/upload/report - Upload a single report via JSON
- POST /api/upload/reports - Bulk upload multiple reports
- POST /api/upload/pingcastle - Upload PingCastle data
- POST /api/upload/domain-groups - Upload domain group membership data
"""

import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from server.models import (
    SecurityToolType,
    APIUploadRequest, APIUploadResponse,
    APIBulkUploadRequest, APIBulkUploadResponse,
    APIPingCastleScores, APIDomainMetadata,
    APIFindingInput, APIGroupData, APIGroupMember
)
from server.storage_postgres import PostgresReportStorage, get_storage
from server.upload_service import get_upload_service


router = APIRouter(prefix="/api/upload", tags=["upload"])
logger = logging.getLogger(__name__)


@router.post("/report", response_model=APIUploadResponse)
async def upload_report(
    request: APIUploadRequest,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Upload a single security report via API.
    
    This endpoint accepts JSON payloads for programmatic report submission,
    enabling integration with external tools, scripts, and CI/CD pipelines.
    
    **Supported Tool Types:**
    - `pingcastle`: PingCastle security assessments
    - `locksmith`: ADCS/PKI configuration analysis
    - `domain_analysis`: Domain group membership tracking
    - `domain_group_members`: Domain group member data
    - `custom`: Custom security findings
    
    **Example Requests:**
    
    ```json
    // PingCastle findings
    {
        "domain": "CORP.LOCAL",
        "tool_type": "pingcastle",
        "findings": [
            {"category": "PrivilegedAccounts", "name": "AdminSDHolder", "score": 15}
        ]
    }
    
    // Domain group data
    {
        "domain": "CORP.LOCAL",
        "tool_type": "domain_analysis",
        "groups": [
            {
                "group_name": "Domain Admins",
                "members": [{"name": "admin1", "type": "user"}]
            }
        ]
    }
    ```
    
    **Response:**
    ```json
    {
        "status": "success",
        "report_id": "uuid",
        "tool_type": "pingcastle",
        "domain": "CORP.LOCAL",
        "findings_count": 5,
        "message": "Successfully uploaded pingcastle report with 5 findings"
    }
    ```
    """
    try:
        upload_service = get_upload_service(storage)
        response = await upload_service.process_api_upload(request)
        logger.info(f"API upload successful: {response.report_id} ({response.tool_type.value})")
        return response
    except ValueError as e:
        logger.warning(f"Validation error in API upload: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to process API upload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {str(e)}")


@router.post("/reports", response_model=APIBulkUploadResponse)
async def upload_reports_bulk(
    request: APIBulkUploadRequest,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Bulk upload multiple security reports via API.
    
    Process multiple reports in a single request. Each report is processed
    independently, so failures in one report don't affect others.
    
    **Example Request:**
    ```json
    {
        "reports": [
            {"domain": "CORP.LOCAL", "tool_type": "pingcastle", "findings": [...]},
            {"domain": "DEV.LOCAL", "tool_type": "domain_analysis", "groups": [...]}
        ]
    }
    ```
    
    **Response:**
    ```json
    {
        "status": "success",
        "total_reports": 2,
        "successful": 2,
        "failed": 0,
        "results": [...]
    }
    ```
    """
    upload_service = get_upload_service(storage)
    results = []
    successful = 0
    failed = 0
    
    for report_request in request.reports:
        try:
            response = await upload_service.process_api_upload(report_request)
            results.append({
                "status": "success",
                "domain": report_request.domain,
                "tool_type": report_request.tool_type.value,
                "report_id": response.report_id,
                "findings_count": response.findings_count
            })
            successful += 1
        except Exception as e:
            logger.warning(f"Failed to process bulk upload item for {report_request.domain}: {e}")
            results.append({
                "status": "error",
                "domain": report_request.domain,
                "tool_type": report_request.tool_type.value,
                "error": str(e)
            })
            failed += 1
    
    return APIBulkUploadResponse(
        status="success" if failed == 0 else "partial",
        total_reports=len(request.reports),
        successful=successful,
        failed=failed,
        results=results
    )


@router.post("/pingcastle", response_model=APIUploadResponse)
async def upload_pingcastle_data(
    domain: str,
    findings: List[APIFindingInput],
    pingcastle_scores: Optional[APIPingCastleScores] = None,
    domain_metadata: Optional[APIDomainMetadata] = None,
    report_date: Optional[datetime] = None,
    send_alert: bool = True,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Upload PingCastle security data via API.
    
    Convenience endpoint specifically for PingCastle data uploads.
    Accepts PingCastle-specific scores and findings.
    
    **Query Parameters:**
    - `domain`: Domain name (required)
    - `send_alert`: Whether to send webhook alerts (default: true)
    
    **Request Body:**
    - `findings`: List of security findings
    - `pingcastle_scores`: Category scores (stale_objects, privileged_accounts, trusts, anomalies)
    - `domain_metadata`: Domain information
    
    **Example:**
    ```json
    {
        "findings": [
            {
                "category": "PrivilegedAccounts",
                "name": "P-AdminNotProtected",
                "score": 20,
                "severity": "high",
                "description": "Admin accounts not protected"
            }
        ],
        "pingcastle_scores": {
            "global_score": 45,
            "stale_objects_score": 10,
            "privileged_accounts_score": 20,
            "trusts_score": 5,
            "anomalies_score": 10
        }
    }
    ```
    """
    request = APIUploadRequest(
        domain=domain,
        tool_type=SecurityToolType.PINGCASTLE,
        report_date=report_date,
        findings=findings,
        pingcastle_scores=pingcastle_scores,
        domain_metadata=domain_metadata,
        send_alert=send_alert
    )
    
    try:
        upload_service = get_upload_service(storage)
        response = await upload_service.process_api_upload(request)
        logger.info(f"PingCastle API upload successful: {response.report_id}")
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to process PingCastle API upload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {str(e)}")


@router.post("/domain-groups", response_model=APIUploadResponse)
async def upload_domain_groups(
    domain: str,
    groups: List[APIGroupData],
    domain_metadata: Optional[APIDomainMetadata] = None,
    report_date: Optional[datetime] = None,
    send_alert: bool = True,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Upload domain group membership data via API.
    
    Convenience endpoint for uploading domain group membership data from
    PowerShell scripts, agents, or external tools.
    
    **Query Parameters:**
    - `domain`: Domain name (required)
    - `send_alert`: Whether to send webhook alerts (default: true)
    
    **Request Body:**
    - `groups`: List of groups with their members
    
    **Example:**
    ```json
    {
        "groups": [
            {
                "group_name": "Domain Admins",
                "members": [
                    {"name": "admin1", "samaccountname": "admin1", "type": "user", "enabled": true},
                    {"name": "admin2", "samaccountname": "admin2", "type": "user", "enabled": true}
                ]
            },
            {
                "group_name": "Enterprise Admins",
                "members": [
                    {"name": "enterprise_admin", "type": "user", "enabled": true}
                ]
            }
        ]
    }
    ```
    
    This endpoint:
    - Creates domain analysis findings for each group
    - Saves group membership records
    - Updates risk calculations
    - Triggers alerts if configured
    """
    request = APIUploadRequest(
        domain=domain,
        tool_type=SecurityToolType.DOMAIN_ANALYSIS,
        report_date=report_date,
        groups=groups,
        domain_metadata=domain_metadata,
        send_alert=send_alert
    )
    
    try:
        upload_service = get_upload_service(storage)
        response = await upload_service.process_api_upload(request)
        logger.info(f"Domain groups API upload successful: {response.report_id}")
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to process domain groups API upload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {str(e)}")


@router.post("/findings", response_model=APIUploadResponse)
async def upload_findings(
    domain: str,
    findings: List[APIFindingInput],
    tool_type: SecurityToolType = SecurityToolType.CUSTOM,
    report_date: Optional[datetime] = None,
    send_alert: bool = True,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Upload generic security findings via API.
    
    Flexible endpoint for uploading findings from any source.
    Use this for custom integrations or when uploading from tools
    not directly supported by DonWatcher.
    
    **Query Parameters:**
    - `domain`: Domain name (required)
    - `tool_type`: Security tool type (default: custom)
    - `send_alert`: Whether to send webhook alerts (default: true)
    
    **Request Body:**
    - `findings`: List of security findings
    
    **Example:**
    ```json
    {
        "findings": [
            {
                "category": "Security",
                "name": "custom_finding_001",
                "score": 10,
                "severity": "medium",
                "description": "Custom security finding from external scan",
                "recommendation": "Review and remediate"
            }
        ]
    }
    ```
    """
    request = APIUploadRequest(
        domain=domain,
        tool_type=tool_type,
        report_date=report_date,
        findings=findings,
        send_alert=send_alert
    )
    
    try:
        upload_service = get_upload_service(storage)
        response = await upload_service.process_api_upload(request)
        logger.info(f"Findings API upload successful: {response.report_id}")
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to process findings API upload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {str(e)}")


# Health check endpoint for API upload module
@router.get("/health")
async def upload_health():
    """Health check endpoint for the upload API."""
    return {
        "status": "healthy",
        "module": "upload",
        "endpoints": [
            "POST /api/upload/report",
            "POST /api/upload/reports",
            "POST /api/upload/pingcastle",
            "POST /api/upload/domain-groups",
            "POST /api/upload/findings"
        ]
    }
