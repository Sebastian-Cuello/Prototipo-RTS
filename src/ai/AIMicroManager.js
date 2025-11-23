/**
 * @module AIMicroManager
 * @description Manages individual unit combat behavior (kiting, targeting)
 */

import { AI_TUNING } from '../config/aiTuning.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { map } from '../core/GameState.js'; // For passability check

export default class AIMicroManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
    }

    update(myUnits) {
        const army = myUnits.filter(u => u.type !== 'peasant');

        // Optimization: Only process units near enemies or in combat
        // But to find if they are near enemies, we need to query.
        // Or we iterate all and check state.

        army.forEach(unit => {
            // 1. Kiting (Archers)
            if (unit.type === 'archer') {
                this.handleKiting(unit);
            }

            // 2. Target Selection
            // Only if idle or current target dead or periodically
            if (!unit.targetEntity || unit.targetEntity.isDead || Math.random() < 0.1) {
                this.updateTarget(unit);
            }
        });
    }

    handleKiting(unit) {
        // Check for nearby melee enemies
        const nearbyEnemies = this.worldView.getEnemiesNear(unit.x, unit.y, AI_TUNING.COMBAT.KITE_DISTANCE);
        const meleeThreat = nearbyEnemies.find(u => u.type === 'soldier' || u.type === 'knight');

        if (meleeThreat) {
            // Retreat logic
            const angle = Math.atan2(unit.y - meleeThreat.y, unit.x - meleeThreat.x);
            const retreatDist = 4;
            let rx = unit.x + Math.cos(angle) * retreatDist;
            let ry = unit.y + Math.sin(angle) * retreatDist;

            // Validate position
            if (this.isValidMove(rx, ry)) {
                unit.moveTo(rx, ry);

                // Stutter step attack - set target and let unit handle attack
                if (this.dist(unit, meleeThreat) <= unit.stats.range) {
                    unit.targetEntity = meleeThreat;
                }
            }
        }
    }

    updateTarget(unit) {
        const visibleEnemies = this.worldView.getVisibleEnemies(unit);
        if (visibleEnemies.length === 0) return;

        const bestTarget = this.selectPriorityTarget(unit, visibleEnemies);

        if (bestTarget) {
            if (!unit.targetEntity || unit.targetEntity.isDead || this.shouldSwitchTarget(unit, bestTarget)) {
                // Set target and move to engage
                unit.targetEntity = bestTarget;
                unit.moveTo(bestTarget.getTileX(), bestTarget.getTileY(), bestTarget);
            }
        }
    }

    selectPriorityTarget(unit, enemies) {
        const priorities = {
            'peasant': 1,
            'archer': 4,
            'soldier': 2,
            'knight': 3,
            'townhall': 10,
            'barracks': 5,
            'guardtower': 3,
            'farm': 2
        };

        let bestTarget = null;
        let bestScore = -Infinity;

        enemies.forEach(target => {
            const distance = this.dist(unit, target);
            const healthFactor = (1 - target.health / target.maxHealth);
            const priority = priorities[target.type] || 1;

            const score = priority * 10 + healthFactor * 5 - distance * 0.5;

            if (score > bestScore && distance <= unit.stats.range + 2) { // +2 buffer
                bestScore = score;
                bestTarget = target;
            }
        });

        return bestTarget;
    }

    shouldSwitchTarget(unit, newTarget) {
        const currentTarget = unit.targetEntity;
        if (!currentTarget || currentTarget.isDead) return true;

        // Simple score comparison
        // We could reuse selectPriorityTarget logic but simplified
        const distOld = this.dist(unit, currentTarget);
        const distNew = this.dist(unit, newTarget);

        // Switch if new target is significantly closer or higher priority
        return distNew < distOld * 0.5;
    }

    isValidMove(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        return ix >= 0 && ix < MAP_WIDTH && iy >= 0 && iy < MAP_HEIGHT && map[iy][ix].passable;
    }

    dist(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
}
