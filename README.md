# Donwatcher: Active Directory Health Dashboard

Donwatcher is a modern, web-based dashboard for monitoring the health and security of your Active Directory environment. It parses reports from popular open-source tools like Pingcastle and provides a clear, intuitive interface for visualizing trends and identifying risks.

## Key Features

- **Global Risk Score**: A prominent gauge displays the overall risk score from the latest Pingcastle report, giving you an immediate sense of your security posture.
- **Historical Trend Charts**: Four dynamic line charts track the scores for Stale Objects, Privileged Accounts, Trusts, and Anomalies over the last 12 reports, allowing you to easily identify trends.
- **Responsive Design**: The dashboard is fully responsive and works beautifully on any device.
- **Easy Report Upload**: Simply upload your Pingcastle XML reports, and Donwatcher will automatically parse them and update the dashboard.

## Installation

Follow these steps to get Donwatcher up and running on your local machine.

### 1. Clone the Repository

```bash
git clone https://github.com/rival420/Donwatcher.git
cd Donwatcher
```

### 2. Create & Activate a Python Virtual Environment

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (PowerShell):**
```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies

Ensure you have a `requirements.txt` file in the project root. It should include at least: `fastapi`, `uvicorn`, `aiofiles`, `defusedxml`, `pydantic`, and `python-multipart`.

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Run the Application

By default, Donwatcher will start on port 8080 and bind to all interfaces.

```bash
uvicorn main:app --reload --port 8080 --host 0.0.0.0
```

- `--reload` enables hot-reloading on code changes.
- To use a different port, change the `--port` value.

### 5. Open in Your Browser

- **Dashboard**: [http://localhost:8080](http://localhost:8080)
- **Analyze Page**: [http://localhost:8080/analyze](http://localhost:8080/analyze)

## Key Use Cases

- **Continuous Monitoring**: Keep a close eye on your Active Directory's health and security posture over time.
- **Trend Analysis**: Use the historical charts to identify recurring issues and track the effectiveness of your remediation efforts.
- **Security Audits**: Quickly generate a high-level overview of your AD environment for security audits and compliance checks.
- **Team Collaboration**: Share the dashboard with your team to ensure everyone is on the same page regarding AD security.

Enjoy using Donwatcher!
