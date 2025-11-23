/**
 * @module AIEconomyManager
 * @description Manages AI economy: peasant training and resource gathering
 */

import { AI_TUNING } from '../config/aiTuning.js';
import { TILES } from '../config/entityStats.js';
import { buildings, map } from '../core/GameState.js'; // Direct access needed for global resource search if not in view?
// Actually, AIWorldView should provide access to resources.
// But for now, let's use global buildings for mines, as they are "neutral" or "owned".

export default class AIEconomyManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
    }

    update(myUnits, myBuildings, resources) {
        this.handlePeasantTraining(myUnits, myBuildings, resources);
        this.handleResourceGathering(myUnits, myBuildings);
    }

    handlePeasantTraining(myUnits, myBuildings, resources) {
        const peasants = myUnits.filter(u => u.type === 'peasant');
        const townHalls = myBuildings.filter(b => b.type === 'townhall' || b.type === 'keep');

        townHalls.forEach(townHall => {
            // Cap peasants per base
            if (!townHall.isBlueprint && peasants.length < AI_TUNING.ECONOMY.MAX_PEASANTS_PER_BASE * townHalls.length) {
                if (resources.gold >= 50 && resources.foodUsed < resources.foodMax) {
                    townHall.trainUnit('peasant');
                }
            }
        });
    }

    handleResourceGathering(myUnits, myBuildings) {
        const peasants = myUnits.filter(u => u.type === 'peasant');
        const goldMiners = peasants.filter(p => p.resourceType === 'gold');

        peasants.forEach(peasant => {
            // Reset if stuck
            if (peasant.cargo > 0 && !peasant.isGathering && !peasant.isMoving) {
                peasant.startGathering(peasant.resourceType || 'gold', peasant.x, peasant.y);
            }

            if (!peasant.isGathering && !peasant.isBuilding && !peasant.isMoving && !peasant.targetEntity) {
                let type = 'wood';

                // Balance based on personality or default ratio
                const ratio = this.personality.economyFocus || AI_TUNING.ECONOMY.GOLD_WOOD_RATIO;

                if (goldMiners.length < peasants.length * ratio) {
                    type = 'gold';
                }

                if (type === 'gold') {
                    this.assignToGold(peasant);
                } else {
                    this.assignToWood(peasant);
                }
            }
        });
    }

    assignToGold(peasant) {
        // Find nearest gold mine
        // TODO: Use SpatialHash via WorldView?
        // Mines are buildings.
        const mines = buildings.filter(b => b.type === 'goldmine');
        let best = null, minD = Infinity;

        mines.forEach(m => {
            const d = Math.abs(peasant.x - m.x) + Math.abs(peasant.y - m.y);
            if (d < minD) { minD = d; best = m; }
        });

        if (best) peasant.startGathering('gold', best.x, best.y, best);
    }

    assignToWood(peasant) {
        // Find nearest tree
        // Trees are tiles. SpatialHash might not index tiles unless we added them?
        // Usually tiles are just in the map array.
        // The original code used random sampling.

        let best = null, minD = Infinity;
        // Optimization: Scan outward from peasant? Or random sample like before?
        // Random sample is O(1) but unreliable.
        // Spiral search is O(N) but reliable.

        // Let's stick to random sample for now to avoid O(N^2) if we scan too much.
        // But we can improve it by checking neighbors first.

        for (let i = 0; i < 20; i++) {
            const rx = Math.floor(peasant.x + (Math.random() * 30 - 15));
            const ry = Math.floor(peasant.y + (Math.random() * 30 - 15));

            if (rx >= 0 && rx < map[0].length && ry >= 0 && ry < map.length && map[ry][rx].id === TILES.TREE.id) {
                const d = Math.abs(peasant.x - rx) + Math.abs(peasant.y - ry);
                if (d < minD) { minD = d; best = { x: rx, y: ry }; }
            }
        }

        if (best) peasant.startGathering('wood', best.x, best.y);
    }
}
