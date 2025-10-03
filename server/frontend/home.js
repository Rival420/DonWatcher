import { createChart, destroyChart } from './chartManager.js';

document.addEventListener('DOMContentLoaded', async () => {
  loadDomainInfo();
  loadDomainScannerData();
  loadEnhancedRiskData();
});

async function loadDomainInfo() {
  try {
    const res = await fetch('/api/reports');
    const reports = await res.json();
    if (reports.length) {
      reports.sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
      
      const latest = reports[reports.length - 1];
      document.getElementById('domain-name').textContent = latest.domain;
      document.getElementById('latest-date').textContent = new Date(latest.report_date).toLocaleDateString();

      let detail = latest;
      try {
        const detailRes = await fetch(`/api/reports/${latest.id}`);
        if (detailRes.ok) {
          detail = await detailRes.json();
        }
      } catch {
        // Fallback to summary data
      }
      
      document.getElementById('domain-sid').textContent = detail.domain_sid;
      document.getElementById('domain-func').textContent = detail.domain_functional_level;
      document.getElementById('forest-func').textContent = detail.forest_functional_level;
      document.getElementById('maturity-level').textContent = detail.maturity_level;
      document.getElementById('dc-count').textContent = detail.dc_count;
      document.getElementById('user-count').textContent = detail.user_count;
      document.getElementById('computer-count').textContent = detail.computer_count;
      
      // Use enhanced risk visualization if available, fallback to legacy
      if (window.RiskManager) {
        loadEnhancedGlobalRisk(detail.domain);
      } else {
        renderGlobalGauge(detail.global_score);
      }

      const historicalData = reports.slice(-12);
      
      const labels = historicalData.map(r => new Date(r.report_date).toLocaleDateString());
      const staleScores = historicalData.map(r => r.stale_objects_score);
      const privScores = historicalData.map(r => r.privileged_accounts_score);
      const trustScores = historicalData.map(r => r.trusts_score);
      const anomScores = historicalData.map(r => r.anomalies_score);

      renderHistoricalChart('stale-objects-chart', 'Stale Objects', labels, staleScores);
      renderHistoricalChart('privileged-accounts-chart', 'Privileged Accounts', labels, privScores);
      renderHistoricalChart('trusts-chart', 'Trusts', labels, trustScores);
      renderHistoricalChart('anomalies-chart', 'Anomalies', labels, anomScores);
    }
  } catch (error) {
    console.error('Failed to load domain info:', error);
  }
}

async function loadDomainScannerData() {
  try {
    // Get domain analysis reports to find the latest domain
    const res = await fetch('/api/reports?tool_type=domain_analysis');
    const reports = await res.json();
    
    const loadingEl = document.getElementById('domain-scanner-loading');
    const contentEl = document.getElementById('domain-scanner-content');
    const emptyEl = document.getElementById('domain-scanner-empty');
    
    if (!reports || reports.length === 0) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    
    // Get the latest domain for the new API
    const latestReport = reports[reports.length - 1];
    const domain = latestReport.domain;
    
    // Use the new domain groups API for enhanced data
    const groupsRes = await fetch(`/api/domain_groups/${encodeURIComponent(domain)}`);
    
    loadingEl.style.display = 'none';
    
    if (!groupsRes.ok) {
      // Fallback to legacy method if new API fails
      return loadLegacyDomainScannerData(reports);
    }
    
    const groupsData = await groupsRes.json();
    
    if (!groupsData || groupsData.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    
    // Render enhanced group tiles
    contentEl.innerHTML = '';
    groupsData.forEach(group => {
      const tile = createEnhancedGroupTile(group, domain);
      contentEl.appendChild(tile);
    });
    
    contentEl.style.display = 'grid';
    
  } catch (error) {
    console.error('Failed to load domain scanner data:', error);
    document.getElementById('domain-scanner-loading').style.display = 'none';
    document.getElementById('domain-scanner-empty').style.display = 'block';
  }
}

function createEnhancedGroupTile(group, domain) {
  const tile = document.createElement('div');
  tile.className = `group-tile ${group.severity}-risk`;
  
  // Calculate acceptance percentage
  const acceptanceRate = group.total_members > 0 ? 
    Math.round((group.accepted_members / group.total_members) * 100) : 100;
  
  // Determine status icon and color
  const statusIcon = group.unaccepted_members === 0 ? 'check-circle' : 'exclamation-triangle';
  const statusColor = group.unaccepted_members === 0 ? '#4CAF50' : '#FF9800';
  
  tile.innerHTML = `
    <div class="group-header">
      <div class="group-name">${group.group_name}</div>
      <div class="group-risk-badge ${group.severity}">
        <span class="risk-score">${group.risk_score}</span>
      </div>
    </div>
    
    <div class="group-status">
      <i class="fas fa-${statusIcon}" style="color: ${statusColor};"></i>
      <span class="status-text">
        ${group.unaccepted_members === 0 ? 'All members accepted' : `${group.unaccepted_members} unaccepted`}
      </span>
    </div>
    
    <div class="group-stats-enhanced">
      <div class="stat-item">
        <div class="stat-label">Total</div>
        <div class="stat-value">${group.total_members}</div>
      </div>
      <div class="stat-item accepted">
        <div class="stat-label">Accepted</div>
        <div class="stat-value">${group.accepted_members}</div>
      </div>
      <div class="stat-item unaccepted">
        <div class="stat-label">Unaccepted</div>
        <div class="stat-value">${group.unaccepted_members}</div>
      </div>
    </div>
    
    <div class="acceptance-bar">
      <div class="acceptance-progress" style="width: ${acceptanceRate}%"></div>
    </div>
    
    <div class="group-actions">
      <button class="btn-manage" data-group="${group.group_name}" data-domain="${domain}">
        <i class="fas fa-cog"></i> Manage Members
      </button>
    </div>
  `;
  
  // Add click handler for manage button
  const manageBtn = tile.querySelector('.btn-manage');
  manageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showMemberManagementModal(group.group_name, domain);
  });
  
  // Add click handler for tile (show quick info)
  tile.addEventListener('click', () => {
    showGroupQuickInfo(group, domain);
  });
  
  return tile;
}

// Legacy fallback for backward compatibility
async function loadLegacyDomainScannerData(reports) {
  try {
    const latestReport = reports[reports.length - 1];
    const detailRes = await fetch(`/api/reports/${latestReport.id}`);
    const reportDetail = await detailRes.json();
    
    const contentEl = document.getElementById('domain-scanner-content');
    const emptyEl = document.getElementById('domain-scanner-empty');
    
    if (!reportDetail.findings || reportDetail.findings.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    
    // Group findings by group name (legacy format)
    const groupData = {};
    reportDetail.findings.forEach(finding => {
      if (finding.category === 'DonScanner' && finding.name.startsWith('Group_')) {
        const groupName = finding.metadata?.group_name || 'Unknown Group';
        const memberCount = finding.metadata?.member_count || 0;
        const severity = finding.severity || 'medium';
        
        groupData[groupName] = {
          name: groupName,
          memberCount: memberCount,
          severity: severity,
          members: finding.metadata?.members || []
        };
      }
    });
    
    // Render legacy tiles
    contentEl.innerHTML = '';
    Object.values(groupData).forEach(group => {
      const tile = createLegacyGroupTile(group);
      contentEl.appendChild(tile);
    });
    
    contentEl.style.display = 'grid';
    
  } catch (error) {
    console.error('Failed to load legacy domain scanner data:', error);
    document.getElementById('domain-scanner-empty').style.display = 'block';
  }
}

function createLegacyGroupTile(group) {
  const tile = document.createElement('div');
  tile.className = `group-tile ${group.severity}-risk legacy`;
  
  tile.innerHTML = `
    <div class="group-header">
      <div class="group-name">${group.name}</div>
      <div class="group-severity ${group.severity}">${group.severity}</div>
    </div>
    <div class="group-stats">
      <i class="fas fa-users"></i>
      <span class="member-count">${group.memberCount}</span>
      <span>members</span>
    </div>
    <div class="legacy-notice">
      <small>Legacy format - upgrade to Phase 1 for member management</small>
    </div>
  `;
  
  // Add click handler to show member details
  tile.addEventListener('click', () => {
    showGroupDetails(group);
  });
  
  return tile;
}

// Enhanced group interaction functions
function showMemberManagementModal(groupName, domain) {
  // Use the real member management modal
  if (window.MemberModal) {
    window.MemberModal.show(groupName, domain);
  } else {
    console.error('MemberModal not loaded');
    alert('Member management modal is not available. Please refresh the page.');
  }
}

function showGroupQuickInfo(group, domain) {
  // Quick info popup/tooltip
  const info = `
Group: ${group.group_name}
Domain: ${domain}
Risk Score: ${group.risk_score} (${group.severity})

Members:
• Total: ${group.total_members}
• Accepted: ${group.accepted_members} 
• Unaccepted: ${group.unaccepted_members}

Last Updated: ${new Date(group.last_updated).toLocaleString()}
  `.trim();
  
  alert(info);
}

// Legacy function for backward compatibility
function showGroupDetails(group) {
  // Create a simple modal or alert with member details
  const memberNames = group.members.map(m => 
    typeof m === 'string' ? m : m.name || 'Unknown'
  ).join('\n');
  
  alert(`${group.name} Members (${group.memberCount}):\n\n${memberNames}`);
}

// Enhanced risk loading functions - Phase 3
async function loadEnhancedRiskData() {
  try {
    // Get domain from latest report
    const res = await fetch('/api/reports');
    const reports = await res.json();
    
    if (reports.length === 0) return;
    
    const latest = reports[reports.length - 1];
    const domain = latest.domain;
    
    // Load enhanced global risk
    await loadEnhancedGlobalRisk(domain);
    
    // Load risk breakdown
    await loadRiskBreakdown(domain);
    
    // Load risk history
    await loadRiskHistory(domain);
    
  } catch (error) {
    console.error('Failed to load enhanced risk data:', error);
    // Fallback to legacy risk display
  }
}

async function loadEnhancedGlobalRisk(domain) {
  try {
    if (!window.RiskManager) return;
    
    const riskData = await window.RiskManager.getGlobalRisk(domain);
    
    // Render enhanced global gauge
    window.RiskManager.renderEnhancedGlobalGauge('global-risk-chart', riskData);
    
    // Update domain SID from risk data if available
    if (riskData.domain_sid && document.getElementById('domain-sid')) {
      document.getElementById('domain-sid').textContent = riskData.domain_sid;
    }
    
  } catch (error) {
    console.error('Failed to load enhanced global risk:', error);
    // Fallback to legacy gauge
    const reports = await fetch('/api/reports');
    const reportsData = await reports.json();
    if (reportsData.length > 0) {
      const latest = reportsData[reportsData.length - 1];
      renderGlobalGauge(latest.global_score || 0);
    }
  }
}

async function loadRiskBreakdown(domain) {
  try {
    if (!window.RiskManager) return;
    
    const breakdown = await window.RiskManager.getRiskBreakdown(domain);
    
    // Create risk breakdown section if it doesn't exist
    let breakdownSection = document.getElementById('risk-breakdown-section');
    if (!breakdownSection) {
      breakdownSection = document.createElement('section');
      breakdownSection.id = 'risk-breakdown-section';
      breakdownSection.className = 'card';
      breakdownSection.innerHTML = `
        <h2>Risk Category Breakdown</h2>
        <div id="risk-category-breakdown"></div>
      `;
      
      // Insert after risk scores section
      const riskScoresSection = document.getElementById('risk-scores');
      if (riskScoresSection) {
        riskScoresSection.parentNode.insertBefore(breakdownSection, riskScoresSection.nextSibling);
      }
    }
    
    // Render breakdown
    window.RiskManager.renderRiskCategoryBreakdown('risk-category-breakdown', breakdown);
    
  } catch (error) {
    console.error('Failed to load risk breakdown:', error);
  }
}

async function loadRiskHistory(domain) {
  try {
    if (!window.RiskManager) return;
    
    const historyData = await window.RiskManager.getRiskHistory(domain, 30);
    
    // Create risk history section if it doesn't exist
    let historySection = document.getElementById('risk-history-section');
    if (!historySection) {
      historySection = document.createElement('section');
      historySection.id = 'risk-history-section';
      historySection.className = 'card';
      historySection.innerHTML = `
        <h2>Combined Risk History (30 days)</h2>
        <div class="chart-container">
          <canvas id="combined-risk-history-chart"></canvas>
        </div>
      `;
      
      // Insert after risk breakdown section
      const breakdownSection = document.getElementById('risk-breakdown-section');
      if (breakdownSection) {
        breakdownSection.parentNode.insertBefore(historySection, breakdownSection.nextSibling);
      }
    }
    
    // Render history chart
    window.RiskManager.renderCombinedRiskHistory('combined-risk-history-chart', historyData);
    
  } catch (error) {
    console.error('Failed to load risk history:', error);
  }
}

function gaugeColor(v) {
  if (v < 25) return '#43a047';
  if (v < 50) return '#fb8c00';
  if (v < 75) return '#e53935';
  return '#b71c1c';
}

function renderGlobalGauge(value) {
  const canvasId = 'global-risk-chart';
  
  createChart(canvasId, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [value, 100 - value],
        backgroundColor: [gaugeColor(value), '#314056'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      circumference: 180,
      rotation: -90,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true
      }
    }
  });

  const textContainer = document.createElement('div');
  textContainer.className = 'global-risk-label';
  textContainer.textContent = value;
  
  const container = document.querySelector('.global-risk-container');
  const existingLabel = container.querySelector('.global-risk-label');
  if (existingLabel) {
    container.removeChild(existingLabel);
  }
  container.appendChild(textContainer);
}

function renderHistoricalChart(canvasId, label, labels, data) {
  createChart(canvasId, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.4,
        fill: false,
        segment: {
          borderColor: (ctx) => {
            const y1 = ctx.p0.parsed.y;
            const y2 = ctx.p1.parsed.y;
            const gradient = ctx.chart.ctx.createLinearGradient(ctx.p0.x, 0, ctx.p1.x, 0);
            gradient.addColorStop(0, gaugeColor(y1));
            gradient.addColorStop(1, gaugeColor(y2));
            return gradient;
          },
        },
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false,
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}
