document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("settings-form");
    const webhook = document.getElementById("webhook");
    const message = document.getElementById("message");
    const logBody = document.querySelector("#log-table tbody");
    const copyBtn = document.getElementById("copy-webhook");
    const testAlertBtn = document.getElementById("test-alert-btn");
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
    
    testAlertBtn.addEventListener("click", async () => {
        const response = await fetch("/api/settings/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webhook_url: webhook.value, alert_message: message.value })
        });
        const result = await response.json();
        if(response.ok) {
            alert("Test alert sent successfully!");
        } else {
            alert(`Error: ${result.detail}`);
        }
    });

    clearDatabaseBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to permanently clear the entire database? This action cannot be undone.")) {
            const response = await fetch("/api/database/clear", { method: "POST" });
            const result = await response.text();
            alert(result);
            location.reload();
        }
    });
    
    async function triggerLogDownload(url, filename, buttonElement) {
        try {
            // Show loading state
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            buttonElement.disabled = true;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up the URL object
            window.URL.revokeObjectURL(downloadUrl);
            
            // Show success state
            buttonElement.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
            buttonElement.style.background = 'var(--green)';
            buttonElement.style.color = '#fff';
            
            setTimeout(() => {
                buttonElement.innerHTML = originalText;
                buttonElement.style.background = '';
                buttonElement.style.color = '';
                buttonElement.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Download failed:', error);
            alert(`Failed to download ${filename}: ${error.message}`);
            
            // Reset button state
            buttonElement.innerHTML = originalText;
            buttonElement.disabled = false;
        }
    }
    
    downloadWebserverLogsBtn.addEventListener('click', () => {
        triggerLogDownload('/api/logs/webserver', 'webserver.log', downloadWebserverLogsBtn);
    });
    
    downloadBackendLogsBtn.addEventListener('click', () => {
        triggerLogDownload('/api/logs/backend', 'backend.log', downloadBackendLogsBtn);
    });
    
    downloadWebhookLogsBtn.addEventListener('click', () => {
        triggerLogDownload('/api/logs/webhook', 'webhook.log', downloadWebhookLogsBtn);
    });

    load();
    switchTab('general-settings');
});
