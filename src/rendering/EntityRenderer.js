import { TILE_SIZE } from '../config/constants.js';
import { FACTIONS, UNIT_STATS } from '../config/entityStats.js';
import { getBuildingImage, getUnitImage } from '../utils/AssetLoader.js';
import { fogMap } from '../core/GameState.js';
import Building from '../entities/Building.js';

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

export class Animation {
    constructor(spritesheet, frames, frameDuration = 100) { // frameDuration in ms
        this.spritesheet = spritesheet;
        this.frames = frames;
        this.frameDuration = frameDuration;
        this.currentFrame = 0;
        this.elapsed = 0;
    }

    update(deltaTime) {
        this.elapsed += deltaTime;

        if (this.elapsed >= this.frameDuration) {
            this.elapsed -= this.frameDuration;
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }
    }

    draw(ctx, x, y, width, height) {
        const frame = this.frames[this.currentFrame];
        return this.spritesheet.draw(ctx, frame.x, frame.y, x, y, width, height);
    }

    reset() {
        this.currentFrame = 0;
        this.elapsed = 0;
    }
}

export default class EntityRenderer {
    constructor() {
        this.spritesheets = {
            units: new SpriteSheet('assets/sprites/units.png', 32, 32),
            buildings: new SpriteSheet('assets/sprites/buildings.png', 64, 64)
        };

        this.animations = {
            peasant_idle: new Animation(this.spritesheets.units, [{ x: 0, y: 0 }], 100),
            peasant_walk: new Animation(this.spritesheets.units, [{ x: 1, y: 0 }, { x: 2, y: 0 }], 150),
            peasant_attack: new Animation(this.spritesheets.units, [{ x: 3, y: 0 }, { x: 4, y: 0 }], 100)
        };
    }

    drawEntities(ctx, visibleBuildings, visibleUnits, uiRenderer, deltaTime) {
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

                // Check Fog
                const tx = Math.floor(b.x);
                const ty = Math.floor(b.y);
                if (fogMap[ty] && fogMap[ty][tx] === 0) return; // Hidden

                // Draw
                if (buildingImage) {
                    // if (b.faction !== FACTIONS.NEUTRAL.id) {
                    //     ctx.globalAlpha = 0.3;
                    //     ctx.fillStyle = faction.color;
                    //     ctx.fillRect(x, y, size, size);
                    //     ctx.globalAlpha = 1.0;
                    // }
                    ctx.drawImage(buildingImage, x, y, size, size);
                } else {
                    // Fallback
                    ctx.fillStyle = faction.color;
                    ctx.fillRect(x, y, size, size);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, size, size);

                    ctx.fillStyle = faction.unitColor;
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(b.stats.symbol, x + size / 2, y + size / 2);
                }

                // Blueprint
                if (b.isBlueprint) {
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
                    ctx.fillRect(x, y, size, size);
                }

                // Training Progress
                if (b.trainingQueue.length > 0 && !b.isBlueprint) {
                    const unitType = b.trainingQueue[0];
                    const buildTime = UNIT_STATS[unitType].buildTime * 30; // Assuming 30 ticks per sec logic still holds for logic updates
                    const progressRatio = b.trainingProgress / buildTime;

                    ctx.fillStyle = '#000';
                    ctx.fillRect(x, y + size + 5, size, 5);
                    ctx.fillStyle = '#f39c12';
                    ctx.fillRect(x, y + size + 5, size * progressRatio, 5);
                }

                uiRenderer.queueHealthBar(b, x, y);

                // Draw Veterancy Stars
                if (b.level > 1) {
                    const starCount = b.level - 1;
                    const startX = x + (size - (starCount * 10)) / 2;

                    ctx.fillStyle = '#ffd700';
                    ctx.font = 'bold 12px Arial';
                    ctx.shadowColor = 'black';
                    ctx.shadowBlur = 2;

                    for (let i = 0; i < starCount; i++) {
                        ctx.fillText('★', startX + i * 10, y - 5);
                    }
                    ctx.shadowBlur = 0;
                }
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
                    // Update animation with deltaTime
                    u.animationState.update(deltaTime);
                    drawn = u.animationState.draw(ctx, x, y, TILE_SIZE, TILE_SIZE);
                }

                if (!drawn) {
                    if (unitImage) {
                        // Optimized: No clip(), just draw image
                        // Draw faction background for identification
                        ctx.fillStyle = faction.color;
                        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

                        const imageSize = TILE_SIZE * 0.8;
                        const imageOffset = (TILE_SIZE - imageSize) / 2;
                        ctx.drawImage(unitImage, x + imageOffset, y + imageOffset, imageSize, imageSize);
                    } else {
                        // Fallback
                        ctx.fillStyle = faction.color;
                        ctx.beginPath();
                        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = faction.unitColor;
                        ctx.font = 'bold 16px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(u.stats.symbol, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
                    }
                }

                // Movement Target
                if (u.isMoving && u.faction === FACTIONS.PLAYER.id && u.selected) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
                    ctx.fillRect(u.targetX * TILE_SIZE + TILE_SIZE / 2 - 4, u.targetY * TILE_SIZE + TILE_SIZE / 2 - 4, 8, 8);
                }

                uiRenderer.queueHealthBar(u, x, y);
            });
        });
    }
}
