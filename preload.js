const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Authentication
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    register: (userData) => ipcRenderer.invoke('auth:register', userData),
    logout: () => ipcRenderer.invoke('auth:logout'),

    // Tab Groups
    createTabGroup: (groupData) => ipcRenderer.invoke('tabgroup:create', groupData),
    listTabGroups: () => ipcRenderer.invoke('tabgroup:list'),
    deleteTabGroup: (groupId) => ipcRenderer.invoke('tabgroup:delete', groupId),
    openTabGroup: (groupId) => ipcRenderer.invoke('tabgroup:open', groupId),

    // Browser
    navigate: (data) => ipcRenderer.invoke('browser:navigate', data),
    newTab: (data) => ipcRenderer.invoke('browser:new-tab', data),

    // Timer
    extendTimer: (groupId) => ipcRenderer.invoke('timer:extend', groupId),

    // Event listeners
    onTimerAlert: (callback) => ipcRenderer.on('timer:alert', callback),
    onGroupClosed: (callback) => ipcRenderer.on('group:closed', callback),
    onGroupLoaded: (callback) => ipcRenderer.on('group:loaded', callback),

    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    // Admin Panel
    openAdminPanel: () => ipcRenderer.invoke('admin:open'),
});

contextBridge.exposeInMainWorld('electron', {
    webviewTag: true  // Allow webview tag
});

