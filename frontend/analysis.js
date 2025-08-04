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
  freq.forEach((finding) => {
    const { category, name, count, description } = finding;
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    const key = `${category}|${name}`;
    const isAccepted = acceptedSet.has(key);

    tr.innerHTML = `
      <td>${category}</td>
      <td>${name}</td>
      <td>${count}</td>
      <td>
        <label class="switch">
          <input type="checkbox" data-cat="${category}" data-name="${name}" ${isAccepted ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </td>
    `;

    tr.addEventListener("click", () => showRiskModal(finding, isAccepted));
    tbody.appendChild(tr);

    const toggle = tr.querySelector(".switch input");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent modal from opening
    });
    toggle.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      await updateAcceptedRisk(category, name, isChecked);
      if(isChecked) {
        acceptedSet.add(key);
      } else {
        acceptedSet.delete(key);
      }
      // We can update the modal if it's open for this risk
      const modalToggle = document.getElementById("risk-modal-accept-toggle");
      if (modalToggle.dataset.cat === category && modalToggle.dataset.name === name) {
        modalToggle.checked = isChecked;
      }
    });
  });
}

function showRiskModal(finding, isAccepted) {
  const { category, name, description } = finding;
  const modal = document.getElementById("risk-modal");
  document.getElementById("risk-modal-title").textContent = name;
  document.getElementById("risk-modal-category").textContent = category;
  document.getElementById("risk-modal-description").textContent = description;

  const toggle = document.getElementById("risk-modal-accept-toggle");
  toggle.checked = isAccepted;
  toggle.dataset.cat = category;
  toggle.dataset.name = name;

  modal.classList.remove("hidden");

  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.onclick = () => modal.classList.add("hidden");
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.classList.add("hidden");
    }
  };

  const modalToggle = document.getElementById("risk-modal-accept-toggle");
  modalToggle.onchange = async () => {
      await updateAcceptedRisk(category, name, modalToggle.checked);
      const mainToggle = document.querySelector(`#recurring-table input[data-cat="${category}"][data-name="${name}"]`);
      if(mainToggle){
        mainToggle.checked = modalToggle.checked;
      }
  };
}

async function updateAcceptedRisk(category, name, isAccepted) {
    const payload = JSON.stringify({ category, name });
    const method = isAccepted ? "POST" : "DELETE";
    await fetch("/api/accepted_risks", {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: payload
    });
}
