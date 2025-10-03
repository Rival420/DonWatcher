# DonWatcher Project Structure

This document outlines the organized structure of the DonWatcher project after Phase 1 implementation.

## 📁 Directory Overview

```
DonWatcher/
├── 📄 README.md                          # Main project documentation
├── 📄 PROJECT_STRUCTURE.md               # This file - project organization
├── 📄 LICENSE                            # Project license
├── 📄 requirements.txt                   # Python dependencies
├── 📄 docker-compose.yml                 # Docker container orchestration
├── 📄 Dockerfile                         # Docker image configuration
│
├── 📁 client/                            # Client-side components
│   ├── 📄 README.md                      # Client documentation
│   ├── 📄 DonWatcher-Config.json         # Scanner configuration
│   ├── 📄 DonWatcher-DomainScanner.ps1   # PowerShell domain scanner
│   └── 📁 agents/                        # Legacy agent components
│       ├── 📄 __init__.py
│       ├── 📄 base_agent.py
│       └── 📄 domain_scanner_agent.py
│
├── 📁 server/                            # Backend server application
│   ├── 📄 README.md                      # Server documentation  
│   ├── 📄 main.py                        # FastAPI application entry point
│   ├── 📄 models.py                      # Pydantic data models
│   ├── 📄 database.py                    # Database connection and setup
│   ├── 📄 storage.py                     # Storage interface
│   ├── 📄 storage_postgres.py            # PostgreSQL storage implementation
│   ├── 📄 parser.py                      # Legacy parser (PingCastle)
│   ├── 📄 alerter.py                     # Alert system
│   │
│   ├── 📁 parsers/                       # Security tool parsers
│   │   ├── 📄 __init__.py
│   │   ├── 📄 base_parser.py             # Base parser interface
│   │   ├── 📄 domain_analysis_parser.py  # Domain analysis parser (enhanced)
│   │   └── 📄 locksmith_parser.py        # Locksmith parser
│   │
│   ├── 📁 routers/                       # API route modules
│   │   └── 📄 settings.py                # Settings API routes
│   │
│   └── 📁 frontend/                      # Web frontend assets
│       ├── 📄 index.html                 # Main dashboard
│       ├── 📄 analyze.html               # Analysis page
│       ├── 📄 reports.html               # Reports page
│       ├── 📄 settings.html              # Settings page
│       ├── 📄 agents.html                # Agents page
│       ├── 📄 debug.html                 # Debug page
│       ├── 📄 nav.html                   # Navigation component
│       ├── 📄 styles.css                 # Application styles
│       ├── 📄 app.js                     # Main application JavaScript
│       ├── 📄 home.js                    # Dashboard JavaScript
│       ├── 📄 analysis.js                # Analysis page JavaScript
│       ├── 📄 settings.js                # Settings page JavaScript
│       ├── 📄 agents.js                  # Agents page JavaScript
│       ├── 📄 nav.js                     # Navigation JavaScript
│       └── 📄 chartManager.js            # Chart management utilities
│
├── 📁 migrations/                        # Database schema migrations
│   ├── 📄 README.md                      # Migration documentation
│   ├── 📄 init_db.sql                    # Initial database schema
│   ├── 📄 migration_001_rename_global_score.sql
│   ├── 📄 migration_002_add_group_member_tables.sql
│   └── 📄 migration_003_add_member_status.sql # Phase 1 enhancements
│
├── 📁 tests/                             # Unit tests and test data
│   ├── 📄 README.md                      # Testing documentation
│   ├── 📄 test_domain_group_parser.py    # Parser unit tests
│   └── 📄 test_domain_group_members.json # Sample test data
│
└── 📁 docs/                              # Project documentation
    ├── 📄 Technical_Overview.md           # Technical overview
    │
    ├── 📁 api/                           # API documentation
    │   ├── 📄 README.md                  # API overview
    │   └── 📄 domain-groups.md           # Domain Groups API reference
    │
    └── 📁 implementation/                # Implementation documentation
        └── 📄 PHASE1_IMPLEMENTATION_SUMMARY.md # Phase 1 summary
```

## 🎯 Key Directories Explained

### `/client/` - Client Components
Contains PowerShell scripts and configuration for client-side data collection:
- **DonWatcher-DomainScanner.ps1**: Main domain scanner script (Phase 1 compatible)
- **DonWatcher-Config.json**: Scanner configuration file
- **agents/**: Legacy Python agent components (deprecated)

### `/server/` - Backend Application  
Core FastAPI application with enhanced Phase 1 functionality:
- **main.py**: Application entry point with new domain group API endpoints
- **parsers/**: Enhanced parser system supporting multiple formats
- **frontend/**: Web interface assets (Phase 2 enhancements planned)

### `/migrations/` - Database Schema
All database migrations in sequential order:
- **init_db.sql**: Base schema for multi-tool security reporting
- **migration_003_add_member_status.sql**: Phase 1 enhancements for member tracking

### `/tests/` - Testing Suite
Comprehensive test coverage for new functionality:
- **test_domain_group_parser.py**: Parser validation and API logic tests
- **test_domain_group_members.json**: Sample data for testing

### `/docs/` - Documentation
Well-organized documentation structure:
- **api/**: Complete API reference with examples
- **implementation/**: Phase implementation summaries and technical details

## 🔄 Phase 1 Integration Points

### Data Flow
```
PowerShell Scanner → JSON Upload → Enhanced Parser → Database → API → Frontend
```

### Key Files Modified/Added for Phase 1:
- ✅ `server/parsers/domain_analysis_parser.py` - Enhanced with dual format support
- ✅ `server/main.py` - Added 5 new domain group management endpoints  
- ✅ `server/models.py` - Added DOMAIN_GROUP_MEMBERS tool type
- ✅ `migrations/migration_003_add_member_status.sql` - Database enhancements
- ✅ `tests/test_domain_group_parser.py` - Comprehensive unit tests
- ✅ `docs/api/domain-groups.md` - Complete API documentation

## 🚀 Development Workflow

### Local Development
```bash
# Start database
docker-compose up -d postgres

# Install dependencies  
pip install -r requirements.txt

# Run migrations
psql -f migrations/init_db.sql
psql -f migrations/migration_003_add_member_status.sql

# Start server
cd server && python main.py

# Run tests
python -m pytest tests/ -v
```

### Adding New Features
1. **Database Changes**: Add migration to `/migrations/`
2. **Backend Logic**: Update parsers, models, or API endpoints in `/server/`
3. **Frontend Updates**: Modify files in `/server/frontend/`
4. **Tests**: Add tests to `/tests/`
5. **Documentation**: Update `/docs/` with changes

## 📋 File Naming Conventions

### Migrations
- `migration_XXX_description.sql` - Sequential numbering with descriptive name

### Tests  
- `test_*.py` - Python unit tests
- `test_*.json` - Test data files

### Documentation
- `README.md` - Directory overview and usage
- `*.md` - Markdown format for all documentation
- API docs use lowercase with hyphens: `domain-groups.md`

## 🔧 Configuration Files

### Root Level
- `requirements.txt` - Python package dependencies
- `docker-compose.yml` - Container orchestration
- `Dockerfile` - Application container definition

### Client Configuration
- `client/DonWatcher-Config.json` - Scanner settings and group lists

### Database Configuration
- Environment variable `DATABASE_URL` for connection string
- Default: `postgresql://donwatcher:donwatcher_pass@localhost:5432/donwatcher`

## 🎯 Clean Architecture Benefits

### Separation of Concerns
- **Client**: Data collection and scanning
- **Server**: API and business logic  
- **Frontend**: User interface
- **Tests**: Quality assurance
- **Docs**: Knowledge management
- **Migrations**: Schema versioning

### Maintainability
- Clear file organization makes code easier to find and modify
- Separate test directory enables comprehensive testing
- Documentation co-located with relevant components
- Migration history provides clear schema evolution

### Scalability
- Modular parser system supports new security tools
- API-first design enables multiple frontend implementations
- Database migrations support schema evolution
- Test structure supports continuous integration

This organized structure provides a solid foundation for Phase 2 development and beyond! 🚀
