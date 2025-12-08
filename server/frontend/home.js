import { createChart, destroyChart } from './chartManager.js';

document.addEventListener('DOMContentLoaded', async () => {
  loadDomainInfo();
  loadDomainScannerData();
  loadEnhancedRiskData();
});

async function loadDomainInfo() {
  try {
    // 🔧 BUG FIX: Separate PingCastle and domain scanner data sources
    
    // Get PingCastle reports ONLY for domain overview
    const pingcastleRes = await fetch('/api/reports?tool_type=pingcastle');
    const pingcastleReports = await pingcastleRes.json();
    
    // Get all reports to determine latest domain
    const allReportsRes = await fetch('/api/reports');
    const allReports = await allReportsRes.json();
    
    if (allReports.length === 0) return;
    
    // Get latest domain name from any report type
    allReports.sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
    const latestDomain = allReports[allReports.length - 1].domain;
    document.getElementById('domain-name').textContent = latestDomain;
    
    // Use ONLY PingCastle data for domain overview metadata
    if (pingcastleReports.length > 0) {
      // Get latest PingCastle report for this domain
      const domainPingcastleReports = pingcastleReports.filter(r => r.domain === latestDomain);
      
      if (domainPingcastleReports.length > 0) {
        domainPingcastleReports.sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
        const latestPingcastle = domainPingcastleReports[domainPingcastleReports.length - 1];
        
        // Update date to latest PingCastle report date
        document.getElementById('latest-date').textContent = new Date(latestPingcastle.report_date).toLocaleDateString();

        // Get PingCastle detail
        let pingcastleDetail = latestPingcastle;
        try {
          const detailRes = await fetch(`/api/reports/${latestPingcastle.id}`);
          if (detailRes.ok) {
            pingcastleDetail = await detailRes.json();
          }
        } catch {
          // Fallback to summary data
        }
        
        // ✅ ONLY use PingCastle data for domain overview
        document.getElementById('domain-sid').textContent = pingcastleDetail.domain_sid || '-';
        document.getElementById('domain-func').textContent = pingcastleDetail.domain_functional_level || '-';
        document.getElementById('forest-func').textContent = pingcastleDetail.forest_functional_level || '-';
        document.getElementById('maturity-level').textContent = pingcastleDetail.maturity_level || '-';
        document.getElementById('dc-count').textContent = pingcastleDetail.dc_count || '-';
        document.getElementById('user-count').textContent = pingcastleDetail.user_count || '-';
        document.getElementById('computer-count').textContent = pingcastleDetail.computer_count || '-';
        
        // ✅ Always show PingCastle score in PingCastle section
        renderPingCastleGauge(pingcastleDetail.global_score || 0);
        
        // ✅ Load combined global risk in separate section
        if (window.RiskManager) {
          loadEnhancedGlobalRisk(latestDomain);
        }

        // ✅ ONLY use PingCastle reports for historical charts
        const historicalPingcastle = domainPingcastleReports.slice(-12);
        
        const labels = historicalPingcastle.map(r => new Date(r.report_date).toLocaleDateString());
        const staleScores = historicalPingcastle.map(r => r.stale_objects_score || 0);
        const privScores = historicalPingcastle.map(r => r.privileged_accounts_score || 0);
        const trustScores = historicalPingcastle.map(r => r.trusts_score || 0);
        const anomScores = historicalPingcastle.map(r => r.anomalies_score || 0);

        renderHistoricalChart('stale-objects-chart', 'Stale Objects', labels, staleScores);
        renderHistoricalChart('privileged-accounts-chart', 'Privileged Accounts', labels, privScores);
        renderHistoricalChart('trusts-chart', 'Trusts', labels, trustScores);
        renderHistoricalChart('anomalies-chart', 'Anomalies', labels, anomScores);
      } else {
        // No PingCastle data for this domain - show placeholders
        document.getElementById('latest-date').textContent = 'No PingCastle data';
        document.getElementById('domain-sid').textContent = '-';
        document.getElementById('domain-func').textContent = '-';
        document.getElementById('forest-func').textContent = '-';
        document.getElementById('maturity-level').textContent = '-';
        document.getElementById('dc-count').textContent = '-';
        document.getElementById('user-count').textContent = '-';
        document.getElementById('computer-count').textContent = '-';
        
        // Still try to load global risk if available
        if (window.RiskManager) {
          loadEnhancedGlobalRisk(latestDomain);
        }
      }
    } else {
      // No PingCastle data available - show domain name only
      document.getElementById('latest-date').textContent = 'No PingCastle data available';
      
      // Still try to load global risk for domain scanner only scenarios
      if (window.RiskManager) {
        loadEnhancedGlobalRisk(latestDomain);
      }
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
    
    // Create separate Global Risk section if it doesn't exist
    let globalRiskSection = document.getElementById('global-risk-section');
    if (!globalRiskSection) {
      globalRiskSection = document.createElement('section');
      globalRiskSection.id = 'global-risk-section';
      globalRiskSection.className = 'card';
      globalRiskSection.innerHTML = `
        <h2>Global Risk Score</h2>
        <p class="section-description">Combined infrastructure security (PingCastle) and access governance (Domain Groups)</p>
        <div class="global-risk-container">
          <canvas id="global-risk-chart"></canvas>
        </div>
      `;
      
      // Insert after PingCastle risk scores section
      const pingcastleSection = document.getElementById('risk-scores');
      if (pingcastleSection) {
        pingcastleSection.parentNode.insertBefore(globalRiskSection, pingcastleSection.nextSibling);
      }
    }
    
    // Render enhanced global gauge in separate section
    window.RiskManager.renderEnhancedGlobalGauge('global-risk-chart', riskData);
    
    // ✅ DON'T update domain SID - that comes from PingCastle only
    
  } catch (error) {
    console.error('Failed to load enhanced global risk:', error);
    // Don't show fallback here - global risk is optional enhancement
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

function renderPingCastleGauge(value) {
  const canvasId = 'pingcastle-risk-chart';
  
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
  textContainer.className = 'pingcastle-risk-label';
  textContainer.innerHTML = `
    <div class="pingcastle-score">${value}</div>
    <div class="pingcastle-label">PingCastle Score</div>
  `;
  
  const container = document.querySelector('.pingcastle-risk-container');
  const existingLabel = container.querySelector('.pingcastle-risk-label');
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
