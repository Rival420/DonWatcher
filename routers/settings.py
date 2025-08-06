from fastapi import APIRouter, Depends, HTTPException
from alerter import Alerter
from models import Settings
from storage import ReportStorage, get_storage
from fastapi.responses import PlainTextResponse, FileResponse
import os

router = APIRouter()
LOG_DIR = "./logs"
os.makedirs(LOG_DIR, exist_ok=True)


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

@router.post("/api/database/clear")
def clear_database_api(storage: ReportStorage = Depends(get_storage)):
    storage.clear_all_data()
    return PlainTextResponse("Database cleared successfully!")

@router.get("/api/logs/webserver")
def download_webserver_logs_api():
    log_path = f"{LOG_DIR}/webserver.log"
    if not os.path.exists(log_path):
        raise HTTPException(status_code=404, detail="Webserver log file not found")
    return FileResponse(log_path, media_type='text/plain', filename='webserver.log')

@router.get("/api/logs/backend")
def download_backend_logs_api():
    log_path = f"{LOG_DIR}/backend.log"
    if not os.path.exists(log_path):
        raise HTTPException(status_code=404, detail="Backend log file not found")
    return FileResponse(log_path, media_type='text/plain', filename='backend.log')
