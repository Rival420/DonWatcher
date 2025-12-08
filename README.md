# DonWatcher: Multi-Tool Security Dashboard

DonWatcher is a modern, containerized web-based dashboard for monitoring the health and security of your Active Directory environment. It supports multiple security assessment tools (PingCastle, Locksmith, Domain Analysis) and provides a unified interface for visualizing trends, tracking findings, and managing security risks across your infrastructure.

## Key Features

- **Multi-Tool Support**: Supports PingCastle XML, Locksmith JSON/CSV, and Domain Analysis JSON reports with automatic tool detection
- **Multi-File Upload**: **NEW** - Upload multiple security reports simultaneously with progress tracking and individual status reporting
- **Unified Dashboard**: Single interface for all security tools with tool-specific badges and severity indicators
- **Advanced Risk Management**: Enhanced accepted risk system with expiration dates, reasoning, and tool-aware filtering
- **Group Monitoring**: Track privileged AD group memberships and detect changes over time
- **Agent Framework**: Automated data collection agents for continuous monitoring (Domain Scanner included)
- **Historical Analysis**: Trend charts and recurring findings analysis across all supported tools
- **Enhanced Alerting**: Rich webhook notifications with tool context and detailed finding metadata
- **Debug & Diagnostics**: Built-in debug dashboard for system monitoring and troubleshooting
- **Automated Migrations**: Database migrations run automatically on startup with version tracking
- **Health Checks**: Comprehensive database health monitoring with `/api/health` endpoints
- **Risk Caching**: LRU cache with TTL for risk calculations reduces database load
- **Containerized Deployment**: Production-ready Docker setup with PostgreSQL database
- **Responsive Design**: Mobile-friendly interface with enhanced filtering and sorting capabilities
- **Robust Error Handling**: Comprehensive error reporting and user-friendly error states

## Repository Structure

DonWatcher uses a modern three-container architecture with a React frontend:

```
DonWatcher/
├── 📄 README.md                          # This file
├── 📄 PROJECT_STRUCTURE.md               # Detailed project organization
├── 📄 requirements.txt                   # Python dependencies (backend)
├── 📄 docker-compose.yml                 # Multi-container orchestration
│
├── 📁 frontend/                          # React Frontend Application
│   ├── 📄 Dockerfile                     # Frontend container definition
│   ├── 📄 package.json                   # Node.js dependencies
│   └── 📁 src/                           # React source code
│       ├── 📁 components/                # Reusable UI components
│       ├── 📁 pages/                     # Page components
│       └── 📁 services/                  # API client
│
├── 📁 backend/                           # Backend Docker configuration
│   └── 📄 Dockerfile                     # Backend container definition
│
├── 📁 server/                            # FastAPI Backend Application
│   ├── 📄 main.py                        # FastAPI application entry point
│   ├── 📄 models.py                      # Pydantic data models
│   ├── 📁 parsers/                       # Multi-format security tool parsers
│   └── 📁 routers/                       # API route modules
│
├── 📁 client/                            # Client Components (remote machines)
│   ├── 📄 DonWatcher-DomainScanner.ps1   # PowerShell domain scanner
│   ├── 📄 DonWatcher-Config.json         # Scanner configuration
│   └── 📁 agents/                        # Legacy Python agents
│
├── 📁 migrations/                        # Database Schema Migrations
│   ├── 📄 init_db.sql                    # Initial schema
│   └── 📄 migration_*.sql                # Incremental migrations
│
├── 📁 tests/                             # Unit tests and test data
│
└── 📁 docs/                              # Project documentation
    ├── 📄 Technical_Overview.md          # Technical documentation
    ├── 📁 api/                           # API reference documentation
    └── 📁 implementation/                # Phase implementation details
```

For detailed information about the project structure, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│  🌐 Frontend    │  🐍 Backend     │  🐘 PostgreSQL          │
│  React + Vite   │  FastAPI        │  Database               │
│  Port: 3000     │  Port: 8080     │  Port: 5432             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Frontend (React)
- **React 18** with TypeScript
- **Vite** for fast development with hot-reload
- **Tailwind CSS** with custom dark cyber theme
- **React Query** for server state management
- **Recharts** for beautiful data visualizations

### Backend (FastAPI)
- **FastAPI**: REST API with automatic documentation
- **PostgreSQL**: Robust data persistence
- **Parser Framework**: Extensible system for multiple security tools

### Client Components  
- **PowerShell Script**: Standalone domain scanner for Windows machines
- **Python Agents**: Extensible agent framework for custom integrations

## Installation

### Quick Start with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/rival420/Donwatcher.git
cd Donwatcher

# Start the full stack (Frontend + Backend + PostgreSQL)
docker compose up -d

# Wait for services to start (about 30-60 seconds)
# Check that all services are running
docker compose ps

# View logs to ensure everything started correctly
docker compose logs -f

# Access the dashboard
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
```

#### First Time Setup
1. **Access the Dashboard**: Navigate to [http://localhost:3000](http://localhost:3000)
2. **Upload Your First Report**: Go to "Upload" and drag a security report file (XML, JSON, or CSV)
3. **Configure Alerts**: Visit "Settings" to set up webhook notifications
4. **Review Results**: Check the main dashboard for visualizations and trends

#### Stopping the Application
```bash
# Stop all services
docker compose down

# Stop and remove all data (including database)
docker compose down -v
```

#### Development with Hot-Reload
Both frontend and backend support hot-reload during development. Changes to source files are automatically detected and applied without restarting containers:

```bash
# Start with logs visible
docker compose up

# Or run in background and watch logs
docker compose up -d && docker compose logs -f
```

### Access Points
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8080/api](http://localhost:8080/api)
- **API Documentation**: [http://localhost:8080/docs](http://localhost:8080/docs)
- **Health Check**: [http://localhost:8080/api/health](http://localhost:8080/api/health)

## Supported Security Tools

### PingCastle
- **Format**: XML reports
- **Features**: Domain health scoring, risk categorization, trend analysis
- **Use Case**: Comprehensive AD security assessment

### Locksmith
- **Format**: JSON/CSV reports  
- **Features**: ADCS configuration analysis, certificate template security
- **Use Case**: PKI and certificate authority security

### Domain Analysis (Enhanced in Phase 1-3)
- **Format**: JSON reports (`domain_analysis` and new `domain_group_members`)
- **Features**: Privileged group monitoring, membership tracking, member acceptance workflow, integrated risk assessment
- **Phase 3 Capabilities**: Global risk integration with PingCastle, real-time risk updates, comprehensive risk visualization
- **Phase 2 Capabilities**: Member management modal, bulk operations, mobile-responsive interface
- **Phase 1 Capabilities**: Individual member accept/deny, enhanced member data (type, enabled status), risk scoring based on unaccepted members
- **Use Case**: Comprehensive AD group management with enterprise risk assessment and compliance reporting

### Agent-Based Collection
- **Domain Scanner Agent**: PowerShell-based AD group membership collection
- **Standalone PowerShell Script**: `DonWatcher-DomainScanner.ps1` for Windows domain-joined machines
- **Extensible Framework**: Easy to add new data collection agents
- **Health Monitoring**: Built-in agent status monitoring and connection testing

## Key Use Cases

- **Multi-Tool Security Monitoring**: Centralized dashboard for all your AD security tools with multi-file upload support
- **Batch Report Processing**: Upload multiple security reports simultaneously for efficient data ingestion
- **Privileged Access Management**: Track and alert on changes to critical AD groups
- **Remote Domain Scanning**: Deploy PowerShell scripts on domain controllers for automated data collection
- **Certificate Authority Security**: Monitor ADCS configurations and detect misconfigurations
- **Risk Trend Analysis**: Historical analysis across all security tools with unified severity mapping
- **Compliance Reporting**: Generate comprehensive security reports across multiple assessment tools
- **Team Collaboration**: Shared risk acceptance and finding management across security teams
- **Automated Monitoring**: Agent-based continuous data collection and alerting
- **System Diagnostics**: Built-in debug tools for troubleshooting and system health monitoring

## Remote Domain Scanning

DonWatcher includes a standalone PowerShell script for automated domain scanning from Windows domain-joined machines.

### PowerShell Domain Scanner

The `client/DonWatcher-DomainScanner.ps1` script can be deployed on domain controllers or any domain-joined Windows machine to automatically collect and send domain analysis data to your DonWatcher instance.

#### Features
- **Configurable**: JSON configuration file for easy customization
- **Privileged Group Monitoring**: Scans Domain Admins, Enterprise Admins, and other critical groups
- **Domain Information**: Collects domain/forest functional levels, DC count, user/computer counts
- **Flexible Deployment**: Can run manually, via scheduled tasks, or Group Policy
- **Connection Testing**: Built-in connectivity verification to DonWatcher
- **Comprehensive Logging**: Detailed logging with configurable verbosity

#### Quick Start
```powershell
# Download the client components to a domain-joined Windows machine
# Ensure Active Directory PowerShell module is installed

# Basic usage - will create default config file
.\client\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://your-donwatcher:8080"

# Test connection only  
.\client\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://your-donwatcher:8080" -TestConnection

# Use custom configuration file
.\client\DonWatcher-DomainScanner.ps1 -ConfigFile "custom-config.json" -Verbose
```

#### Configuration
The script uses `client/DonWatcher-Config.json` for configuration:
```json
{
  "DonWatcherUrl": "http://localhost:8080",
  "PrivilegedGroups": [
    "Domain Admins",
    "Enterprise Admins",
    "Schema Admins"
  ],
  "MaxUsers": 5000,
  "MaxComputers": 5000,
  "TimeoutSeconds": 300
}
```

#### Prerequisites
- Windows PowerShell 5.1+ or PowerShell Core 6+
- Active Directory PowerShell module (`RSAT-AD-PowerShell`)
- Domain-joined machine with appropriate permissions
- Network connectivity to DonWatcher instance

#### Scheduled Execution
For automated scanning, create a scheduled task:
```powershell
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\DonWatcher-DomainScanner.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00AM"
$Principal = New-ScheduledTaskPrincipal -UserId "DOMAIN\ServiceAccount" -LogonType Password
Register-ScheduledTask -TaskName "DonWatcher Domain Scan" -Action $Action -Trigger $Trigger -Principal $Principal
```

## Documentation

- **Technical Overview**: [docs/Technical_Overview.md](docs/Technical_Overview.md) - Comprehensive technical documentation
- **API Documentation**: Available at `/docs` when running the application
- **Contributing Guidelines**: See technical overview for coding conventions and extensibility

## Recent Updates (v2.1 + Phase 1)

### 🚀 New Features (Phase 1-3 Complete)

**Phase 3 - Risk Score Integration**:
- **Global Risk Framework**: Complementary integration of PingCastle + domain group risks
- **Enhanced Risk Visualization**: Rich dashboard with component attribution and trending
- **Real-time Risk Updates**: Automatic recalculation on membership changes
- **Cross-Domain Comparison**: Enterprise-wide risk assessment and benchmarking
- **Performance Optimized**: Sub-second risk calculations with intelligent caching

**Phase 2 - Frontend Enhancement**:
- **Member Management Modal**: Comprehensive interface with bulk operations
- **Enhanced Group Tiles**: Rich visual indicators with acceptance status
- **Mobile-First Design**: Full functionality across all devices
- **Advanced Filtering**: Smart search and categorization tools

**Phase 1 - Backend Foundation**:
- **Domain Group Management**: Complete member acceptance workflow with individual accept/deny controls
- **Enhanced Parser**: Dual format support for legacy and new domain scanner JSON formats
- **New API Endpoints**: 11 new REST endpoints for group and risk management
- **Risk Score Enhancement**: Risk calculations based only on unaccepted members
- **Member Detail Tracking**: Enhanced member data including type, enabled status, and SID

### 🚀 Previous Features (v2.1)
- **Multi-File Upload**: Upload multiple security reports simultaneously with progress tracking
- **Debug Dashboard**: Real-time system monitoring and API health checks at `/debug`
- **Enhanced Error Handling**: Comprehensive error reporting and troubleshooting tools
- **Improved HTML Correlation**: Better matching logic for PingCastle HTML reports

### 🛠️ Bug Fixes (Latest)
- **Fixed UUID Conversion**: Resolved PostgreSQL UUID to string conversion issues
- **Fixed Middleware Errors**: Improved exception handling to prevent cascade errors
- **Fixed Import Handling**: Graceful fallback when advanced features aren't available
- **Fixed Docker Compose**: Removed obsolete version attribute causing warnings
- **Fixed HTML Upload Correlation**: Enhanced file matching with multiple strategies
- **Fixed Reports Display**: Proper error handling and data loading in UI tables
- **Fixed Analysis Page Errors**: Enhanced null checking and safe property access in recurring findings table
- **Fixed Frontend Data Safety**: Robust error handling for missing or undefined data properties
- **Fixed Modal Interactions**: Safe DOM element access in risk acceptance modals

### 📱 UI Improvements
- Progress indicators for multi-file uploads
- Enhanced tool badges and severity indicators
- Better error states and user feedback
- Debug page for real-time system diagnostics
- Console log capture for troubleshooting

## Contributing

Please read the [Technical Overview](docs/Technical_Overview.md) for detailed information about:
- Architecture and design patterns
- Coding conventions and standards
- Adding new security tools and parsers
- Extending the agent framework
- Database schema and migrations
- Debug and troubleshooting procedures

## License

This project is licensed under the terms specified in the LICENSE file.

## Troubleshooting

If you encounter issues, follow these steps:

### Quick Diagnostics
1. **Check System Status**: Visit [http://localhost:3000/settings](http://localhost:3000/settings) for system status
2. **Verify Services**: Run `docker compose ps` to ensure all containers are running
3. **Check Logs**: View container logs with `docker compose logs -f`

### Common Issues and Solutions

#### Container Won't Start
```bash
# Check container logs for errors
docker compose logs frontend
docker compose logs backend
docker compose logs postgres

# If port conflict, modify docker-compose.yml:
# frontend ports: "3001:3000"  # Use port 3001 instead
# backend ports: "8081:8080"   # Use port 8081 instead
```

#### Database Connection Issues
```bash
# Restart the database container
docker compose restart postgres

# Check database logs
docker compose logs postgres

# If persistent issues, reset the database
docker compose down -v && docker compose up -d
```

#### Frontend Not Loading
```bash
# Check frontend container logs
docker compose logs frontend

# Rebuild frontend container
docker compose up --build frontend
```

#### Upload Failures
- **File Size**: Default limit is 10MB. Check file size and adjust `MAX_UPLOAD_SIZE` if needed
- **File Format**: Supported formats are XML, JSON, and CSV
- **Browser Errors**: Check browser console (F12) for detailed error messages
- **CORS Issues**: Ensure backend CORS_ORIGINS includes the frontend URL

#### Report Processing Issues
- **No Findings**: Check that your report format matches supported tools (PingCastle, Locksmith, Domain Analysis)
- **Parsing Errors**: Check backend logs for parser errors
- **Missing Data**: Ensure uploaded files contain valid security data

#### Frontend Display Issues
- **Empty Pages**: Hard refresh the browser (Ctrl+F5) to clear cache
- **JavaScript Errors**: Check browser console and ensure API is accessible
- **Missing Charts**: Verify that reports have been successfully uploaded

### Getting Help
1. **Settings Page**: System status is shown on the Settings page
2. **Backend API Health**: Check [http://localhost:8080/api/health](http://localhost:8080/api/health)
3. **Browser Console**: Press F12 and check the Console tab for frontend errors
4. **Docker Logs**: Use `docker compose logs` to view detailed container logs

### Performance Tips
- **Large Files**: For files >5MB, upload individually
- **Frequent Uploads**: Consider using the PowerShell agent for automated data collection
- **Database Size**: Manage data retention in Settings

---

**DonWatcher v3.0** - Now with modern React frontend, Docker-based development, and dark cyber theme!
