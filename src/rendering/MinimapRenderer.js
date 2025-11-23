import { map, units, buildings } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { camera } from './Camera.js';
import { FACTIONS, TILES } from '../config/entityStats.js';
import { Profiler } from '../utils/Profiler.js';

let minimapCanvas, minimapCtx;
let terrainCache = null;
let terrainCtx = null;

export function initMinimapRenderer(canvas, ctx) {
    minimapCanvas = canvas;
    minimapCtx = ctx;

    // Initialize cache
    terrainCache = document.createElement('canvas');
    terrainCache.width = canvas.width;
    terrainCache.height = canvas.height;
    terrainCtx = terrainCache.getContext('2d');

    // Initial draw of static terrain
    cacheTerrain();
}

function cacheTerrain() {
    if (!terrainCtx) return;

    const scaleX = minimapCanvas.width / (MAP_WIDTH * TILE_SIZE);
    const scaleY = minimapCanvas.height / (MAP_HEIGHT * TILE_SIZE);

    terrainCtx.fillStyle = '#000';
    terrainCtx.fillRect(0, 0, terrainCache.width, terrainCache.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];

            if (tile.id === TILES.WATER.id) {
                terrainCtx.fillStyle = '#1e90ff';
            } else if (tile.id === TILES.TREE.id) {
                terrainCtx.fillStyle = '#228b22';
            } else if (tile.id === TILES.MOUNTAIN.id) {
                terrainCtx.fillStyle = '#696969';
            } else if (tile.id === TILES.STONE.id) {
                terrainCtx.fillStyle = '#7f8c8d';
            } else {
                terrainCtx.fillStyle = '#2d5016';
            }

            terrainCtx.fillRect(
                Math.floor(x * TILE_SIZE * scaleX),
                Math.floor(y * TILE_SIZE * scaleY),
                Math.ceil(TILE_SIZE * scaleX),
                Math.ceil(TILE_SIZE * scaleY)
            );
        }
    }
    console.log('🗺️ Minimap terrain cached');
}

export function drawMinimap() {
    if (!minimapCtx) return;

    Profiler.start('Minimap_Draw');

    // 1. Draw cached terrain
    if (terrainCache) {
        minimapCtx.drawImage(terrainCache, 0, 0);
    } else {
        // Fallback if cache missing (shouldn't happen)
        minimapCtx.fillStyle = '#000';
        minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    }

    const scaleX = minimapCanvas.width / (MAP_WIDTH * TILE_SIZE);
    const scaleY = minimapCanvas.height / (MAP_HEIGHT * TILE_SIZE);

    // 2. Draw buildings
    buildings.forEach(b => {
        if (b.isDead) return;

        const faction = Object.values(FACTIONS).find(f => f.id === b.faction);
        minimapCtx.fillStyle = faction ? faction.color : '#888';
        minimapCtx.fillRect(
            Math.floor(b.x * TILE_SIZE * scaleX),
            Math.floor(b.y * TILE_SIZE * scaleY),
            Math.ceil(b.size * TILE_SIZE * scaleX),
            Math.ceil(b.size * TILE_SIZE * scaleY)
        );
    });

    // 3. Draw units (dots)
    units.forEach(u => {
        if (u.isDead) return;

        const faction = Object.values(FACTIONS).find(f => f.id === u.faction);
        minimapCtx.fillStyle = faction ? faction.color : '#888';
        minimapCtx.fillRect(
            Math.floor(u.x * TILE_SIZE * scaleX),
            Math.floor(u.y * TILE_SIZE * scaleY),
            2,
            2
        );
    });

    // 4. Draw camera viewport
    const viewportWidth = window.innerWidth - 400; // Approximate based on layout
    const viewportHeight = window.innerHeight;

    minimapCtx.strokeStyle = '#ffffff';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(
        Math.floor(camera.x * scaleX),
        Math.floor(camera.y * scaleY),
        Math.floor(viewportWidth * scaleX),
        Math.floor(viewportHeight * scaleY)
    );

    Profiler.end('Minimap_Draw');
}
