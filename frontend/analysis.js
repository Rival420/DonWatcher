import { createChart } from './chartManager.js';

export async function showAnalysis() {
  try {
    console.log("Loading analysis data...");
    
    const [scores, freq, accepted] = await Promise.all([
      fetch("/analysis/scores").then(r => {
        if (!r.ok) throw new Error(`Scores API error: ${r.status}`);
        return r.json();
      }),
      fetch("/analysis/frequency").then(r => {
        if (!r.ok) throw new Error(`Frequency API error: ${r.status}`);
        return r.json();
      }),
      fetch("/api/accepted_risks").then(r => {
        if (!r.ok) throw new Error(`Accepted risks API error: ${r.status}`);
        return r.json();
      }),
    ]);
    
    console.log("Analysis data loaded:", { scores, freq, accepted });
    
    renderChart(scores);
    renderRecurring(freq, accepted);
    enableColumnDragAndDrop('#recurring-table');
  } catch (error) {
    console.error("Failed to load analysis data:", error);
    
    // Show error in the UI
    const tbody = document.querySelector("#recurring-table tbody");
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #f44336;">Error loading analysis data. Check console for details.</td></tr>';
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  showAnalysis().catch(() => {
    console.error("Failed to load analysis data");
  });

  document.getElementById("findings-filter").addEventListener("input", renderFilteredFindings);
  document.getElementById("category-filter").addEventListener("change", renderFilteredFindings);
  document.getElementById("tool-filter").addEventListener("change", renderFilteredFindings);
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
  allFindings = freq || [];
  acceptedRisks = accepted || [];
  
  console.log("Rendering recurring findings:", { freq: allFindings.length, accepted: acceptedRisks.length });
  
  const categoryFilter = document.getElementById("category-filter");
  const toolFilter = document.getElementById("tool-filter");
  
  if (!categoryFilter || !toolFilter) {
    console.error("Filter elements not found");
    return;
  }
  
  // Populate category filter
  const categories = [...new Set(allFindings.map(f => f.category).filter(Boolean))].sort();
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
  
  // Populate tool filter
  const tools = [...new Set(allFindings.map(f => f.toolType).filter(Boolean))].sort();
  toolFilter.innerHTML = '<option value="">All Tools</option>';
  tools.forEach(tool => {
    const option = document.createElement("option");
    option.value = tool;
    option.textContent = tool.toUpperCase();
    toolFilter.appendChild(option);
  });
  
  renderFilteredFindings();
}

function renderFilteredFindings() {
  const tbody = document.querySelector("#recurring-table tbody");
  
  if (!tbody) {
    console.error("Recurring table tbody not found");
    return;
  }
  
  // Get filter values with null checking
  const filterText = (document.getElementById("findings-filter")?.value || "").toLowerCase();
  const categoryFilter = document.getElementById("category-filter")?.value || "";
  const toolFilter = document.getElementById("tool-filter")?.value || "";
  const acceptanceFilter = document.getElementById("acceptance-filter")?.value || "";
  const latestOnly = !!(document.getElementById("latest-only-toggle")?.checked);
  const sortBy = document.getElementById("sort-findings")?.value || "count-desc";
  
  // Handle empty data
  if (!allFindings || allFindings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">No recurring findings found. Upload some reports to see analysis.</td></tr>';
    return;
  }
  
  const acceptedSet = new Set(acceptedRisks.map(r => `${r.tool_type}|${r.category}|${r.name}`));
  
  let filteredFindings = allFindings.filter(finding => {
    // Safe property access with fallbacks
    const name = finding.name || '';
    const description = finding.description || '';
    const category = finding.category || '';
    const toolType = finding.toolType || '';
    
    const matchesText = name.toLowerCase().includes(filterText) || 
                       description.toLowerCase().includes(filterText) ||
                       category.toLowerCase().includes(filterText);
    const matchesCategory = !categoryFilter || category === categoryFilter;
    const matchesTool = !toolFilter || toolType === toolFilter;
    
    const key = `${toolType}|${category}|${name}`;
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
    return matchesText && matchesCategory && matchesTool && matchesAcceptance && matchesLatest;
  });
  
  filteredFindings.sort((a, b) => {
    switch (sortBy) {
      case "count-desc":
        return (b.count || 0) - (a.count || 0);
      case "count-asc":
        return (a.count || 0) - (b.count || 0);
      case "score-desc":
        return (b.avg_score || 0) - (a.avg_score || 0);
      case "score-asc":
        return (a.avg_score || 0) - (b.avg_score || 0);
      case "name":
        return (a.name || '').localeCompare(b.name || '');
      case "category":
        return (a.category || '').localeCompare(b.category || '');
      default:
        return (b.count || 0) - (a.count || 0);
    }
  });
  
  tbody.innerHTML = "";
  
  if (filteredFindings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">No findings match the current filters.</td></tr>';
    return;
  }
  
  filteredFindings.forEach((finding) => {
    // Safe destructuring with defaults
    const {
      toolType = 'unknown',
      category = 'unknown', 
      name = 'unknown',
      count = 0,
      description = '',
      avg_score = 0,
      severity = 'medium',
      inLatest = false
    } = finding;
    
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    const key = `${toolType}|${category}|${name}`;
    const isAccepted = acceptedSet.has(key);

    // Build cells with data-col so DnD reorders by key, not by current index
    const cells = [
      { key: 'tool', html: `<span class="tool-badge tool-${toolType}">${toolType.toUpperCase()}</span>` },
      { key: 'category', html: category || 'N/A' },
      { key: 'name', html: name || 'N/A' },
      { key: 'count', html: count || 0 },
      { key: 'avg_score', html: avg_score || 0 },
      { key: 'severity', html: `<span class="severity-badge severity-${severity || 'medium'}">${(severity || 'medium').toUpperCase()}</span>` },
      { key: 'inLatest', html: inLatest ? 'Yes' : 'No' },
      { key: 'accepted', html: `<label class="switch"><input type="checkbox" data-tool="${toolType}" data-cat="${category}" data-name="${name}" ${isAccepted ? "checked" : ""}><span class="slider"></span></label>` },
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
      await updateAcceptedRisk(toolType, category, name, isChecked);
      if(isChecked) {
        acceptedSet.add(key);
      } else {
        acceptedSet.delete(key);
      }
      const modalToggle = document.getElementById("risk-modal-accept-toggle");
      if (modalToggle.dataset.tool === toolType && modalToggle.dataset.cat === category && modalToggle.dataset.name === name) {
        modalToggle.checked = isChecked;
      }
    });
  });
}

function showRiskModal(finding, isAccepted) {
  const toolType = finding.toolType || 'unknown';
  const category = finding.category || 'unknown';
  const name = finding.name || 'unknown';
  const description = finding.description || 'No description available';
  const severity = finding.severity || 'medium';
  
  const modal = document.getElementById("risk-modal");
  if (!modal) {
    console.error("Risk modal not found");
    return;
  }
  
  const titleEl = document.getElementById("risk-modal-title");
  const toolEl = document.getElementById("risk-modal-tool");
  const categoryEl = document.getElementById("risk-modal-category");
  const severityEl = document.getElementById("risk-modal-severity");
  const descriptionEl = document.getElementById("risk-modal-description");
  
  if (titleEl) titleEl.textContent = name;
  if (toolEl) toolEl.innerHTML = `<span class="tool-badge tool-${toolType}">${toolType.toUpperCase()}</span>`;
  if (categoryEl) categoryEl.textContent = category;
  if (severityEl) severityEl.innerHTML = `<span class="severity-badge severity-${severity}">${severity.toUpperCase()}</span>`;
  if (descriptionEl) descriptionEl.textContent = description;

  const toggle = document.getElementById("risk-modal-accept-toggle");
  if (toggle) {
    toggle.checked = isAccepted;
    toggle.dataset.tool = toolType;
    toggle.dataset.cat = category;
    toggle.dataset.name = name;
  }

  modal.classList.remove("hidden");

  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.onclick = () => modal.classList.add("hidden");
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.classList.add("hidden");
    }
  };

  const modalToggle = document.getElementById("risk-modal-accept-toggle");
  if (modalToggle) {
    modalToggle.onchange = async () => {
        await updateAcceptedRisk(toolType, category, name, modalToggle.checked);
        const mainToggle = document.querySelector(`#recurring-table input[data-tool="${toolType}"][data-cat="${category}"][data-name="${name}"]`);
        if(mainToggle){
          mainToggle.checked = modalToggle.checked;
        }
    };
  }
}

async function updateAcceptedRisk(toolType, category, name, isAccepted) {
    const payload = JSON.stringify({ 
        tool_type: toolType, 
        category, 
        name,
        reason: isAccepted ? "Accepted via dashboard" : null,
        accepted_by: "dashboard_user"
    });
    const method = isAccepted ? "POST" : "DELETE";
    await fetch("/api/accepted_risks", {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: payload
    });
}
