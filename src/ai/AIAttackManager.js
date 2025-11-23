/**
 * @module AIAttackManager
 * @description Manages AI offensive operations
 */

import { AI_TUNING } from '../config/aiTuning.js';
import { FACTIONS } from '../config/entityStats.js';
import { buildings, units, allianceSystem } from '../core/GameState.js';

export default class AIAttackManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
        this.waveIndex = 0;
    }

    update(myUnits, myBuildings, state) {
        if (state !== 'ATTACK') return;

        const army = myUnits.filter(u => u.type !== 'peasant');

        // Retreat if army is decimated
        if (army.length < 3) {
            return 'GROWTH'; // Signal to switch state
        }

        const targets = this.findTargets();
        if (targets.length === 0) {
            return 'GROWTH';
        }

        // Split army if large enough
        if (army.length > 12 && targets.length > 1) {
            const groups = this.createBalancedGroups(army, 2);
            groups.forEach((group, idx) => {
                const target = targets[idx % targets.length];
                this.commandGroup(group, target);
            });
        } else {
            this.commandGroup(army, targets[0]);
        }

        return 'ATTACK';
    }

    commandGroup(group, target) {
        group.forEach(u => {
            // Chase logic: if already targeting, check if we should keep chasing
            if (u.targetEntity && !u.targetEntity.isDead) {
                const dist = Math.abs(u.targetEntity.x - u.x) + Math.abs(u.targetEntity.y - u.y);
                const maxChase = u.stats.range + AI_TUNING.COMBAT.CHASE_TOLERANCE;

                // If too far, stop chasing and return to main target
                if (dist > maxChase) {
                    u.targetEntity = null;
                    u.moveTo(target.x, target.y, target);
                }
            } else if (!u.isMoving && !u.targetEntity) {
                u.moveTo(target.x, target.y, target);
            }
        });
    }

    createBalancedGroups(army, numGroups) {
        const soldiers = army.filter(u => u.type === 'soldier');
        const archers = army.filter(u => u.type === 'archer');
        const knights = army.filter(u => u.type === 'knight');

        const groups = Array.from({ length: numGroups }, () => []);

        [soldiers, archers, knights].forEach(unitType => {
            unitType.forEach((unit, idx) => {
                groups[idx % numGroups].push(unit);
            });
        });

        return groups;
    }

    findTargets() {
        // Filter enemy buildings using alliance system
        const enemyBuildings = buildings.filter(b =>
            !b.isDead &&
            b.faction !== FACTIONS.NEUTRAL.id &&
            allianceSystem.areEnemies(this.factionId, b.faction)
        );

        // Filter by exploration (Fog of War)
        const knownBuildings = enemyBuildings.filter(b =>
            this.worldView.isExplored(b.x, b.y)
        );

        if (knownBuildings.length > 0) {
            // Prioritize Town Halls
            const townHalls = knownBuildings.filter(b => b.type === 'townhall' || b.type === 'keep');
            if (townHalls.length > 0) return townHalls;
            return knownBuildings;
        }

        // If no buildings known, check for known units using alliance system
        const enemyUnits = units.filter(u =>
            !u.isDead &&
            allianceSystem.areEnemies(this.factionId, u.faction) &&
            this.worldView.isExplored(u.x, u.y)
        );

        if (enemyUnits.length > 0) {
            return [enemyUnits[0]];
        }

        return [];
    }
}
