/**
 * @module MapBalancer
 * @description Validates map balance and fairness
 */

import { FACTIONS, TILES } from '../config/entityStats.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';

export default class MapBalancer {
    validate(map, buildings) {
        const isBalanced = this.validateMapBalance(map, buildings);
        console.log(`   → Balance: ${isBalanced ? '✅ Good' : '⚠️ Unbalanced'}`);
        return isBalanced;
    }

    validateMapBalance(map, buildings) {
        const factions = [
            FACTIONS.PLAYER.id,
            FACTIONS.ENEMY.id,
            FACTIONS.ALLY.id,
            FACTIONS.ENEMY_2.id
        ];

        const metrics = factions.map(factionId => {
            const base = buildings.find(b => b.faction === factionId && b.type === 'townhall');
            if (!base) return null;

            const nearbyGold = buildings.filter(b =>
                b.type === 'goldmine' &&
                this.distance(b.x, b.y, base.x, base.y) < 20
            ).length;

            const nearbyTrees = this.countInRadius(map, base.x, base.y, 15, TILES.TREE.id);
            const buildableSpace = this.countInRadius(map, base.x, base.y, 20, TILES.GRASS.id);

            return { factionId, nearbyGold, nearbyTrees, buildableSpace };
        }).filter(m => m !== null);

        const goldCounts = metrics.map(m => m.nearbyGold);
        const goldVariance = Math.max(...goldCounts) - Math.min(...goldCounts);

        if (goldVariance > 1) {
            console.warn(`⚠️ Gold imbalance: ${goldCounts.join(', ')}`);
            return false;
        }

        return true;
    }

    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    countInRadius(map, cx, cy, radius, tileId) {
        let count = 0;
        for (let y = cy - radius; y <= cy + radius; y++) {
            for (let x = cx - radius; x <= cx + radius; x++) {
                if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                    if (this.distance(x, y, cx, cy) <= radius && map[y][x].id === tileId) {
                        count++;
                    }
                }
            }
        }
        return count;
    }
}
