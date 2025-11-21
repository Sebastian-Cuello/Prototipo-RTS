/**
 * @module Renderer
 * @description Main game canvas rendering system
 * 
 * This module handles all visual rendering including:
 * - Terrain and tile rendering with fog of war
 * - Entity rendering (units and buildings)
 * - Health bars and status indicators
 * - Selection boxes and movement targets
 * - Training progress bars
 * - Camera transformation and culling
 * 
 * Key Features:
 * - Viewport culling (only renders visible tiles)
 * - Fog of War rendering (unexplored, explored, visible)
 * - Faction-colored entities
 * - Dynamic health bar colors
 * - Blueprint overlay for buildings under construction
 * - Selection drag box visualization
 * - Training queue progress display
 * 
 * Performance Optimizations:
 * - Only draws tiles within camera view
 * - Pre-calculates tile positions
 * - Minimal canvas state changes
 * - Efficient entity filtering
 */

import { map, units, buildings, fogMap } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { camera } from './Camera.js';
import { FACTIONS, TILES, UNIT_STATS } from '../config/entityStats.js';
import Unit from '../entities/Unit.js';
import Building from '../entities/Building.js';
import { getBuildingImage, getUnitImage, getTileImage } from '../utils/AssetLoader.js';


let canvas, ctx, mapCanvas, mapCtx;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragCurrentX = 0;
let dragCurrentY = 0;

export function initRenderer(c, cx, mc, mcx) {
    canvas = c;
    ctx = cx;
    mapCanvas = mc;
    mapCtx = mcx;
}

export function setDragState(dragging, startX, startY, currentX, currentY) {
    isDragging = dragging;
    dragStartX = startX;
    dragStartY = startY;
    dragCurrentX = currentX;
    dragCurrentY = currentY;
}

export function drawStaticMap() {
    if (!mapCtx) return;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];
            const tileImage = getTileImage(tile.id);

            if (tileImage) {
                mapCtx.drawImage(tileImage, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else {
                mapCtx.fillStyle = tile.color;
                mapCtx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                // Draw resource symbol (Fallback)
                if (tile.id === TILES.TREE.id) {
                    mapCtx.fillStyle = '#444';
                    mapCtx.font = '20px Arial';
                    mapCtx.fillText('🌲', x * TILE_SIZE + 5, y * TILE_SIZE + 24);
                }
            }
        }
    }
}

function drawEntities(entitiesToDraw) {
    entitiesToDraw.filter(e => !e.isDead).forEach(entity => {
        // Check Fog
        const tx = Math.floor(entity.x);
        const ty = Math.floor(entity.y);
        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
            const fog = fogMap[ty][tx];
            if (fog === 0) return;
            if (fog === 1 && entity instanceof Unit) return;
        }

        const x = Math.round(entity.x * TILE_SIZE);
        const y = Math.round(entity.y * TILE_SIZE);

        const faction = Object.values(FACTIONS).find(f => f.id === entity.faction) || FACTIONS.NEUTRAL;

        // Draw Health Bar
        const healthRatio = entity.health / entity.maxHealth;
        const size = entity instanceof Building ? entity.size * TILE_SIZE : TILE_SIZE;

        ctx.fillStyle = '#000';
        ctx.fillRect(x + 2, y - 10, size - 4, 6);
        ctx.fillStyle = healthRatio > 0.5 ? '#2ecc71' : healthRatio > 0.2 ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(x + 2, y - 10, (size - 4) * healthRatio, 6);

        if (entity instanceof Unit) {
            // Draw Unit
            const unitImage = getUnitImage(entity.type);

            if (unitImage) {
                // Draw the unit image
                ctx.save();

                // Create circular clip for unit image
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                ctx.clip();

                // Apply faction color tint background
                ctx.fillStyle = faction.color;
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

                // Draw the actual image centered
                const imageSize = TILE_SIZE * 0.8; // Slightly smaller than tile
                const imageOffset = (TILE_SIZE - imageSize) / 2;
                ctx.drawImage(unitImage, x + imageOffset, y + imageOffset, imageSize, imageSize);

                ctx.restore();
            } else {
                // Fallback to CSS rendering if image not available
                ctx.fillStyle = faction.color;
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                ctx.fill();

                // Draw Symbol
                ctx.fillStyle = faction.unitColor;
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(entity.stats.symbol, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
            }

            // Draw movement target
            if (entity.isMoving) {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.fillRect(entity.targetX * TILE_SIZE + TILE_SIZE / 2 - 4, entity.targetY * TILE_SIZE + TILE_SIZE / 2 - 4, 8, 8);
            }

        } else if (entity instanceof Building) {
            // Draw Building
            const bSize = entity.size * TILE_SIZE;
            const buildingImage = getBuildingImage(entity.type);

            if (buildingImage) {
                // Draw the building image
                ctx.save();

                // Apply faction color tint for non-neutral buildings
                if (entity.faction !== FACTIONS.NEUTRAL.id) {
                    ctx.globalAlpha = 0.3;
                    ctx.fillStyle = faction.color;
                    ctx.fillRect(x, y, bSize, bSize);
                    ctx.globalAlpha = 1.0;
                }

                // Draw the actual image
                ctx.drawImage(buildingImage, x, y, bSize, bSize);

                ctx.restore();
            } else {
                // Fallback to CSS rendering if image not available
                ctx.fillStyle = faction.color;
                ctx.fillRect(x, y, bSize, bSize);

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, bSize, bSize);

                ctx.fillStyle = faction.unitColor;
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(entity.stats.symbol, x + bSize / 2, y + bSize / 2);
            }

            if (entity.isBlueprint) {
                ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
                ctx.fillRect(x, y, bSize, bSize);
            }

            if (entity.trainingQueue.length > 0 && !entity.isBlueprint) {
                const unitType = entity.trainingQueue[0];
                const buildTime = UNIT_STATS[unitType].buildTime * 30;
                const progressRatio = entity.trainingProgress / buildTime;

                ctx.fillStyle = '#000';
                ctx.fillRect(x, y + bSize + 5, bSize, 5);
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(x, y + bSize + 5, bSize * progressRatio, 5);
            }
        }
    });
}

export function draw() {
    if (!ctx) return;

    // Clear screen
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw Map
    const startCol = Math.floor(camera.x / TILE_SIZE);
    const endCol = startCol + (canvas.width / TILE_SIZE) + 1;
    const startRow = Math.floor(camera.y / TILE_SIZE);
    const endRow = startRow + (canvas.height / TILE_SIZE) + 1;

    for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
            if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
                const tile = map[y][x];
                const fog = fogMap[y][x];

                if (fog === 0) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                    const tileImage = getTileImage(tile.id);

                    if (tileImage) {
                        ctx.drawImage(tileImage, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    } else {
                        ctx.fillStyle = tile.color;
                        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                        if (tile.id === TILES.TREE.id) {
                            ctx.fillStyle = '#274e13';
                            ctx.font = '20px Arial';
                            ctx.fillText('🌲', x * TILE_SIZE + 5, y * TILE_SIZE + 24);
                        } else if (tile.id === TILES.MOUNTAIN.id) {
                            ctx.fillStyle = '#444';
                            ctx.font = '20px Arial';
                            ctx.fillText('⛰️', x * TILE_SIZE + 5, y * TILE_SIZE + 24);
                        }
                    }

                    if (fog === 1) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }
    }

    drawEntities(buildings);
    drawEntities(units);

    if (isDragging) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        const width = dragCurrentX - dragStartX;
        const height = dragCurrentY - dragStartY;
        ctx.strokeRect(dragStartX, dragStartY, width, height);
    }

    ctx.restore();
}
