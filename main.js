const { app, BrowserWindow, ipcMain, session, BrowserView } = require('electron');
const path = require('path');
const Database = require('./src/database/db');
const AuthService = require('./src/services/authService');
const TabGroupService = require('./src/services/tabGroupService');
const TimerService = require('./src/services/timerService');

class PrivacyBrowser {
    constructor() {
        this.mainWindow = null;
        this.authWindow = null;
        this.browserViews = new Map();
        this.currentUser = null;
        this.tabGroups = new Map();
        this.timers = new Map();
        
        this.initializeApp();
    }

    async initializeApp() {
        await app.whenReady();
        
        // Initialize database
        await Database.initialize();
        
        // Initialize services
        this.authService = new AuthService();
        this.tabGroupService = new TabGroupService();
        this.timerService = new TimerService();
        
        this.setupIPC();
        this.createAuthWindow();
    }

    createAuthWindow() {
        this.authWindow = new BrowserWindow({
            width: 400,
            height: 500,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            resizable: false,
            titleBarStyle: 'hiddenInset'
        });

        this.authWindow.loadFile('src/renderer/auth.html');
        
        this.authWindow.on('closed', () => {
            this.authWindow = null;
            if (!this.mainWindow) {
                app.quit();
            }
        });
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                webviewTag: true,
                preload: path.join(__dirname, 'preload.js')
            },
            titleBarStyle: 'hiddenInset'
        });

        this.mainWindow.loadFile('src/renderer/dashboard.html');
        
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
            // Close all browser views
            this.browserViews.forEach(view => {
                if (view && !view.isDestroyed()) {
                    this.mainWindow.removeBrowserView(view);
                }
            });
            this.browserViews.clear();
        });
    }

    setupIPC() {
        // Authentication
        ipcMain.handle('auth:login', async (event, credentials) => {
            try {
                const user = await this.authService.login(credentials);
                if (user) {
                    this.currentUser = user;
                    this.createMainWindow();
                    if (this.authWindow) {
                        this.authWindow.close();
                    }
                    return { success: true, user };
                }
                return { success: false, error: 'Invalid credentials' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('auth:register', async (event, userData) => {
            try {
                const user = await this.authService.register(userData);
                return { success: true, user };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('auth:logout', async () => {
            this.currentUser = null;
            // Clear all sessions and timers
            this.clearAllSessions();
            if (this.mainWindow) {
                this.mainWindow.close();
            }
            this.createAuthWindow();
            return { success: true };
        });

        // Tab Groups
        ipcMain.handle('tabgroup:create', async (event, groupData) => {
            try {
                const group = await this.tabGroupService.createTabGroup({
                    ...groupData,
                    userId: this.currentUser.id
                });
                
                // Create isolated session for this group
                const sessionName = 'tabgroup-' + group.id;
                const isolatedSession = session.fromPartition(sessionName, { cache: false });
                
                // Configure session to not store history
                isolatedSession.clearStorageData({
                    storages: ['localstorage', 'indexdb', 'websql']
                });

                this.tabGroups.set(group.id, {
                    ...group,
                    session: isolatedSession,
                    tabs: []
                });

                // Set up timer if specified
                if (group.timerMinutes > 0) {
                    this.setupGroupTimer(group.id, group.timerMinutes);
                }

                return { success: true, group };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('tabgroup:list', async () => {
            try {
                const groups = await this.tabGroupService.getUserTabGroups(this.currentUser.id);
                return { success: true, groups };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('tabgroup:delete', async (event, groupId) => {
            try {
                await this.tabGroupService.deleteTabGroup(groupId);
                this.closeTabGroup(groupId);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('tabgroup:open', async (event, groupId) => {
            try {
                this.openTabGroup(groupId);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // Browser navigation
        ipcMain.handle('browser:navigate', async (event, { groupId, url }) => {
            try {
                this.navigateInGroup(groupId, url);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser:new-tab', async (event, { groupId, url }) => {
            try {
                this.createNewTab(groupId, url);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // Timer management
        ipcMain.handle('timer:extend', async (event, groupId) => {
            try {
                const group = this.tabGroups.get(groupId);
                if (group && group.timerMinutes > 0) {
                    this.setupGroupTimer(groupId, group.timerMinutes);
                    return { success: true };
                }
                return { success: false, error: 'Group not found or no timer set' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    
        // Admin Panel
        ipcMain.handle('admin:open', async () => {
            const adminWindow = new BrowserWindow({
                width: 1000,
                height: 800,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.js')
                }
            });
    
            await adminWindow.loadFile('src/renderer/admin.html');
            return { status: 'success' };
        });
    
        // Add admin login handler
        ipcMain.handle('admin:login', async (event, credentials) => {
            try {
                // Implement admin authentication logic here
                // For example:
                if (credentials.username === 'admin' && credentials.password === 'adminpass') {
                    return { success: true };
                }
                return { success: false, error: 'Invalid admin credentials' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    }

    setupGroupTimer(groupId, minutes) {
        // Clear existing timer
        if (this.timers.has(groupId)) {
            clearTimeout(this.timers.get(groupId));
        }

        const timeoutId = setTimeout(() => {
            this.showTimerAlert(groupId, minutes);
        }, (minutes - 1) * 60 * 1000); // Alert 1 minute before closure

        this.timers.set(groupId, timeoutId);

        // Set final timeout for closure
        const finalTimeoutId = setTimeout(() => {
            this.closeTabGroup(groupId);
        }, minutes * 60 * 1000);

        this.timers.set(`${groupId}-final`, finalTimeoutId);
    }

    showTimerAlert(groupId, minutes) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('timer:alert', {
                groupId,
                message: `Tab group will close in 1 minute. Click to extend by ${minutes} minutes.`
            });
        }
    }

    openTabGroup(groupId) {
        const group = this.tabGroups.get(groupId);
        if (!group) return;

        // Create browser window for this group
        const browserWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webviewTag: true,
                preload: path.join(__dirname, 'preload.js')
            },
            titleBarStyle: 'hiddenInset'
        });

        browserWindow.loadFile('src/renderer/browser.html');
        
        // Send group data to browser window
        browserWindow.webContents.once('did-finish-load', () => {
            // Send only serializable data, excluding session and window references
            const serializableGroup = {
                id: group.id,
                name: group.name,
                description: group.description,
                timerMinutes: group.timerMinutes,
                userId: group.userId,
                createdAt: group.createdAt
            };
            browserWindow.webContents.send('group:loaded', serializableGroup);
        });

        browserWindow.on('closed', () => {
            // Clean up group reference
            const groupData = this.tabGroups.get(groupId);
            if (groupData) {
                groupData.window = null;
            }
        });

        // Update group with window reference
        group.window = browserWindow;
        this.tabGroups.set(groupId, group);
    }

    closeTabGroup(groupId) {
        const group = this.tabGroups.get(groupId);
        if (group) {
            // Close window if open
            if (group.window && !group.window.isDestroyed()) {
                group.window.close();
            }

            // Clear timers
            if (this.timers.has(groupId)) {
                clearTimeout(this.timers.get(groupId));
                this.timers.delete(groupId);
            }
            if (this.timers.has(`${groupId}-final`)) {
                clearTimeout(this.timers.get(`${groupId}-final`));
                this.timers.delete(`${groupId}-final`);
            }

            // Clear session data
            if (group.session) {
                group.session.clearStorageData();
            }

            this.tabGroups.delete(groupId);
        }

        // Notify main window
        if (this.mainWindow) {
            this.mainWindow.webContents.send('group:closed', groupId);
        }
    }

    clearAllSessions() {
        this.tabGroups.forEach((group, groupId) => {
            this.closeTabGroup(groupId);
        });
        this.timers.clear();
    }
}

// App event handlers
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        new PrivacyBrowser();
    }
});
// Initialize the application
new PrivacyBrowser();

  