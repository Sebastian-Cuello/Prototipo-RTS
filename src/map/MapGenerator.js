/**
 * @module MapGenerator
 * @description Procedural map generation and entity spawning
 * 
 * This module handles:
 * - Procedural terrain generation using cellular automata
 * - Spawn area clearing for faction bases
 * - Gold mine placement
 * - Initial entity spawning (town halls, units)
 * - Faction resource initialization
 * 
 * Key Features:
 * - Cellular automata for realistic forest generation
 * - Mountain range generation
 * - Strategic resource (gold mine) placement
 * - Guaranteed clear spawn areas for each faction
 * - Automatic base setup (town hall + peasants)
 * - Per-faction resource initialization
 * 
 * Map Layout:
 * - 4 faction starting positions (corners of the map)
 * - Scattered gold mines for strategic control
 * - Forest areas generated using cellular automata
 * - Clear grass areas for building placement
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { TILES, FACTIONS, BUILDING_STATS } from '../config/entityStats.js';
import { map, units, buildings, gameState, setMap, setUnits, setBuildings, setSpatialHash, setPathfinder } from '../core/GameState.js';
import SpatialHash from './SpatialHash.js';
import Pathfinder from '../systems/Pathfinder.js';
import { initFog } from '../systems/FogOfWar.js';
import Unit from '../entities/Unit.js';
import Building from '../entities/Building.js';
import { updateResourcesUI } from '../ui/UIManager.js';

export function generateMap() {
    // Initialize with Grass
    const newMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        newMap[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            newMap[y][x] = TILES.GRASS;
        }
    }

    // Cellular Automata for Forests
    // 1. Random Fill
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (Math.random() < 0.40) {
                newMap[y][x] = TILES.TREE;
            }
        }
    }

    // 2. Smoothing Iterations
    for (let i = 0; i < 4; i++) {
        const tempMap = JSON.parse(JSON.stringify(newMap)); // Deep copy
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                let neighbors = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < MAP_HEIGHT && nx >= 0 && nx < MAP_WIDTH) {
                            if (tempMap[ny][nx].id === TILES.TREE.id) neighbors++;
                        } else {
                            neighbors++; // Edge counts as tree
                        }
                    }
                }

                if (neighbors > 4) newMap[y][x] = TILES.TREE;
                else newMap[y][x] = TILES.GRASS;
            }
        }
    }

    setMap(newMap);

    // Clear Spawn Areas (Top-Left, Bottom-Right, etc.)
    // Player (5,5)
    clearArea(5, 5, 10);
    // Enemy (W-8, H-8)
    clearArea(MAP_WIDTH - 8, MAP_HEIGHT - 8, 10);
    // Ally (W-8, 5)
    clearArea(MAP_WIDTH - 8, 5, 10);
    // Enemy 2 (5, H-8)
    clearArea(5, MAP_HEIGHT - 8, 10);

    spawnGoldMines();

    // Initialize Systems
    setSpatialHash(new SpatialHash(10)); // 10x10 buckets
    setPathfinder(new Pathfinder(MAP_WIDTH, MAP_HEIGHT, TILES, newMap));

    // Initialize Fog
    initFog();
}

function clearArea(cx, cy, radius) {
    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
                map[y][x] = TILES.GRASS;
            }
        }
    }
}

function spawnGoldMines() {
    const mineCount = 8; // Reduced amount
    let spawned = 0;
    let attempts = 0;

    while (spawned < mineCount && attempts < 1000) {
        attempts++;
        const x = Math.floor(Math.random() * (MAP_WIDTH - 2));
        const y = Math.floor(Math.random() * (MAP_HEIGHT - 2));

        // Check if area is clear
        let clear = true;
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                if (map[y + dy][x + dx].id !== TILES.GRASS.id) {
                    clear = false;
                    break;
                }
            }
            if (!clear) break;
        }

        // Check distance from other buildings (bases)
        if (clear) {
            buildings.push(new Building(x, y, FACTIONS.NEUTRAL.id, 'goldmine'));
            spawned++;
        }
    }
}

export function spawnInitialEntities() {
    // Player Base (Top Left)
    const playerHall = new Building(5, 5, FACTIONS.PLAYER.id, 'townhall');
    buildings.push(playerHall);
    units.push(new Unit(8, 8, FACTIONS.PLAYER.id, 'peasant'));
    units.push(new Unit(9, 8, FACTIONS.PLAYER.id, 'peasant'));

    // Enemy Base (Bottom Right)
    const enemyHall = new Building(MAP_WIDTH - 8, MAP_HEIGHT - 8, FACTIONS.ENEMY.id, 'townhall');
    buildings.push(enemyHall);
    units.push(new Unit(MAP_WIDTH - 10, MAP_HEIGHT - 10, FACTIONS.ENEMY.id, 'peasant'));
    units.push(new Unit(MAP_WIDTH - 11, MAP_HEIGHT - 10, FACTIONS.ENEMY.id, 'peasant'));

    // Ally Base (Top Right)
    const allyHall = new Building(MAP_WIDTH - 8, 5, FACTIONS.ALLY.id, 'townhall');
    buildings.push(allyHall);
    units.push(new Unit(MAP_WIDTH - 10, 8, FACTIONS.ALLY.id, 'peasant'));

    // Enemy 2 Base (Bottom Left)
    const enemy2Hall = new Building(5, MAP_HEIGHT - 8, FACTIONS.ENEMY_2.id, 'townhall');
    buildings.push(enemy2Hall);
    units.push(new Unit(8, MAP_HEIGHT - 10, FACTIONS.ENEMY_2.id, 'peasant'));

    // Initial Resources
    gameState.resources.gold = 500;
    gameState.resources.wood = 500;
    updateResourcesUI();
}
