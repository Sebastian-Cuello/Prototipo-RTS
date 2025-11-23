/**
 * @module Renderer
 * @description High-performance game rendering system (Refactored)
 */

import { map, units, buildings, fogMap, gameState } from '../core/GameState.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { camera } from './Camera.js';
import { getMousePosition } from '../input/InputManager.js';
import { Profiler } from '../utils/Profiler.js';

// Sub-renderers
import TerrainRenderer from './TerrainRenderer.js';
import FogRenderer from './FogRenderer.js';
import EntityRenderer from './EntityRenderer.js';
import ParticleRenderer from './ParticleRenderer.js';
import UIRenderer from './UIRenderer.js';

export default class Renderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.mapCanvas = null;
        this.mapCtx = null;

        // Sub-systems
        this.terrainRenderer = new TerrainRenderer();
        this.fogRenderer = new FogRenderer();
        this.entityRenderer = new EntityRenderer();
        this.particleRenderer = new ParticleRenderer();
        this.uiRenderer = new UIRenderer();

        this.lastCameraX = 0;
        this.lastCameraY = 0;

        this.lastTime = 0;
    }

    init(canvas, ctx, mapCanvas, mapCtx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.mapCanvas = mapCanvas;
        this.mapCtx = mapCtx;

        // Init sub-renderers
        this.terrainRenderer.init();
        this.fogRenderer.init();

        this.lastTime = performance.now();
    }

    updateFog() {
        this.fogRenderer.markFullRedraw();
    }

    updateTile(x, y) {
        this.terrainRenderer.updateTile(x, y);
    }

    updateFogTile(x, y) {
        this.fogRenderer.markDirty(x, y);
    }

    setDragState(dragging, startX, startY, currentX, currentY) {
        this.uiRenderer.setDragState(dragging, startX, startY, currentX, currentY);
    }

    isInViewport(entity, bounds) {
        const x = entity.x * TILE_SIZE;
        const y = entity.y * TILE_SIZE;
        const size = entity.size ? entity.size * TILE_SIZE : TILE_SIZE;

        return !(
            x + size < bounds.left ||
            x > bounds.right ||
            y + size < bounds.top ||
            y > bounds.bottom
        );
    }

    drawLayer(sourceCanvas, offsetX, offsetY) {
        if (!sourceCanvas) return;

        const width = this.canvas.width;
        const height = this.canvas.height;

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity (screen space)

        const startX = Math.floor(offsetX);
        const startY = Math.floor(offsetY);

        this.ctx.drawImage(
            sourceCanvas,
            startX, startY, width, height,  // Source (World Crop)
            0, 0, width, height             // Destination (Screen Space)
        );

        this.ctx.restore();
    }

    draw() {
        if (!this.ctx) return;

        const now = performance.now();
        const deltaTime = this.lastTime ? now - this.lastTime : 16;
        this.lastTime = now;

        const cameraChanged = (
            this.lastCameraX !== camera.x ||
            this.lastCameraY !== camera.y
        );

        this.lastCameraX = camera.x;
        this.lastCameraY = camera.y;

        // Clear Screen
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Terrain (Screen Space Draw)
        Profiler.start('Draw_Terrain');
        this.drawLayer(this.terrainRenderer.getCanvas(), camera.x, camera.y);
        Profiler.end('Draw_Terrain');

        // 2. Fog (Update & Screen Space Draw)
        Profiler.start('Draw_Fog');
        this.fogRenderer.update();
        this.drawLayer(this.fogRenderer.getCanvas(), camera.x, camera.y);
        Profiler.end('Draw_Fog');

        // 3. Entities (World Space Draw)
        Profiler.start('Draw_Entities');
        this.ctx.save();
        this.ctx.translate(-camera.x, -camera.y);

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

        this.entityRenderer.drawEntities(
            this.ctx,
            visibleBuildings,
            visibleUnits,
            this.uiRenderer,
            deltaTime
        );
        this.ctx.restore();
        Profiler.end('Draw_Entities');

        // 4. Particles
        Profiler.start('Draw_Particles');
        this.particleRenderer.update();
        this.particleRenderer.draw(this.ctx);
        Profiler.end('Draw_Particles');

        // 5. UI (World Space - Selection Box, Range, etc)
        // Note: Healthbars are also drawn here (flushed)
        Profiler.start('Draw_UI');
        this.uiRenderer.draw(this.ctx);
        Profiler.end('Draw_UI');
    }
}

// Singleton instance
export const renderer = new Renderer();
export const initRenderer = (c, cx, mc, mcx) => renderer.init(c, cx, mc, mcx);
export const setDragState = (d, sx, sy, cx, cy) => renderer.setDragState(d, sx, sy, cx, cy);
export const draw = () => renderer.draw();
export const updateFogRenderer = () => renderer.updateFog();
export const updateFogTile = (x, y) => renderer.updateFogTile(x, y);
export const updateTileRenderer = (x, y) => renderer.updateTile(x, y);
export const drawStaticMap = () => { }; // No-op
