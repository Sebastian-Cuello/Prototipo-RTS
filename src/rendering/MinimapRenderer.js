import { map, units, buildings } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { camera } from './Camera.js';
import { FACTIONS } from '../config/entityStats.js';
import Unit from '../entities/Unit.js';

let minimapCanvas, minimapCtx;

export function initMinimapRenderer(canvas, ctx) {
    minimapCanvas = canvas;
    minimapCtx = ctx;
}

import { TILES } from '../config/entityStats.js';

export function drawMinimap() {
    if (!minimapCtx) return;

    // Clear
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const scaleX = minimapCanvas.width / (MAP_WIDTH * TILE_SIZE);
    const scaleY = minimapCanvas.height / (MAP_HEIGHT * TILE_SIZE);

    // Draw terrain
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];

            if (tile.id === TILES.WATER.id) {
                minimapCtx.fillStyle = '#1e90ff';
            } else if (tile.id === TILES.TREE.id) {
                minimapCtx.fillStyle = '#228b22';
            } else if (tile.id === TILES.MOUNTAIN.id) {
                minimapCtx.fillStyle = '#696969';
            } else {
                minimapCtx.fillStyle = '#2d5016';
            }

            // Draw slightly larger to avoid gaps
            minimapCtx.fillRect(
                Math.floor(x * TILE_SIZE * scaleX),
                Math.floor(y * TILE_SIZE * scaleY),
                Math.ceil(TILE_SIZE * scaleX),
                Math.ceil(TILE_SIZE * scaleY)
            );
        }
    }

    // Draw buildings
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

    // Draw units (dots)
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

    // Draw camera viewport
    // We need the main canvas dimensions to draw the viewport correctly
    // Assuming a global canvas or passing it in would be better, but for now:
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
}
