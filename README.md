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
- **Containerized Deployment**: Production-ready Docker setup with PostgreSQL database
- **Responsive Design**: Mobile-friendly interface with enhanced filtering and sorting capabilities
- **Robust Error Handling**: Comprehensive error reporting and user-friendly error states

## Installation

### Quick Start with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/rival420/Donwatcher.git
cd Donwatcher

# Start the full stack (PostgreSQL + DonWatcher)
docker-compose up -d

# View logs
docker-compose logs -f donwatcher

# Access the dashboard
# http://localhost:8080
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
psql -d donwatcher -f init_db.sql
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

### Domain Analysis
- **Format**: JSON reports
- **Features**: Privileged group monitoring, membership tracking
- **Use Case**: AD group management and access control

### Agent-Based Collection
- **Domain Scanner Agent**: PowerShell-based AD group membership collection
- **Extensible Framework**: Easy to add new data collection agents
- **Health Monitoring**: Built-in agent status monitoring and connection testing

## Key Use Cases

- **Multi-Tool Security Monitoring**: Centralized dashboard for all your AD security tools with multi-file upload support
- **Batch Report Processing**: Upload multiple security reports simultaneously for efficient data ingestion
- **Privileged Access Management**: Track and alert on changes to critical AD groups
- **Certificate Authority Security**: Monitor ADCS configurations and detect misconfigurations
- **Risk Trend Analysis**: Historical analysis across all security tools with unified severity mapping
- **Compliance Reporting**: Generate comprehensive security reports across multiple assessment tools
- **Team Collaboration**: Shared risk acceptance and finding management across security teams
- **Automated Monitoring**: Agent-based continuous data collection and alerting
- **System Diagnostics**: Built-in debug tools for troubleshooting and system health monitoring

## Documentation

- **Technical Overview**: [docs/Technical_Overview.md](docs/Technical_Overview.md) - Comprehensive technical documentation
- **API Documentation**: Available at `/docs` when running the application
- **Contributing Guidelines**: See technical overview for coding conventions and extensibility

## Recent Updates (v2.1)

### 🚀 New Features
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

If you encounter issues:

1. **Check the Debug Dashboard**: Visit `/debug` for real-time system status
2. **Review Logs**: Use Docker logs or download backend logs via the settings page
3. **Test Database Connection**: The debug dashboard shows database connectivity status
4. **Verify Upload Formats**: Ensure files are in supported formats (XML, JSON, CSV, HTML)
5. **Check Browser Console**: Frontend error details are logged to browser console

### Common Issues
- **Reports not showing**: Check `/debug` for database connection issues, verify UUID string conversion
- **Upload failures**: Verify file formats and check file size limits
- **Missing findings**: Ensure parsers are registered and database schema is up-to-date
- **Container startup errors**: Check Docker logs for import errors or database connection issues
- **500 Internal Server Error**: Usually indicates UUID conversion or database connection problems
- **Analysis page errors**: Frontend JavaScript errors due to missing data properties - fixed with safe property access
- **Empty recurring findings table**: Normal if no reports uploaded yet, check browser console for JavaScript errors

---

**DonWatcher v2.1** - Now with multi-file upload, enhanced debugging, robust error handling, and improved reliability!
