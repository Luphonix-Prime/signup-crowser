class AuthManager {
    constructor() {
        this.currentForm = 'login';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Form switching
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchForm('register');
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchForm('login');
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Admin panel access
        document.getElementById('admin-login-btn').addEventListener('click', () => {
            this.handleAdminAccess();
        });
    }

    switchForm(formType) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (formType === 'register') {
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
            this.currentForm = 'register';
        } else {
            registerForm.classList.remove('active');
            loginForm.classList.add('active');
            this.currentForm = 'login';
        }

        this.clearError();
        this.clearForms();
    }

    async handleLogin() {
        const form = document.getElementById('loginForm');
        const formData = new FormData(form);
        
        const credentials = {
            username: formData.get('username').trim(),
            password: formData.get('password')
        };

        if (!credentials.username || !credentials.password) {
            this.showError('Please fill in all fields');
            return;
        }

        this.showLoading(true);
        this.clearError();

        try {
            const result = await window.electronAPI.login(credentials);
            
            if (result.success) {
                // Check if user is admin and redirect accordingly
                if (result.user && result.user.role === 'admin') {
                    // Open admin panel
                    await window.electronAPI.openAdminPanel();
                } else {
                    // Open regular browser/dashboard
                    await window.electronAPI.openBrowser();
                }
                this.showLoading(false);
            } else {
                this.showError(result.error || 'Login failed');
                this.showLoading(false);
            }
        } catch (error) {
            this.showError('An unexpected error occurred. Please try again.');
            this.showLoading(false);
            console.error('Login error:', error);
        }
    }

    async handleRegister() {
        const form = document.getElementById('registerForm');
        const formData = new FormData(form);
        
        const userData = {
            username: formData.get('username').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword')
        };

        // Validation
        if (!userData.username || !userData.email || !userData.password || !userData.confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(userData.email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (userData.password.length < 8) {
            this.showError('Password must be at least 8 characters long');
            return;
        }

        if (userData.password !== userData.confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (!this.isValidUsername(userData.username)) {
            this.showError('Username must be 3-20 characters long and contain only letters, numbers, and underscores');
            return;
        }

        this.showLoading(true);
        this.clearError();

        try {
            const result = await window.electronAPI.register(userData);
            
            if (result.success) {
                this.showSuccess('Account created successfully! Please sign in.');
                this.switchForm('login');
            } else {
                this.showError(result.error || 'Registration failed');
            }
        } catch (error) {
            this.showError('An unexpected error occurred. Please try again.');
            console.error('Registration error:', error);
        }

        this.showLoading(false);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidUsername(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        return usernameRegex.test(username);
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.clearError();
        }, 5000);
    }

    showSuccess(message) {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = message;
        errorElement.classList.add('show', 'success');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.clearError();
        }, 3000);
    }

    clearError() {
        const errorElement = document.getElementById('error-message');
        errorElement.classList.remove('show', 'success');
        errorElement.textContent = '';
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (show) {
            loadingElement.classList.remove('hidden');
        } else {
            loadingElement.classList.add('hidden');
        }
    }

    async handleAdminAccess() {
        const username = prompt('Enter admin username:');
        const password = prompt('Enter admin password:');
        
        if (!username || !password) {
            this.showError('Admin credentials required');
            return;
        }

        this.showLoading(true);
        this.clearError();

        try {
            const result = await window.electronAPI.adminLogin({ username, password });
            
            if (result.success) {
                // Open admin panel directly
                await window.electronAPI.openAdminPanel();
                this.showLoading(false);
            } else {
                this.showError('Admin login failed: ' + (result.error || 'Invalid credentials'));
                this.showLoading(false);
            }
        } catch (error) {
            this.showError('Admin login error occurred');
            this.showLoading(false);
            console.error('Admin login error:', error);
        }
    }

    clearForms() {
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
    }
}

// Initialize the auth manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});
