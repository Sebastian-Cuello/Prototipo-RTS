import { fogMap } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';

export default class FogRenderer {
    constructor() {
        this.offscreen = null;
        this.ctx = null;
        this.dirtyTiles = new Set(); // Stores "x,y" strings of tiles that need updating
        this.needsFullRedraw = true;
    }

    init() {
        this.offscreen = document.createElement('canvas');
        this.offscreen.width = MAP_WIDTH * TILE_SIZE;
        this.offscreen.height = MAP_HEIGHT * TILE_SIZE;
        this.ctx = this.offscreen.getContext('2d');

        this.drawFullFog();
    }

    markDirty(x, y) {
        this.dirtyTiles.add(`${x},${y}`);
    }

    markFullRedraw() {
        this.needsFullRedraw = true;
    }

    update() {
        if (this.needsFullRedraw) {
            this.drawFullFog();
            this.needsFullRedraw = false;
            this.dirtyTiles.clear();
        } else if (this.dirtyTiles.size > 0) {
            this.dirtyTiles.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                this.drawFogTile(x, y);
            });
            this.dirtyTiles.clear();
        }
    }

    drawFullFog() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                this.drawFogTile(x, y);
            }
        }
    }

    drawFogTile(x, y) {
        if (!this.ctx) return;

        const fog = fogMap[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Clear the tile first to prevent alpha accumulation
        this.ctx.clearRect(px, py, TILE_SIZE, TILE_SIZE);

        if (fog === 0) {
            // Unexplored - Black
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else if (fog === 1) {
            // Explored but not visible - Dimmed
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        // fog === 2 is Visible (Transparent), so we just clear it (already done)
    }

    getCanvas() {
        return this.offscreen;
    }
}
