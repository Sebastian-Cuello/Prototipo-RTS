/**
 * @module AIStrategyManager
 * @description Manages high-level AI strategy and personality adaptation
 */

import { AI_TUNING } from '../config/aiTuning.js';

export default class AIStrategyManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
    }

    update(myUnits, myBuildings, resources, currentState) {
        // Adapt Strategy periodically (handled by Controller timer)
        // Here we just provide the logic

        const army = myUnits.filter(u => u.type !== 'peasant');
        const peasants = myUnits.filter(u => u.type === 'peasant');

        // Economic Health
        const goldRate = resources.gold / (peasants.length || 1);
        const isEconomyStrong = goldRate > 20 && peasants.length > 10;
        const isEconomyWeak = goldRate < 10 || peasants.length < 5;

        // Pressure
        // Use WorldView to detect threats
        // We need to know if we are under attack.
        // DefenseManager handles immediate response, but Strategy should know if we are losing.

        // Simple check: Are buildings dying? (Not tracked here easily without events)
        // Check nearby enemies to base
        const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
        let isUnderPressure = false;
        if (townHall) {
            const threats = this.worldView.getEnemiesNear(townHall.x, townHall.y, 30);
            isUnderPressure = threats.length > 3;
        }

        if (isUnderPressure && !isEconomyStrong) {
            // Emergency Defense
            this.personality.militaryFocus = 0.8;
            this.personality.economyFocus = 0.2;
        } else if (isEconomyWeak && !isUnderPressure) {
            // Recover Economy
            this.personality.economyFocus = 0.7;
            this.personality.militaryFocus = 0.3;
        } else if (isEconomyStrong && army.length > AI_TUNING.ECONOMY.EXPANSION_ARMY_THRESHOLD) {
            // Prepare Attack
            this.personality.militaryFocus = 0.7;
            this.personality.economyFocus = 0.3;
        }

        // State Transitions
        // If we have a huge army, maybe force ATTACK?
        // This logic was in handleAttack.

        if (currentState === 'GROWTH') {
            if (army.length >= this.personality.expansionThreshold) {
                return 'ATTACK';
            }
        }

        return currentState;
    }
}
