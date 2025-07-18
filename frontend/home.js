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

function makeGaugeJS(canvasId, value, max) {
  var opts = {
    angle: 0,                  // 0: half-circle, 1: full
    lineWidth: 0.25,           // thickness
    radiusScale: 1,            // relative to canvas size
    pointer: {
      length: 0.6,             // Relative to gauge radius
      strokeWidth: 3,          // Gauge pointer thickness
      color: '#e53935'         // Pointer color
    },
    limitMax: true,     
    limitMin: true,     
    colorStart: gaugeColor(value),   // Custom gauge color for the arc
    colorStop: gaugeColor(value),
    strokeColor: '#314056',    // background arc color
    generateGradient: false,
    highDpiSupport: true,
    staticLabels: {
      font: "10px sans-serif",  // font
      labels: [0, max / 2, max],
      color: "#fff",
      fractionDigits: 0
    },
    staticZones: [
      {strokeStyle: "#43a047", min: 0, max: 25},
      {strokeStyle: "#fb8c00", min: 25, max: 50},
      {strokeStyle: "#e53935", min: 50, max: 75},
      {strokeStyle: "#b71c1c", min: 75, max: max}
    ],
    // Just half a circle:
    angle: 0, // The span of the gauge arc (0 = 180 degrees = half a circle)
  };
  var target = document.getElementById(canvasId);
  var gauge = new Gauge(target).setOptions(opts);
  gauge.maxValue = max;
  gauge.setMinValue(0);
  gauge.animationSpeed = 32; 
  gauge.set(value);
}


function renderGauges(scores) {
  makeGaugeJS('gauge-stale', scores.stale, 100);
  makeGaugeJS('gauge-priv', scores.priv, 100);
  makeGaugeJS('gauge-trusts', scores.trusts, 100);
  makeGaugeJS('gauge-anom', scores.anom, 100);
}

