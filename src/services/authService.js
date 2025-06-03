const bcrypt = require('bcrypt');
const Database = require('../database/db');
const crypto = require('../utils/crypto');

class AuthService {
    constructor() {
        this.saltRounds = 12;
    }

    async register(userData) {
        const { username, email, password } = userData;

        // Validate input
        if (!username || !email || !password) {
            throw new Error('Username, email, and password are required');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        // Check if user already exists
        const existingUser = await Database.get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            throw new Error('Username or email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, this.saltRounds);

        // Create user
        const result = await Database.run(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        return {
            id: result.id,
            username,
            email
        };
    }

    async login(credentials) {
        const { username, password } = credentials;

        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        // Find user
        const user = await Database.get(
            'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate session token
        const sessionToken = crypto.generateToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await Database.run(
            'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
            [user.id, sessionToken, expiresAt.toISOString()]
        );

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            sessionToken
        };
    }

    async validateSession(sessionToken) {
        const session = await Database.get(
            `SELECT us.*, u.username, u.email 
             FROM user_sessions us 
             JOIN users u ON us.user_id = u.id 
             WHERE us.session_token = ? AND us.expires_at > datetime('now')`,
            [sessionToken]
        );

        return session ? {
            id: session.user_id,
            username: session.username,
            email: session.email
        } : null;
    }

    async logout(sessionToken) {
        await Database.run(
            'DELETE FROM user_sessions WHERE session_token = ?',
            [sessionToken]
        );
    }

    async cleanupExpiredSessions() {
        await Database.run(
            'DELETE FROM user_sessions WHERE expires_at <= datetime("now")'
        );
    }
}

module.exports = AuthService;
