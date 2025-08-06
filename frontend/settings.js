document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("settings-form");
    const webhook = document.getElementById("webhook");
    const message = document.getElementById("message");
    const copyBtn = document.getElementById("copy-webhook");
    const testAlertBtn = document.getElementById("test-alert-btn");
    const clearDatabaseBtn = document.getElementById("clear-database-btn");
    const downloadBackendLogsBtn = document.getElementById("download-backend-logs");

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
        const settings = await fetch("/api/settings").then(r => r.json());
        webhook.value = settings.webhook_url || "";
        message.value = settings.alert_message || "";
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

    async function handleButtonFeedback(button, action) {
        const originalText = button.innerHTML;
        const loadingText = button.dataset.loadingText || 'Loading...';
        const successText = button.dataset.successText || 'Done!';

        try {
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
            button.disabled = true;

            const result = await action();

            button.innerHTML = `<i class="fas fa-check"></i> ${successText}`;
            button.style.background = 'var(--green)';
            button.style.color = '#fff';

            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
                button.style.color = '';
                button.disabled = false;
            }, 2000);

            return result;
        } catch (error) {
            alert(`Error: ${error.message}`);
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const saveBtn = form.querySelector('button[type="submit"]');
        await handleButtonFeedback(saveBtn, async () => {
            const response = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhook_url: webhook.value, alert_message: message.value })
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.detail || 'Failed to save settings');
            }
        });
    });
    
    testAlertBtn.addEventListener("click", async () => {
        await handleButtonFeedback(testAlertBtn, async () => {
            const response = await fetch("/api/settings/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhook_url: webhook.value, alert_message: message.value })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.detail || 'Failed to send test alert');
            }
        });
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
        const originalText = buttonElement.innerHTML;
        try {
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            buttonElement.disabled = true;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}: ${response.statusText}` }));
                throw new Error(errorData.detail);
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            window.URL.revokeObjectURL(downloadUrl);
            
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
            
            buttonElement.innerHTML = originalText;
            buttonElement.disabled = false;
        }
    }
    
    downloadBackendLogsBtn.addEventListener('click', () => {
        triggerLogDownload('/api/logs/backend', 'backend.log', downloadBackendLogsBtn);
    });

    load();
    switchTab('general-settings');
});
