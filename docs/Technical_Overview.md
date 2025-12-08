### DonWatcher Technical Overview

This document explains how DonWatcher works at a technical level: containerized multi-tool architecture, data models and storage, extensible parsing pipeline, alerting, REST API, agent framework, and frontend behavior. It also codifies our coding conventions to ease onboarding and ensure consistency.

## Architecture at a Glance

### Server Components (Docker Container)
- **Backend**: FastAPI app in `server/main.py`. Responsibilities: multi-format file upload, extensible parsing, PostgreSQL persistence, analysis endpoints, static serving, and settings/log utilities.
- **Parser Framework**: Extensible parser system supporting multiple security tools (PingCastle, Locksmith, Domain Analysis) via `server/parsers/` with automatic tool detection.
- **Storage**: `server/storage_postgres.PostgresReportStorage` persists data in PostgreSQL, supports multiple tool types, group monitoring, and enhanced accepted-risks with expiration.
- **Alerting**: Enhanced `server/alerter.Alerter` posts webhook notifications with tool-type awareness and richer metadata.
- **Routers**: `server/routers/settings.py` exposes settings CRUD, test alert, DB clear, and log-download endpoints.
- **Frontend**: Enhanced static files in `server/frontend/` with multi-tool support, severity indicators, tool badges, and filtering.
- **Containerization**: Docker Compose setup with PostgreSQL database and application container.

### Client Components (Remote Machines)
- **PowerShell Script**: `client/DonWatcher-DomainScanner.ps1` provides standalone domain scanning for Windows machines.
- **Python Agents**: `client/agents/` contains agent framework for custom integrations and automated data collection.
- **Configuration**: `client/DonWatcher-Config.json` template for flexible deployment scenarios.

## Data Model
Location: `models.py` (Pydantic models with enums)
- `SecurityToolType`: Enum (PINGCASTLE, LOCKSMITH, DOMAIN_ANALYSIS, CUSTOM)
- `FindingStatus`: Enum (NEW, ACCEPTED, RESOLVED, FALSE_POSITIVE)
- `Finding`:
  - id: str (UUID)
  - report_id: str (parent report)
  - tool_type: SecurityToolType
  - category: str (varies by tool)
  - name: str (rule/finding identifier)
  - score: int
  - severity: str (high, medium, low)
  - description: str
  - recommendation: str
  - status: FindingStatus
  - metadata: Dict[str, Any] (extensible)
- `Report`: full entity with tool_type, domain metadata, optional PingCastle scores, file references, extensible metadata, and findings list.
- `ReportSummary`: lightweight view with tool_type, summary statistics (total_findings, high/medium/low_severity_findings), and optional PingCastle scores.
- `AcceptedRisk`: enhanced with tool_type, reason, accepted_by, accepted_at, expires_at.
- `MonitoredGroup`: groups to track for membership changes with alert settings.
- `GroupMembership`: members of monitored groups per report.
- `Agent`: configuration for data collection agents.
- `Settings`: enhanced with retention_days, auto_accept_low_severity, and richer alert templates.

## Storage Layer (PostgreSQL)
Location: `storage_postgres.py` and `database.py`
- Database: PostgreSQL with connection pooling and health checks.
- Schema: `init_db.sql` with proper types, enums, indexes, and foreign keys.
- Tables: `reports`, `findings`, `risks`, `accepted_risks`, `monitored_groups`, `group_memberships`, `agents`, `settings`.
- Enhanced features: UUID primary keys, JSONB metadata, proper enums, expiring accepted risks.
- Core methods:
  - `save_report(report: Report)`: upserts report + findings with tool_type awareness.
  - `get_all_reports_summary()`: includes tool_type and severity statistics.
  - `get_recurring_findings()`: enhanced with tool_type and severity data.
  - `add_accepted_risk()`: supports tool_type, reason, accepted_by, expiration.
  - `get_monitored_groups()`, `add_monitored_group()`: group monitoring management.
  - `save_group_memberships()`: track group membership changes over time.
  - Enhanced settings with retention policies and auto-acceptance rules.

## Parsing Framework
Location: `parsers/` (extensible framework)
- **Base Parser**: `parsers/base_parser.py` defines `BaseSecurityParser` interface and `ParserRegistry`.
- **Registry System**: Automatic parser discovery and file-type matching via `parser_registry.find_parser_for_file()`.
- **Supported Tools**:
  - **PingCastle Parser** (`parser.py`): XML reports with domain metadata and risk scoring.
  - **Locksmith Parser** (`parsers/locksmith_parser.py`): JSON/CSV ADCS configuration reports.
  - **Domain Analysis Parser** (`parsers/domain_analysis_parser.py`): JSON domain analysis with group membership tracking.

### PingCastle Parser
- Input: PingCastle XML report
- Extracts domain metadata, parses dates, computes category scores
- Creates findings with severity mapping based on scores

### Locksmith Parser  
- Input: JSON or CSV ADCS reports
- Analyzes certificate templates and authorities
- Detects overprivileged templates, dangerous CA permissions, SAN issues

### Domain Analysis Parser
- Input: JSON domain analysis reports
- Processes privileged group memberships
- Creates findings for group membership anomalies
- Extracts group membership data for monitoring

Notes:
- All parsers implement `can_parse()` for automatic detection
- Severity mapping and metadata extraction per tool
- HTML uploads still supported for PingCastle compatibility

## Enhanced Alerting
Location: `alerter.py` (`Alerter`)
- Triggers on successful report upload after storage (any tool type).
- Filters findings through tool-aware `accepted_risks` with expiration support.
- Enhanced alert templates with placeholders: `{report_id}`, `{domain}`, `{tool_type}`, `{findings_count}`, `{findings}`.
- Delivery:
  - `ntfy` URLs: raw text POST with tool-aware titles and tags.
  - Others: JSON payload with `tool_type`, `domain`, and enhanced findings metadata (severity, tool_type per finding).
- Test alerts include multi-tool examples.
- Respects auto-acceptance rules for low-severity findings.

## Enhanced REST API
Location: `main.py` and `routers/settings.py`
- Upload and Reports
  - `POST /upload` (multipart): accepts `.xml`, `.html|.htm`, `.json`, `.csv`. Auto-detects tool type via parser registry. Enhanced response with tool_type and processing details.
  - `POST /upload/multiple` (multipart): **NEW** - batch upload multiple files simultaneously with individual status tracking
  - `GET /api/reports?tool_type=<type>` -> `List[ReportSummary]` with optional tool filtering
  - `GET /api/reports/{report_id}` -> `Report` with full tool-aware data
- Analysis
  - `GET /analysis/scores`: PingCastle historical scores (backward compatible)
  - `GET /analysis/frequency?tool_type=<type>`: recurring findings with tool_type, severity, and filtering
- Accepted Risks (Enhanced)
  - `GET /api/accepted_risks?tool_type=<type>` -> tool-filtered accepted risks
  - `POST /api/accepted_risks` -> enhanced with tool_type, reason, accepted_by
  - `DELETE /api/accepted_risks` -> tool-aware removal
- Group Monitoring
  - `GET /api/monitored_groups` -> list monitored groups
  - `POST /api/monitored_groups` -> add new monitored group
- Agent Management
  - `GET /api/agents` -> list all agents with status
  - `POST /api/agents/{name}/run` -> manually trigger agent
  - `POST /api/agents/{name}/test` -> test agent connection
- Debug & Diagnostics
  - `GET /api/debug/status` -> **NEW** - system health checks and diagnostics
  - `GET /debug` -> **NEW** - debug dashboard page
- Settings & Utilities
  - Enhanced settings with retention_days, auto_accept_low_severity
  - `POST /api/reports/clear` -> **NEW** - clear only reports and findings, preserve settings/risks
  - `POST /api/database/clear` -> clear entire database (development use)
  - All existing endpoints with enhanced functionality

Static and Pages
- Enhanced multi-tool frontend support with debug capabilities

## Request Logging and Errors
- Middleware logs every request to `./logs/backend.log` via a rotating handler (max 10MB x 5 files).
- Application-level exceptions surface as `HTTPException` with appropriate status; unexpected exceptions become `500` with a generic message and are logged with stacktrace.

## Enhanced Frontend Overview
Location: `frontend/`
- `index.html` + `home.js`: shows latest domain metadata with tool-aware displays, global risk gauge for PingCastle, and historical charts.
- `reports.html` + `app.js`: **ENHANCED** - multi-file upload support, drag-and-drop for multiple files, progress tracking, enhanced error handling, tool badges, findings modal with severity indicators.
- `analyze.html` + `analysis.js`: **ENHANCED** - multi-tool analysis with tool filtering, enhanced recurring findings table with severity badges, tool-aware accepted risk management, comprehensive error handling.
- `settings.html` + `settings.js`: enhanced settings with retention policies and auto-acceptance, improved alert templates.
- `debug.html`: **NEW** - comprehensive debug dashboard with system status monitoring, API health checks, real-time console logs.
- `nav.html` + `nav.js`: **ENHANCED** - added debug page to navigation.
- `styles.css`: **ENHANCED** - tool badges, severity indicators, progress bars, improved modal styles, responsive design.
- `chartManager.js`: unchanged chart management.

### New UI Features
- **Multi-File Upload**: Drag multiple files, progress indicators, batch processing with individual file status
- **Tool Badges**: Color-coded badges for each security tool (PingCastle=blue, Locksmith=orange, Domain Analysis=green)
- **Severity Indicators**: High=red, Medium=orange, Low=green badges throughout the UI
- **Enhanced Filtering**: Tool-type and severity filtering in analysis view
- **Debug Dashboard**: Real-time system monitoring, API testing, console log viewing
- **Progress Tracking**: Animated progress bars for multi-file uploads
- **Error Handling**: Comprehensive error states and user-friendly messaging
- **Improved Tables**: Additional columns for severity, recommendations, tool types
- **Responsive Design**: Mobile-friendly badges and layouts

## Enhanced Upload Flow

### Single File Upload
1) User drags any supported file (XML, JSON, CSV, HTML) to dropzone -> `POST /upload`.
2) Backend validates file type, uses parser registry to find appropriate parser.
3) Parser processes report based on tool type, extracts findings with severity mapping.
4) Report and findings saved to PostgreSQL with tool_type awareness.
5) Group memberships extracted and stored for Domain Analysis reports.
6) Unaccepted findings filtered through tool-aware accepted risks (with expiration).
7) Enhanced alerts sent with tool context and richer metadata.
8) UI reloads with tool badges and enhanced display.
9) HTML reports link to matching XML reports using improved correlation logic.

### Multi-File Upload (**NEW**)
1) User drags multiple files to dropzone -> `POST /upload/multiple`.
2) Backend processes each file individually using the same validation and parsing logic.
3) Each file result is tracked separately with success/failure status.
4) UI displays progress indicator and individual file processing status.
5) Batch results shown with overall success count and detailed error reporting.
6) All successful uploads trigger alerts and UI refresh.

### HTML Correlation Improvements
- **Enhanced Matching**: Multiple strategies for correlating HTML files with XML reports
- **UUID Handling**: Proper extraction of original filenames from stored UUID-prefixed names
- **Fallback Logic**: Exact match -> ends-with -> contains matching strategies
- **Better Reporting**: Clear success/failure messages for correlation attempts

## Enhanced Analysis Flow
- The Analysis page fetches three datasets in parallel: scores time series, recurring findings, and accepted risks. It renders:
  - A line chart for PingCastle scores over time (backward compatible).
  - An enhanced sortable/filterable table with:
    - Tool type filtering and badges
    - Severity indicators and filtering
    - Enhanced accepted risk management with expiration awareness
    - Improved sorting by count, score, severity, tool type
    - Persistent column ordering with localStorage

## Agent Framework
Location: `client/agents/` and `client/`
- **Base Agent** (`client/agents/base_agent.py`): Abstract base class for all data collection agents with error handling, status reporting, and connection testing.
- **Agent Manager**: Central registry for agents with lifecycle management and batch execution.
- **Domain Scanner Agent** (`client/agents/domain_scanner_agent.py`): PowerShell-based AD group membership scanner.
- **Standalone PowerShell Script** (`client/DonWatcher-DomainScanner.ps1`): Deployable script for Windows domain-joined machines.

### Agent Features
- Automatic registration and discovery
- Health monitoring and connection testing  
- Manual and scheduled execution
- Report generation with standard format
- Configuration management via database
- Status reporting and logging

### PowerShell Domain Scanner (`DonWatcher-DomainScanner.ps1`)
A standalone, configurable PowerShell script for Windows domain-joined machines that:
- Collects domain and forest information (functional levels, DC count, user/computer counts)
- Scans privileged group memberships (Domain Admins, Enterprise Admins, etc.)
- Sends data to DonWatcher via REST API in standard domain analysis format
- Supports JSON configuration files for customization
- Includes connection testing and comprehensive logging
- Can be deployed via scheduled tasks or Group Policy
- Requires Active Directory PowerShell module and domain membership

## Group Monitoring System
- **Monitored Groups**: Configure which AD groups to track for membership changes.
- **Membership Tracking**: Historical record of group memberships per report.
- **Change Detection**: Identify additions/removals in privileged groups.
- **Alert Integration**: Notifications for significant membership changes.
- **Default Groups**: Pre-configured high-risk groups (Domain Admins, Enterprise Admins, etc.).

## Coding Conventions
These conventions must be followed for all contributions.

### General
- Prefer explicit, descriptive names. Avoid abbreviations and single-letter variables.
- Variables are nouns; functions are verbs/verb phrases.
- Early returns for guard clauses; avoid deep nesting beyond two levels.
- Handle errors meaningfully; never swallow exceptions.
- Keep formatting consistent with existing files. Do not reformat unrelated code.

### Python (Backend)
- Use Pydantic models for API I/O and internal entities (`models.py`).
- Annotate public function signatures and exported APIs explicitly.
- Use `PostgresReportStorage` for all DB access; do not inline SQL outside `storage_postgres.py`.
- Log across request boundaries using the root logger configured in `main.py`.
- Avoid inline comments; add short docstrings above complex functions.
- Avoid TODOs; implement immediately or create an issue.
- Use proper exception handling with meaningful error messages.
- Implement debug endpoints for system health monitoring.

### FastAPI Endpoints
- Keep endpoint handlers thin: validation, call service/storage, return models.
- Raise `HTTPException` for expected client errors; let middleware convert unexpected ones to `500`.
- Response models should be defined in `models.py` to ensure OpenAPI coherence.

### JavaScript (Frontend)
- Use module files with top-level `DOMContentLoaded` initialization.
- Keep DOM selectors at the top of each logical block and cache where reasonable.
- Extract reusable UI behaviors into small helpers (e.g., column drag-and-drop, chart creation).
- Use explicit names: `renderFindings`, `updateAcceptedRisk`, `enableColumnDragAndDrop`.
- Keep network calls centralized per page module; prefer `async/await` with comprehensive error handling.
- Add debug logging with `console.log()` for troubleshooting data flow.
- Implement user-friendly error states and loading indicators.
- Support both single and multi-file upload scenarios.
- **Always use safe property access**: Use `?.` operator and provide fallbacks for undefined/null values.
- **DOM Element Validation**: Check if elements exist before accessing properties or methods.
- **Data Structure Safety**: Use destructuring with defaults and validate data before processing.

### File/Directory Naming
- Backend modules: snake_case (`report_storage.py` if split), data classes in `models.py`.
- Frontend: kebab-case for HTML, camelCase for JS functions and variables; one module per page when possible.
- Static assets under `frontend/`; backend-only code at repo root or under domain folders (`routers/`, etc.).

### Indentation and Formatting
- Preserve existing indentation style per file. Do not mix tabs/spaces, and do not reflow unrelated code.

## Local Development

### Docker Development (Recommended)
```bash
# Start the full stack
docker-compose up -d

# View logs
docker-compose logs -f donwatcher

# Stop the stack
docker-compose down
```

### Native Development
1. Install PostgreSQL and create database
2. Set `DATABASE_URL` environment variable
3. Create a venv and install from `requirements.txt`
4. Run database initialization: `psql -d donwatcher -f init_db.sql`
5. Start the server: `uvicorn main:app --reload --port 8080 --host 0.0.0.0`
6. Open `http://localhost:8080`

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `PORT`: overrides default 8080
- `MAX_UPLOAD_SIZE`: bytes; defaults to 10 MB

### Database Management
- **Migrations**: Schema updates via `init_db.sql` with proper constraints
- **Backup**: Standard PostgreSQL backup tools
- **Data Management**: 
  - `POST /api/reports/clear` - Clear only reports/findings (production-safe)
  - `POST /api/database/clear` - Full reset for development
- **Settings Preservation**: Reports can be cleared while maintaining configuration

## Operational Notes
- **Containerization**: Production-ready Docker setup with PostgreSQL
- **Logging**: Structured logging with rotation; downloadable via API
- **Database**: PostgreSQL with connection pooling, health checks, and proper indexes
- **Security**: Multi-format upload validation, defusedxml parsing, SQL injection protection via parameterized queries
- **Monitoring**: Agent health checks, database connection monitoring, application metrics
- **Debug Tools**: Built-in debug dashboard (`/debug`) for system diagnostics and troubleshooting
- **Error Handling**: Comprehensive error reporting and user-friendly error states
- **Performance**: Optimized queries with proper indexing and connection pooling
- **Backup**: PostgreSQL backup strategies, persistent volume management

## Debug and Troubleshooting
- **Debug Dashboard**: Available at `/debug` with real-time system status
- **Health Check API**: `/api/health` for quick checks, `/api/health/full` for comprehensive diagnostics
- **Migration Status**: `/api/debug/migrations` shows applied and pending database migrations
- **Cache Statistics**: `/api/debug/cache` shows risk calculation cache hit rates and performance

## Automated Migration System
DonWatcher includes an automated migration runner that:
- Discovers migration files from the `migrations/` directory
- Tracks applied migrations in a `schema_migrations` table
- Automatically applies pending migrations on startup
- Supports rollback and version tracking

### Migration Endpoints
- `GET /api/debug/migrations` - View migration status and history

## Risk Calculation Caching
The risk service includes an LRU cache with TTL support:
- Caches expensive risk calculations for 5 minutes by default
- Automatically invalidates on member acceptance changes
- Reduces database load for frequently accessed risk scores
- Thread-safe with statistics monitoring

### Cache Endpoints
- `GET /api/debug/cache` - View cache statistics and hit rates
- `POST /api/debug/cache/clear` - Clear all cached risk calculations
- **API Health Checks**: `/api/debug/status` endpoint for programmatic monitoring
- **Console Logging**: Frontend captures and displays console logs for troubleshooting
- **Error Reporting**: Enhanced error messages throughout the application
- **System Diagnostics**: Database connection testing, parser registration verification

### Common Issues and Fixes
- **UUID String Conversion**: PostgreSQL returns UUID objects that must be converted to strings for Pydantic models
- **Import Error Handling**: Graceful fallback when advanced parsers/agents are not available
- **Middleware Exception Handling**: Proper exception propagation without cascade errors
- **Docker Compose Version**: Remove obsolete `version` attribute to avoid warnings
- **Database Connection**: Comprehensive connection testing and error reporting during startup
- **Frontend Data Safety**: Null checking and safe property access in JavaScript to handle missing/undefined data
- **Analysis Page Filtering**: Robust filtering logic with fallbacks for missing properties
- **Modal Error Handling**: Safe DOM element access with null checking in risk modals

## Extensibility Guidelines

### Adding New Security Tools
1. Create parser class inheriting from `BaseSecurityParser` in `parsers/`
2. Implement required methods: `tool_type`, `supported_extensions`, `can_parse()`, `parse_report()`
3. Register parser in `parsers/__init__.py`
4. Add tool-specific CSS classes and frontend handling
5. Update database enums if needed

### Adding New Agent Types  
1. Create agent class inheriting from `BaseAgent` in `agents/`
2. Implement `collect_data()` and `test_connection()` methods
3. Register agent in startup or configuration system
4. Add agent-specific UI components if needed

### Deploying PowerShell Domain Scanner
1. Copy `DonWatcher-DomainScanner.ps1` and `DonWatcher-Config.json` to target machines
2. Ensure Active Directory PowerShell module is installed (`Install-WindowsFeature RSAT-AD-PowerShell`)
3. Configure `DonWatcher-Config.json` with appropriate DonWatcher URL and settings
4. Test connectivity: `.\DonWatcher-DomainScanner.ps1 -TestConnection`
5. Set up scheduled task for automated execution
6. Monitor logs and DonWatcher dashboard for successful data collection

### Adding Analysis Features
1. Implement queries in `storage_postgres.py` with proper tool_type filtering
2. Create new API endpoints in `main.py`
3. Add frontend components and integrate with existing UI
4. Consider multi-tool compatibility

### Adding Notification Channels
1. Extend `Alerter` with new delivery methods
2. Add channel-specific configuration to Settings model
3. Update settings UI and test functionality
4. Ensure tool-aware alert formatting

## Glossary
- **Security Tool**: Any supported security assessment tool (PingCastle, Locksmith, etc.)
- **Finding**: A security issue or observation from any security tool
- **Tool Type**: Enum identifying the source tool (pingcastle, locksmith, domain_analysis, custom)
- **Severity**: Risk level classification (high, medium, low) applied consistently across tools
- **Accepted Risk**: A finding marked as acceptable with optional expiration and reasoning
- **Agent**: Automated data collection component for specific security tools or data sources
- **Monitored Group**: AD group tracked for membership changes and security implications
- **Parser Registry**: System for automatic detection and routing of different report formats


