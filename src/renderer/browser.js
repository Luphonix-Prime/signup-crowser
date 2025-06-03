class BrowserManager {
    constructor() {
        this.currentGroup = null;
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
        this.timerInterval = null;
        this.webviews = new Map();

        // Webview event handlers
        this.handleWebviewLoadStart = this.handleWebviewLoadStart.bind(this);
        this.handleWebviewLoadStop = this.handleWebviewLoadStop.bind(this);

        this.initializeEventListeners();
        this.setupIPC();
        
        // Initialize feather icons
        feather.replace();
    }

    initializeEventListeners() {
        // Navigation
        document.getElementById('back-btn').addEventListener('click', () => this.goBack());
        document.getElementById('forward-btn').addEventListener('click', () => this.goForward());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        
        // Address bar
        document.getElementById('url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigate();
            }
        });
        document.getElementById('go-btn').addEventListener('click', () => this.navigate());
        
        // Tab management
        document.getElementById('new-tab-btn').addEventListener('click', () => this.createNewTab());
        document.getElementById('add-tab-btn').addEventListener('click', () => this.createNewTab());
        document.getElementById('close-group-btn').addEventListener('click', () => this.closeGroup());
        
        // Quick links
        document.querySelectorAll('.quick-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                this.createNewTab(url);
            });
        });
        
        // Timer alert
        document.getElementById('extend-timer').addEventListener('click', () => this.extendTimer());
        document.getElementById('dismiss-alert').addEventListener('click', () => this.dismissAlert());
    }

    setupIPC() {
        // Listen for group data
        window.electronAPI.onGroupLoaded((event, groupData) => {
            this.loadGroup(groupData);
        });
        
        // Listen for timer alerts
        window.electronAPI.onTimerAlert((event, data) => {
            this.showTimerAlert(data.message);
        });
    }

    loadGroup(groupData) {
        this.currentGroup = groupData;
        
        // Update UI
        document.getElementById('group-name').textContent = groupData.name;
        document.getElementById('group-description').textContent = 
            `Group: ${groupData.name} - Private browsing session with isolated cookies and no history.`;
        
        // Setup timer display
        if (groupData.timerMinutes > 0) {
            this.setupTimerDisplay(groupData.timerMinutes);
        }
        
        // Create initial tab
        this.createNewTab();
    }

    setupTimerDisplay(minutes) {
        const timerDisplay = document.getElementById('timer-display');
        const timerText = document.getElementById('timer-text');
        
        timerDisplay.classList.remove('hidden');
        
        let timeLeft = minutes * 60; // Convert to seconds
        
        this.timerInterval = setInterval(() => {
            timeLeft--;
            
            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                timerText.textContent = '00:00';
                return;
            }
            
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            // Change color when time is running low
            if (timeLeft <= 60) { // Last minute
                timerDisplay.classList.add('timer-warning');
            } else if (timeLeft <= 300) { // Last 5 minutes
                timerDisplay.classList.add('timer-caution');
            }
        }, 1000);
    }

    createNewTab(url = null) {
        const tabId = ++this.tabCounter;
        
        const tab = {
            id: tabId,
            title: url ? 'Loading...' : 'New Tab',
            url: url || 'about:blank',
            canGoBack: false,
            canGoForward: false,
            isLoading: false
        };
        
        this.tabs.push(tab);
        this.renderTabs();
        this.setActiveTab(tabId);
        
        if (url) {
            this.navigateToUrl(url);
        } else {
            this.showWelcomeScreen();
        }
        
        return tab;
    }

    renderTabs() {
        const container = document.getElementById('tabs-container');
        
        container.innerHTML = this.tabs.map(tab => `
            <div class="tab ${tab.id === this.activeTabId ? 'active' : ''}" data-tab-id="${tab.id}">
                <div class="tab-content">
                    <div class="tab-icon">
                        ${tab.isLoading ? '<div class="tab-spinner"></div>' : '<i data-feather="globe"></i>'}
                    </div>
                    <span class="tab-title" title="${this.escapeHtml(tab.title)}">${this.escapeHtml(tab.title)}</span>
                </div>
                <button class="tab-close" onclick="browserManager.closeTab(${tab.id})" title="Close tab">
                    <i data-feather="x"></i>
                </button>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.tab').forEach(tabElement => {
            const tabId = parseInt(tabElement.dataset.tabId);
            tabElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close') && !e.target.closest('.tab-close')) {
                    this.setActiveTab(tabId);
                }
            });
        });
        
        feather.replace();
    }

    setActiveTab(tabId) {
        this.activeTabId = tabId;
        const tab = this.tabs.find(t => t.id === tabId);
        
        if (!tab) return;
        
        // Update address bar
        document.getElementById('url-input').value = tab.url === 'about:blank' ? '' : tab.url;
        
        // Update navigation buttons
        document.getElementById('back-btn').disabled = !tab.canGoBack;
        document.getElementById('forward-btn').disabled = !tab.canGoForward;
        
        // Update UI
        this.renderTabs();
        
        if (tab.url === 'about:blank') {
            this.showWelcomeScreen();
        } else {
            this.hideWelcomeScreen();
        }
        
        // Update window title
        document.title = `${tab.title} - Privacy Browser`;
    }

    closeTab(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;
        
        this.tabs.splice(tabIndex, 1);
        
        // If this was the active tab, switch to another
        if (this.activeTabId === tabId) {
            if (this.tabs.length > 0) {
                const newActiveIndex = Math.max(0, tabIndex - 1);
                this.setActiveTab(this.tabs[newActiveIndex].id);
            } else {
                // No tabs left, create a new one
                this.createNewTab();
                return;
            }
        }
        
        this.renderTabs();
    }

    navigate() {
        const urlInput = document.getElementById('url-input');
        let url = urlInput.value.trim();
        
        if (!url) return;
        
        // Add protocol if missing
        if (!url.match(/^https?:\/\//)) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                // Treat as search query
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }
        
        this.navigateToUrl(url);
    }

    // In navigateToUrl method
    navigateToUrl(url) {
        const activeTab = this.tabs.find(t => t.id === this.activeTabId);
        if (!activeTab) return;

        let webview = this.webviews.get(activeTab.id);
        if (!webview) {
            webview = this.createWebviewElement(activeTab.id);
            this.webviews.set(activeTab.id, webview);
        }

        webview.src = url;
        activeTab.url = url;
        this.renderTabs();
    }

    createWebviewElement(tabId) {
        const webview = document.createElement('webview');
        webview.setAttribute('partition', 'persist:electron-browser');
        webview.style.height = '100%';
        webview.style.width = '100%';
        webview.style.position = 'absolute';
        webview.style.zIndex = '1';

        // Add event listeners
        webview.addEventListener('did-start-loading', this.handleWebviewLoadStart);
        webview.addEventListener('did-stop-loading', this.handleWebviewLoadStop);
        webview.addEventListener('dom-ready', () => {
            activeTab.title = webview.getTitle();
            this.renderTabs();
        });

        document.getElementById('webview-container').appendChild(webview);
        return webview;
    }

    handleWebviewLoadStart(event) {
        const webview = event.target;
        const tabId = Array.from(this.webviews.entries())
            .find(([id, wv]) => wv === webview)[0];
        
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.isLoading = true;
            this.renderTabs();
        }
    }

    handleWebviewLoadStop(event) {
        const webview = event.target;
        const tabId = Array.from(this.webviews.entries())
            .find(([id, wv]) => wv === webview)[0];

        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.isLoading = false;
            tab.title = webview.getTitle();
            this.renderTabs();
        }
    }

    goBack() {
        const webview = this.webviews.get(this.activeTabId);
        if (webview && webview.canGoBack()) {
            webview.goBack();
        }
    }

    goForward() {
        const webview = this.webviews.get(this.activeTabId);
        if (webview && webview.canGoForward()) {
            webview.goForward();
        }
    }

    refresh() {
        const webview = this.webviews.get(this.activeTabId);
        if (webview) {
            webview.reload();
        }
    }

    getTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    showWelcomeScreen() {
        document.getElementById('welcome-screen').classList.remove('hidden');
        document.getElementById('webview-container').classList.add('hidden');
    }

    hideWelcomeScreen() {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('webview-container').classList.remove('hidden');
    }

    closeGroup() {
        const confirmed = confirm(`Close tab group "${this.currentGroup?.name}"? All tabs will be closed and data will be cleared.`);
        if (confirmed) {
            window.close();
        }
    }

    showTimerAlert(message) {
        document.getElementById('alert-text').textContent = message;
        document.getElementById('timer-alert').classList.remove('hidden');
    }

    dismissAlert() {
        document.getElementById('timer-alert').classList.add('hidden');
    }

    async extendTimer() {
        if (!this.currentGroup) return;
        
        try {
            const result = await window.electronAPI.extendTimer(this.currentGroup.id);
            
            if (result.success) {
                this.dismissAlert();
                // Reset timer display
                if (this.currentGroup.timerMinutes > 0) {
                    clearInterval(this.timerInterval);
                    this.setupTimerDisplay(this.currentGroup.timerMinutes);
                }
            } else {
                alert('Failed to extend timer: ' + result.error);
            }
        } catch (error) {
            alert('Error extending timer');
            console.error('Extend timer error:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize browser manager
let browserManager;
document.addEventListener('DOMContentLoaded', () => {
    browserManager = new BrowserManager();
});

// Handle window closing
window.addEventListener('beforeunload', () => {
    if (browserManager && browserManager.timerInterval) {
        clearInterval(browserManager.timerInterval);
    }
});

const webview = document.getElementById('webview');
if (webview) {
    webview.src = url;
}
