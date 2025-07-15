document.addEventListener("DOMContentLoaded", () => {
  loadReports();
  setupUpload();
  setupGlobalSearch();

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
  const res = await fetch("/reports");
  const reports = await res.json();
    // Sort by report_date ascending
  reports.sort((a, b) => 
    new Date(a.report_date) - new Date(b.report_date)
  );
  const tbody = document.querySelector("#reports-table tbody");
  tbody.innerHTML = "";
  reports.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.domain}</td>
      <td>${new Date(r.report_date).toLocaleDateString()}</td>
      <td>${r.global_score}</td>
      <td>${r.stale_objects_score}</td>
      <td>${r.privileged_accounts_score}</td>
      <td>${r.trusts_score}</td>
      <td>${r.anomalies_score}</td>
      <td>
        <button class="icon-btn" data-id="${r.id}" title="Details">
          <i class="fas fa-search"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".icon-btn[data-id]").forEach(btn => {
    btn.addEventListener("click", () => showDetails(btn.dataset.id, reports));
  });
}

function showDetails(id, reports) {
  const report = reports.find(r => r.id === id);
  window.currentReport = report;
  document.getElementById("sort-select").value = 'category';
  renderFindings(report, 'category');
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
  fetch("/reports")
    .then(r => r.json())
    .then(reports => {
      const headers = ["domain","report_date","global_score","stale_objects_score","privileged_accounts_score","trusts_score","anomalies_score"];
      const lines = [headers.join(",")];
      reports.forEach(r => {
        lines.push(headers.map(h => `"${r[h]}"`).join(","));
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
