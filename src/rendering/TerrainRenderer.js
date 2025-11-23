import { map } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { getTileImage } from '../utils/AssetLoader.js';
import { TILES } from '../config/entityStats.js';

export default class TerrainRenderer {
    constructor() {
        this.offscreen = null;
        this.ctx = null;
    }

    init() {
        this.offscreen = document.createElement('canvas');
        this.offscreen.width = MAP_WIDTH * TILE_SIZE;
        this.offscreen.height = MAP_HEIGHT * TILE_SIZE;
        this.ctx = this.offscreen.getContext('2d');

        this.drawFullMap();
    }

    drawFullMap() {
        if (!this.ctx) return;

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                this.drawTile(x, y);
            }
        }
        console.log('✅ Terrain layer cached');
    }

    drawTile(x, y) {
        if (!this.ctx) return;

        const tile = map[y][x];
        const tileImage = getTileImage(tile.id);

        // Clear the specific tile area
        this.ctx.clearRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (tileImage) {
            this.ctx.drawImage(tileImage, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
            this.ctx.fillStyle = tile.color;
            this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Fallback symbols
            if (tile.id === TILES.TREE.id) {
                this.ctx.fillStyle = '#274e13';
                this.ctx.font = '20px Arial';
                this.ctx.fillText('🌲', x * TILE_SIZE + 5, y * TILE_SIZE + 24);
            } else if (tile.id === TILES.MOUNTAIN.id) {
                this.ctx.fillStyle = '#444';
                this.ctx.font = '20px Arial';
                this.ctx.fillText('⛰️', x * TILE_SIZE + 5, y * TILE_SIZE + 24);
            }
        }
    }

    updateTile(x, y) {
        this.drawTile(x, y);
    }

    getCanvas() {
        return this.offscreen;
    }
}
