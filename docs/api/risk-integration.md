# Risk Integration API

The Risk Integration API provides comprehensive risk assessment capabilities that combine PingCastle infrastructure security scores with domain group access governance scores into a unified global risk framework.

## Overview

Phase 3 introduces complementary risk scoring that enhances rather than replaces existing PingCastle assessments:

- **Infrastructure Security** (PingCastle): Domain configuration, vulnerabilities, policy compliance
- **Access Governance** (Domain Groups): Privileged group membership management and acceptance status
- **Global Risk Score**: Weighted combination providing comprehensive security posture assessment

## Risk Calculation Framework

### Global Risk Formula
```
Global Score = (PingCastle Score × 70%) + (Domain Group Score × 30%)
```

### Domain Group Risk Categories
- **Access Governance** (30%): Member acceptance management effectiveness
- **Privilege Escalation** (40%): Unaccepted members in critical groups  
- **Compliance Posture** (20%): Overall audit readiness and coverage
- **Operational Risk** (10%): Management efficiency and process gaps

## Endpoints

### Get Global Risk Score

Retrieve combined global risk score for a domain.

**Endpoint:** `GET /api/risk/global/{domain}`

**Parameters:**
- `domain` (path) - Domain name

**Response:**
```json
{
  "domain": "corp.example.com",
  "global_score": 74.5,
  "pingcastle_score": 80.0,
  "domain_group_score": 60.0,
  "pingcastle_contribution": 75.7,
  "domain_group_contribution": 24.3,
  "trend_direction": "improving",
  "trend_percentage": 2.1,
  "assessment_date": "2024-01-15T10:30:00.000Z"
}
```

**Field Descriptions:**
- `global_score`: Combined weighted risk score (0-100)
- `pingcastle_score`: Infrastructure security score (null if no PingCastle data)
- `domain_group_score`: Access governance score (0-100)
- `pingcastle_contribution`: Percentage contribution of PingCastle to global score
- `domain_group_contribution`: Percentage contribution of domain groups to global score
- `trend_direction`: `improving`, `stable`, or `degrading`
- `trend_percentage`: Magnitude of trend change

---

### Get Risk Breakdown

Retrieve detailed risk category breakdown for a domain.

**Endpoint:** `GET /api/risk/breakdown/{domain}`

**Parameters:**
- `domain` (path) - Domain name

**Response:**
```json
{
  "domain": "corp.example.com",
  "assessment_date": "2024-01-15T10:30:00.000Z",
  "global_score": 74.5,
  "pingcastle_score": 80.0,
  "domain_group_score": 60.0,
  "pingcastle_contribution": 75.7,
  "domain_group_contribution": 24.3,
  "trend_direction": "improving",
  "trend_percentage": 2.1,
  "category_scores": {
    "access_governance": 45.0,
    "privilege_escalation": 65.0,
    "compliance_posture": 35.0,
    "operational_risk": 25.0
  },
  "group_risks": [
    {
      "group_name": "Domain Admins",
      "risk_score": 75.0,
      "risk_level": "critical",
      "total_members": 5,
      "accepted_members": 2,
      "unaccepted_members": 3,
      "contributing_factors": {
        "unaccepted_ratio": 60.0,
        "excess_members": 10.0,
        "criticality_multiplier": 2.0,
        "zero_acceptance_penalty": 0.0
      }
    }
  ],
  "summary": {
    "group_count": 8,
    "critical_groups": 3,
    "high_risk_groups": 2,
    "total_members": 45,
    "total_unaccepted": 12
  }
}
```

---

### Get Risk History

Retrieve historical risk score trends for trending analysis.

**Endpoint:** `GET /api/risk/history/{domain}`

**Parameters:**
- `domain` (path) - Domain name
- `days` (query) - Number of days of history (default: 30)

**Response:**
```json
{
  "domain": "corp.example.com",
  "days": 30,
  "history": [
    {
      "date": "2024-01-01T00:00:00.000Z",
      "global_score": 72.0,
      "pingcastle_score": 78.0,
      "domain_group_score": 58.0,
      "trend_direction": "stable"
    },
    {
      "date": "2024-01-08T00:00:00.000Z", 
      "global_score": 69.5,
      "pingcastle_score": 75.0,
      "domain_group_score": 55.0,
      "trend_direction": "improving"
    }
  ]
}
```

---

### Get Domain Risk Comparison

Compare risk scores across all domains in the organization.

**Endpoint:** `GET /api/risk/comparison`

**Response:**
```json
{
  "total_domains": 3,
  "comparison_date": "2024-01-15T10:30:00.000Z",
  "domains": [
    {
      "domain": "corp.example.com",
      "global_score": 74.5,
      "pingcastle_score": 80.0,
      "domain_group_score": 60.0,
      "trend_direction": "improving",
      "risk_level": "medium",
      "total_groups": 8,
      "critical_groups": 3,
      "high_risk_groups": 2,
      "total_members": 45,
      "total_unaccepted": 12,
      "assessment_date": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Recalculate Domain Risk

Force recalculation of risk scores for a domain.

**Endpoint:** `POST /api/risk/recalculate/{domain}`

**Parameters:**
- `domain` (path) - Domain name

**Response:**
```json
{
  "status": "success",
  "domain": "corp.example.com",
  "domain_group_score": 60.0,
  "global_score": 74.5,
  "recalculation_date": "2024-01-15T10:30:00.000Z"
}
```

---

### Risk System Status

Debug endpoint for risk calculation system health.

**Endpoint:** `GET /api/debug/risk_status`

**Response:**
```json
{
  "status": "ok",
  "risk_system_enabled": true,
  "domain_assessments": 15,
  "global_risk_scores": 15,
  "risk_configurations": 3,
  "latest_calculations": [
    {
      "domain": "corp.example.com",
      "global_score": 74.5,
      "date": "2024-01-15T10:30:00.000Z"
    }
  ],
  "risk_dashboard_available": true
}
```

## Risk Calculation Triggers

Risk scores are automatically recalculated when:

1. **Domain Scanner Upload**: New group membership data uploaded
2. **Member Acceptance**: Individual members accepted or denied
3. **Bulk Operations**: Multiple member acceptance changes
4. **Manual Recalculation**: Explicit API call to recalculate endpoint
5. **Scheduled Updates**: Daily risk assessment refresh (future enhancement)

## Performance Characteristics

### Response Times
- **Global Risk Score**: < 500ms
- **Risk Breakdown**: < 1 second
- **Risk History**: < 2 seconds (30 days)
- **Domain Comparison**: < 3 seconds (all domains)
- **Recalculation**: < 5 seconds (force refresh)

### Caching Strategy
- **Client Cache**: 5-minute TTL for risk data
- **Database Cache**: Materialized views for dashboard queries
- **Calculation Cache**: Recent assessments cached for 6 hours
- **History Cache**: Historical data cached for 1 hour

## Error Handling

### Common Errors

**404 - No Risk Data**
```json
{
  "detail": "No domain group data available for risk calculation"
}
```

**500 - Calculation Error**
```json
{
  "detail": "Failed to calculate risk scores: Database connection error"
}
```

### Graceful Degradation
- **Missing PingCastle**: Uses domain group score as global score
- **Missing Domain Groups**: Falls back to PingCastle-only assessment
- **Calculation Failures**: Returns cached results with warning
- **API Timeouts**: Frontend shows last known risk data

## Usage Examples

### JavaScript/Frontend
```javascript
// Get global risk score
const riskData = await window.RiskManager.getGlobalRisk('corp.example.com');
console.log(`Global Risk: ${riskData.global_score}`);

// Get detailed breakdown
const breakdown = await window.RiskManager.getRiskBreakdown('corp.example.com');
console.log('Category Scores:', breakdown.category_scores);

// Force recalculation
const result = await window.RiskManager.recalculateRisk('corp.example.com');
console.log('Recalculation completed:', result.status);
```

### Python/Backend
```python
from server.risk_service import get_risk_service

# Calculate domain risk
risk_service = get_risk_service(storage)
domain_assessment = await risk_service.calculate_and_store_domain_risk('corp.example.com')

# Get global risk
global_risk = await risk_service.calculate_and_store_global_risk('corp.example.com')

# Get risk breakdown
breakdown = await risk_service.get_domain_risk_breakdown('corp.example.com')
```

### PowerShell
```powershell
# Get global risk score
$risk = Invoke-RestMethod -Uri "http://localhost:8080/api/risk/global/corp.example.com"
Write-Host "Global Risk Score: $($risk.global_score)"

# Force recalculation
$result = Invoke-RestMethod -Uri "http://localhost:8080/api/risk/recalculate/corp.example.com" -Method Post
Write-Host "Recalculation Status: $($result.status)"
```

## Security Considerations

### Data Protection
- **Calculation Transparency**: All risk calculations are auditable and explainable
- **Access Control**: Risk APIs use same authentication as existing endpoints
- **Data Integrity**: Risk scores stored with cryptographic checksums
- **Audit Trail**: Complete history of risk calculations and changes

### Non-Interference Guarantees
- **PingCastle Preservation**: Original PingCastle scores never modified
- **Separate Storage**: Risk calculations stored in dedicated tables
- **Independent Processing**: Risk calculations don't affect report processing
- **Backward Compatibility**: System functions normally without risk integration

## Monitoring and Alerting

### Risk Thresholds
- **Critical**: Global score ≥ 75 (immediate attention required)
- **High**: Global score ≥ 50 (review recommended)
- **Medium**: Global score ≥ 25 (monitoring advised)
- **Low**: Global score < 25 (acceptable risk level)

### Trend Monitoring
- **Degrading Trend**: > 5 point increase over 7 days
- **Improving Trend**: > 5 point decrease over 7 days  
- **Stable Trend**: ≤ 5 point change over 7 days

### Integration with Existing Alerts
Risk-based alerts integrate with existing DonWatcher notification system:
- **High Risk Domains**: Automatic alerts when global score exceeds thresholds
- **Risk Trend Changes**: Notifications on significant risk progression changes
- **Critical Group Exposure**: Immediate alerts for unaccepted members in critical groups
