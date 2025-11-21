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

export function drawMinimap() {
    if (!minimapCtx) return;

    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const scaleX = minimapCanvas.width / (MAP_WIDTH * TILE_SIZE);
    const scaleY = minimapCanvas.height / (MAP_HEIGHT * TILE_SIZE);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            minimapCtx.fillStyle = map[y][x].color;
            minimapCtx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY);
        }
    }

    [...buildings, ...units].filter(e => !e.isDead).forEach(entity => {
        const faction = Object.values(FACTIONS).find(f => f.id === entity.faction) || FACTIONS.NEUTRAL;
        minimapCtx.fillStyle = faction.color;

        if (entity instanceof Unit) {
            minimapCtx.beginPath();
            minimapCtx.arc(entity.x * TILE_SIZE * scaleX, entity.y * TILE_SIZE * scaleY, 2, 0, Math.PI * 2);
            minimapCtx.fill();
        } else {
            minimapCtx.fillRect(entity.x * TILE_SIZE * scaleX, entity.y * TILE_SIZE * scaleY, entity.stats.size * TILE_SIZE * scaleX, entity.stats.size * TILE_SIZE * scaleY);
        }
    });

    // Draw Camera View Rect
    // We need to access canvas dimensions. Assuming camera stores viewport or we pass it.
    // For now, we can't easily access main canvas dimensions here unless we store them.
    // Let's assume standard viewport or export it from constants if fixed, or pass it.
    // Actually, Camera.js doesn't store viewport size.
    // Let's just skip the rect for now or use a fixed size assumption, or update Camera to store viewport.
}
