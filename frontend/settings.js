document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settings-form");
  const webhook = document.getElementById("webhook");
  const message = document.getElementById("message");
  const logBody = document.querySelector("#log-table tbody");

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
  });

  load();
});
