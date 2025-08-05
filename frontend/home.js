import { showAnalysis } from './analysis.js';

document.addEventListener('DOMContentLoaded', async () => {
  await showAnalysis().catch(() => console.error('Failed to load analysis data'));
  loadDomainInfo();
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

function gaugeColor(v) {
  if (v < 25) return '#43a047';
  if (v < 50) return '#fb8c00';
  if (v < 75) return '#e53935';
  return '#b71c1c';
}

function renderGlobalGauge(value) {
  const ctx = document.getElementById('global-risk-chart').getContext('2d');
  
  new Chart(ctx, {
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

  // Add the text in the middle of the doughnut
  const textContainer = document.createElement('div');
  textContainer.className = 'global-risk-label';
  textContainer.textContent = value;
  document.querySelector('.global-risk-container').appendChild(textContainer);
}

function renderHistoricalChart(canvasId, label, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  new Chart(ctx, {
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
