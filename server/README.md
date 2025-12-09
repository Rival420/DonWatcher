# DonWatcher Server Components

This directory contains the FastAPI backend server that runs in a Docker container.

## Structure

```
server/
├── main.py                 # FastAPI application entry point
├── models.py               # Pydantic data models
├── database.py             # Database connection and initialization
├── storage_postgres.py     # PostgreSQL storage implementation
├── storage.py              # Legacy SQLite storage (deprecated)
├── alerter.py              # Webhook alerting system
├── parser.py               # Legacy PingCastle parser
├── risk_service.py         # Risk calculation service
├── risk_calculator.py      # Risk scoring algorithms
├── cache_service.py        # Caching layer
├── health_check.py         # Health check utilities
├── migration_runner.py     # Database migration runner
├── parsers/                # Extensible parser framework
│   ├── __init__.py         # Parser registry
│   ├── base_parser.py      # Base parser interface
│   ├── domain_analysis_parser.py
│   └── locksmith_parser.py
└── routers/                # FastAPI route modules
    └── settings.py         # Settings and admin endpoints
```

## Key Components

### FastAPI Application (main.py)
- Multi-tool security report upload and processing
- REST API for data access and management
- CORS configuration for React frontend
- Request logging and error handling

### Data Models (models.py)
- Pydantic models for type safety and validation
- Support for multiple security tool types
- Extensible finding and report structures

### Storage Layer (storage_postgres.py)
- PostgreSQL-based data persistence
- Multi-tool support with tool-type awareness
- Group membership tracking and monitoring
- Settings and accepted risk management

### Risk Service (risk_service.py)
- Global risk score calculation
- PingCastle + Domain Groups integration
- Risk trend tracking and history

### Parser Framework (parsers/)
- Extensible parser system for multiple security tools
- Automatic tool detection and file routing
- Support for PingCastle, Locksmith, and Domain Analysis
- Easy to add new security tool parsers

## Running the Server

The server runs in a Docker container as part of the multi-container setup:

```bash
# Build and run with Docker Compose
docker compose up -d

# View logs
docker compose logs -f backend

# Rebuild after code changes (hot-reload handles most changes)
docker compose up --build backend
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 8080)
- `MAX_UPLOAD_SIZE`: Maximum file upload size in bytes
- `CORS_ORIGINS`: Allowed origins for CORS (comma-separated)

## API Endpoints

### Core APIs
- `POST /upload` - Upload security reports
- `GET /api/reports` - List all reports
- `GET /api/health` - System health check
- `GET /api/debug/status` - Detailed system status

### Domain Groups
- `GET /api/domains` - List monitored domains
- `GET /api/domain_groups/{domain}` - Get groups for a domain
- `GET /api/domain_groups/{domain}/{group}/members` - Get group members
- `POST /api/domain_groups/{domain}/{group}/accept/{member}` - Accept a member
- `DELETE /api/domain_groups/{domain}/{group}/accept/{member}` - Remove acceptance

### Risk Integration
- `GET /api/risk/global` - Get global risk score
- `GET /api/risk/breakdown` - Get risk breakdown by category
- `GET /api/risk/history` - Get risk score history

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update settings

See the `/docs/api/` directory for complete API reference.

## Development

The backend supports hot-reload during development. When running with Docker Compose, code changes in the `server/` directory are automatically detected and the server restarts.

```bash
# Check for linting errors
cd server
python -m py_compile main.py

# Run locally (requires PostgreSQL)
uvicorn server.main:app --host 0.0.0.0 --port 8080 --reload
```

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  React Frontend  │────▶│  FastAPI Backend │────▶│   PostgreSQL     │
│  (Port 3000)     │     │  (Port 8080)     │     │  (Port 5432)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         ▲                        │
         │                        ▼
    Web Browser              File System
                            (uploaded_reports/)
```

The backend serves as a pure API server - all frontend assets are served by the separate React container.
