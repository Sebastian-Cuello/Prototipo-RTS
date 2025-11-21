import { fogMap, setFogMap, units, buildings } from '../core/GameState.js';
/**
 * @module FogOfWar
 * @description Fog of War visibility system
 *
 * This module manages map visibility and exploration:
 * - Tracks explored vs unexplored areas
 * - Updates visibility based on unit/building vision
 * - Automatically downgrades visible areas to explored
 *
 * Key Features:
 * - Three visibility states: Unexplored (0), Explored (1), Visible (2)
 * - Circular vision radius around player units/buildings
 * - Automatic visibility downgrade (visible -> explored)
 * - Real-time updates based on unit positions
 *
 * Visibility States:
 * - Unexplored (0): Black/hidden on map, no entities visible
 * - Explored (1): Terrain visible, buildings visible, units hidden
 * - Visible (2): Full visibility of terrain and all entities
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { FACTIONS } from '../config/entityStats.js';
import Unit from '../entities/Unit.js';

export function initFog() {
    const newFogMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        newFogMap[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            newFogMap[y][x] = 0; // 0: Unexplored, 1: Explored, 2: Visible
        }
    }
    setFogMap(newFogMap);
}

export function updateFog() {
    // Downgrade Visible (2) to Explored (1)
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (fogMap[y][x] === 2) fogMap[y][x] = 1;
        }
    }

    // Reveal for Player Units/Buildings
    // Note: We need to ensure Unit is imported or we check type differently if circular dep issues arise.
    // But here we just check faction.
    const playerEntities = [...units, ...buildings].filter(e => !e.isDead && e.faction === FACTIONS.PLAYER.id);

    playerEntities.forEach(e => {
        const range = e.stats.range ? e.stats.range + 4 : 6; // Vision range
        const cx = Math.floor(e.x);
        const cy = Math.floor(e.y);

        for (let y = cy - range; y <= cy + range; y++) {
            for (let x = cx - range; x <= cx + range; x++) {
                if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                    if (dist <= range) {
                        fogMap[y][x] = 2;
                    }
                }
            }
        }
    });
}
