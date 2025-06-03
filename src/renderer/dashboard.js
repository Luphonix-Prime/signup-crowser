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
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettingsModal();
        });

        document.getElementById('refresh-groups').addEventListener('click', () => {
            this.loadTabGroups();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        document.getElementById('upgrade-btn').addEventListener('click', () => {
            this.showPaymentModal('premium');
        });

        // Settings modal
        document.getElementById('close-settings-modal').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchSettingsTab(tab.dataset.tab);
            });
        });

        document.getElementById('account-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateAccountSettings();
        });

        document.getElementById('privacy-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updatePrivacySettings();
        });

        // Payment modal
        document.getElementById('close-payment-modal').addEventListener('click', () => {
            this.hidePaymentModal();
        });

        document.getElementById('cancel-payment').addEventListener('click', () => {
            this.hidePaymentModal();
        });

        document.getElementById('payment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processPayment();
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

        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                this.hideSettingsModal();
            }
        });

        document.getElementById('payment-modal').addEventListener('click', (e) => {
            if (e.target.id === 'payment-modal') {
                this.hidePaymentModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideCreateGroupModal();
                this.hideSettingsModal();
                this.hidePaymentModal();
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
                this.updateSubscriptionStatus(result.userInfo);
            } else {
                this.showError('Failed to load tab groups: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading tab groups');
            console.error('Load groups error:', error);
        }
        
        this.showLoading(false);
    }

    updateSubscriptionStatus(userInfo) {
        if (userInfo) {
            const planElement = document.getElementById('subscription-plan');
            const detailsElement = document.getElementById('subscription-details');
            
            if (userInfo.subscription === 'premium') {
                planElement.textContent = 'Premium Plan';
                detailsElement.textContent = 'Unlimited tab groups and advanced features';
                document.getElementById('upgrade-btn').style.display = 'none';
            } else {
                planElement.textContent = 'Free Plan';
                detailsElement.textContent = `${this.tabGroups.length}/3 tab groups used`;
                document.getElementById('upgrade-btn').style.display = 'block';
            }
        }
    }

    showSettingsModal() {
        document.getElementById('settings-modal').classList.remove('hidden');
        this.loadUserSettings();
    }

    hideSettingsModal() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    switchSettingsTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update panels
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}-settings`).classList.add('active');
    }

    async loadUserSettings() {
        try {
            const result = await window.electronAPI.getUserSettings();
            
            if (result.success) {
                const settings = result.settings;
                document.getElementById('settings-username').value = settings.username || '';
                document.getElementById('settings-email').value = settings.email || '';
                document.getElementById('clear-data-on-exit').checked = settings.clearDataOnExit ?? true;
                document.getElementById('block-trackers').checked = settings.blockTrackers ?? true;
                document.getElementById('disable-notifications').checked = settings.disableNotifications ?? false;
            }
        } catch (error) {
            this.showError('Failed to load user settings');
            console.error('Load settings error:', error);
        }
    }

    async updateAccountSettings() {
        const formData = new FormData(document.getElementById('account-settings-form'));
        
        const settings = {
            email: formData.get('email') || document.getElementById('settings-email').value,
            currentPassword: document.getElementById('current-password').value,
            newPassword: document.getElementById('new-password').value
        };

        if (settings.newPassword && !settings.currentPassword) {
            this.showError('Current password is required to change password');
            return;
        }

        this.showLoading(true);

        try {
            const result = await window.electronAPI.updateAccountSettings(settings);
            
            if (result.success) {
                this.showSuccess('Account settings updated successfully');
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
            } else {
                this.showError('Failed to update account settings: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while updating account settings');
            console.error('Update account error:', error);
        }

        this.showLoading(false);
    }

    async updatePrivacySettings() {
        const settings = {
            clearDataOnExit: document.getElementById('clear-data-on-exit').checked,
            blockTrackers: document.getElementById('block-trackers').checked,
            disableNotifications: document.getElementById('disable-notifications').checked
        };

        this.showLoading(true);

        try {
            const result = await window.electronAPI.updatePrivacySettings(settings);
            
            if (result.success) {
                this.showSuccess('Privacy settings updated successfully');
            } else {
                this.showError('Failed to update privacy settings: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while updating privacy settings');
            console.error('Update privacy error:', error);
        }

        this.showLoading(false);
    }

    showPaymentModal(plan) {
        document.getElementById('payment-modal').classList.remove('hidden');
    }

    hidePaymentModal() {
        document.getElementById('payment-modal').classList.add('hidden');
        document.getElementById('payment-form').reset();
    }

    async processPayment() {
        const formData = new FormData(document.getElementById('payment-form'));
        
        const paymentData = {
            cardNumber: formData.get('card-number') || document.getElementById('card-number').value,
            expiryDate: formData.get('expiry-date') || document.getElementById('expiry-date').value,
            cvv: formData.get('cvv') || document.getElementById('cvv').value,
            cardholderName: formData.get('cardholder-name') || document.getElementById('cardholder-name').value,
            plan: 'premium'
        };

        // Basic validation
        if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv || !paymentData.cardholderName) {
            this.showError('Please fill in all payment details');
            return;
        }

        this.showLoading(true);

        try {
            const result = await window.electronAPI.processPayment(paymentData);
            
            if (result.success) {
                this.hidePaymentModal();
                this.showSuccess('Payment processed successfully! Welcome to Premium!');
                this.loadTabGroups(); // Refresh to update subscription status
            } else {
                this.showError('Payment failed: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while processing payment');
            console.error('Payment error:', error);
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
