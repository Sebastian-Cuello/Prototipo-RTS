/**
 * @module MapGenerator (REFACTORED)
 * @description Advanced procedural map generation with multiple biomes
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

// ========================================
// MAP TEMPLATES
// ========================================
export const MAP_TEMPLATES = {
    RANDOM: 'random',
    FOREST: 'forest',      // Dense trees
    OPEN: 'open',          // Sparse trees, open space
    ISLANDS: 'islands',    // Separated by water
    HIGHLANDS: 'highlands' // Mountain terrain
};

// ========================================
// MAIN GENERATION FUNCTION
// ========================================
export function generateMap(template = MAP_TEMPLATES.RANDOM) {
    console.log(`🗺️ Generating map: ${template}`);
    
    // Select random template if needed
    if (template === MAP_TEMPLATES.RANDOM) {
        const templates = [
            MAP_TEMPLATES.FOREST,
            MAP_TEMPLATES.OPEN,
            MAP_TEMPLATES.ISLANDS,
            MAP_TEMPLATES.HIGHLANDS
        ];
        template = templates[Math.floor(Math.random() * templates.length)];
        console.log(`   → Selected: ${template}`);
    }
    
    // Generate base terrain
    const newMap = generateBaseTerrain(template);
    setMap(newMap);
    
    // Clear spawn areas
    clearSpawnAreas();
    
    // Place resources strategically
    spawnGoldMines();
    spawnStoneDeposits();
    
    // Add decorations
    addDecorations();
    
    // Initialize systems
    setSpatialHash(new SpatialHash(10));
    setPathfinder(new Pathfinder(MAP_WIDTH, MAP_HEIGHT, TILES, map));
    initFog();
    
    // Validate balance (optional: regenerate if too imbalanced)
    const isBalanced = validateMapBalance();
    console.log(`   → Balance: ${isBalanced ? '✅ Good' : '⚠️ Unbalanced'}`);
}

// ========================================
// TERRAIN GENERATION
// ========================================
function generateBaseTerrain(template) {
    const newMap = [];
    
    switch (template) {
        case MAP_TEMPLATES.FOREST:
            return generateForestMap();
        case MAP_TEMPLATES.OPEN:
            return generateOpenMap();
        case MAP_TEMPLATES.ISLANDS:
            return generateIslandMap();
        case MAP_TEMPLATES.HIGHLANDS:
            return generateHighlandMap();
        default:
            return generateForestMap();
    }
}

// --- FOREST MAP (Your original + improvements) ---
function generateForestMap() {
    const newMap = initializeEmptyMap(TILES.GRASS);
    
    // 1. Random tree placement
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (Math.random() < 0.42) {
                newMap[y][x] = TILES.TREE;
            }
        }
    }
    
    // 2. Cellular automata smoothing
    for (let iteration = 0; iteration < 4; iteration++) {
        const tempMap = JSON.parse(JSON.stringify(newMap));
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const neighbors = countNeighbors(tempMap, x, y, TILES.TREE.id);
                
                if (neighbors > 4) {
                    newMap[y][x] = TILES.TREE;
                } else if (neighbors < 3) {
                    newMap[y][x] = TILES.GRASS;
                }
            }
        }
    }
    
    // 3. Add water lakes (2-3 small lakes)
    addWaterLakes(newMap, 2 + Math.floor(Math.random() * 2));
    
    // 4. Add mountain clusters (1-2 ranges)
    addMountainRanges(newMap, 1 + Math.floor(Math.random() * 2));
    
    return newMap;
}

// --- OPEN MAP ---
function generateOpenMap() {
    const newMap = initializeEmptyMap(TILES.GRASS);
    
    // Sparse tree clusters
    const clusterCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < clusterCount; i++) {
        const cx = Math.floor(Math.random() * MAP_WIDTH);
        const cy = Math.floor(Math.random() * MAP_HEIGHT);
        const radius = 3 + Math.floor(Math.random() * 4);
        
        addCircularFeature(newMap, cx, cy, radius, TILES.TREE, 0.6);
    }
    
    // Few water bodies
    addWaterLakes(newMap, 1);
    
    // Mountain patches (less than forest)
    addMountainRanges(newMap, 1);
    
    return newMap;
}

// --- ISLAND MAP ---
function generateIslandMap() {
    const newMap = initializeEmptyMap(TILES.WATER);
    
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
    
    // Add narrow bridges connecting islands
    addBridge(newMap, islands[0], islands[1], 2); // Top horizontal
    addBridge(newMap, islands[2], islands[3], 2); // Bottom horizontal
    addBridge(newMap, islands[0], islands[2], 2); // Left vertical
    addBridge(newMap, islands[1], islands[3], 2); // Right vertical
    
    return newMap;
}

// --- HIGHLAND MAP ---
function generateHighlandMap() {
    const newMap = initializeEmptyMap(TILES.GRASS);
    
    // Heavy mountain coverage
    addMountainRanges(newMap, 4 + Math.floor(Math.random() * 3));
    
    // Light forests
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (newMap[y][x].passable && Math.random() < 0.25) {
                newMap[y][x] = TILES.TREE;
            }
        }
    }
    
    // Small lakes in valleys
    addWaterLakes(newMap, 3);
    
    return newMap;
}

// ========================================
// TERRAIN FEATURES
// ========================================
function addWaterLakes(map, count) {
    for (let i = 0; i < count; i++) {
        const cx = 15 + Math.floor(Math.random() * (MAP_WIDTH - 30));
        const cy = 15 + Math.floor(Math.random() * (MAP_HEIGHT - 30));
        const radius = 4 + Math.floor(Math.random() * 5);
        
        addCircularFeature(map, cx, cy, radius, TILES.WATER, 1.0);
    }
}

function addMountainRanges(map, count) {
    for (let i = 0; i < count; i++) {
        const startX = Math.floor(Math.random() * MAP_WIDTH);
        const startY = Math.floor(Math.random() * MAP_HEIGHT);
        const length = 12 + Math.floor(Math.random() * 15);
        const direction = Math.random() * Math.PI * 2;
        
        let x = startX;
        let y = startY;
        
        for (let j = 0; j < length; j++) {
            // Draw mountain cluster
            addCircularFeature(map, Math.floor(x), Math.floor(y), 2, TILES.MOUNTAIN, 0.7);
            
            // Move along direction with noise
            x += Math.cos(direction) + (Math.random() - 0.5);
            y += Math.sin(direction) + (Math.random() - 0.5);
            
            x = Math.max(5, Math.min(MAP_WIDTH - 5, x));
            y = Math.max(5, Math.min(MAP_HEIGHT - 5, y));
        }
    }
}

function addBridge(map, island1, island2, width) {
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

function addStoneDeposits(map) {
    const depositCount = 6 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < depositCount; i++) {
        const cx = Math.floor(Math.random() * MAP_WIDTH);
        const cy = Math.floor(Math.random() * MAP_HEIGHT);
        const size = 2 + Math.floor(Math.random() * 3);
        
        for (let y = cy - size; y <= cy + size; y++) {
            for (let x = cx - size; x <= cx + size; x++) {
                if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                    if (map[y][x].passable && Math.random() > 0.5) {
                        map[y][x] = TILES.STONE; // You need to add this tile type
                    }
                }
            }
        }
    }
}

function addDecorations() {
    // Add visual variety (flowers, rocks, etc.)
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x].id === TILES.GRASS.id && Math.random() < 0.03) {
                // Store decoration data (render in your renderer)
                map[y][x] = {
                    ...map[y][x],
                    decoration: Math.random() > 0.5 ? 'flower' : 'rock'
                };
            }
        }
    }
}

// ========================================
// RESOURCE PLACEMENT
// ========================================
function spawnGoldMines() {
    const minePositions = [];
    
    // 1. Guaranteed mine near each base (fair distribution)
    const bases = [
        { x: 5, y: 5 },
        { x: MAP_WIDTH - 8, y: MAP_HEIGHT - 8 },
        { x: MAP_WIDTH - 8, y: 5 },
        { x: 5, y: MAP_HEIGHT - 8 }
    ];
    
    bases.forEach(base => {
        const mine = findValidLocation(base.x, base.y, 8, 15, 2);
        if (mine) {
            buildings.push(new Building(mine.x, mine.y, FACTIONS.NEUTRAL.id, 'goldmine'));
            minePositions.push(mine);
        }
    });
    
    // 2. Contested center mines
    const centerMines = 2;
    for (let i = 0; i < centerMines; i++) {
        const mine = findValidLocation(
            MAP_WIDTH / 2, 
            MAP_HEIGHT / 2, 
            3, 
            12, 
            2
        );
        if (mine && !isTooClose(mine, minePositions, 10)) {
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
        const mine = findValidLocation(exp.x, exp.y, 3, 10, 2);
        if (mine && !isTooClose(mine, minePositions, 8)) {
            buildings.push(new Building(mine.x, mine.y, FACTIONS.NEUTRAL.id, 'goldmine'));
            minePositions.push(mine);
        }
    });
    
    console.log(`   → Spawned ${minePositions.length} gold mines`);
}

function spawnStoneDeposits() {
    // Similar to gold but less critical
    const depositCount = 4;
    let spawned = 0;
    
    for (let i = 0; i < depositCount * 10 && spawned < depositCount; i++) {
        const x = Math.floor(Math.random() * (MAP_WIDTH - 2));
        const y = Math.floor(Math.random() * (MAP_HEIGHT - 2));
        
        if (isAreaClear(x, y, 2)) {
            // Add stone deposit building (you'd need to create this)
            // buildings.push(new Building(x, y, FACTIONS.NEUTRAL.id, 'stonedeposit'));
            spawned++;
        }
    }
}

// ========================================
// ENTITY SPAWNING
// ========================================
export function spawnInitialEntities() {
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
        const spawn = getSpawnLocation(config.corner);
        spawnBase(spawn.x, spawn.y, config.faction, config.peasants);
    });
    
    // Player starting resources
    gameState.resources.gold = 500;
    gameState.resources.wood = 500;
    updateResourcesUI();
    
    console.log(`   → Spawned ${units.length} units and ${buildings.length} buildings`);
}

function getSpawnLocation(corner) {
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

function spawnBase(x, y, factionId, peasantCount) {
    // Ensure clear area
    clearArea(x, y, 8);
    
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

function clearSpawnAreas() {
    clearArea(5, 5, 10);
    clearArea(MAP_WIDTH - 8, MAP_HEIGHT - 8, 10);
    clearArea(MAP_WIDTH - 8, 5, 10);
    clearArea(5, MAP_HEIGHT - 8, 10);
}

// ========================================
// VALIDATION
// ========================================
function validateMapBalance() {
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
            distance(b.x, b.y, base.x, base.y) < 20
        ).length;
        
        const nearbyTrees = countInRadius(base.x, base.y, 15, TILES.TREE.id);
        const buildableSpace = countInRadius(base.x, base.y, 20, TILES.GRASS.id);
        
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

// ========================================
// UTILITY FUNCTIONS
// ========================================
function initializeEmptyMap(fillTile) {
    const newMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        newMap[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            newMap[y][x] = fillTile;
        }
    }
    return newMap;
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

function addCircularFeature(map, cx, cy, radius, tile, probability) {
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

function countNeighbors(map, x, y, tileId) {
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

function findValidLocation(cx, cy, minDist, maxDist, size) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        
        const x = Math.floor(cx + Math.cos(angle) * dist);
        const y = Math.floor(cy + Math.sin(angle) * dist);
        
        if (isAreaClear(x, y, size)) {
            return { x, y };
        }
    }
    return null;
}

function isAreaClear(x, y, size) {
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

function isTooClose(pos, others, minDist) {
    return others.some(other => distance(pos.x, pos.y, other.x, other.y) < minDist);
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function countInRadius(cx, cy, radius, tileId) {
    let count = 0;
    for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                if (distance(x, y, cx, cy) <= radius && map[y][x].id === tileId) {
                    count++;
                }
            }
        }
    }
    return count;
}