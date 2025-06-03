
class AdminManager {
    constructor() {
        this.currentSection = 'dashboard';
        this.users = [];
        this.sessions = [];
        this.payments = [];
        this.stats = {};
        this.initializeEventListeners();
        this.loadDashboardData();
        this.setupIPC();
        
        // Initialize feather icons
        feather.replace();
    }

    initializeEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
            });
        });

        // Dashboard actions
        document.getElementById('refresh-data').addEventListener('click', () => {
            this.loadDashboardData();
        });

        // User management
        document.getElementById('add-user-btn').addEventListener('click', () => {
            this.showAddUserModal();
        });

        document.getElementById('close-add-user-modal').addEventListener('click', () => {
            this.hideAddUserModal();
        });

        document.getElementById('cancel-add-user').addEventListener('click', () => {
            this.hideAddUserModal();
        });

        document.getElementById('add-user-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddUser();
        });

        document.getElementById('user-search').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // Session management
        document.getElementById('refresh-sessions').addEventListener('click', () => {
            this.loadActiveSessions();
        });

        // Payment management
        document.getElementById('payment-filter').addEventListener('change', (e) => {
            this.filterPayments(e.target.value);
        });

        // Settings forms
        document.getElementById('general-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGeneralSettings();
        });

        document.getElementById('payment-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePaymentSettings();
        });

        document.getElementById('security-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSecuritySettings();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Modal backdrop
        document.getElementById('add-user-modal').addEventListener('click', (e) => {
            if (e.target.id === 'add-user-modal') {
                this.hideAddUserModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAddUserModal();
            }
        });
    }

    setupIPC() {
        // Listen for real-time updates
        window.electronAPI.onUserActivity?.((event, data) => {
            this.handleUserActivity(data);
        });

        window.electronAPI.onPaymentUpdate?.((event, data) => {
            this.handlePaymentUpdate(data);
        });
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        this.currentSection = section;

        // Load section-specific data
        switch (section) {
            case 'users':
                this.loadUsers();
                break;
            case 'sessions':
                this.loadActiveSessions();
                break;
            case 'payments':
                this.loadPayments();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    async loadDashboardData() {
        this.showLoading(true);
        
        try {
            const result = await window.electronAPI.getAdminStats();
            
            if (result.success) {
                this.stats = result.stats;
                this.updateDashboardStats();
            } else {
                this.showError('Failed to load dashboard data: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading dashboard data');
            console.error('Dashboard data error:', error);
        }
        
        this.showLoading(false);
    }

    updateDashboardStats() {
        document.getElementById('total-users').textContent = this.stats.totalUsers || 0;
        document.getElementById('active-sessions').textContent = this.stats.activeSessions || 0;
        document.getElementById('monthly-revenue').textContent = `$${this.stats.monthlyRevenue || 0}`;
        document.getElementById('avg-session-time').textContent = `${this.stats.avgSessionTime || 0}h`;
    }

    async loadUsers() {
        this.showLoading(true);
        
        try {
            const result = await window.electronAPI.getUsers();
            
            if (result.success) {
                this.users = result.users;
                this.renderUsers();
            } else {
                this.showError('Failed to load users: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading users');
            console.error('Load users error:', error);
        }
        
        this.showLoading(false);
    }

    renderUsers(filteredUsers = null) {
        const users = filteredUsers || this.users;
        const tbody = document.getElementById('users-table-body');
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; background: hsl(var(--primary) / 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: hsl(var(--primary)); font-weight: 600;">
                            ${user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 500;">${this.escapeHtml(user.username)}</div>
                            <div style="font-size: 0.8rem; color: hsl(var(--muted-foreground));">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td>${this.escapeHtml(user.email)}</td>
                <td><span class="status-badge status-${user.status}">${user.status}</span></td>
                <td>${user.subscription || 'Free'}</td>
                <td>${this.formatDuration(user.totalSessionTime || 0)}</td>
                <td>${this.formatDate(user.lastLogin)}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-secondary" onclick="adminManager.editUser(${user.id})" title="Edit">
                            <i data-feather="edit-2"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminManager.suspendUser(${user.id})" title="Suspend">
                            <i data-feather="user-x"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="adminManager.viewUserSessions(${user.id})" title="Sessions">
                            <i data-feather="activity"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Re-initialize feather icons
        feather.replace();
    }

    async loadActiveSessions() {
        this.showLoading(true);
        
        try {
            const result = await window.electronAPI.getActiveSessions();
            
            if (result.success) {
                this.sessions = result.sessions;
                this.renderSessions();
            } else {
                this.showError('Failed to load active sessions: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading sessions');
            console.error('Load sessions error:', error);
        }
        
        this.showLoading(false);
    }

    renderSessions() {
        const tbody = document.getElementById('sessions-table-body');
        
        tbody.innerHTML = this.sessions.map(session => `
            <tr>
                <td>
                    <div style="font-weight: 500;">${this.escapeHtml(session.username)}</div>
                    <div style="font-size: 0.8rem; color: hsl(var(--muted-foreground));">${this.escapeHtml(session.email)}</div>
                </td>
                <td>${this.formatDateTime(session.startTime)}</td>
                <td>${this.formatDuration(session.duration)}</td>
                <td>${session.tabGroups || 0} groups</td>
                <td>${this.formatDateTime(session.lastActivity)}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-danger" onclick="adminManager.terminateSession('${session.sessionToken}')" title="Terminate">
                            <i data-feather="x-circle"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="adminManager.viewSessionDetails('${session.sessionToken}')" title="Details">
                            <i data-feather="info"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        feather.replace();
    }

    async loadPayments() {
        this.showLoading(true);
        
        try {
            const result = await window.electronAPI.getPayments();
            
            if (result.success) {
                this.payments = result.payments;
                this.renderPayments();
                this.updatePaymentStats();
            } else {
                this.showError('Failed to load payments: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading payments');
            console.error('Load payments error:', error);
        }
        
        this.showLoading(false);
    }

    renderPayments(filteredPayments = null) {
        const payments = filteredPayments || this.payments;
        const tbody = document.getElementById('payments-table-body');
        
        tbody.innerHTML = payments.map(payment => `
            <tr>
                <td>
                    <div style="font-weight: 500;">${this.escapeHtml(payment.username)}</div>
                    <div style="font-size: 0.8rem; color: hsl(var(--muted-foreground));">${this.escapeHtml(payment.email)}</div>
                </td>
                <td>${payment.plan}</td>
                <td>$${payment.amount}</td>
                <td><span class="status-badge status-${payment.status}">${payment.status}</span></td>
                <td>${this.formatDate(payment.startDate)}</td>
                <td>${this.formatDate(payment.endDate)}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm btn-secondary" onclick="adminManager.viewPaymentDetails(${payment.id})" title="Details">
                            <i data-feather="eye"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="adminManager.processRefund(${payment.id})" title="Refund">
                            <i data-feather="dollar-sign"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        feather.replace();
    }

    updatePaymentStats() {
        const totalRevenue = this.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const activeSubscriptions = this.payments.filter(p => p.status === 'active').length;
        const pendingPayments = this.payments.filter(p => p.status === 'pending').length;

        document.getElementById('total-revenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('active-subscriptions').textContent = activeSubscriptions;
        document.getElementById('pending-payments').textContent = pendingPayments;
    }

    async loadSettings() {
        try {
            const result = await window.electronAPI.getSettings();
            
            if (result.success) {
                this.populateSettings(result.settings);
            } else {
                this.showError('Failed to load settings: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while loading settings');
            console.error('Load settings error:', error);
        }
    }

    populateSettings(settings) {
        // General settings
        document.getElementById('app-name').value = settings.appName || 'Privacy Browser';
        document.getElementById('max-tab-groups').value = settings.maxTabGroups || 10;
        document.getElementById('session-timeout').value = settings.sessionTimeout || 24;

        // Payment settings
        document.getElementById('basic-plan-price').value = settings.basicPlanPrice || 9.99;
        document.getElementById('premium-plan-price').value = settings.premiumPlanPrice || 19.99;
        document.getElementById('trial-period').value = settings.trialPeriod || 7;

        // Security settings
        document.getElementById('force-2fa').checked = settings.force2FA || false;
        document.getElementById('auto-logout').checked = settings.autoLogout || true;
        document.getElementById('password-policy').value = settings.passwordMinLength || 8;
    }

    showAddUserModal() {
        document.getElementById('add-user-modal').classList.remove('hidden');
        document.getElementById('new-username').focus();
    }

    hideAddUserModal() {
        document.getElementById('add-user-modal').classList.add('hidden');
        document.getElementById('add-user-form').reset();
    }

    async handleAddUser() {
        const form = document.getElementById('add-user-form');
        const formData = new FormData(form);
        
        const userData = {
            username: formData.get('username').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password'),
            role: formData.get('role')
        };

        if (!userData.username || !userData.email || !userData.password) {
            this.showError('All fields are required');
            return;
        }

        this.showLoading(true);

        try {
            const result = await window.electronAPI.createUser(userData);
            
            if (result.success) {
                this.hideAddUserModal();
                this.loadUsers();
                this.showSuccess('User created successfully!');
            } else {
                this.showError('Failed to create user: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while creating the user');
            console.error('Create user error:', error);
        }

        this.showLoading(false);
    }

    filterUsers(searchTerm) {
        if (!searchTerm) {
            this.renderUsers();
            return;
        }

        const filtered = this.users.filter(user => 
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        this.renderUsers(filtered);
    }

    filterPayments(filter) {
        if (filter === 'all') {
            this.renderPayments();
            return;
        }

        const filtered = this.payments.filter(payment => payment.status === filter);
        this.renderPayments(filtered);
    }

    async editUser(userId) {
        // Implementation for editing user
        console.log('Edit user:', userId);
    }

    async suspendUser(userId) {
        const confirmed = confirm('Are you sure you want to suspend this user?');
        if (!confirmed) return;

        try {
            const result = await window.electronAPI.suspendUser(userId);
            
            if (result.success) {
                this.loadUsers();
                this.showSuccess('User suspended successfully');
            } else {
                this.showError('Failed to suspend user: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while suspending the user');
            console.error('Suspend user error:', error);
        }
    }

    async viewUserSessions(userId) {
        // Implementation for viewing user sessions
        console.log('View sessions for user:', userId);
    }

    async terminateSession(sessionToken) {
        const confirmed = confirm('Are you sure you want to terminate this session?');
        if (!confirmed) return;

        try {
            const result = await window.electronAPI.terminateSession(sessionToken);
            
            if (result.success) {
                this.loadActiveSessions();
                this.showSuccess('Session terminated successfully');
            } else {
                this.showError('Failed to terminate session: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while terminating the session');
            console.error('Terminate session error:', error);
        }
    }

    async viewSessionDetails(sessionToken) {
        // Implementation for viewing session details
        console.log('View session details:', sessionToken);
    }

    async viewPaymentDetails(paymentId) {
        // Implementation for viewing payment details
        console.log('View payment details:', paymentId);
    }

    async processRefund(paymentId) {
        const confirmed = confirm('Are you sure you want to process a refund for this payment?');
        if (!confirmed) return;

        try {
            const result = await window.electronAPI.processRefund(paymentId);
            
            if (result.success) {
                this.loadPayments();
                this.showSuccess('Refund processed successfully');
            } else {
                this.showError('Failed to process refund: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while processing the refund');
            console.error('Process refund error:', error);
        }
    }

    async saveGeneralSettings() {
        const settings = {
            appName: document.getElementById('app-name').value,
            maxTabGroups: parseInt(document.getElementById('max-tab-groups').value),
            sessionTimeout: parseInt(document.getElementById('session-timeout').value)
        };

        try {
            const result = await window.electronAPI.saveSettings('general', settings);
            
            if (result.success) {
                this.showSuccess('General settings saved successfully');
            } else {
                this.showError('Failed to save settings: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while saving settings');
            console.error('Save settings error:', error);
        }
    }

    async savePaymentSettings() {
        const settings = {
            basicPlanPrice: parseFloat(document.getElementById('basic-plan-price').value),
            premiumPlanPrice: parseFloat(document.getElementById('premium-plan-price').value),
            trialPeriod: parseInt(document.getElementById('trial-period').value)
        };

        try {
            const result = await window.electronAPI.saveSettings('payment', settings);
            
            if (result.success) {
                this.showSuccess('Payment settings saved successfully');
            } else {
                this.showError('Failed to save settings: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while saving settings');
            console.error('Save settings error:', error);
        }
    }

    async saveSecuritySettings() {
        const settings = {
            force2FA: document.getElementById('force-2fa').checked,
            autoLogout: document.getElementById('auto-logout').checked,
            passwordMinLength: parseInt(document.getElementById('password-policy').value)
        };

        try {
            const result = await window.electronAPI.saveSettings('security', settings);
            
            if (result.success) {
                this.showSuccess('Security settings saved successfully');
            } else {
                this.showError('Failed to save settings: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred while saving settings');
            console.error('Save settings error:', error);
        }
    }

    async handleLogout() {
        const confirmed = confirm('Are you sure you want to logout?');
        if (!confirmed) return;

        try {
            const result = await window.electronAPI.logout();
            
            if (result.success) {
                // Window will close automatically
            } else {
                this.showError('Failed to logout: ' + result.error);
            }
        } catch (error) {
            this.showError('An error occurred during logout');
            console.error('Logout error:', error);
        }
    }

    handleUserActivity(data) {
        // Update real-time stats
        this.loadDashboardData();
    }

    handlePaymentUpdate(data) {
        // Update payment data
        this.loadPayments();
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

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 8px;
            padding: 1rem 1.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            max-width: 400px;
            color: hsl(var(--foreground));
        `;
        
        if (type === 'error') {
            notification.style.borderColor = 'hsl(var(--error))';
            notification.style.background = 'hsl(var(--error) / 0.1)';
        } else if (type === 'success') {
            notification.style.borderColor = 'hsl(var(--success))';
            notification.style.background = 'hsl(var(--success) / 0.1)';
        }

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span>${this.escapeHtml(message)}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: hsl(var(--muted-foreground)); cursor: pointer; padding: 0.25rem;">×</button>
            </div>
        `;

        document.body.appendChild(notification);

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
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    formatDateTime(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    formatDuration(minutes) {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
}

// Initialize admin manager
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminManager();
});
