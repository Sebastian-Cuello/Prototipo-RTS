/**
 * @module AIDefenseManager
 * @description Manages AI defensive operations and raid response
 */

import { AI_TUNING } from '../config/aiTuning.js';
import { FACTIONS } from '../config/entityStats.js';

export default class AIDefenseManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
    }

    update(myUnits, myBuildings, state) {
        const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
        if (!townHall) return state;

        // 1. Check for threats near base
        // Use WorldView to get enemies near TownHall
        const threats = this.worldView.getEnemiesNear(townHall.x, townHall.y, 20);

        if (threats.length > 0) {
            this.respondToThreats(myUnits, threats, townHall);
            return 'DEFENSE';
        } else if (state === 'DEFENSE') {
            return 'GROWTH'; // Threat cleared
        }

        // 2. Check for raids on peasants
        this.detectAndRespondToRaids(myUnits, myBuildings);

        return state;
    }

    respondToThreats(myUnits, threats, townHall) {
        const army = myUnits.filter(u => u.type !== 'peasant');
        const threat = threats[0]; // Focus on first threat for now

        army.forEach(unit => {
            if (!unit.targetEntity) {
                unit.moveTo(threat.x, threat.y, threat);
            }
        });

        // Peasants fight if desperate
        if (Math.abs(threat.x - townHall.x) < 8) {
            myUnits.filter(u => u.type === 'peasant').forEach(p => {
                if (!p.targetEntity) p.moveTo(threat.x, threat.y, threat);
            });
        }
    }

    detectAndRespondToRaids(myUnits, myBuildings) {
        const peasants = myUnits.filter(u => u.type === 'peasant');

        peasants.forEach(peasant => {
            // Check for enemies very close to peasant
            const nearbyEnemies = this.worldView.getEnemiesNear(peasant.x, peasant.y, 8);

            if (nearbyEnemies.length > 0) {
                // Raid Detected
                // 1. Flee
                const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
                if (townHall) {
                    peasant.moveTo(townHall.x, townHall.y);
                }

                // 2. Call for help
                const army = myUnits.filter(u => u.type !== 'peasant');
                // Find nearest defenders
                // Optimization: Use SpatialHash via WorldView if possible, but we need OUR units.
                // WorldView.getUnitsInArea(peasant.x, peasant.y, 20) and filter?

                const nearbyDefenders = army.filter(u =>
                    Math.abs(u.x - peasant.x) < 20 && Math.abs(u.y - peasant.y) < 20
                ).slice(0, 5);

                nearbyDefenders.forEach(defender => {
                    if (!defender.targetEntity) {
                        defender.moveTo(nearbyEnemies[0].x, nearbyEnemies[0].y, nearbyEnemies[0]);
                    }
                });
            }
        });
    }
}
