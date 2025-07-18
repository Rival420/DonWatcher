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
      reports.sort((a, b) => new Date(b.report_date) - new Date(a.report_date));
      const latest = reports[0];
      document.getElementById('domain-name').textContent = latest.domain;
      document.getElementById('latest-date').textContent = new Date(latest.report_date).toLocaleDateString();


      let detail = latest;
      try {
        const detailRes = await fetch(`/api/reports/${latest.id}`);
        if (detailRes.ok) {
          detail = await detailRes.json();
        }
      } catch {
        // fall back to summary data if detailed fetch fails
      }
      document.getElementById('domain-sid').textContent = detail.domain_sid;
      document.getElementById('domain-func').textContent = detail.domain_functional_level;
      document.getElementById('forest-func').textContent = detail.forest_functional_level;
      document.getElementById('maturity-level').textContent = detail.maturity_level;
      document.getElementById('dc-count').textContent = detail.dc_count;
      document.getElementById('user-count').textContent = detail.user_count;
      document.getElementById('computer-count').textContent = detail.computer_count;
      document.getElementById('risk-global').textContent = detail.global_score;
      document.getElementById('risk-stale-val').textContent = detail.stale_objects_score;
      document.getElementById('risk-priv-val').textContent = detail.privileged_accounts_score;
      document.getElementById('risk-trusts-val').textContent = detail.trusts_score;
      document.getElementById('risk-anom-val').textContent = detail.anomalies_score;

            renderGauges({
        stale: detail.stale_objects_score,
        priv:  detail.privileged_accounts_score,
        trusts: detail.trusts_score,
        anom:  detail.anomalies_score
      });
    }
  } catch {
    // ignore
  }
}

/**
 * choose a gauge color based on a 0–100 value
 */
function gaugeColor(v){
  if(v < 25 ) return '#43a047';    // green
  if(v < 50 ) return '#fb8c00';    // orange
  if(v < 75 ) return '#e53935';    // red
  return '#b71c1c';                // dark red
}

/**
 * render a half‑donut gauge into a canvas context
 */
function makeGauge(ctx, value){
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [100 - value, value],
        backgroundColor: [ gaugeColor(value), '#314056' ],
        hoverBackgroundColor: [ gaugeColor(value), '#314056' ],
        borderWidth: 0
      }]
    },
    options: {
      rotation: Math.PI,           // start at 180°
      circumference: Math.PI,      // sweep 180°
      cutout: '70%',               // thickness
      plugins: {
        tooltip: { enabled: false },
        legend:  { display: false }
      }
    }
  });
}

/**
 * render all four gauges
 */
function renderGauges(scores){
  // map IDs to score keys
  const map = {
    stale: 'gauge-stale',
    priv:  'gauge-priv',
    trusts:'gauge-trusts',
    anom:  'gauge-anom'
  };
  Object.entries(map).forEach(([key, canvasId])=>{
    const val = scores[key] ?? 0;
    const cappedVal = Math.min(rawVal, 100); // capping max value at 100
    
    // update the numeric label based on real value
    document.getElementById(`risk-${key}-val`).textContent = val;
    
    // create chart
    const ctx = document.getElementById(canvasId).getContext('2d');
    // destroy old chart if you store references; for brevity this just draws fresh
    makeGauge(ctx, cappedVal);
  });
}

