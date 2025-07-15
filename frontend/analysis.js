export async function showAnalysis() {
  const [scores, freq] = await Promise.all([
    fetch("/analysis/scores").then(r => r.json()),
    fetch("/analysis/frequency").then(r => r.json())
  ]);
  renderChart(scores);
  renderRecurring(freq);
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
      datasets: [{
        label: "Global Score",
        data: data.map(d => d.staleObjects + d.privilegedAccounts + d.trusts + d.anomalies),
        fill: false,
        borderColor: '#1976d2',
        borderWidth: 2,
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Score" } }
      }
    }
  });
}

function renderRecurring(freq) {
  const tbody = document.querySelector("#recurring-table tbody");
  tbody.innerHTML = "";
  freq.forEach(({category,name,count}) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${category}</td><td>${name}</td><td>${count}</td>
    `;
    tbody.appendChild(tr);
  });
}
