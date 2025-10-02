import { createChart, destroyChart } from './chartManager.js';

document.addEventListener('DOMContentLoaded', async () => {
  loadDomainInfo();
  loadDomainScannerData();
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
      
      renderGlobalGauge(detail.global_score);

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
    // Get domain analysis reports
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
    
    // Get the latest domain scanner report
    const latestReport = reports[reports.length - 1];
    const detailRes = await fetch(`/api/reports/${latestReport.id}`);
    const reportDetail = await detailRes.json();
    
    loadingEl.style.display = 'none';
    
    if (!reportDetail.findings || reportDetail.findings.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    
    // Group findings by group name
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
    
    // Render group tiles
    contentEl.innerHTML = '';
    Object.values(groupData).forEach(group => {
      const tile = createGroupTile(group);
      contentEl.appendChild(tile);
    });
    
    contentEl.style.display = 'grid';
    
  } catch (error) {
    console.error('Failed to load domain scanner data:', error);
    document.getElementById('domain-scanner-loading').style.display = 'none';
    document.getElementById('domain-scanner-empty').style.display = 'block';
  }
}

function createGroupTile(group) {
  const tile = document.createElement('div');
  tile.className = `group-tile ${group.severity}-risk`;
  
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
  `;
  
  // Add click handler to show member details
  tile.addEventListener('click', () => {
    showGroupDetails(group);
  });
  
  return tile;
}

function showGroupDetails(group) {
  // Create a simple modal or alert with member details
  const memberNames = group.members.map(m => 
    typeof m === 'string' ? m : m.name || 'Unknown'
  ).join('\n');
  
  alert(`${group.name} Members (${group.memberCount}):\n\n${memberNames}`);
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
