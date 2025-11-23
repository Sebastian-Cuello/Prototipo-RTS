/**
 * @module AIBuildManager
 * @description Manages AI construction and research
 */

import { AI_TUNING } from '../config/aiTuning.js';
import { UPGRADES } from '../config/entityStats.js';
import { gameState } from '../core/GameState.js'; // Need access to upgrades
import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { map } from '../core/GameState.js'; // For placement check

export default class AIBuildManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
    }

    update(myUnits, myBuildings, resources) {
        this.handleResearch(myBuildings, resources);
        this.handleConstruction(myUnits, myBuildings, resources);
    }

    handleResearch(myBuildings, resources) {
        const blacksmith = myBuildings.find(b => b.type === 'blacksmith' && !b.isBlueprint);
        if (blacksmith && blacksmith.stats.research) {
            blacksmith.stats.research.forEach(upgId => {
                if (!gameState.factionUpgrades[this.factionId].includes(upgId)) {
                    const upgrade = UPGRADES[upgId];
                    if (resources.gold >= upgrade.cost.gold && resources.wood >= upgrade.cost.wood) {
                        blacksmith.research(upgId);
                    }
                }
            });
        }
    }

    handleConstruction(myUnits, myBuildings, resources) {
        const peasants = myUnits.filter(u => u.type === 'peasant');
        const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
        if (!townHall) return;

        const buildOrder = this.personality.buildPriority;
        const limits = AI_TUNING.LIMITS;

        const counts = {
            farm: myBuildings.filter(b => b.type === 'farm').length,
            barracks: myBuildings.filter(b => b.type === 'barracks').length,
            lumbermill: myBuildings.filter(b => b.type === 'lumbermill').length,
            blacksmith: myBuildings.filter(b => b.type === 'blacksmith').length,
            guardtower: myBuildings.filter(b => b.type === 'guardtower').length
        };

        // 1. Emergency Food
        if (resources.foodMax - resources.foodUsed <= 6 && counts.farm < limits.farm && !this.isBuilding(myBuildings, 'farm')) {
            this.tryBuild(peasants, resources, 'farm', townHall);
            return;
        }

        // 2. Personality Build Order
        for (const type of buildOrder) {
            if (counts[type] < limits[type]) {
                if (!this.isBuilding(myBuildings, type)) {
                    this.tryBuild(peasants, resources, type, townHall);
                    return;
                }
            }
        }

        // 3. Excess Resources
        if (resources.gold > 500) {
            if (counts.barracks < limits.barracks) this.tryBuild(peasants, resources, 'barracks', townHall);
            else if (counts.farm < limits.farm) this.tryBuild(peasants, resources, 'farm', townHall);
        }

        // 4. Upgrade Town Hall
        if (townHall.type === 'townhall' && resources.gold > 1000) {
            townHall.upgrade();
        }
    }

    isBuilding(myBuildings, type) {
        return myBuildings.some(b => b.type === type && b.isBlueprint);
    }

    tryBuild(peasants, resources, type, nearEntity) {
        // Find idle builder
        const builder = peasants.find(p => !p.isBuilding && !p.isGathering && !p.isMoving) || peasants[0];
        if (!builder) return;

        // Check cost (handled by Entity but good to check here)
        // We assume caller checked resources or Entity will fail.

        // Find placement
        const pos = this.findBuildLocation(nearEntity.x, nearEntity.y, 3, 20);
        if (pos) {
            builder.startBuilding(type, pos.x, pos.y);
        }
    }

    findBuildLocation(cx, cy, size, radius) {
        // Spiral search
        for (let r = 3; r < radius; r++) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
                const x = Math.floor(cx + Math.cos(angle) * r);
                const y = Math.floor(cy + Math.sin(angle) * r);

                if (this.isValidLocation(x, y, size)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    isValidLocation(x, y, size) {
        if (x < 2 || x >= MAP_WIDTH - 2 || y < 2 || y >= MAP_HEIGHT - 2) return false;

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (!map[y + dy][x + dx].passable) return false;
            }
        }
        return true;
    }
}
