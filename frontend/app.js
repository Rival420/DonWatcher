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
    fileInput.files = e.dataTransfer.files;
    uploadFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => uploadFile(fileInput.files[0]));

  async function uploadFile(file) {
    statusDiv.textContent = "Uploading…";
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        statusDiv.textContent = "✓ Uploaded: " + data.report_id;
        statusDiv.style.color = "green";
        loadReports();
      } else {
        statusDiv.textContent = "✗ Error: " + (data.detail || res.statusText);
        statusDiv.style.color = "red";
      }
    } catch {
      statusDiv.textContent = "✗ Network error";
      statusDiv.style.color = "red";
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
  const res = await fetch("/api/reports");
  const reports = await res.json();
  const tbody = document.querySelector("#reports-table tbody");
  tbody.innerHTML = "";
  reports.forEach(r => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    [
      r.domain,
      new Date(r.report_date).toLocaleDateString(),
      r.global_score,
      r.stale_objects_score,
      r.privileged_accounts_score,
      r.trusts_score,
      r.anomalies_score,
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
}

async function showDetails(id) {
  const res = await fetch(`/api/reports/${id}`);
  const report = await res.json();
  window.currentReport = report;
  document.getElementById("sort-select").value = 'category';
  renderFindings(report, 'category');
  const openBtn = document.getElementById('open-report-btn');
  if (openBtn) {
    if (report.original_file && report.original_file.toLowerCase().endsWith('.html')) {
      const fileName = report.original_file.split(/[/\\\\]/).pop();
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
      <td>${f.description}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportCSV() {
  fetch("/api/reports")
    .then(r => r.json())
    .then(reports => {
      const headers = ["domain","report_date","global_score","stale_objects_score","privileged_accounts_score","trusts_score","anomalies_score"];
      
      const escapeCsv = (val) => {
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const lines = [headers.join(",")];
      reports.forEach(r => {
        lines.push(headers.map(h => escapeCsv(r[h])).join(","));
      });

      const blob = new Blob([lines.join("\n")], {type:"text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "donwatch_reports.csv";
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
