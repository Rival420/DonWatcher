export async function showAnalysis() {
  const [scores, freq, accepted] = await Promise.all([
    fetch("/analysis/scores").then(r => r.json()),
    fetch("/analysis/frequency").then(r => r.json()),
    fetch("/api/accepted_risks").then(r => r.json()),
  ]);
  renderChart(scores);
  renderRecurring(freq, accepted);
}

// Automatically fetch and display charts when the page is loaded
document.addEventListener("DOMContentLoaded", () => {
  showAnalysis().catch(() => {
    console.error("Failed to load analysis data");
  });
});

function renderChart(data) {
  const ctx = document.getElementById("scoreChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d=> new Date(d.date).toLocaleDateString()),
      datasets: [
        {
          label: "Global Score",
          data: data.map(d => d.staleObjects + d.privilegedAccounts + d.trusts + d.anomalies),
          fill: false,
          borderColor: '#1976d2',
          borderWidth: 2,
        },
        {
          label: "StaleObjects",
          data: data.map(d => d.staleObjects),
          fill: false,
          borderColor: '#e53935',
          borderWidth: 2,
        },
        {
          label: "PrivilegedAccounts",
          data: data.map(d => d.privilegedAccounts),
          fill: false,
          borderColor: '#43a047',
          borderWidth: 2,
        },
        {
          label: "Trusts",
          data: data.map(d => d.trusts),
          fill: false,
          borderColor: '#fb8c00',
          borderWidth: 2,
        },
        {
          label: "Anomalies",
          data: data.map(d => d.anomalies),
          fill: false,
          borderColor: '#8e24aa',
          borderWidth: 2,
        }
      ]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Score" } }
      }
    }
  });
}

function renderRecurring(freq, accepted) {
  const tbody = document.querySelector("#recurring-table tbody");
  const acceptedSet = new Set(accepted.map(r => `${r.category}|${r.name}`));
  tbody.innerHTML = "";
  freq.forEach(({category, name, count, description}) => {
    const tr = document.createElement("tr");
    const key = `${category}|${name}`;
    const toggle = `
      <label class="switch">
        <input type="checkbox" data-cat="${category}" data-name="${name}" ${acceptedSet.has(key) ? "checked" : ""}>
        <span class="slider"></span>
      </label>`;
    tr.innerHTML = `
      <td>${category}</td><td title="${description}">${name}</td><td>${count}</td><td>${toggle}</td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".switch input").forEach(chk => {
    chk.addEventListener("change", async () => {
      const payload = JSON.stringify({category: chk.dataset.cat, name: chk.dataset.name});
      if (chk.checked) {
        await fetch("/api/accepted_risks", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: payload
        });
      } else {
        await fetch("/api/accepted_risks", {
          method: "DELETE",
          headers: {"Content-Type": "application/json"},
          body: payload
        });
      }
      showAnalysis();
    });
  });
}
