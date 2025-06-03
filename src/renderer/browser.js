
class BrowserManager {
    constructor() {
        this.currentGroup = null;
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
        this.timerInterval = null;
        this.webviews = new Map();

        this.initializeEventListeners();
        this.setupIPC();
        
        // Initialize feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    initializeEventListeners() {
        // URL input enter key
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.navigate();
                }
            });
        }
    }

    setupIPC() {
        if (window.electronAPI) {
            // Listen for group data
            window.electronAPI.onGroupLoaded((event, groupData) => {
                this.currentGroup = groupData;
                this.updateGroupInfo();
                this.startTimer();
                this.createInitialTab();
            });

            // Listen for timer alerts
            window.electronAPI.onTimerAlert((event, data) => {
                this.showTimerAlert(data.message);
            });

            // Listen for group closure
            window.electronAPI.onGroupClosed((event, groupId) => {
                if (this.currentGroup && this.currentGroup.id === groupId) {
                    window.close();
                }
            });
        }
    }

    updateGroupInfo() {
        const groupNameEl = document.getElementById('group-name');
        if (groupNameEl && this.currentGroup) {
            groupNameEl.textContent = this.currentGroup.name;
        }
    }

    startTimer() {
        if (this.currentGroup && this.currentGroup.timerMinutes > 0) {
            const timerDisplay = document.getElementById('timer-display');
            const timerText = document.getElementById('timer-text');
            
            if (timerDisplay && timerText) {
                timerDisplay.classList.remove('hidden');
                
                let remainingMinutes = this.currentGroup.timerMinutes;
                let remainingSeconds = 0;
                
                this.timerInterval = setInterval(() => {
                    if (remainingSeconds > 0) {
                        remainingSeconds--;
                    } else if (remainingMinutes > 0) {
                        remainingMinutes--;
                        remainingSeconds = 59;
                    } else {
                        clearInterval(this.timerInterval);
                        return;
                    }
                    
                    const minutes = String(remainingMinutes).padStart(2, '0');
                    const seconds = String(remainingSeconds).padStart(2, '0');
                    timerText.textContent = `${minutes}:${seconds}`;
                }, 1000);
            }
        }
    }

    createInitialTab() {
        this.newTab('https://www.google.com');
    }

    newTab(url = null) {
        const tabId = ++this.tabCounter;
        const tab = {
            id: tabId,
            title: 'New Tab',
            url: url || 'about:blank',
            isLoading: false
        };

        this.tabs.push(tab);
        this.activeTabId = tabId;
        this.renderTabs();

        if (url) {
            this.navigateToUrl(url);
        } else {
            this.showWelcomeScreen();
        }

        return tab;
    }

    renderTabs() {
        const tabsList = document.getElementById('tabs-list');
        if (!tabsList) return;

        tabsList.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = `tab ${tab.id === this.activeTabId ? 'active' : ''}`;
            tabEl.innerHTML = `
                <div class="tab-content" onclick="browserManager.switchTab(${tab.id})">
                    ${tab.isLoading ? '<i data-feather="loader" class="loading"></i>' : '<i data-feather="globe"></i>'}
                    <span class="tab-title">${tab.title}</span>
                </div>
                <button class="tab-close" onclick="browserManager.closeTab(${tab.id})" title="Close tab">
                    <i data-feather="x"></i>
                </button>
            `;
            tabsList.appendChild(tabEl);
        });

        // Re-initialize feather icons for new elements
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    switchTab(tabId) {
        this.activeTabId = tabId;
        this.renderTabs();

        // Hide all webviews
        this.webviews.forEach(webview => {
            webview.style.display = 'none';
        });

        // Show active webview or welcome screen
        const activeWebview = this.webviews.get(tabId);
        if (activeWebview) {
            activeWebview.style.display = 'block';
            this.hideWelcomeScreen();
            
            // Update URL input
            const urlInput = document.getElementById('url-input');
            const activeTab = this.tabs.find(t => t.id === tabId);
            if (urlInput && activeTab && activeTab.url !== 'about:blank') {
                urlInput.value = activeTab.url;
            }
        } else {
            this.showWelcomeScreen();
        }
    }

    closeTab(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Remove webview
        const webview = this.webviews.get(tabId);
        if (webview) {
            webview.remove();
            this.webviews.delete(tabId);
        }

        // Remove tab
        this.tabs.splice(tabIndex, 1);

        // Handle active tab change
        if (this.activeTabId === tabId) {
            if (this.tabs.length > 0) {
                // Switch to next tab or previous if it was the last
                const newActiveIndex = tabIndex < this.tabs.length ? tabIndex : this.tabs.length - 1;
                this.activeTabId = this.tabs[newActiveIndex].id;
                this.switchTab(this.activeTabId);
            } else {
                // No tabs left, create a new one
                this.newTab();
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
        activeTab.isLoading = true;
        
        // Update URL input
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.value = url;
        }

        this.hideWelcomeScreen();
        this.switchTab(activeTab.id);
        this.renderTabs();
    }

    createWebviewElement(tabId) {
        const webview = document.createElement('webview');
        webview.setAttribute('partition', `tabgroup-${this.currentGroup?.id || 'default'}`);
        webview.setAttribute('allowpopups', 'true');
        webview.setAttribute('webSecurity', 'false');
        webview.style.height = '100%';
        webview.style.width = '100%';
        webview.style.position = 'absolute';
        webview.style.top = '0';
        webview.style.left = '0';
        webview.style.zIndex = '1';
        webview.style.display = 'none';

        // Add event listeners
        webview.addEventListener('did-start-loading', () => {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.isLoading = true;
                this.renderTabs();
            }
        });

        webview.addEventListener('did-stop-loading', () => {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.isLoading = false;
                tab.title = webview.getTitle() || this.getTitleFromUrl(webview.src);
                this.renderTabs();
            }
        });

        webview.addEventListener('page-title-updated', () => {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.title = webview.getTitle() || this.getTitleFromUrl(webview.src);
                this.renderTabs();
            }
        });

        webview.addEventListener('did-navigate', (event) => {
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.url = event.url;
                if (this.activeTabId === tabId) {
                    const urlInput = document.getElementById('url-input');
                    if (urlInput) {
                        urlInput.value = event.url;
                    }
                }
            }
        });

        document.getElementById('webview-container').appendChild(webview);
        return webview;
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
        const welcomeScreen = document.getElementById('welcome-screen');
        const webviewContainer = document.getElementById('webview-container');
        
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (webviewContainer) webviewContainer.classList.add('hidden');
    }

    hideWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcome-screen');
        const webviewContainer = document.getElementById('webview-container');
        
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (webviewContainer) webviewContainer.classList.remove('hidden');
    }

    closeGroup() {
        const confirmed = confirm(`Close tab group "${this.currentGroup?.name}"? All tabs will be closed and data will be cleared.`);
        if (confirmed) {
            window.close();
        }
    }

    showTimerAlert(message) {
        const alertText = document.getElementById('alert-text');
        const timerAlert = document.getElementById('timer-alert');
        
        if (alertText) alertText.textContent = message;
        if (timerAlert) timerAlert.classList.remove('hidden');
    }

    dismissAlert() {
        const timerAlert = document.getElementById('timer-alert');
        if (timerAlert) timerAlert.classList.add('hidden');
    }

    async extendTimer() {
        if (this.currentGroup && window.electronAPI) {
            try {
                await window.electronAPI.extendTimer(this.currentGroup.id);
                this.dismissAlert();
                // Restart the timer display
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                }
                this.startTimer();
            } catch (error) {
                console.error('Failed to extend timer:', error);
            }
        }
    }
}

// Initialize browser manager when DOM is loaded
let browserManager;
document.addEventListener('DOMContentLoaded', () => {
    browserManager = new BrowserManager();
});
