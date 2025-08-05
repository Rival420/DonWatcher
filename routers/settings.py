from fastapi import APIRouter, Depends, HTTPException
from typing import List
from alerter import Alerter
from models import Settings, AlertLog
from storage import ReportStorage, get_storage
from fastapi.responses import PlainTextResponse

router = APIRouter()

@router.get("/api/settings", response_model=Settings)
def get_settings_api(storage: ReportStorage = Depends(get_storage)):
    return storage.get_settings()

@router.post("/api/settings")
def update_settings_api(settings: Settings, storage: ReportStorage = Depends(get_storage)):
    storage.update_settings(settings.webhook_url, settings.alert_message)
    return {"status": "ok"}

@router.post("/api/settings/test")
def test_settings_api(settings: Settings, storage: ReportStorage = Depends(get_storage)):
    alerter = Alerter(storage)
    try:
        result = alerter.send_test_alert(settings)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/alerts/log", response_model=List[AlertLog])
def get_alert_log(storage: ReportStorage = Depends(get_storage)):
    return storage.get_alert_log()

@router.post("/api/database/clear")
def clear_database_api(storage: ReportStorage = Depends(get_storage)):
    # storage.clear_all_data() 
    return PlainTextResponse("Database cleared (not really, this is a placeholder)!")

@router.get("/api/logs/webserver")
def download_webserver_logs_api():
    # Logic to get webserver logs
    return PlainTextResponse("Webserver logs would be here.")

@router.get("/api/logs/backend")
def download_backend_logs_api():
    # Logic to get backend logs
    return PlainTextResponse("Backend logs would be here.")

@router.get("/api/logs/webhook")
def download_webhook_logs_api():
    # Logic to get webhook logs
    return PlainTextResponse("Webhook logs would be here.")
