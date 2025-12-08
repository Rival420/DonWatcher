import { createChart } from './chartManager.js';

export async function showAnalysis() {
  try {
    console.log("Loading analysis data...");
    
    const [scores, freq, accepted] = await Promise.all([
      fetch("/analysis/scores").then(r => {
        if (!r.ok) throw new Error(`Scores API error: ${r.status}`);
        return r.json();
      }),
      fetch("/analysis/frequency?tool_type=pingcastle").then(r => {
        if (!r.ok) throw new Error(`Frequency API error: ${r.status}`);
        return r.json();
      }),
      fetch("/api/accepted_risks?tool_type=pingcastle").then(r => {
        if (!r.ok) throw new Error(`Accepted risks API error: ${r.status}`);
        return r.json();
      }),
    ]);
    
    console.log("Analysis data loaded:", { scores, freq, accepted });
    console.log("Frequency data details:", freq);
    console.log("Number of findings:", freq ? freq.length : 0);
    
    renderChart(scores);
    renderRecurring(freq, accepted);
    loadDomainScannerData(accepted);
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

  // Setup tab switching
  setupTabs();

  document.getElementById("findings-filter").addEventListener("input", renderFilteredFindings);
  document.getElementById("category-filter").addEventListener("change", renderFilteredFindings);
  document.getElementById("tool-filter").addEventListener("change", renderFilteredFindings);
  document.getElementById("acceptance-filter").addEventListener("change", renderFilteredFindings);
  const latestToggle = document.getElementById("latest-only-toggle");
  if (latestToggle) latestToggle.addEventListener("change", renderFilteredFindings);
  document.getElementById("sort-findings").addEventListener("change", renderFilteredFindings);
});

function setupTabs() {
  document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-link').forEach(link => {
    link.classList.remove('active');
  });

  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.tab-link[data-tab="${tabId}"]`).classList.add('active');
  
  // Load domain scanner data when switching to that tab
  if (tabId === 'domain-scanner') {
    loadDomainScannerAnalysis();
  }
}

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
  console.log("Sample findings:", allFindings.slice(0, 3));
  
  // Check if table exists
  const table = document.querySelector("#recurring-table");
  if (!table) {
    console.error("Recurring table not found!");
    return;
  }
  
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
    console.log("No findings data available");
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">No recurring findings found. Upload some PingCastle reports to see analysis.</td></tr>';
    return;
  }
  
  console.log("Total findings before filtering:", allFindings.length);
  
  console.log("Processing", allFindings.length, "findings");
  
  const acceptedSet = new Set(acceptedRisks.map(r => `${r.tool_type}|${r.category}|${r.name}`));
  
  let filteredFindings = allFindings.filter(finding => {
    // Safe property access with fallbacks
    const name = finding.name || '';
    const description = finding.description || '';
    const category = finding.category || '';
    const toolType = finding.toolType || '';
    
    // No need to exclude DonScanner findings since we're filtering at API level
    
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
  
  console.log("Filtered findings count:", filteredFindings.length);
  console.log("First few filtered findings:", filteredFindings.slice(0, 2));
  console.log("Filter values:", { filterText, categoryFilter, toolFilter, acceptanceFilter, latestOnly });
  
  if (filteredFindings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">No findings match the current filters. Total available: ' + allFindings.length + '</td></tr>';
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

// Domain Scanner functionality
async function loadDomainScannerData(acceptedRisks) {
  try {
    console.log("Loading domain scanner data...");
    
    // Get all domain analysis reports
    const response = await fetch("/api/reports?tool_type=domain_analysis");
    if (!response.ok) {
      throw new Error(`Domain scanner API error: ${response.status}`);
    }
    
    const reports = await response.json();
    console.log("Domain scanner reports loaded:", reports.length);
    
    // Extract group membership data from the latest report
    if (reports.length > 0) {
      const latestReport = reports[reports.length - 1];
      const reportDetails = await fetch(`/api/reports/${latestReport.id}`);
      if (reportDetails.ok) {
        const report = await reportDetails.json();
        renderGroupMemberships(report, acceptedRisks);
      }
    } else {
      // Show empty state
      const tbody = document.querySelector("#group-members-table tbody");
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">No domain scanner data found. Upload a domain analysis report to see group memberships.</td></tr>';
      }
    }
  } catch (error) {
    console.error("Failed to load domain scanner data:", error);
    const tbody = document.querySelector("#group-members-table tbody");
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #f44336;">Error loading domain scanner data. Check console for details.</td></tr>';
    }
  }
}

function renderGroupMemberships(report, acceptedRisks) {
  const tbody = document.querySelector("#group-members-table tbody");
  const groupFilter = document.getElementById("group-name-filter");
  
  if (!tbody || !report.findings) return;
  
  // Clear and populate group filter
  groupFilter.innerHTML = '<option value="">All Groups</option>';
  const groups = new Set();
  
  // Extract all group memberships from DonScanner findings
  const groupMemberships = [];
  
  report.findings.forEach(finding => {
    if (finding.category === "DonScanner" && finding.metadata && finding.metadata.members) {
      const groupName = finding.metadata.group_name;
      groups.add(groupName);
      
      finding.metadata.members.forEach(member => {
        groupMemberships.push({
          group: groupName,
          member: member.name,
          type: member.type,
          sid: member.sid,
          enabled: member.enabled,
          finding: finding
        });
      });
    }
  });
  
  // Populate group filter dropdown
  [...groups].sort().forEach(group => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    groupFilter.appendChild(option);
  });
  
  // Render memberships table
  renderFilteredGroupMemberships(groupMemberships, acceptedRisks);
  
  // Setup event listeners for domain scanner filters
  document.getElementById("group-filter").addEventListener("input", () => {
    renderFilteredGroupMemberships(groupMemberships, acceptedRisks);
  });
  document.getElementById("group-name-filter").addEventListener("change", () => {
    renderFilteredGroupMemberships(groupMemberships, acceptedRisks);
  });
  document.getElementById("member-acceptance-filter").addEventListener("change", () => {
    renderFilteredGroupMemberships(groupMemberships, acceptedRisks);
  });
}

function renderFilteredGroupMemberships(memberships, acceptedRisks) {
  const tbody = document.querySelector("#group-members-table tbody");
  if (!tbody) return;
  
  // Get filter values
  const textFilter = (document.getElementById("group-filter")?.value || "").toLowerCase();
  const groupFilter = document.getElementById("group-name-filter")?.value || "";
  const acceptanceFilter = document.getElementById("member-acceptance-filter")?.value || "";
  
  // Create accepted risks set for DonScanner findings
  const acceptedSet = new Set(
    acceptedRisks
      .filter(r => r.tool_type === 'domain_analysis')
      .map(r => `${r.category}|${r.name}`)
  );
  
  // Filter memberships
  let filtered = memberships.filter(m => {
    const matchesText = textFilter === "" || 
                       m.group.toLowerCase().includes(textFilter) ||
                       m.member.toLowerCase().includes(textFilter);
    const matchesGroup = groupFilter === "" || m.group === groupFilter;
    
    const memberKey = `DonScanner|Group_${m.group.replace(' ', '_')}_Member_${m.member.replace(' ', '_')}`;
    const isAccepted = acceptedSet.has(memberKey);
    const matchesAcceptance = acceptanceFilter === "" ||
                             (acceptanceFilter === "accepted" && isAccepted) ||
                             (acceptanceFilter === "unaccepted" && !isAccepted);
    
    return matchesText && matchesGroup && matchesAcceptance;
  });
  
  // Clear table
  tbody.innerHTML = "";
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">No memberships match the current filters.</td></tr>';
    return;
  }
  
  // Render filtered memberships
  filtered.forEach(membership => {
    const memberKey = `DonScanner|Group_${membership.group.replace(' ', '_')}_Member_${membership.member.replace(' ', '_')}`;
    const isAccepted = acceptedSet.has(memberKey);
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${membership.group}</strong></td>
      <td>
        ${membership.member}
        ${!membership.enabled ? '<span style="color: var(--orange); margin-left: 5px;">(Disabled)</span>' : ''}
      </td>
      <td><span class="member-type-badge type-${membership.type}">${membership.type.toUpperCase()}</span></td>
      <td><code style="font-size: 0.8em;">${membership.sid}</code></td>
      <td>
        <label class="switch">
          <input type="checkbox" 
                 data-tool="domain_analysis" 
                 data-cat="DonScanner" 
                 data-name="Group_${membership.group.replace(' ', '_')}_Member_${membership.member.replace(' ', '_')}"
                 ${isAccepted ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </td>
    `;
    
    // Add click handler for the switch
    const toggle = tr.querySelector(".switch input");
    toggle.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      const toolType = e.target.dataset.tool;
      const category = e.target.dataset.cat;
      const name = e.target.dataset.name;
      
      try {
        await updateAcceptedRisk(toolType, category, name, isChecked);
        console.log(`Updated accepted risk: ${name} = ${isChecked}`);
      } catch (error) {
        console.error("Failed to update accepted risk:", error);
        e.target.checked = !isChecked; // Revert on error
      }
    });
    
    tbody.appendChild(tr);
  });
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


async function loadDomainScannerAnalysis() {
  try {
    console.log("Loading domain scanner analysis data...");
    
    // Get domain analysis reports and accepted members in parallel
    const [reportsRes, acceptedMembersRes] = await Promise.all([
      fetch('/api/reports?tool_type=domain_analysis'),
      fetch('/api/accepted_group_members')
    ]);
    
    const reports = await reportsRes.json();
    const acceptedMembers = await acceptedMembersRes.json();
    
    if (!reports || reports.length === 0) {
      renderDomainScannerTable([]);
      return;
    }
    
    // Create a set of accepted members for quick lookup
    const acceptedSet = new Set(
      acceptedMembers.map(m => `${m.group_name}|${m.member_name}`)
    );
    
    // Get detailed data for all reports
    const detailedReports = await Promise.all(
      reports.map(async (report) => {
        const detailRes = await fetch(`/api/reports/${report.id}`);
        return detailRes.json();
      })
    );
    
    // Extract individual member data from all reports
    const memberData = [];
    detailedReports.forEach(report => {
      if (report.findings) {
        report.findings.forEach(finding => {
          if (finding.category === 'DonScanner' && finding.name.startsWith('Group_')) {
            const groupName = finding.metadata?.group_name || 'Unknown Group';
            const groupScore = finding.score || 0;
            const members = finding.metadata?.members || [];
            
            // Create one row per member
            members.forEach(member => {
              const memberName = typeof member === 'string' ? member : (member.name || 'Unknown');
              const memberKey = `${groupName}|${memberName}`;
              
              memberData.push({
                reportId: report.id,
                reportDate: new Date(report.report_date),
                groupName: groupName,
                groupScore: groupScore,
                memberName: memberName,
                memberType: typeof member === 'string' ? 'user' : (member.type || 'user'),
                memberEnabled: typeof member === 'string' ? true : (member.enabled !== false),
                memberSid: typeof member === 'string' ? '' : (member.sid || ''),
                isAccepted: acceptedSet.has(memberKey),
                description: finding.description || '',
                recommendation: finding.recommendation || ''
              });
            });
          }
        });
      }
    });
    
    renderDomainScannerTable(memberData);
    setupDomainScannerFilters(memberData);
    
  } catch (error) {
    console.error('Failed to load domain scanner analysis:', error);
    renderDomainScannerTable([]);
  }
}

function renderDomainScannerTable(memberData) {
  const tbody = document.querySelector('#domain-scanner-table tbody');
  if (!tbody) return;
  
  if (!memberData || memberData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #999;">No domain scanner data available</td></tr>';
    return;
  }
  
  // Sort by report date (newest first), then by group name, then by member name
  memberData.sort((a, b) => {
    if (b.reportDate.getTime() !== a.reportDate.getTime()) {
      return b.reportDate - a.reportDate;
    }
    if (a.groupName !== b.groupName) {
      return a.groupName.localeCompare(b.groupName);
    }
    return a.memberName.localeCompare(b.memberName);
  });
  
  tbody.innerHTML = memberData.map(member => `
    <tr class="member-row" data-group="${member.groupName}" data-member="${member.memberName}">
      <td>${member.reportDate.toLocaleDateString()}</td>
      <td>
        <div class="group-name-cell">${member.groupName}</div>
      </td>
      <td>
        <div class="member-name-cell">${member.memberName}</div>
      </td>
      <td>
        <span class="member-type-badge ${member.memberType}">${member.memberType.toUpperCase()}</span>
      </td>
      <td>
        <span class="enabled-badge ${member.memberEnabled ? 'enabled' : 'disabled'}">
          ${member.memberEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </td>
      <td>
        <span class="risk-score-badge">${member.groupScore}</span>
      </td>
      <td>
        <span class="risk-status ${member.isAccepted ? 'accepted' : 'unaccepted'}">
          ${member.isAccepted ? 'Accepted' : 'Unaccepted'}
        </span>
      </td>
      <td>
        <button class="accept-btn ${member.isAccepted ? 'accepted' : ''}" 
                onclick="toggleMemberAcceptance('${member.groupName}', '${member.memberName}', ${!member.isAccepted})"
                title="${member.isAccepted ? 'Remove acceptance' : 'Accept this member'}">
          <i class="fas fa-${member.isAccepted ? 'times' : 'check'}"></i>
          ${member.isAccepted ? 'Unaccept' : 'Accept'}
        </button>
        <button class="info-btn" onclick="showMemberInfo('${member.groupName}', '${member.memberName}', '${member.memberSid}', '${member.description}')">
          <i class="fas fa-info-circle"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function setupDomainScannerFilters(memberData) {
  // Populate group filter
  const groupFilter = document.getElementById('scanner-group-filter');
  if (groupFilter) {
    const uniqueGroups = [...new Set(memberData.map(m => m.groupName))].sort();
    groupFilter.innerHTML = '<option value="">All Groups</option>' +
      uniqueGroups.map(group => `<option value="${group}">${group}</option>`).join('');
  }
  
  // Add filter event listeners
  const filterElements = [
    'domain-scanner-filter',
    'scanner-group-filter', 
    'scanner-severity-filter',
    'scanner-report-filter'
  ];
  
  filterElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', () => filterDomainScannerTable(memberData));
      element.addEventListener('change', () => filterDomainScannerTable(memberData));
    }
  });
}

function filterDomainScannerTable(allData) {
  const searchTerm = document.getElementById('domain-scanner-filter')?.value.toLowerCase() || '';
  const groupFilter = document.getElementById('scanner-group-filter')?.value || '';
  const reportFilter = document.getElementById('scanner-report-filter')?.value || 'latest';
  
  let filteredData = allData.filter(member => {
    const matchesSearch = !searchTerm || 
      member.groupName.toLowerCase().includes(searchTerm) ||
      member.memberName.toLowerCase().includes(searchTerm);
    
    const matchesGroup = !groupFilter || member.groupName === groupFilter;
    
    return matchesSearch && matchesGroup;
  });
  
  // Handle report filter
  if (reportFilter === 'latest') {
    const latestDate = Math.max(...filteredData.map(m => m.reportDate.getTime()));
    filteredData = filteredData.filter(m => m.reportDate.getTime() === latestDate);
  }
  
  renderDomainScannerTable(filteredData);
}

// Helper function to get current domain from reports
async function getCurrentDomainFromReports() {
  try {
    const response = await fetch('/api/reports?tool_type=domain_analysis');
    const reports = await response.json();
    if (reports && reports.length > 0) {
      // Get the most recent domain analysis report's domain
      const latestReport = reports[reports.length - 1];
      return latestReport.domain;
    }
  } catch (error) {
    console.error('Failed to get current domain from reports:', error);
  }
  return null;
}

// Global functions for button clicks
window.showGroupMembers = function(groupName, members) {
  const memberList = members.map(m => 
    typeof m === 'string' ? m : `${m.name || 'Unknown'} (${m.type || 'user'})`
  ).join('\n');
  
  alert(`${groupName} Members:\n\n${memberList}`);
};

window.showGroupInfo = function(groupName, description, recommendation) {
  alert(`${groupName}\n\nDescription: ${description}\n\nRecommendation: ${recommendation}`);
};

window.toggleMemberAcceptance = async function(groupName, memberName, accept) {
  try {
    const action = accept ? 'accept' : 'unaccept';
    console.log(`${action}ing member ${memberName} in group ${groupName}`);
    
    const confirmed = confirm(`${accept ? 'Accept' : 'Remove acceptance for'} ${memberName} in ${groupName}?`);
    
    if (confirmed) {
      // Get current domain from latest reports or use fallback
      const currentDomain = await getCurrentDomainFromReports() || 'onenet.be';
      
      const memberData = {
        group_name: groupName,
        member_name: memberName,
        domain: currentDomain,
        reason: accept ? 'Accepted via domain scanner analysis' : null,
        accepted_by: 'dashboard_user'
      };
      
      const method = accept ? 'POST' : 'DELETE';
      // FIXED: Use standardized domain groups API endpoint
      const response = await fetch('/api/domain_groups/members/accept', {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memberData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`Member ${memberName} ${accept ? 'accepted' : 'unaccepted'} successfully`);
        
        // Check for risk calculation status if available
        if (result.risk_calculation_status === 'failed') {
          console.warn('Risk scores may not have been updated');
        }
        
        // Reload the table to reflect changes
        loadDomainScannerAnalysis();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API call failed: ${response.status}`);
      }
    }
  } catch (error) {
    console.error('Failed to toggle member acceptance:', error);
    alert(`Failed to update member acceptance: ${error.message}`);
  }
};

window.showMemberInfo = function(groupName, memberName, memberSid, description) {
  alert(`Member Information:\n\nName: ${memberName}\nGroup: ${groupName}\nSID: ${memberSid}\nDescription: ${description}`);
};
