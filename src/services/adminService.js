
const Database = require('../database/db');

class AdminService {
    constructor() {
        this.sessionTracker = new Map(); // Track active sessions
    }

    async getAdminStats() {
        try {
            // Get total users
            const totalUsersResult = await Database.get('SELECT COUNT(*) as count FROM users');
            const totalUsers = totalUsersResult.count;

            // Get active sessions
            const activeSessionsResult = await Database.get(`
                SELECT COUNT(*) as count FROM user_sessions 
                WHERE expires_at > datetime('now')
            `);
            const activeSessions = activeSessionsResult.count;

            // Get monthly revenue
            const monthlyRevenueResult = await Database.get(`
                SELECT SUM(amount) as total FROM payments 
                WHERE status = 'completed' 
                AND created_at >= date('now', '-1 month')
            `);
            const monthlyRevenue = monthlyRevenueResult.total || 0;

            // Get average session time
            const avgSessionResult = await Database.get(`
                SELECT AVG(session_duration) as avg FROM user_sessions 
                WHERE session_duration IS NOT NULL
            `);
            const avgSessionTime = Math.round((avgSessionResult.avg || 0) / 60); // Convert to hours

            return {
                totalUsers,
                activeSessions,
                monthlyRevenue,
                avgSessionTime
            };
        } catch (error) {
            throw new Error('Failed to get admin stats: ' + error.message);
        }
    }

    async getUsers(page = 1, limit = 50, search = '') {
        try {
            let query = `
                SELECT u.id, u.username, u.email, u.role, u.status, u.created_at,
                       u.last_login, COALESCE(SUM(s.session_duration), 0) as total_session_time,
                       p.plan as subscription
                FROM users u
                LEFT JOIN user_sessions s ON u.id = s.user_id
                LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'active'
            `;
            
            const params = [];
            
            if (search) {
                query += ` WHERE u.username LIKE ? OR u.email LIKE ?`;
                params.push(`%${search}%`, `%${search}%`);
            }
            
            query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, (page - 1) * limit);

            const users = await Database.all(query, params);
            
            return users.map(user => ({
                ...user,
                status: user.status || 'active',
                totalSessionTime: user.total_session_time || 0
            }));
        } catch (error) {
            throw new Error('Failed to get users: ' + error.message);
        }
    }

    async getActiveSessions() {
        try {
            const sessions = await Database.all(`
                SELECT s.session_token, s.created_at as start_time, s.expires_at,
                       s.last_activity, s.session_duration as duration,
                       u.username, u.email,
                       COUNT(tg.id) as tab_groups
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN tab_groups tg ON u.id = tg.user_id AND tg.is_active = 1
                WHERE s.expires_at > datetime('now')
                GROUP BY s.session_token
                ORDER BY s.last_activity DESC
            `);

            return sessions.map(session => ({
                ...session,
                startTime: session.start_time,
                lastActivity: session.last_activity,
                duration: session.duration || 0,
                tabGroups: session.tab_groups || 0
            }));
        } catch (error) {
            throw new Error('Failed to get active sessions: ' + error.message);
        }
    }

    async getPayments(filter = 'all') {
        try {
            let query = `
                SELECT p.id, p.amount, p.plan, p.status, p.created_at as start_date,
                       p.expires_at as end_date, u.username, u.email
                FROM payments p
                JOIN users u ON p.user_id = u.id
            `;
            
            const params = [];
            
            if (filter !== 'all') {
                query += ' WHERE p.status = ?';
                params.push(filter);
            }
            
            query += ' ORDER BY p.created_at DESC';

            const payments = await Database.all(query, params);
            
            return payments.map(payment => ({
                ...payment,
                startDate: payment.start_date,
                endDate: payment.end_date
            }));
        } catch (error) {
            throw new Error('Failed to get payments: ' + error.message);
        }
    }

    async createUser(userData) {
        const { username, email, password, role = 'user' } = userData;
        
        try {
            // Check if user already exists
            const existingUser = await Database.get(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email]
            );

            if (existingUser) {
                throw new Error('Username or email already exists');
            }

            // Hash password
            const bcrypt = require('bcrypt');
            const passwordHash = await bcrypt.hash(password, 12);

            // Create user
            const result = await Database.run(
                'INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
                [username, email, passwordHash, role, 'active']
            );

            return {
                id: result.id,
                username,
                email,
                role,
                status: 'active'
            };
        } catch (error) {
            throw new Error('Failed to create user: ' + error.message);
        }
    }

    async suspendUser(userId) {
        try {
            await Database.run('UPDATE users SET status = ? WHERE id = ?', ['suspended', userId]);
            
            // Terminate all active sessions for this user
            await Database.run('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
            
            return true;
        } catch (error) {
            throw new Error('Failed to suspend user: ' + error.message);
        }
    }

    async terminateSession(sessionToken) {
        try {
            await Database.run('DELETE FROM user_sessions WHERE session_token = ?', [sessionToken]);
            return true;
        } catch (error) {
            throw new Error('Failed to terminate session: ' + error.message);
        }
    }

    async processRefund(paymentId) {
        try {
            // Update payment status
            await Database.run(
                'UPDATE payments SET status = ?, refunded_at = datetime("now") WHERE id = ?',
                ['refunded', paymentId]
            );

            // Get payment details to downgrade user
            const payment = await Database.get('SELECT user_id FROM payments WHERE id = ?', [paymentId]);
            
            if (payment) {
                // Remove premium subscription
                await Database.run(
                    'UPDATE users SET subscription = ? WHERE id = ?',
                    ['free', payment.user_id]
                );
            }

            return true;
        } catch (error) {
            throw new Error('Failed to process refund: ' + error.message);
        }
    }

    async getSettings() {
        try {
            const settings = await Database.all('SELECT key, value FROM app_settings');
            
            const settingsObj = {};
            settings.forEach(setting => {
                settingsObj[setting.key] = JSON.parse(setting.value);
            });

            return {
                appName: settingsObj.app_name || 'Privacy Browser',
                maxTabGroups: settingsObj.max_tab_groups || 10,
                sessionTimeout: settingsObj.session_timeout || 24,
                basicPlanPrice: settingsObj.basic_plan_price || 9.99,
                premiumPlanPrice: settingsObj.premium_plan_price || 19.99,
                trialPeriod: settingsObj.trial_period || 7,
                force2FA: settingsObj.force_2fa || false,
                autoLogout: settingsObj.auto_logout || true,
                passwordMinLength: settingsObj.password_min_length || 8
            };
        } catch (error) {
            throw new Error('Failed to get settings: ' + error.message);
        }
    }

    async saveSettings(category, settings) {
        try {
            const promises = Object.entries(settings).map(([key, value]) => {
                const settingKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                return Database.run(
                    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
                    [settingKey, JSON.stringify(value)]
                );
            });

            await Promise.all(promises);
            return true;
        } catch (error) {
            throw new Error('Failed to save settings: ' + error.message);
        }
    }

    trackUserActivity(userId, action, metadata = {}) {
        try {
            Database.run(
                'INSERT INTO user_activity (user_id, action, metadata, timestamp) VALUES (?, ?, ?, datetime("now"))',
                [userId, action, JSON.stringify(metadata)]
            );
        } catch (error) {
            console.error('Failed to track user activity:', error);
        }
    }

    updateSessionDuration(sessionToken, duration) {
        try {
            Database.run(
                'UPDATE user_sessions SET session_duration = ?, last_activity = datetime("now") WHERE session_token = ?',
                [duration, sessionToken]
            );
        } catch (error) {
            console.error('Failed to update session duration:', error);
        }
    }
}

module.exports = AdminService;
