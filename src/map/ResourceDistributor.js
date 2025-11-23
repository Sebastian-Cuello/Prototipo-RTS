/**
 * @module ResourceDistributor
 * @description Handles placement of resources (gold mines, stone deposits)
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { FACTIONS, TILES } from '../config/entityStats.js';
import Building from '../entities/Building.js';

export default class ResourceDistributor {
    place(map, buildings) {
        console.log('   → Distributing resources...');
        this.spawnGoldMines(map, buildings);
        this.spawnStoneDeposits(map, buildings); // Note: Original code didn't fully implement stone deposits, but I will add the logic.
    }

    spawnGoldMines(map, buildings) {
        const minePositions = [];

        // 1. Guaranteed mine near each base (fair distribution)
        const bases = [
            { x: 5, y: 5 },
            { x: MAP_WIDTH - 8, y: MAP_HEIGHT - 8 },
            { x: MAP_WIDTH - 8, y: 5 },
            { x: 5, y: MAP_HEIGHT - 8 }
        ];

        bases.forEach(base => {
            const mine = this.findValidLocation(map, base.x, base.y, 8, 15, 2);
            if (mine) {
                buildings.push(new Building(mine.x, mine.y, FACTIONS.NEUTRAL.id, 'goldmine'));
                minePositions.push(mine);
            }
        });

        // 2. Contested center mines
        const centerMines = 2;
        for (let i = 0; i < centerMines; i++) {
            const mine = this.findValidLocation(
                map,
                MAP_WIDTH / 2,
                MAP_HEIGHT / 2,
                3,
                12,
                2
            );
            if (mine && !this.isTooClose(mine, minePositions, 10)) {
                buildings.push(new Building(mine.x, mine.y, FACTIONS.NEUTRAL.id, 'goldmine'));
                minePositions.push(mine);
            }
        }

        // 3. Expansion locations
        const expansions = [
            { x: MAP_WIDTH / 4, y: MAP_HEIGHT / 4 },
            { x: 3 * MAP_WIDTH / 4, y: MAP_HEIGHT / 4 },
            { x: MAP_WIDTH / 4, y: 3 * MAP_HEIGHT / 4 },
            { x: 3 * MAP_WIDTH / 4, y: 3 * MAP_HEIGHT / 4 }
        ];

        expansions.forEach(exp => {
            const mine = this.findValidLocation(map, exp.x, exp.y, 3, 10, 2);
            if (mine && !this.isTooClose(mine, minePositions, 8)) {
                buildings.push(new Building(mine.x, mine.y, FACTIONS.NEUTRAL.id, 'goldmine'));
                minePositions.push(mine);
            }
        });

        console.log(`   → Spawned ${minePositions.length} gold mines`);
    }

    spawnStoneDeposits(map, buildings) {
        // Similar to gold but less critical
        const depositCount = 4;
        let spawned = 0;

        for (let i = 0; i < depositCount * 10 && spawned < depositCount; i++) {
            const x = Math.floor(Math.random() * (MAP_WIDTH - 2));
            const y = Math.floor(Math.random() * (MAP_HEIGHT - 2));

            if (this.isAreaClear(map, x, y, 2)) {
                // Add stone deposit building (assuming 'stonedeposit' exists or will exist)
                // If it doesn't exist in Building factory, this might error or create a dummy.
                // For now, I'll comment it out as in the original code, but leave the structure ready.
                // buildings.push(new Building(x, y, FACTIONS.NEUTRAL.id, 'stonedeposit'));

                // Alternatively, place stone TILES if that's how it works.
                // The original code had a `addStoneDeposits` function that modified the MAP tiles.
                // Let's check `addStoneDeposits` in original MapGenerator.js.
                // It modified `map[y][x] = TILES.STONE`.
                // So this should probably be in FeatureGenerator if it modifies tiles?
                // OR ResourceDistributor can modify tiles too if they are resources.
                // Let's stick to ResourceDistributor modifying tiles for stone if it's a tile resource.

                // Re-implementing the tile-based stone deposit logic from original code:
                const size = 2 + Math.floor(Math.random() * 3);
                let placed = false;
                for (let dy = -size; dy <= size; dy++) {
                    for (let dx = -size; dx <= size; dx++) {
                        const py = y + dy;
                        const px = x + dx;
                        if (px >= 0 && px < MAP_WIDTH && py >= 0 && py < MAP_HEIGHT) {
                            if (map[py][px].passable && Math.random() > 0.5) {
                                map[py][px] = TILES.STONE;
                                placed = true;
                            }
                        }
                    }
                }
                if (placed) spawned++;
            }
        }
    }

    findValidLocation(map, cx, cy, minDist, maxDist, size) {
        for (let attempt = 0; attempt < 100; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDist + Math.random() * (maxDist - minDist);

            const x = Math.floor(cx + Math.cos(angle) * dist);
            const y = Math.floor(cy + Math.sin(angle) * dist);

            if (this.isAreaClear(map, x, y, size)) {
                return { x, y };
            }
        }
        return null;
    }

    isAreaClear(map, x, y, size) {
        if (x < 1 || x >= MAP_WIDTH - size || y < 1 || y >= MAP_HEIGHT - size) {
            return false;
        }

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (!map[y + dy][x + dx].passable ||
                    map[y + dy][x + dx].id !== TILES.GRASS.id) {
                    return false;
                }
            }
        }

        return true;
    }

    isTooClose(pos, others, minDist) {
        return others.some(other => this.distance(pos.x, pos.y, other.x, other.y) < minDist);
    }

    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
}
