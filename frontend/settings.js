document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("settings-form");
    const webhook = document.getElementById("webhook");
    const message = document.getElementById("message");
    const logBody = document.querySelector("#log-table tbody");
    const copyBtn = document.getElementById("copy-webhook");
    const clearDatabaseBtn = document.getElementById("clear-database-btn");
    const downloadWebserverLogsBtn = document.getElementById("download-webserver-logs");
    const downloadBackendLogsBtn = document.getElementById("download-backend-logs");
    const downloadWebhookLogsBtn = document.getElementById("download-webhook-logs");

    function switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-link').forEach(link => {
            link.classList.remove('active');
        });

        document.getElementById(tabId).classList.add('active');
        document.querySelector(`.tab-link[data-tab="${tabId}"]`).classList.add('active');
    }

    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

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

    copyBtn.addEventListener("click", async () => {
        if (webhook.value) {
            try {
                await navigator.clipboard.writeText(webhook.value);
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.style.background = 'var(--blue)';
                copyBtn.style.color = '#fff';

                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.style.background = '';
                    copyBtn.style.color = '';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
                alert('Failed to copy to clipboard');
            }
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webhook_url: webhook.value, alert_message: message.value })
        });
        alert("Settings saved!");
    });

    clearDatabaseBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to permanently clear the entire database? This action cannot be undone.")) {
            // Placeholder for backend call
            alert("Database cleared (not really, this is a placeholder)!");
        }
    });
    
    downloadWebserverLogsBtn.addEventListener('click', () => {
        alert("Downloading webserver logs (not really, this is a placeholder)!");
    });
    
    downloadBackendLogsBtn.addEventListener('click', () => {
        alert("Downloading backend logs (not really, this is a placeholder)!");
    });
    
    downloadWebhookLogsBtn.addEventListener('click', () => {
        alert("Downloading webhook logs (not really, this is a placeholder)!");
    });

    load();
    switchTab('general-settings');
});
