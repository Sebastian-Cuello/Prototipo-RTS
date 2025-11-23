/**
 * @module AILogger
 * @description Debug logger for AI actions
 */

export class AILogger {
    constructor(factionId, enabled = true) {
        this.factionId = factionId;
        this.enabled = enabled;
        this.actions = [];
    }

    log(manager, action, details = '') {
        if (!this.enabled) return;

        const entry = {
            time: Date.now(),
            manager,
            action,
            details
        };

        this.actions.push(entry);

        // Console log with formatting
        console.log(`🤖 AI${this.factionId} [${manager}] ${action} ${details}`);

        // Keep only last 50 actions
        if (this.actions.length > 50) {
            this.actions.shift();
        }
    }

    getHistory() {
        return this.actions;
    }

    clear() {
        this.actions = [];
    }
}
