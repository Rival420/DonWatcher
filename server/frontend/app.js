document.addEventListener("DOMContentLoaded", () => {
  loadReports();
  setupUpload();
  setupGlobalSearch();
  enableColumnDragAndDrop('#reports-table');

  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("modal").classList.add("hidden");
  });

  document.getElementById("sort-select").addEventListener("change", () => {
    if (window.currentReport) {
      renderFindings(window.currentReport, document.getElementById("sort-select").value);
    }
  });

  document.getElementById("export-btn").addEventListener("click", exportCSV);
});

function setupUpload() {
  const dz = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const statusDiv = document.getElementById("upload-status");
  const progressDiv = document.getElementById("upload-progress");

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", e => {
    e.preventDefault();
    dz.classList.add("dragover");
  });
  dz.addEventListener("dragleave", e => {
    e.preventDefault();
    dz.classList.remove("dragover");
  });
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("dragover");
    handleFileSelection(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => handleFileSelection(fileInput.files));

  async function handleFileSelection(files) {
    if (files.length === 0) return;
    
    if (files.length === 1) {
      await uploadSingleFile(files[0]);
    } else {
      await uploadMultipleFiles(files);
    }
  }

  async function uploadSingleFile(file) {
    statusDiv.textContent = "Uploading…";
    statusDiv.style.color = "#888";
    const form = new FormData();
    form.append("file", file);
    
    try {
      const res = await fetch("/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        const displayId = data.report_id || data.attached_to || '';
        statusDiv.textContent = `✓ Uploaded ${file.name}` + (displayId ? ` (ID: ${displayId})` : "");
        statusDiv.style.color = "green";
        loadReports();
      } else {
        statusDiv.textContent = `✗ Error uploading ${file.name}: ` + (data.detail || res.statusText);
        statusDiv.style.color = "red";
      }
    } catch (e) {
      statusDiv.textContent = `✗ Network error uploading ${file.name}`;
      statusDiv.style.color = "red";
    }
  }

  async function uploadMultipleFiles(files) {
    progressDiv.style.display = "block";
    statusDiv.textContent = `Uploading ${files.length} files...`;
    statusDiv.style.color = "#888";
    
    const form = new FormData();
    for (let file of files) {
      form.append("files", file);
    }
    
    try {
      const res = await fetch("/upload/multiple", { method: "POST", body: form });
      const data = await res.json();
      
      if (res.ok) {
        const results = data.results;
        const successful = results.filter(r => r.status === "success").length;
        const failed = results.filter(r => r.status === "error").length;
        
        let message = `✓ Uploaded ${successful}/${files.length} files`;
        if (failed > 0) {
          message += ` (${failed} failed)`;
        }
        
        statusDiv.innerHTML = message;
        if (failed > 0) {
          statusDiv.innerHTML += "<br><small>" + 
            results.filter(r => r.status === "error")
                   .map(r => `${r.filename}: ${r.error}`)
                   .join("<br>") + "</small>";
          statusDiv.style.color = "#ff9800";
        } else {
          statusDiv.style.color = "green";
        }
        
        loadReports();
      } else {
        statusDiv.textContent = "✗ Error: " + (data.detail || res.statusText);
        statusDiv.style.color = "red";
      }
    } catch (e) {
      statusDiv.textContent = "✗ Network error during multi-file upload";
      statusDiv.style.color = "red";
    } finally {
      progressDiv.style.display = "none";
    }
  }
}

function setupGlobalSearch() {
  const gs = document.getElementById("global-search");
  gs.addEventListener("input", () => {
    const filter = gs.value.toLowerCase();
    document.querySelectorAll("#reports-table tbody tr").forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(filter) ? "" : "none";
    });
  });
}

async function loadReports() {
  try {
    const res = await fetch("/api/reports?tool_type=pingcastle");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const reports = await res.json();
    console.log("Loaded PingCastle reports:", reports); // Debug log
    
    const tbody = document.querySelector("#reports-table tbody");
    tbody.innerHTML = "";
    
    if (reports.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="8" style="text-align: center; color: #888;">No reports found. Upload some security reports to get started.</td>';
      tbody.appendChild(tr);
      return;
    }
    
    reports.forEach(r => {
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;
      
      // Tool type badge
      const toolTd = document.createElement("td");
      const toolBadge = document.createElement("span");
      toolBadge.className = `tool-badge tool-${r.tool_type}`;
      toolBadge.textContent = r.tool_type.toUpperCase();
      toolTd.appendChild(toolBadge);
      tr.appendChild(toolTd);
      
      // Other columns - PingCastle specific
      [
        r.domain || 'Unknown',
        new Date(r.report_date).toLocaleDateString(),
        r.global_score || 0,
        r.stale_objects_score || 0,
        r.privileged_accounts_score || 0,
        r.trusts_score || 0,
        r.anomalies_score || 0,
      ].forEach(text => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    
    tbody.querySelectorAll("tr[data-id]").forEach(tr => {
      tr.addEventListener("click", () => showDetails(tr.dataset.id));
    });
  } catch (error) {
    console.error("Failed to load reports:", error);
    const tbody = document.querySelector("#reports-table tbody");
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #f44336;">Error loading reports. Please check the console for details.</td></tr>';
  }
}

async function showDetails(id) {
  const res = await fetch(`/api/reports/${id}`);
  const report = await res.json();
  window.currentReport = report;
  document.getElementById("sort-select").value = 'category';
  renderFindings(report, 'category');
  const openBtn = document.getElementById('open-report-btn');
  if (openBtn) {
    if (report.html_file) {
      const fileName = report.html_file.split(/[/\\\\]/).pop();
      const url = `/uploads/${fileName}`;
      openBtn.onclick = () => window.open(url, '_blank');
      openBtn.disabled = false;
    } else {
      openBtn.onclick = null;
      openBtn.disabled = true;
    }
  }
  document.getElementById("modal").classList.remove("hidden");
}

function renderFindings(report, sortKey) {
  let arr = [...report.findings];
  switch (sortKey) {
    case 'score_desc':
      arr.sort((a,b) => b.score - a.score); break;
    case 'score_asc':
      arr.sort((a,b) => a.score - b.score); break;
    case 'name':
      arr.sort((a,b) => a.name.localeCompare(b.name)); break;
    case 'severity':
      arr.sort((a,b) => getSeverityOrder(b.severity) - getSeverityOrder(a.severity)); break;
    default: 
      arr.sort((a,b) => a.category.localeCompare(b.category));
  }
  const tbody = document.querySelector("#findings-table tbody");
  tbody.innerHTML = "";
  arr.forEach(f => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.category}</td>
      <td>${f.name}</td>
      <td>${f.score}</td>
      <td><span class="severity-badge severity-${f.severity}">${f.severity.toUpperCase()}</span></td>
      <td>${f.description}</td>
      <td>${f.recommendation || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function getSeverityOrder(severity) {
  const order = { 'high': 3, 'medium': 2, 'low': 1 };
  return order[severity] || 0;
}

function exportCSV() {
  fetch("/api/reports")
    .then(r => r.json())
    .then(reports => {
      const headers = ["tool_type","domain","report_date","total_findings","high_severity_findings","medium_severity_findings","low_severity_findings"];
      
      const escapeCsv = (val) => {
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const lines = [headers.join(",")];
      reports.forEach(r => {
        const row = [
          r.tool_type,
          r.domain,
          r.report_date,
          r.total_findings || 0,
          r.high_severity_findings || 0,
          r.medium_severity_findings || 0,
          r.low_severity_findings || 0
        ];
        lines.push(row.map(val => escapeCsv(val)).join(","));
      });

      const blob = new Blob([lines.join("\n")], {type:"text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "donwatcher_reports.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
}

// Column drag-and-drop (Reports table)
function enableColumnDragAndDrop(tableSelector) {
  const table = document.querySelector(tableSelector);
  if (!table) return;

  const headerCells = Array.from(table.querySelectorAll('thead th'));
  headerCells.forEach((th, index) => {
    th.draggable = true;
    th.dataset.colIndex = index;

    th.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
    });

    th.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    th.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;
      if (fromIndex === toIndex) return;
      moveTableColumn(table, fromIndex, toIndex);
    });
  });
}

function moveTableColumn(table, fromIndex, toIndex) {
  const rows = table.querySelectorAll('tr');
  rows.forEach((row) => {
    const cells = row.children;
    if (fromIndex >= cells.length || toIndex >= cells.length) return;
    const fromCell = cells[fromIndex];
    const toCell = cells[toIndex];
    if (fromIndex < toIndex) {
      toCell.after(fromCell);
    } else {
      toCell.before(fromCell);
    }
  });
}
