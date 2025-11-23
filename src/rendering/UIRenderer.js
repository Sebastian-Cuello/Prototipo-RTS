import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { camera } from './Camera.js';
import { gameState, map } from '../core/GameState.js';
import { BUILDING_STATS, TILES } from '../config/entityStats.js';
import { getMousePosition } from '../input/InputManager.js';

export default class UIRenderer {
    constructor() {
        this.healthBarQueue = [];
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
    }

    setDragState(dragging, startX, startY, currentX, currentY) {
        this.isDragging = dragging;
        this.dragStartX = startX;
        this.dragStartY = startY;
        this.dragCurrentX = currentX;
        this.dragCurrentY = currentY;
    }

    queueHealthBar(entity, x, y) {
        const healthRatio = entity.health / entity.maxHealth;
        const size = entity.size ? entity.size * TILE_SIZE : TILE_SIZE;

        this.healthBarQueue.push({
            x, y, size, healthRatio
        });
    }

    flushHealthBars(ctx) {
        if (this.healthBarQueue.length === 0) return;

        // 1. Draw all backgrounds in one go
        ctx.fillStyle = '#000';
        ctx.beginPath();
        this.healthBarQueue.forEach(bar => {
            ctx.rect(bar.x + 2, bar.y - 10, bar.size - 4, 6);
        });
        ctx.fill();

        // 2. Group bars by color to minimize state changes
        const colorGroups = { green: [], yellow: [], red: [] };

        this.healthBarQueue.forEach(bar => {
            const color = bar.healthRatio > 0.5 ? 'green' :
                bar.healthRatio > 0.2 ? 'yellow' : 'red';
            colorGroups[color].push(bar);
        });

        // 3. Draw colored bars
        const colors = { green: '#2ecc71', yellow: '#f1c40f', red: '#e74c3c' };

        Object.entries(colorGroups).forEach(([colorKey, bars]) => {
            if (bars.length === 0) return;

            ctx.fillStyle = colors[colorKey];
            ctx.beginPath();
            bars.forEach(bar => {
                ctx.rect(bar.x + 2, bar.y - 10, (bar.size - 4) * bar.healthRatio, 6);
            });
            ctx.fill();
        });

        this.healthBarQueue = [];
    }

    /**
     * Draw UI elements in world-space (affected by camera translation)
     * These elements should move with the camera
     */
    drawWorldUI(ctx) {
        // Range Indicators (world-space)
        gameState.selectedEntities.forEach(entity => {
            if (entity.stats.range) {
                ctx.strokeStyle = '#ffffff44';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(
                    entity.x * TILE_SIZE + TILE_SIZE / 2,
                    entity.y * TILE_SIZE + TILE_SIZE / 2,
                    entity.stats.range * TILE_SIZE,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
        });

        // Building Ghost (world-space but uses screen mouse coords)
        if (gameState.buildingMode) {
            const { x, y } = getMousePosition();
            this.drawBuildingGhost(ctx, x, y, gameState.buildingMode);
        }

        // Flush health bars (must be in world-space)
        this.flushHealthBars(ctx);
    }

    /**
     * Draw UI elements in screen-space (NOT affected by camera translation)
     * These elements stay fixed on screen
     */
    drawScreenUI(ctx) {
        // Selection Box (screen-space - already in screen coordinates)
        if (this.isDragging) {
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 2;
            const width = this.dragCurrentX - this.dragStartX;
            const height = this.dragCurrentY - this.dragStartY;
            ctx.strokeRect(this.dragStartX, this.dragStartY, width, height);
        }
    }

    drawBuildingGhost(ctx, mouseX, mouseY, buildingType) {
        const stats = BUILDING_STATS[buildingType];
        const tileX = Math.floor((mouseX + camera.x) / TILE_SIZE);
        const tileY = Math.floor((mouseY + camera.y) / TILE_SIZE);

        let canBuild = true;
        for (let y = 0; y < stats.size; y++) {
            for (let x = 0; x < stats.size; x++) {
                const tx = tileX + x;
                const ty = tileY + y;
                if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT ||
                    !map[ty][tx].passable || map[ty][tx].id !== TILES.GRASS.id) {
                    canBuild = false;
                    break;
                }
            }
        }

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = canBuild ? '#00ff0044' : '#ff000044';
        ctx.fillRect(
            tileX * TILE_SIZE,
            tileY * TILE_SIZE,
            stats.size * TILE_SIZE,
            stats.size * TILE_SIZE
        );
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = canBuild ? '#00ff00' : '#ff0000';
        ctx.font = '12px Arial';
        ctx.fillText(
            stats.name,
            tileX * TILE_SIZE,
            tileY * TILE_SIZE - 5
        );
    }
}
