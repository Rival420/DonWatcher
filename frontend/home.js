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
      document.getElementById('risk-stale').textContent = detail.stale_objects_score;
      document.getElementById('risk-priv').textContent = detail.privileged_accounts_score;
      document.getElementById('risk-trusts').textContent = detail.trusts_score;
      document.getElementById('risk-anom').textContent = detail.anomalies_score;
    }
  } catch {
    // ignore
  }
}
