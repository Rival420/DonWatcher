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
      // Sort reports from oldest to newest
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
        // Fallback to summary data if detailed fetch fails
      }
      
      document.getElementById('domain-sid').textContent = detail.domain_sid;
      document.getElementById('domain-func').textContent = detail.domain_functional_level;
      document.getElementById('forest-func').textContent = detail.forest_functional_level;
      document.getElementById('maturity-level').textContent = detail.maturity_level;
      document.getElementById('dc-count').textContent = detail.dc_count;
      document.getElementById('user-count').textContent = detail.user_count;
      document.getElementById('computer-count').textContent = detail.computer_count;
      
      // Render the global risk gauge
      renderGlobalGauge(detail.global_score);

      // Take the last 12 reports for historical charts
      const historicalData = reports.slice(-12);
      
      // Prepare data for charts
      const labels = historicalData.map(r => new Date(r.report_date).toLocaleDateString());
      const staleScores = historicalData.map(r => r.stale_objects_score);
      const privScores = historicalData.map(r => r.privileged_accounts_score);
      const trustScores = historicalData.map(r => r.trusts_score);
      const anomScores = historicalData.map(r => r.anomalies_score);

      // Render historical charts
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
  if (v < 25) return '#43a047';    // green
  if (v < 50) return '#fb8c00';    // orange
  if (v < 75) return '#e53935';    // red
  return '#b71c1c';                // dark red
}

function renderGlobalGauge(value) {
  const opts = {
    angle: 0.15,
    lineWidth: 0.2,
    radiusScale: 1,
    pointer: {
      length: 0.6,
      strokeWidth: 0.035,
      color: '#e53935'
    },
    limitMax: true,
    limitMin: true,
    colorStart: gaugeColor(value),
    colorStop: gaugeColor(value),
    strokeColor: '#314056',
    generateGradient: true,
    highDpiSupport: true,
    staticZones: [
      {strokeStyle: "#43a047", min: 0, max: 25},
      {strokeStyle: "#fb8c00", min: 25, max: 50},
      {strokeStyle: "#e53935", min: 50, max: 75},
      {strokeStyle: "#b71c1c", min: 75, max: 100}
    ],
  };
  
  const target = document.getElementById('global-risk-gauge');
  const gauge = new Gauge(target).setOptions(opts);
  gauge.maxValue = 100;
  gauge.setMinValue(0);
  gauge.animationSpeed = 32;
  gauge.set(value);

  document.getElementById('global-risk-value').textContent = value;
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