class DashboardManager {
    constructor() {
        this.tabGroups = [];
        this.currentAlertGroupId = null;
        this.initializeEventListeners();
        this.loadTabGroups();
        this.setupIPC();
        
        // Initialize feather icons
        feather.replace();
    }

    initializeEventListeners() {
        // Create group modal
        document.getElementById('create-group-btn').addEventListener('click', () => {
            this.showCreateGroupModal();
        });

        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideCreateGroupModal();
        });

        document.getElementById('cancel-create').addEventListener('click', () => {
            this.hideCreateGroupModal();
        });

        document.getElementById('create-group-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateGroup();
        });

        // Other actions
        document.getElementById('refresh-groups').addEventListener('click', () => {
            this.loadTabGroups();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Timer alert actions
        document.getElementById('extend-timer-btn').addEventListener('click', () => {
            this.handleExtendTimer();
        });

        document.getElementById('dismiss-alert-btn').addEventListener('click', () => {
            this.hideTimerAlert();
        });

        // Modal backdrop click
        document.getElementById('create-group-modal').addEventListener('click', (e) => {
            if (e.target.id === 'create-group-modal') {
                this.hideCreateGroupModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideCreateGroupModal();
                this.hideTimerAlert();
            }
        });
    }

    setupIPC() {
        // Listen for timer alerts
        window.electronAPI.onTimerAlert((event, data) => {
            this.showTimerAlert(data.groupId, data.message);
        });

        // Listen for group closures
        window.electronAPI.onGroupClosed((event, groupId) => {
            this.handleGroupClosed(groupId);
        });
    }

    async loadTabGroups() {
        this.showLoading(true);
        
        try {
            const result = await window.electronAPI.listTabGroups();
            
            if (result.success) {
                this.tabGroups = result.groups;
                this.renderTabGroups();
            } else {
                this.showError('Failed to load tab groups: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading tab groups');
            console.error('Load groups error:', error);
        }
        
        this.showLoading(false);
    }

    renderTabGroups() {
        const grid = document.getElementById('tab-groups-grid');
        const emptyState = document.getElementById('empty-state');

        if (this.tabGroups.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        grid.innerHTML = this.tabGroups.map(group => `
            <div class="tab-group-card" data-group-id="${group.id}">
                <div class="card-header">
                    <h3>${this.escapeHtml(group.name)}</h3>
                    <div class="card-actions">
                        <button class="btn btn-icon" onclick="dashboardManager.openTabGroup(${group.id})" title="Open">
                            <i data-feather="external-link"></i>
                        </button>
                        <button class="btn btn-icon btn-danger" onclick="dashboardManager.deleteTabGroup(${group.id})" title="Delete">
                            <i data-feather="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <div class="group-info">
                        <div class="info-item">
                            <i data-feather="clock"></i>
                            <span>${group.timerMinutes > 0 ? `${group.timerMinutes} minutes` : 'No timer'}</span>
                        </div>
                        <div class="info-item">
                            <i data-feather="calendar"></i>
                            <span>Created ${this.formatDate(group.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary btn-full" onclick="dashboardManager.openTabGroup(${group.id})">
                        Open Group
                    </button>
                </div>
            </div>
        `).join('');

        // Re-initialize feather icons for new content
        feather.replace();
    }

    showCreateGroupModal() {
        document.getElementById('create-group-modal').classList.remove('hidden');
        document.getElementById('group-name').focus();
    }

    hideCreateGroupModal() {
        document.getElementById('create-group-modal').classList.add('hidden');
        document.getElementById('create-group-form').reset();
    }

    async handleCreateGroup() {
        const form = document.getElementById('create-group-form');
        const formData = new FormData(form);
        
        const groupData = {
            name: formData.get('name').trim(),
            timerMinutes: parseInt(formData.get('timerMinutes')) || 0
        };

        if (!groupData.name) {
            this.showError('Group name is required');
            return;
        }

        if (groupData.timerMinutes < 0 || groupData.timerMinutes > 1440) {
            this.showError('Timer must be between 0 and 1440 minutes');
            return;
        }

        this.showLoading(true);

        try {
            const result = await window.electronAPI.createTabGroup(groupData);
            
            if (result.success) {
                this.hideCreateGroupModal();
                await this.loadTabGroups();
                this.showSuccess('Tab group created successfully!');
            } else {
                this.showError('Failed to create tab group: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while creating the tab group');
            console.error('Create group error:', error);
        }

        this.showLoading(false);
    }

    async openTabGroup(groupId) {
        try {
            const result = await window.electronAPI.openTabGroup(groupId);
            
            if (!result.success) {
                this.showError('Failed to open tab group: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while opening the tab group');
            console.error('Open group error:', error);
        }
    }

    async deleteTabGroup(groupId) {
        const group = this.tabGroups.find(g => g.id === groupId);
        if (!group) return;

        const confirmed = confirm(`Are you sure you want to delete the tab group "${group.name}"? This action cannot be undone.`);
        if (!confirmed) return;

        this.showLoading(true);

        try {
            const result = await window.electronAPI.deleteTabGroup(groupId);
            
            if (result.success) {
                await this.loadTabGroups();
                this.showSuccess('Tab group deleted successfully');
            } else {
                this.showError('Failed to delete tab group: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while deleting the tab group');
            console.error('Delete group error:', error);
        }

        this.showLoading(false);
    }

    async handleLogout() {
        const confirmed = confirm('Are you sure you want to logout? All open tab groups will be closed.');
        if (!confirmed) return;

        this.showLoading(true);

        try {
            const result = await window.electronAPI.logout();
            
            if (result.success) {
                // Window will close automatically and auth window will open
            } else {
                this.showError('Failed to logout: ' + result.error);
                this.showLoading(false);
            }
        } catch (error) {
            this.showError('An error occurred during logout');
            this.showLoading(false);
            console.error('Logout error:', error);
        }
    }

    showTimerAlert(groupId, message) {
        this.currentAlertGroupId = groupId;
        document.getElementById('alert-message-text').textContent = message;
        document.getElementById('timer-alert').classList.remove('hidden');
    }

    hideTimerAlert() {
        document.getElementById('timer-alert').classList.add('hidden');
        this.currentAlertGroupId = null;
    }

    async handleExtendTimer() {
        if (!this.currentAlertGroupId) return;

        try {
            const result = await window.electronAPI.extendTimer(this.currentAlertGroupId);
            
            if (result.success) {
                this.hideTimerAlert();
                this.showSuccess('Timer extended successfully');
            } else {
                this.showError('Failed to extend timer: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while extending the timer');
            console.error('Extend timer error:', error);
        }
    }

    handleGroupClosed(groupId) {
        this.loadTabGroups(); // Refresh the list
        const group = this.tabGroups.find(g => g.id === groupId);
        if (group) {
            this.showInfo(`Tab group "${group.name}" has been automatically closed`);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${this.escapeHtml(message)}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i data-feather="x"></i>
                </button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);
        feather.replace();

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
}

// Initialize dashboard manager
let dashboardManager;
document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
});
