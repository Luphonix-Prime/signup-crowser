class TimerService {
    constructor() {
        this.activeTimers = new Map();
        this.callbacks = new Map();
    }

    createTimer(groupId, minutes, onWarning, onExpiry) {
        this.clearTimer(groupId);

        const warningTime = Math.max(1, minutes - 1); // Warning 1 minute before expiry
        const expiryTime = minutes;

        // Set warning timer
        const warningTimer = setTimeout(() => {
            if (onWarning) {
                onWarning(groupId);
            }
        }, warningTime * 60 * 1000);

        // Set expiry timer
        const expiryTimer = setTimeout(() => {
            if (onExpiry) {
                onExpiry(groupId);
            }
            this.clearTimer(groupId);
        }, expiryTime * 60 * 1000);

        this.activeTimers.set(groupId, {
            warningTimer,
            expiryTimer,
            startTime: Date.now(),
            totalMinutes: minutes
        });

        this.callbacks.set(groupId, { onWarning, onExpiry });
    }

    extendTimer(groupId, additionalMinutes) {
        const timerData = this.activeTimers.get(groupId);
        const callbacks = this.callbacks.get(groupId);

        if (!timerData || !callbacks) {
            throw new Error('Timer not found for group');
        }

        // Clear existing timers
        clearTimeout(timerData.warningTimer);
        clearTimeout(timerData.expiryTimer);

        // Calculate elapsed time
        const elapsedMs = Date.now() - timerData.startTime;
        const elapsedMinutes = elapsedMs / (60 * 1000);
        const remainingMinutes = Math.max(0, timerData.totalMinutes - elapsedMinutes);

        // Create new timer with extended time
        const newTotalMinutes = remainingMinutes + additionalMinutes;
        this.createTimer(groupId, newTotalMinutes, callbacks.onWarning, callbacks.onExpiry);

        return newTotalMinutes;
    }

    clearTimer(groupId) {
        const timerData = this.activeTimers.get(groupId);
        if (timerData) {
            clearTimeout(timerData.warningTimer);
            clearTimeout(timerData.expiryTimer);
            this.activeTimers.delete(groupId);
        }
        this.callbacks.delete(groupId);
    }

    getRemainingTime(groupId) {
        const timerData = this.activeTimers.get(groupId);
        if (!timerData) {
            return 0;
        }

        const elapsedMs = Date.now() - timerData.startTime;
        const elapsedMinutes = elapsedMs / (60 * 1000);
        const remainingMinutes = Math.max(0, timerData.totalMinutes - elapsedMinutes);

        return remainingMinutes;
    }

    isActive(groupId) {
        return this.activeTimers.has(groupId);
    }

    clearAllTimers() {
        this.activeTimers.forEach((timerData) => {
            clearTimeout(timerData.warningTimer);
            clearTimeout(timerData.expiryTimer);
        });
        this.activeTimers.clear();
        this.callbacks.clear();
    }

    getActiveTimers() {
        return Array.from(this.activeTimers.keys());
    }
}

module.exports = TimerService;
