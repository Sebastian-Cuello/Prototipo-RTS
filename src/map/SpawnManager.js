/**
 * @module SpawnManager
 * @description Handles spawning of initial entities (bases, units)
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { FACTIONS, TILES } from '../config/entityStats.js';
import { gameState } from '../core/GameState.js';
import { updateResourcesUI } from '../ui/UIManager.js';
import Unit from '../entities/Unit.js';
import Building from '../entities/Building.js';

export default class SpawnManager {
    spawn(map, units, buildings) {
        console.log('   → Spawning initial entities...');

        const spawnConfigs = [
            {
                faction: FACTIONS.PLAYER.id,
                corner: 'top-left',
                peasants: 3
            },
            {
                faction: FACTIONS.ENEMY.id,
                corner: 'bottom-right',
                peasants: 2
            },
            {
                faction: FACTIONS.ALLY.id,
                corner: 'top-right',
                peasants: 2
            },
            {
                faction: FACTIONS.ENEMY_2.id,
                corner: 'bottom-left',
                peasants: 2
            }
        ];

        spawnConfigs.forEach(config => {
            const spawn = this.getSpawnLocation(map, config.corner);
            this.spawnBase(map, units, buildings, spawn.x, spawn.y, config.faction, config.peasants);
        });

        // Player starting resources
        gameState.resources.gold = 500;
        gameState.resources.wood = 500;
        updateResourcesUI();

        console.log(`   → Spawned ${units.length} units and ${buildings.length} buildings`);
    }

    getSpawnLocation(map, corner) {
        const margin = 5;
        const variance = 3;

        let baseX, baseY;

        switch (corner) {
            case 'top-left':
                baseX = margin;
                baseY = margin;
                break;
            case 'top-right':
                baseX = MAP_WIDTH - margin - 3;
                baseY = margin;
                break;
            case 'bottom-left':
                baseX = margin;
                baseY = MAP_HEIGHT - margin - 3;
                break;
            case 'bottom-right':
                baseX = MAP_WIDTH - margin - 3;
                baseY = MAP_HEIGHT - margin - 3;
                break;
        }

        // Random offset for variety
        baseX += Math.floor(Math.random() * variance * 2 - variance);
        baseY += Math.floor(Math.random() * variance * 2 - variance);

        // Ensure on grass
        let attempts = 0;
        while (attempts < 100 && map[baseY][baseX].id !== TILES.GRASS.id) {
            baseX += 1;
            if (baseX >= MAP_WIDTH - 3) {
                baseX = margin;
                baseY += 1;
            }
            attempts++;
        }

        return { x: baseX, y: baseY };
    }

    spawnBase(map, units, buildings, x, y, factionId, peasantCount) {
        // Ensure clear area
        this.clearArea(map, x, y, 8);

        // Town Hall
        buildings.push(new Building(x, y, factionId, 'townhall'));

        // Peasants in circle formation
        for (let i = 0; i < peasantCount; i++) {
            const angle = (i / peasantCount) * Math.PI * 2;
            const distance = 3;
            const px = Math.floor(x + Math.cos(angle) * distance) + 1;
            const py = Math.floor(y + Math.sin(angle) * distance) + 1;

            units.push(new Unit(px, py, factionId, 'peasant'));
        }
    }

    clearSpawnAreas(map) {
        this.clearArea(map, 5, 5, 10);
        this.clearArea(map, MAP_WIDTH - 8, MAP_HEIGHT - 8, 10);
        this.clearArea(map, MAP_WIDTH - 8, 5, 10);
        this.clearArea(map, 5, MAP_HEIGHT - 8, 10);
    }

    clearArea(map, cx, cy, radius) {
        for (let y = cy - radius; y <= cy + radius; y++) {
            for (let x = cx - radius; x <= cx + radius; x++) {
                if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
                    map[y][x] = TILES.GRASS;
                }
            }
        }
    }
}
