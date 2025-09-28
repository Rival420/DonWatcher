# DonWatcher Server Components

This directory contains all server-side components that run in the Docker container.

## Structure

```
server/
├── main.py                 # FastAPI application entry point
├── models.py              # Pydantic data models
├── database.py            # Database connection and initialization
├── storage_postgres.py    # PostgreSQL storage implementation
├── storage.py             # Legacy SQLite storage (deprecated)
├── alerter.py            # Webhook alerting system
├── parser.py             # Legacy PingCastle parser
├── parsers/              # Extensible parser framework
│   ├── __init__.py       # Parser registry
│   ├── base_parser.py    # Base parser interface
│   ├── domain_analysis_parser.py
│   └── locksmith_parser.py
├── routers/              # FastAPI route modules
│   └── settings.py       # Settings and admin endpoints
└── frontend/             # Web interface (HTML/CSS/JS)
    ├── index.html        # Main dashboard
    ├── reports.html      # Reports page
    ├── analyze.html      # Analysis page
    ├── settings.html     # Settings page
    ├── debug.html        # Debug dashboard
    └── *.js, *.css       # Frontend assets
```

## Key Components

### FastAPI Application (main.py)
- Multi-tool security report upload and processing
- REST API for data access and management
- Static file serving for web interface
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

### Parser Framework (parsers/)
- Extensible parser system for multiple security tools
- Automatic tool detection and file routing
- Support for PingCastle, Locksmith, and Domain Analysis
- Easy to add new security tool parsers

### Web Frontend (frontend/)
- Modern responsive web interface
- Multi-tool dashboard with tool badges
- Interactive charts and analysis views
- Real-time system diagnostics

## Running the Server

The server components are designed to run in a Docker container:

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or run directly (requires PostgreSQL)
cd server
uvicorn main:app --host 0.0.0.0 --port 8080
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 8080)
- `MAX_UPLOAD_SIZE`: Maximum file upload size in bytes

## API Endpoints

- `POST /upload` - Upload security reports
- `GET /api/reports` - List all reports
- `GET /api/debug/status` - System health check
- `GET /analysis/scores` - PingCastle score trends
- `GET /analysis/frequency` - Recurring findings analysis
- `/settings` - Settings management interface

See the main documentation for complete API reference.
