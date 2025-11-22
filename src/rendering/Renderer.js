/**
 * @module Renderer
 * @description Main game canvas rendering system (Refactored)
 * 
 * Features:
 * - Layer System (Terrain, Fog, Entities, UI)
 * - Viewport Culling
 * - Batch Rendering
 * - Particle System
 * - Animation System (with fallback)
 */

import { map, units, buildings, fogMap, gameState } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { camera } from './Camera.js';
import { FACTIONS, TILES, UNIT_STATS, BUILDING_STATS } from '../config/entityStats.js';
import { getMousePosition } from '../input/InputManager.js';
import Unit from '../entities/Unit.js';
import Building from '../entities/Building.js';
import { getBuildingImage, getUnitImage, getTileImage } from '../utils/AssetLoader.js';

// ==========================================
// PARTICLE SYSTEM
// ==========================================
class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = 0.1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    isDead() {
        return this.life <= 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, options = {}) {
        const {
            color = '#ff6600',
            size = 3,
            life = 30,
            spread = 2
        } = options;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * spread;

            this.particles.push(new Particle(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 1, // Upward bias
                life + Math.random() * 10,
                color,
                size + Math.random() * 2
            ));
        }
    }

    update() {
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => !p.isDead());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    // Presets
    bloodSplatter(x, y) {
        this.emit(x, y, 10, { color: '#ff0000', size: 2, life: 20, spread: 3 });
    }

    swordHit(x, y) {
        this.emit(x, y, 5, { color: '#ffff00', size: 3, life: 15, spread: 2 });
    }

    buildingDust(x, y) {
        this.emit(x, y, 15, { color: '#8B4513', size: 4, life: 40, spread: 1.5 });
    }

    goldSparkle(x, y) {
        this.emit(x, y, 3, { color: '#ffd700', size: 2, life: 25, spread: 1 });
    }
}

// ==========================================
// ANIMATION SYSTEM
// ==========================================
class SpriteSheet {
    constructor(imagePath, tileWidth, tileHeight) {
        this.image = new Image();
        this.image.src = imagePath;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        this.loaded = false;

        this.image.onload = () => {
            this.loaded = true;
            console.log(`✅ Spritesheet loaded: ${imagePath}`);
        };
        this.image.onerror = () => {
            // console.warn(`⚠️ Spritesheet failed: ${imagePath} (Using fallback)`);
        };
    }

    draw(ctx, spriteX, spriteY, destX, destY, destWidth, destHeight) {
        if (!this.loaded) return false;

        ctx.drawImage(
            this.image,
            spriteX * this.tileWidth,
            spriteY * this.tileHeight,
            this.tileWidth,
            this.tileHeight,
            destX,
            destY,
            destWidth || this.tileWidth,
            destHeight || this.tileHeight
        );
        return true;
    }
}

class Animation {
    constructor(spritesheet, frames, frameRate = 10) {
        this.spritesheet = spritesheet;
        this.frames = frames; // Array of {x, y} sprite positions
        this.frameRate = frameRate;
        this.currentFrame = 0;
        this.frameCounter = 0;
    }

    update() {
        this.frameCounter++;

        if (this.frameCounter >= this.frameRate) {
            this.frameCounter = 0;
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }
    }

    draw(ctx, x, y, width, height) {
        const frame = this.frames[this.currentFrame];
        return this.spritesheet.draw(ctx, frame.x, frame.y, x, y, width, height);
    }

    reset() {
        this.currentFrame = 0;
        this.frameCounter = 0;
    }
}

// ==========================================
// RENDERER
// ==========================================
export default class Renderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.mapCanvas = null;
        this.mapCtx = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;

        // Layers
        this.layers = {
            terrain: null,
            fog: null
        };
        this.offscreenCanvases = {};

        this.lastCameraX = 0;
        this.lastCameraY = 0;
        this.fogNeedsUpdate = true;

        // Systems
        this.particleSystem = new ParticleSystem();

        // Drag Selection
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;

        // Batching
        this.healthBarQueue = [];

        // Spritesheets (Placeholders for now)
        this.spritesheets = {
            units: new SpriteSheet('assets/sprites/units.png', 32, 32),
            buildings: new SpriteSheet('assets/sprites/buildings.png', 64, 64)
        };

        // Animations
        this.animations = {
            // Example definitions
            peasant_idle: new Animation(this.spritesheets.units, [{ x: 0, y: 0 }], 15),
            peasant_walk: new Animation(this.spritesheets.units, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 8),
            peasant_attack: new Animation(this.spritesheets.units, [{ x: 3, y: 0 }, { x: 4, y: 0 }], 5)
        };
    }

    init(canvas, ctx, mapCanvas, mapCtx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.mapCanvas = mapCanvas;
        this.mapCtx = mapCtx;

        this.initLayers();
    }

    initLayers() {
        // Create offscreen canvases
        ['terrain', 'fog'].forEach(layerName => {
            const canvas = document.createElement('canvas');
            canvas.width = MAP_WIDTH * TILE_SIZE;
            canvas.height = MAP_HEIGHT * TILE_SIZE;
            const ctx = canvas.getContext('2d');
            this.offscreenCanvases[layerName] = { canvas, ctx };
        });

        // Draw static terrain once
        this.drawTerrainLayer();
    }

    drawTerrainLayer() {
        const { ctx } = this.offscreenCanvases.terrain;

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tile = map[y][x];
                const tileImage = getTileImage(tile.id);

                if (tileImage) {
                    ctx.drawImage(tileImage, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                    ctx.fillStyle = tile.color;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                    // Fallback symbols
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
            }
        }
        console.log('✅ Terrain layer cached');
    }

    updateFogLayer() {
        const { ctx } = this.offscreenCanvases.fog;

        // Clear
        ctx.clearRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

        // Draw fog overlay
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const fog = fogMap[y][x];

                if (fog === 0) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else if (fog === 1) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        this.fogNeedsUpdate = false;
    }

    updateFog() {
        this.fogNeedsUpdate = true;
    }

    updateTile(x, y) {
        const { ctx } = this.offscreenCanvases.terrain;
        const tile = map[y][x];
        const tileImage = getTileImage(tile.id);

        // Clear the specific tile area
        ctx.clearRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (tileImage) {
            ctx.drawImage(tileImage, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
            ctx.fillStyle = tile.color;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Fallback symbols
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
    }

    drawLayer(layerName, offsetX, offsetY) {
        const offscreen = this.offscreenCanvases[layerName];
        if (!offscreen) return;

        // Only draw visible portion
        const startX = Math.floor(offsetX);
        const startY = Math.floor(offsetY);
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.drawImage(
            offscreen.canvas,
            startX, startY, width, height,  // Source
            startX, startY, width, height   // Destination
        );
    }

    setDragState(dragging, startX, startY, currentX, currentY) {
        this.isDragging = dragging;
        this.dragStartX = startX;
        this.dragStartY = startY;
        this.dragCurrentX = currentX;
        this.dragCurrentY = currentY;
    }

    isInViewport(entity, bounds) {
        const x = entity.x * TILE_SIZE;
        const y = entity.y * TILE_SIZE;
        const size = entity instanceof Building ? entity.size * TILE_SIZE : TILE_SIZE;

        return !(
            x + size < bounds.left ||
            x > bounds.right ||
            y + size < bounds.top ||
            y > bounds.bottom
        );
    }

    drawEntitiesLayer() {
        const viewportBounds = {
            left: camera.x,
            right: camera.x + this.canvas.width,
            top: camera.y,
            bottom: camera.y + this.canvas.height
        };

        // Filter visible entities
        const visibleBuildings = buildings.filter(b =>
            !b.isDead && this.isInViewport(b, viewportBounds)
        );

        const visibleUnits = units.filter(u =>
            !u.isDead && this.isInViewport(u, viewportBounds)
        );

        this.drawEntitiesBatch(visibleBuildings, visibleUnits);
    }

    drawEntitiesBatch(visibleBuildings, visibleUnits) {
        // Group by type
        const groups = {
            units: {},
            buildings: {}
        };

        visibleUnits.forEach(u => {
            if (!groups.units[u.type]) groups.units[u.type] = [];
            groups.units[u.type].push(u);
        });

        visibleBuildings.forEach(b => {
            if (!groups.buildings[b.type]) groups.buildings[b.type] = [];
            groups.buildings[b.type].push(b);
        });

        // Draw Buildings
        Object.entries(groups.buildings).forEach(([type, list]) => {
            const buildingImage = getBuildingImage(type);

            list.forEach(b => {
                const x = Math.round(b.x * TILE_SIZE);
                const y = Math.round(b.y * TILE_SIZE);
                const size = b.size * TILE_SIZE;
                const faction = Object.values(FACTIONS).find(f => f.id === b.faction) || FACTIONS.NEUTRAL;

                // Check Fog (Simple check)
                const tx = Math.floor(b.x);
                const ty = Math.floor(b.y);
                if (fogMap[ty] && fogMap[ty][tx] === 0) return; // Hidden

                // Draw
                if (buildingImage) {
                    if (b.faction !== FACTIONS.NEUTRAL.id) {
                        this.ctx.globalAlpha = 0.3;
                        this.ctx.fillStyle = faction.color;
                        this.ctx.fillRect(x, y, size, size);
                        this.ctx.globalAlpha = 1.0;
                    }
                    this.ctx.drawImage(buildingImage, x, y, size, size);
                } else {
                    // Fallback
                    this.ctx.fillStyle = faction.color;
                    this.ctx.fillRect(x, y, size, size);
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(x, y, size, size);

                    this.ctx.fillStyle = faction.unitColor;
                    this.ctx.font = 'bold 20px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(b.stats.symbol, x + size / 2, y + size / 2);
                }

                // Blueprint
                if (b.isBlueprint) {
                    this.ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
                    this.ctx.fillRect(x, y, size, size);
                }

                // Training Progress
                if (b.trainingQueue.length > 0 && !b.isBlueprint) {
                    const unitType = b.trainingQueue[0];
                    const buildTime = UNIT_STATS[unitType].buildTime * 30;
                    const progressRatio = b.trainingProgress / buildTime;

                    this.ctx.fillStyle = '#000';
                    this.ctx.fillRect(x, y + size + 5, size, 5);
                    this.ctx.fillStyle = '#f39c12';
                    this.ctx.fillRect(x, y + size + 5, size * progressRatio, 5);
                }

                this.queueHealthBar(b, x, y);
            });
        });

        // Draw Units
        Object.entries(groups.units).forEach(([type, list]) => {
            const unitImage = getUnitImage(type);

            list.forEach(u => {
                const x = Math.round(u.x * TILE_SIZE);
                const y = Math.round(u.y * TILE_SIZE);
                const faction = Object.values(FACTIONS).find(f => f.id === u.faction) || FACTIONS.NEUTRAL;

                // Check Fog
                const tx = Math.floor(u.x);
                const ty = Math.floor(u.y);
                if (fogMap[ty] && fogMap[ty][tx] !== 2) return; // Only visible if fully explored

                // Animation or Image
                let drawn = false;
                if (u.animationState) {
                    drawn = u.animationState.draw(this.ctx, x, y, TILE_SIZE, TILE_SIZE);
                }

                if (!drawn) {
                    if (unitImage) {
                        this.ctx.save();
                        this.ctx.beginPath();
                        this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                        this.ctx.clip();
                        this.ctx.fillStyle = faction.color;
                        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

                        const imageSize = TILE_SIZE * 0.8;
                        const imageOffset = (TILE_SIZE - imageSize) / 2;
                        this.ctx.drawImage(unitImage, x + imageOffset, y + imageOffset, imageSize, imageSize);
                        this.ctx.restore();
                    } else {
                        // Fallback
                        this.ctx.fillStyle = faction.color;
                        this.ctx.beginPath();
                        this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                        this.ctx.fill();

                        this.ctx.fillStyle = faction.unitColor;
                        this.ctx.font = 'bold 16px monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText(u.stats.symbol, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
                    }
                }

                // Movement Target
                if (u.isMoving && u.faction === FACTIONS.PLAYER.id && u.selected) {
                    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
                    this.ctx.fillRect(u.targetX * TILE_SIZE + TILE_SIZE / 2 - 4, u.targetY * TILE_SIZE + TILE_SIZE / 2 - 4, 8, 8);
                }

                this.queueHealthBar(u, x, y);
            });
        });

        this.flushHealthBars();
    }

    queueHealthBar(entity, x, y) {
        const healthRatio = entity.health / entity.maxHealth;
        const size = entity instanceof Building ? entity.size * TILE_SIZE : TILE_SIZE;

        this.healthBarQueue.push({
            x, y, size, healthRatio
        });
    }

    flushHealthBars() {
        if (this.healthBarQueue.length === 0) return;

        // Draw backgrounds
        this.ctx.fillStyle = '#000';
        this.healthBarQueue.forEach(bar => {
            this.ctx.fillRect(bar.x + 2, bar.y - 10, bar.size - 4, 6);
        });

        // Draw bars
        const colorGroups = { green: [], yellow: [], red: [] };

        this.healthBarQueue.forEach(bar => {
            const color = bar.healthRatio > 0.5 ? 'green' :
                bar.healthRatio > 0.2 ? 'yellow' : 'red';
            colorGroups[color].push(bar);
        });

        this.ctx.fillStyle = '#2ecc71';
        colorGroups.green.forEach(bar => {
            this.ctx.fillRect(bar.x + 2, bar.y - 10, (bar.size - 4) * bar.healthRatio, 6);
        });

        this.ctx.fillStyle = '#f1c40f';
        colorGroups.yellow.forEach(bar => {
            this.ctx.fillRect(bar.x + 2, bar.y - 10, (bar.size - 4) * bar.healthRatio, 6);
        });

        this.ctx.fillStyle = '#e74c3c';
        colorGroups.red.forEach(bar => {
            this.ctx.fillRect(bar.x + 2, bar.y - 10, (bar.size - 4) * bar.healthRatio, 6);
        });

        this.healthBarQueue = [];
    }

    drawUI() {
        // Range Indicators
        gameState.selectedEntities.forEach(entity => {
            if (entity.stats.range) {
                this.ctx.strokeStyle = '#ffffff44';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(
                    entity.x * TILE_SIZE + TILE_SIZE / 2,
                    entity.y * TILE_SIZE + TILE_SIZE / 2,
                    entity.stats.range * TILE_SIZE,
                    0,
                    Math.PI * 2
                );
                this.ctx.stroke();
            }
        });

        // Building Ghost
        if (gameState.buildingMode) {
            const { x, y } = getMousePosition();
            this.drawBuildingGhost(x, y, gameState.buildingMode);
        }

        // Selection Box
        if (this.isDragging) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            const width = this.dragCurrentX - this.dragStartX;
            const height = this.dragCurrentY - this.dragStartY;
            this.ctx.strokeRect(this.dragStartX, this.dragStartY, width, height);
        }
    }

    drawBuildingGhost(mouseX, mouseY, buildingType) {
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

        this.ctx.globalAlpha = 0.5;
        this.ctx.fillStyle = canBuild ? '#00ff0044' : '#ff000044';
        this.ctx.fillRect(
            tileX * TILE_SIZE,
            tileY * TILE_SIZE,
            stats.size * TILE_SIZE,
            stats.size * TILE_SIZE
        );
        this.ctx.globalAlpha = 1.0;

        this.ctx.fillStyle = canBuild ? '#00ff00' : '#ff0000';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(
            stats.name,
            tileX * TILE_SIZE,
            tileY * TILE_SIZE - 5
        );
    }

    draw() {
        if (!this.ctx) return;

        const cameraChanged = (
            this.lastCameraX !== camera.x ||
            this.lastCameraY !== camera.y
        );

        this.lastCameraX = camera.x;
        this.lastCameraY = camera.y;

        // Clear
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(-camera.x, -camera.y);

        // 1. Terrain (Cached)
        this.drawLayer('terrain', camera.x, camera.y);

        // 2. Fog (Update if needed)
        if (cameraChanged || this.fogNeedsUpdate) {
            this.updateFogLayer();
        }
        this.drawLayer('fog', camera.x, camera.y);

        // 3. Entities (Batched)
        this.drawEntitiesLayer();

        // 4. Particles
        this.particleSystem.update();
        this.particleSystem.draw(this.ctx);

        // 5. UI
        this.drawUI();

        this.ctx.restore();
    }
}

// Singleton instance
export const renderer = new Renderer();
export const initRenderer = (c, cx, mc, mcx) => renderer.init(c, cx, mc, mcx);
export const setDragState = (d, sx, sy, cx, cy) => renderer.setDragState(d, sx, sy, cx, cy);
export const draw = () => renderer.draw();
export const updateFogRenderer = () => renderer.updateFog();
export const updateTileRenderer = (x, y) => renderer.updateTile(x, y);
export const drawStaticMap = () => { }; // No-op, handled internally
