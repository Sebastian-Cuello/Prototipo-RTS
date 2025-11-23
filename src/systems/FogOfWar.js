import { fogMap, setFogMap, units, buildings } from '../core/GameState.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { FACTIONS } from '../config/entityStats.js';
import { updateFogTile } from '../rendering/Renderer.js';

let visibleTiles = new Set(); // Stores "x,y" strings

export function initFog() {
    const newFogMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        newFogMap[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            newFogMap[y][x] = 0; // 0: Unexplored, 1: Explored, 2: Visible
        }
    }
    setFogMap(newFogMap);
    visibleTiles.clear();
}

export function updateFog() {
    const newVisibleTiles = new Set();

    // 1. Calculate new visible tiles based on current entity positions
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
                        newVisibleTiles.add(`${x},${y}`);
                    }
                }
            }
        }
    });

    // 2. Downgrade old visible tiles that are no longer visible
    visibleTiles.forEach(key => {
        if (!newVisibleTiles.has(key)) {
            const [x, y] = key.split(',').map(Number);
            fogMap[y][x] = 1; // Downgrade to Explored
            updateFogTile(x, y);
        }
    });

    // 3. Upgrade new visible tiles
    newVisibleTiles.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        // If it wasn't already visible (it might have been 0 or 1)
        if (fogMap[y][x] !== 2) {
            fogMap[y][x] = 2; // Set to Visible
            updateFogTile(x, y);
        }
    });

    visibleTiles = newVisibleTiles;
}
