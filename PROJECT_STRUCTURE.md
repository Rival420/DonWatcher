# DonWatcher Project Structure

This document outlines the organized structure of the DonWatcher project after the React frontend overhaul.

## 📁 Directory Overview

```
DonWatcher/
├── 📄 README.md                          # Main project documentation
├── 📄 PROJECT_STRUCTURE.md               # This file - project organization
├── 📄 LICENSE                            # Project license
├── 📄 requirements.txt                   # Python dependencies (backend)
├── 📄 docker-compose.yml                 # Multi-container orchestration
│
├── 📁 frontend/                          # React Frontend Application
│   ├── 📄 Dockerfile                     # Frontend container configuration
│   ├── 📄 package.json                   # Node.js dependencies
│   ├── 📄 vite.config.ts                 # Vite build configuration
│   ├── 📄 tailwind.config.js             # Tailwind CSS theme configuration
│   ├── 📄 tsconfig.json                  # TypeScript configuration
│   ├── 📄 index.html                     # HTML entry point
│   └── 📁 src/                           # React source code
│       ├── 📄 main.tsx                   # React entry point
│       ├── 📄 App.tsx                    # Root component with routing
│       ├── 📁 components/                # Reusable UI components
│       │   ├── 📄 Layout.tsx             # Main layout wrapper
│       │   ├── 📄 Sidebar.tsx            # Navigation sidebar
│       │   ├── 📄 Header.tsx             # Page header
│       │   ├── 📄 RiskGauge.tsx          # Risk score gauge
│       │   └── 📄 StatsCard.tsx          # Statistics card
│       ├── 📁 pages/                     # Page components
│       │   ├── 📄 Dashboard.tsx          # Main dashboard
│       │   ├── 📄 Reports.tsx            # Reports listing
│       │   ├── 📄 DomainGroups.tsx       # Group management
│       │   ├── 📄 Upload.tsx             # File upload
│       │   └── 📄 Settings.tsx           # System settings
│       ├── 📁 services/                  # API integration
│       │   └── 📄 api.ts                 # Backend API client
│       ├── 📁 hooks/                     # Custom React hooks
│       │   └── 📄 useApi.ts              # React Query hooks
│       ├── 📁 types/                     # TypeScript definitions
│       │   └── 📄 index.ts               # Type definitions
│       └── 📁 styles/                    # Global styles
│           └── 📄 index.css              # Tailwind imports
│
├── 📁 backend/                           # Backend Configuration
│   └── 📄 Dockerfile                     # Backend container configuration
│
├── 📁 server/                            # FastAPI Backend Application
│   ├── 📄 README.md                      # Server documentation  
│   ├── 📄 main.py                        # FastAPI application entry point
│   ├── 📄 models.py                      # Pydantic data models
│   ├── 📄 database.py                    # Database connection and setup
│   ├── 📄 storage.py                     # Storage interface
│   ├── 📄 storage_postgres.py            # PostgreSQL storage implementation
│   ├── 📄 parser.py                      # Legacy parser (PingCastle)
│   ├── 📄 alerter.py                     # Alert system
│   ├── 📄 risk_service.py                # Risk calculation service
│   ├── 📄 risk_calculator.py             # Risk scoring algorithms
│   ├── 📄 cache_service.py               # Caching layer
│   ├── 📄 health_check.py                # Health check utilities
│   ├── 📄 migration_runner.py            # Database migration runner
│   │
│   ├── 📁 parsers/                       # Security tool parsers
│   │   ├── 📄 __init__.py
│   │   ├── 📄 base_parser.py             # Base parser interface
│   │   ├── 📄 domain_analysis_parser.py  # Domain analysis parser
│   │   └── 📄 locksmith_parser.py        # Locksmith parser
│   │
│   └── 📁 routers/                       # API route modules
│       └── 📄 settings.py                # Settings API routes
│
├── 📁 client/                            # Client-side Components
│   ├── 📄 README.md                      # Client documentation
│   ├── 📄 DonWatcher-Config.json         # Scanner configuration
│   ├── 📄 DonWatcher-DomainScanner.ps1   # PowerShell domain scanner
│   └── 📁 agents/                        # Legacy agent components
│       ├── 📄 __init__.py
│       ├── 📄 base_agent.py
│       └── 📄 domain_scanner_agent.py
│
├── 📁 migrations/                        # Database Schema Migrations
│   ├── 📄 README.md                      # Migration documentation
│   ├── 📄 init_db.sql                    # Initial database schema
│   ├── 📄 migration_001_rename_global_score.sql
│   ├── 📄 migration_002_add_group_member_tables.sql
│   ├── 📄 migration_003_add_member_status.sql
│   ├── 📄 migration_004_add_risk_integration.sql
│   └── 📄 migration_005_add_risk_dashboard_summary.sql
│
├── 📁 tests/                             # Unit Tests and Test Data
│   ├── 📄 README.md                      # Testing documentation
│   ├── 📄 test_domain_group_parser.py    # Parser unit tests
│   ├── 📄 test_risk_integration.py       # Risk integration tests
│   ├── 📄 test_storage_bug_fixes.py      # Storage layer tests
│   └── 📄 test_domain_group_members.json # Sample test data
│
└── 📁 docs/                              # Project Documentation
    ├── 📄 Technical_Overview.md          # Technical overview
    ├── 📄 LESSONS_LEARNED.md             # Development lessons
    ├── 📄 PROJECT_COMPLETION_SUMMARY.md  # Project completion summary
    ├── 📄 USER_GUIDE_DOMAIN_GROUPS.md    # User guide
    │
    ├── 📁 api/                           # API Documentation
    │   ├── 📄 README.md                  # API overview
    │   ├── 📄 domain-groups.md           # Domain Groups API reference
    │   └── 📄 risk-integration.md        # Risk Integration API reference
    │
    └── 📁 implementation/                # Implementation Documentation
        └── 📄 *.md                        # Phase implementation summaries
```

## 🐳 Docker Architecture

The application runs as three separate containers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│  🌐 Frontend    │  🐍 Backend     │  🐘 PostgreSQL          │
│  React + Vite   │  FastAPI        │  Database               │
│  Port: 3000     │  Port: 8080     │  Port: 5432             │
│                 │                 │                         │
│  Hot-Reload ✓   │  Hot-Reload ✓   │  Persistent Data ✓      │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## 🎯 Key Directories Explained

### `/frontend/` - React Frontend
Modern React application with dark cyber theme:
- **Vite**: Fast build tool with hot module replacement
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with custom dark theme
- **React Query**: Server state management
- **Recharts**: Beautiful data visualizations
- **Framer Motion**: Smooth animations

### `/backend/` - Backend Docker Configuration
Contains the Dockerfile for the Python backend container.

### `/server/` - FastAPI Backend
Core API application:
- **main.py**: Application entry point with CORS configuration
- **parsers/**: Multi-format security report parsers
- **risk_service.py**: Risk calculation and scoring
- **storage_postgres.py**: Database operations

### `/client/` - PowerShell Scanner
Client-side data collection tools:
- **DonWatcher-DomainScanner.ps1**: Domain group member scanner
- **DonWatcher-Config.json**: Scanner configuration

### `/migrations/` - Database Schema
Sequential SQL migrations for PostgreSQL:
- Idempotent migrations (safe to re-run)
- Auto-applied on container startup

## 🚀 Development Workflow

### Starting Development Environment
```bash
# Start all containers with hot-reload
docker compose up --build -d

# View logs
docker compose logs -f

# Stop containers
docker compose down
```

### Accessing Services
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api
- **API Health**: http://localhost:8080/api/health
- **Database**: localhost:5432

### Development Commands
```bash
# Rebuild specific container
docker compose up --build frontend

# View frontend logs
docker compose logs -f frontend

# View backend logs
docker compose logs -f backend

# Reset database (deletes all data)
docker compose down -v
docker compose up --build -d
```

## 🎨 Frontend Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| Tailwind CSS | Styling |
| React Query | Server state |
| React Router | Navigation |
| Recharts | Charts |
| Framer Motion | Animations |
| Lucide React | Icons |

## 🔧 Configuration Files

### Docker Configuration
- `docker-compose.yml` - Multi-container orchestration
- `backend/Dockerfile` - Python backend container
- `frontend/Dockerfile` - Node.js frontend container

### Frontend Configuration
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/tailwind.config.js` - Tailwind theme configuration
- `frontend/tsconfig.json` - TypeScript configuration

### Backend Configuration
- `requirements.txt` - Python package dependencies
- Environment variable `DATABASE_URL` for database connection
- Environment variable `CORS_ORIGINS` for allowed origins

## 🎯 Clean Architecture Benefits

### Separation of Concerns
- **Frontend**: Independent React application
- **Backend**: Pure API server (no HTML serving)
- **Database**: Isolated PostgreSQL instance
- **Client**: Data collection scripts

### Developer Experience
- Hot-reload for both frontend and backend
- No local dependencies required (everything in Docker)
- Clear separation between concerns
- Type-safe development with TypeScript

### Deployment Ready
- Containerized architecture
- Health checks built-in
- Volume mounts for data persistence
- Easy scaling potential

This architecture provides a modern, maintainable foundation for future development! 🚀
