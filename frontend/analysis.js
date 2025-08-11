import { createChart } from './chartManager.js';

export async function showAnalysis() {
  const [scores, freq, accepted] = await Promise.all([
    fetch("/analysis/scores").then(r => r.json()),
    fetch("/analysis/frequency").then(r => r.json()),
    fetch("/api/accepted_risks").then(r => r.json()),
  ]);
  renderChart(scores);
  renderRecurring(freq, accepted);
  enableColumnDragAndDrop('#recurring-table');
}

document.addEventListener("DOMContentLoaded", () => {
  showAnalysis().catch(() => {
    console.error("Failed to load analysis data");
  });

  document.getElementById("findings-filter").addEventListener("input", renderFilteredFindings);
  document.getElementById("category-filter").addEventListener("change", renderFilteredFindings);
  document.getElementById("acceptance-filter").addEventListener("change", renderFilteredFindings);
  const latestToggle = document.getElementById("latest-only-toggle");
  if (latestToggle) latestToggle.addEventListener("change", renderFilteredFindings);
  document.getElementById("sort-findings").addEventListener("change", renderFilteredFindings);
});

const ORDER_STORAGE_KEY = 'recurringTableColumnOrder';

function enableColumnDragAndDrop(tableSelector) {
  const table = document.querySelector(tableSelector);
  if (!table) return;

  // Initialize order from storage or header
  const initialOrder = getHeaderOrder(table);
  const saved = loadColumnOrder() || initialOrder;
  applyColumnOrder(table, saved);

  // Make headers draggable by data key
  const headerCells = Array.from(table.querySelectorAll('thead th'));
  headerCells.forEach((th) => {
    const key = th.dataset.col;
    th.draggable = true;
    th.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', key);
    });
    th.addEventListener('dragover', (e) => e.preventDefault());
    th.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromKey = e.dataTransfer.getData('text/plain');
      const toKey = th.dataset.col;
      if (!fromKey || !toKey || fromKey === toKey) return;
      const currentOrder = getHeaderOrder(table);
      const fromIdx = currentOrder.indexOf(fromKey);
      const toIdx = currentOrder.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) return;
      const newOrder = [...currentOrder];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, moved);
      saveColumnOrder(newOrder);
      applyColumnOrder(table, newOrder);
    });
  });
}

function getHeaderOrder(table) {
  return Array.from(table.querySelectorAll('thead th')).map(th => th.dataset.col);
}

function loadColumnOrder() {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveColumnOrder(order) {
  try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order)); } catch {}
}

function applyColumnOrder(table, order) {
  // Reorder header
  const theadRow = table.querySelector('thead tr');
  const thByKey = {};
  Array.from(table.querySelectorAll('thead th')).forEach(th => { thByKey[th.dataset.col] = th; });
  order.forEach((key) => {
    const th = thByKey[key];
    if (th) theadRow.appendChild(th);
  });

  // Reorder each body row according to td[data-col]
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row) => {
    const tdByKey = {};
    Array.from(row.children).forEach(td => { tdByKey[td.dataset.col] = td; });
    order.forEach((key) => {
      const td = tdByKey[key];
      if (td) row.appendChild(td);
    });
  });
}

function renderChart(data) {
  const canvasId = "scoreChart";
  createChart(canvasId, {
    type: "line",
    data: {
      labels: data.map(d => new Date(d.date).toLocaleDateString()),
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
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Score" } }
      }
    }
  });
}

let allFindings = [];
let acceptedRisks = [];

function renderRecurring(freq, accepted) {
  allFindings = freq;
  acceptedRisks = accepted;
  
  const categoryFilter = document.getElementById("category-filter");
  const categories = [...new Set(freq.map(f => f.category))].sort();
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
  
  renderFilteredFindings();
}

function renderFilteredFindings() {
  const tbody = document.querySelector("#recurring-table tbody");
  const filterText = document.getElementById("findings-filter").value.toLowerCase();
  const categoryFilter = document.getElementById("category-filter").value;
  const acceptanceFilter = document.getElementById("acceptance-filter").value;
  const latestOnly = !!(document.getElementById("latest-only-toggle") || { checked: false }).checked;
  const sortBy = document.getElementById("sort-findings").value;
  
  const acceptedSet = new Set(acceptedRisks.map(r => `${r.category}|${r.name}`));
  
  let filteredFindings = allFindings.filter(finding => {
    const matchesText = finding.name.toLowerCase().includes(filterText) || 
                       finding.description.toLowerCase().includes(filterText) ||
                       finding.category.toLowerCase().includes(filterText);
    const matchesCategory = !categoryFilter || finding.category === categoryFilter;
    
    const key = `${finding.category}|${finding.name}`;
    const isAccepted = acceptedSet.has(key);
    let matchesAcceptance = true;
    
    if (acceptanceFilter === "accepted") {
      matchesAcceptance = isAccepted;
    } else if (acceptanceFilter === "unaccepted") {
      matchesAcceptance = !isAccepted;
    }
    
    let matchesLatest = true;
    if (latestOnly) {
      matchesLatest = !!finding.inLatest;
    }
    return matchesText && matchesCategory && matchesAcceptance && matchesLatest;
  });
  
  filteredFindings.sort((a, b) => {
    switch (sortBy) {
      case "count-desc":
        return b.count - a.count;
      case "count-asc":
        return a.count - b.count;
      case "score-desc":
        return b.avg_score - a.avg_score;
      case "score-asc":
        return a.avg_score - b.avg_score;
      case "name":
        return a.name.localeCompare(b.name);
      case "category":
        return a.category.localeCompare(b.category);
      default:
        return b.count - a.count;
    }
  });
  
  tbody.innerHTML = "";
  
  filteredFindings.forEach((finding) => {
    const { category, name, count, description, avg_score, inLatest } = finding;
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    const key = `${category}|${name}`;
    const isAccepted = acceptedSet.has(key);

    // Build cells with data-col so DnD reorders by key, not by current index
    const cells = [
      { key: 'category', html: category },
      { key: 'name', html: name },
      { key: 'count', html: count },
      { key: 'avg_score', html: avg_score },
      { key: 'inLatest', html: inLatest ? 'Yes' : 'No' },
      { key: 'accepted', html: `<label class="switch"><input type="checkbox" data-cat="${category}" data-name="${name}" ${isAccepted ? "checked" : ""}><span class="slider"></span></label>` },
    ];

    tr.innerHTML = cells.map(c => `<td data-col="${c.key}">${c.html}</td>`).join('');

    tr.addEventListener("click", (event) => {
      if (event.target.closest('.switch')) {
        return;
      }
      showRiskModal(finding, isAccepted);
    });
    tbody.appendChild(tr);

    const toggle = tr.querySelector(".switch input");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    toggle.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      await updateAcceptedRisk(category, name, isChecked);
      if(isChecked) {
        acceptedSet.add(key);
      } else {
        acceptedSet.delete(key);
      }
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
