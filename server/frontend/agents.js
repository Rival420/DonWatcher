// Agent Downloads Page JavaScript

class AgentDownloader {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateTimestamp();
    }

    setupEventListeners() {
        // Domain Scanner download
        document.getElementById('download-domain-scanner')?.addEventListener('click', () => {
            this.downloadFile('../client/DonWatcher-DomainScanner.ps1', 'DonWatcher-DomainScanner.ps1');
        });

        // Config template download
        document.getElementById('download-config-template')?.addEventListener('click', () => {
            this.downloadFile('../client/DonWatcher-Config.json', 'DonWatcher-Config.json');
        });
    }

    async downloadFile(filePath, filename) {
        try {
            // Show loading state
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            button.disabled = true;

            // Fetch the file
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;

            // Trigger download
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success message
            this.showNotification(`✅ ${filename} downloaded successfully!`, 'success');

        } catch (error) {
            console.error('Download failed:', error);
            this.showNotification(`❌ Failed to download ${filename}: ${error.message}`, 'error');
        } finally {
            // Restore button state
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }
    }

    updateTimestamp() {
        // Update the script timestamp
        const timestampElement = document.getElementById('script-timestamp');
        if (timestampElement) {
            const now = new Date();
            timestampElement.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1em 1.5em',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.9em',
            fontWeight: '500',
            zIndex: '1000',
            opacity: '0',
            transform: 'translateY(-10px)',
            transition: 'all 0.3s ease'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = 'var(--green)';
                break;
            case 'error':
                notification.style.background = 'var(--red)';
                break;
            default:
                notification.style.background = 'var(--blue)';
        }

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);

        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AgentDownloader();
});
