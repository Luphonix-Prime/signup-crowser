const Database = require('../database/db');

class TabGroupService {
    async createTabGroup(groupData) {
        const { userId, name, timerMinutes = 0 } = groupData;

        if (!userId || !name) {
            throw new Error('User ID and group name are required');
        }

        if (timerMinutes < 0 || timerMinutes > 1440) { // Max 24 hours
            throw new Error('Timer must be between 0 and 1440 minutes');
        }

        const result = await Database.run(
            'INSERT INTO tab_groups (user_id, name, timer_minutes) VALUES (?, ?, ?)',
            [userId, name, timerMinutes]
        );

        return {
            id: result.id,
            userId,
            name,
            timerMinutes,
            createdAt: new Date().toISOString()
        };
    }

    async getUserTabGroups(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const groups = await Database.all(
            'SELECT * FROM tab_groups WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        return groups.map(group => ({
            id: group.id,
            userId: group.user_id,
            name: group.name,
            timerMinutes: group.timer_minutes,
            createdAt: group.created_at
        }));
    }

    async getTabGroup(groupId) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        const group = await Database.get(
            'SELECT * FROM tab_groups WHERE id = ?',
            [groupId]
        );

        if (!group) {
            throw new Error('Tab group not found');
        }

        return {
            id: group.id,
            userId: group.user_id,
            name: group.name,
            timerMinutes: group.timer_minutes,
            createdAt: group.created_at
        };
    }

    async updateTabGroup(groupId, updates) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        const { name, timerMinutes } = updates;
        const setClauses = [];
        const values = [];

        if (name !== undefined) {
            setClauses.push('name = ?');
            values.push(name);
        }

        if (timerMinutes !== undefined) {
            if (timerMinutes < 0 || timerMinutes > 1440) {
                throw new Error('Timer must be between 0 and 1440 minutes');
            }
            setClauses.push('timer_minutes = ?');
            values.push(timerMinutes);
        }

        if (setClauses.length === 0) {
            throw new Error('No valid updates provided');
        }

        values.push(groupId);

        const result = await Database.run(
            `UPDATE tab_groups SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );

        if (result.changes === 0) {
            throw new Error('Tab group not found');
        }

        return this.getTabGroup(groupId);
    }

    async deleteTabGroup(groupId) {
        if (!groupId) {
            throw new Error('Group ID is required');
        }

        const result = await Database.run(
            'DELETE FROM tab_groups WHERE id = ?',
            [groupId]
        );

        if (result.changes === 0) {
            throw new Error('Tab group not found');
        }

        return true;
    }

    async deleteUserTabGroups(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        await Database.run(
            'DELETE FROM tab_groups WHERE user_id = ?',
            [userId]
        );

        return true;
    }
}

module.exports = TabGroupService;
