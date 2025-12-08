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

DonWatcher is organized with a clean, modular structure for maintainability and scalability:

```
DonWatcher/
├── 📄 README.md                          # This file
├── 📄 PROJECT_STRUCTURE.md               # Detailed project organization
├── 📄 requirements.txt                   # Python dependencies
├── 📄 docker-compose.yml                 # Container orchestration
├── 📄 Dockerfile                         # Server container definition
│
├── 📁 client/                            # Client components (remote machines)
│   ├── 📄 DonWatcher-DomainScanner.ps1   # PowerShell domain scanner
│   ├── 📄 DonWatcher-Config.json         # Scanner configuration
│   └── 📁 agents/                        # Legacy Python agents
│
├── 📁 server/                            # Backend server application
│   ├── 📄 main.py                        # FastAPI application with Phase 1 enhancements
│   ├── 📄 models.py                      # Enhanced data models
│   ├── 📁 parsers/                       # Multi-format security tool parsers
│   ├── 📁 frontend/                      # Web interface assets
│   └── 📁 routers/                       # API route modules
│
├── 📁 migrations/                        # Database schema migrations
│   ├── 📄 README.md                      # Migration documentation
│   ├── 📄 init_db.sql                    # Initial schema
│   └── 📄 migration_003_add_member_status.sql # Phase 1 enhancements
│
├── 📁 tests/                             # Unit tests and test data
│   ├── 📄 README.md                      # Testing documentation
│   ├── 📄 test_domain_group_parser.py    # Comprehensive parser tests
│   └── 📄 test_domain_group_members.json # Sample test data
│
└── 📁 docs/                              # Project documentation
    ├── 📄 Technical_Overview.md           # Technical documentation
    ├── 📁 api/                           # API reference documentation
    └── 📁 implementation/                # Phase implementation details
```

For detailed information about the project structure, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

### Server Components
- **FastAPI Backend**: REST API, file processing, database management
- **Web Frontend**: Modern responsive dashboard with multi-tool support
- **Parser Framework**: Extensible system for multiple security tools
- **PostgreSQL Storage**: Robust data persistence with tool-type awareness

### Client Components  
- **PowerShell Script**: Standalone domain scanner for Windows machines
- **Python Agents**: Extensible agent framework for custom integrations
- **Configuration**: Flexible JSON-based configuration system

## Installation

### Quick Start with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/rival420/Donwatcher.git
cd Donwatcher

# Start the full stack (PostgreSQL + DonWatcher)
docker-compose up -d

# Wait for services to start (about 30-60 seconds)
# Check that both services are running
docker-compose ps

# View logs to ensure everything started correctly
docker-compose logs -f donwatcher

# Access the dashboard
# Open your browser and go to: http://localhost:8080
```

#### First Time Setup
1. **Access the Dashboard**: Navigate to [http://localhost:8080](http://localhost:8080)
2. **Upload Your First Report**: Go to "Reports" and drag a security report file (XML, JSON, CSV, or HTML)
3. **Configure Alerts**: Visit "Settings" > "Alerting" to set up webhook notifications
4. **Review Results**: Check the main dashboard for visualizations and trends

#### Stopping the Application
```bash
# Stop all services
docker-compose down

# Stop and remove all data (including database)
docker-compose down -v
```

### Manual Installation

#### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Node.js (for development)

#### Steps

1. **Clone and Setup**
```bash
git clone https://github.com/rival420/Donwatcher.git
cd Donwatcher
```

2. **Database Setup**
```bash
# Create PostgreSQL database
createdb donwatcher

# Initialize schema
psql -d donwatcher -f migrations/init_db.sql

# Apply Phase 1 enhancements (optional but recommended)
psql -d donwatcher -f migrations/migration_003_add_member_status.sql
```

3. **Python Environment**
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or
.venv\Scripts\Activate.ps1  # Windows

# Install dependencies
pip install -r requirements.txt
```

4. **Configure Environment**
```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/donwatcher"
export PORT=8080
```

5. **Run Application**
```bash
uvicorn main:app --reload --port 8080 --host 0.0.0.0
```

6. **Access Dashboard**
- **Main Dashboard**: [http://localhost:8080](http://localhost:8080)
- **Analysis Page**: [http://localhost:8080/analyze](http://localhost:8080/analyze)
- **Reports**: [http://localhost:8080/reports](http://localhost:8080/reports)
- **Settings**: [http://localhost:8080/settings](http://localhost:8080/settings)
- **Debug Dashboard**: [http://localhost:8080/debug](http://localhost:8080/debug) ⭐ **NEW**

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
1. **Check System Status**: Visit [http://localhost:8080/debug](http://localhost:8080/debug) for real-time system status
2. **Verify Services**: Run `docker-compose ps` to ensure both containers are running
3. **Check Logs**: View container logs with `docker-compose logs -f donwatcher`

### Common Issues and Solutions

#### Container Won't Start
```bash
# Check if port 8080 is already in use
docker-compose logs donwatcher

# If port conflict, modify docker-compose.yml:
# ports: "8081:8080"  # Use port 8081 instead
```

#### Database Connection Issues
```bash
# Restart the database container
docker-compose restart postgres

# Check database logs
docker-compose logs postgres

# If persistent issues, reset the database
docker-compose down -v && docker-compose up -d
```

#### Upload Failures
- **File Size**: Default limit is 10MB. Check file size and adjust `MAX_UPLOAD_SIZE` if needed
- **File Format**: Supported formats are XML, JSON, CSV, and HTML
- **Browser Errors**: Check browser console (F12) for detailed error messages

#### Report Processing Issues
- **No Findings**: Check that your report format matches supported tools (PingCastle, Locksmith, Domain Analysis)
- **Parsing Errors**: View the debug dashboard for parser registration status
- **Missing Data**: Ensure uploaded files contain valid security data

#### Frontend Display Issues
- **Empty Pages**: Hard refresh the browser (Ctrl+F5) to clear cache
- **JavaScript Errors**: Check browser console and ensure all assets are loaded
- **Missing Charts**: Verify that reports have been successfully uploaded and parsed

### Getting Help
1. **Debug Dashboard**: Most issues can be diagnosed at `/debug`
2. **Log Files**: Download backend logs from Settings > General > Download Logs
3. **Browser Console**: Press F12 and check the Console tab for frontend errors
4. **Docker Logs**: Use `docker-compose logs` to view detailed container logs

### Performance Tips
- **Large Files**: For files >5MB, upload individually rather than using multi-file upload
- **Frequent Uploads**: Consider using the agent framework for automated data collection
- **Database Size**: Use "Settings > Data Management > Clear Reports" to remove old data while preserving configuration

---

**DonWatcher v2.1** - Now with multi-file upload, enhanced debugging, robust error handling, and improved reliability!
