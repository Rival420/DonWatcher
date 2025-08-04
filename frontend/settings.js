document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settings-form");
  const webhook = document.getElementById("webhook");
  const message = document.getElementById("message");
  const logBody = document.querySelector("#log-table tbody");
  const testBtn = document.getElementById("test-btn");

  async function load() {
    const [settings, log] = await Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/alerts/log").then(r => r.json()),
    ]);
    webhook.value = settings.webhook_url || "";
    message.value = settings.alert_message || "";
    logBody.innerHTML = "";
    log.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${new Date(entry.timestamp).toLocaleString()}</td><td>${entry.message}</td>`;
      logBody.appendChild(tr);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await fetch("/api/settings", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({webhook_url: webhook.value, alert_message: message.value})
    });
    alert("Settings saved!");
  });

  testBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({webhook_url: webhook.value, alert_message: message.value})
      });
      const data = await res.json();
      if (res.ok) {
        alert("Test webhook sent successfully!");
      } else {
        alert(`Error: ${data.detail}`);
      }
    } catch (err) {
      alert(`Network error: ${err}`);
    }
    load(); // Refresh log
  });

  load();
});
