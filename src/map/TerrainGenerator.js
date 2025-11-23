/**
 * @module TerrainGenerator
 * @description Handles base terrain generation (Forest, Open, Islands, Highlands)
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { TILES } from '../config/entityStats.js';

export const MAP_TEMPLATES = {
    RANDOM: 'random',
    FOREST: 'forest',      // Dense trees
    OPEN: 'open',          // Sparse trees, open space
    ISLANDS: 'islands',    // Separated by water
    HIGHLANDS: 'highlands' // Mountain terrain
};

export default class TerrainGenerator {
    generate(template) {
        console.log(`   → Generating base terrain: ${template}`);
        switch (template) {
            case MAP_TEMPLATES.FOREST:
                return this.generateForestMap();
            case MAP_TEMPLATES.OPEN:
                return this.generateOpenMap();
            case MAP_TEMPLATES.ISLANDS:
                return this.generateIslandMap();
            case MAP_TEMPLATES.HIGHLANDS:
                return this.generateHighlandMap();
            default:
                return this.generateForestMap();
        }
    }

    initializeEmptyMap(fillTile) {
        const newMap = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            newMap[y] = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                newMap[y][x] = fillTile;
            }
        }
        return newMap;
    }

    // --- FOREST MAP ---
    generateForestMap() {
        const newMap = this.initializeEmptyMap(TILES.GRASS);

        // 1. Random tree placement
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (Math.random() < 0.42) {
                    newMap[y][x] = TILES.TREE;
                }
            }
        }

        // 2. Cellular automata smoothing (Optimized with double buffering)
        let currentMap = newMap;
        let nextMap = this.initializeEmptyMap(TILES.GRASS); // Pre-allocate buffer

        for (let iteration = 0; iteration < 4; iteration++) {
            for (let y = 0; y < MAP_HEIGHT; y++) {
                for (let x = 0; x < MAP_WIDTH; x++) {
                    const neighbors = this.countNeighbors(currentMap, x, y, TILES.TREE.id);

                    if (neighbors > 4) {
                        nextMap[y][x] = TILES.TREE;
                    } else if (neighbors < 3) {
                        nextMap[y][x] = TILES.GRASS;
                    } else {
                        nextMap[y][x] = currentMap[y][x];
                    }
                }
            }
            // Swap buffers
            [currentMap, nextMap] = [nextMap, currentMap];
        }

        return currentMap;
    }

    // --- OPEN MAP ---
    generateOpenMap() {
        const newMap = this.initializeEmptyMap(TILES.GRASS);

        // Sparse tree clusters logic will be handled by FeatureGenerator or here?
        // The original code had it here. Let's keep base terrain simple and let FeatureGenerator handle features?
        // Actually, the original generateOpenMap creates clusters directly. 
        // To keep it clean, I'll implement the basic structure here.
        // But wait, the user said "TerrainGenerator -> only creates array of tiles".
        // So I should probably keep the main structure generation here.

        // Sparse tree clusters
        // We need addCircularFeature. Since it modifies the map, maybe it belongs in FeatureGenerator?
        // But if it's part of the "base" terrain generation (like islands), it might be better here.
        // However, the user explicitly said "FeatureGenerator -> lakes, mountains, decorations".
        // Trees are kind of in between.
        // Let's put the *logic* for clusters here but maybe use a helper if needed.
        // For now, I'll inline the cluster logic or use a local helper to avoid circular dependency if I were to use FeatureGenerator.

        const clusterCount = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < clusterCount; i++) {
            const cx = Math.floor(Math.random() * MAP_WIDTH);
            const cy = Math.floor(Math.random() * MAP_HEIGHT);
            const radius = 3 + Math.floor(Math.random() * 4);

            this.addCircularFeature(newMap, cx, cy, radius, TILES.TREE, 0.6);
        }

        return newMap;
    }

    // --- ISLAND MAP ---
    generateIslandMap() {
        const newMap = this.initializeEmptyMap(TILES.WATER);

        // Create 4 main islands (one per faction)
        const islands = [
            { x: Math.floor(MAP_WIDTH * 0.25), y: Math.floor(MAP_HEIGHT * 0.25), radius: 14 },
            { x: Math.floor(MAP_WIDTH * 0.75), y: Math.floor(MAP_HEIGHT * 0.25), radius: 14 },
            { x: Math.floor(MAP_WIDTH * 0.25), y: Math.floor(MAP_HEIGHT * 0.75), radius: 14 },
            { x: Math.floor(MAP_WIDTH * 0.75), y: Math.floor(MAP_HEIGHT * 0.75), radius: 14 }
        ];

        islands.forEach(island => {
            // Create island landmass
            for (let y = island.y - island.radius; y <= island.y + island.radius; y++) {
                for (let x = island.x - island.radius; x <= island.x + island.radius; x++) {
                    if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                        const dist = Math.sqrt((x - island.x) ** 2 + (y - island.y) ** 2);

                        // Irregular island edges
                        const noise = Math.random() * 2;
                        if (dist <= island.radius - noise) {
                            newMap[y][x] = Math.random() > 0.35 ? TILES.GRASS : TILES.TREE;
                        }
                    }
                }
            }
        });

        // Bridges will be added by FeatureGenerator as they are "features" connecting land?
        // Or should they be part of the base terrain?
        // The user said "FeatureGenerator -> lakes, mountains, decorations".
        // Bridges feel like base terrain connectivity. I'll include them here for now to ensure connectivity.
        // Actually, let's move bridges to FeatureGenerator to strictly follow "TerrainGenerator -> array of tiles".
        // But wait, if I don't add bridges, the map is broken.
        // Let's keep bridges here as they are essential for the "Island" template to work.

        this.addBridge(newMap, islands[0], islands[1], 2); // Top horizontal
        this.addBridge(newMap, islands[2], islands[3], 2); // Bottom horizontal
        this.addBridge(newMap, islands[0], islands[2], 2); // Left vertical
        this.addBridge(newMap, islands[1], islands[3], 2); // Right vertical

        return newMap;
    }

    // --- HIGHLAND MAP ---
    generateHighlandMap() {
        const newMap = this.initializeEmptyMap(TILES.GRASS);

        // Heavy mountain coverage - this is a feature, but it defines the terrain type.
        // I'll leave the heavy lifting to FeatureGenerator for mountains, 
        // but here I can set the base "light forests".

        // Light forests
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (newMap[y][x].passable && Math.random() < 0.25) {
                    newMap[y][x] = TILES.TREE;
                }
            }
        }

        return newMap;
    }

    // --- UTILS ---
    countNeighbors(map, x, y, tileId) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < MAP_HEIGHT && nx >= 0 && nx < MAP_WIDTH) {
                    if (map[ny][nx].id === tileId) count++;
                } else {
                    count++; // Edges count as filled
                }
            }
        }
        return count;
    }

    addCircularFeature(map, cx, cy, radius, tile, probability) {
        for (let y = cy - radius; y <= cy + radius; y++) {
            for (let x = cx - radius; x <= cx + radius; x++) {
                if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                    if (dist <= radius && Math.random() < probability) {
                        map[y][x] = tile;
                    }
                }
            }
        }
    }

    addBridge(map, island1, island2, width) {
        const dx = island2.x - island1.x;
        const dy = island2.y - island1.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.floor(island1.x + dx * t);
            const y = Math.floor(island1.y + dy * t);

            for (let w = -width / 2; w <= width / 2; w++) {
                const bx = x + (dx === 0 ? w : 0);
                const by = y + (dy === 0 ? w : 0);

                if (bx >= 0 && bx < MAP_WIDTH && by >= 0 && by < MAP_HEIGHT) {
                    map[by][bx] = TILES.GRASS;
                }
            }
        }
    }
}
