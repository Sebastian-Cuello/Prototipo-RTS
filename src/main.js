/**
 * @module Main
 * @description Main entry point for the RTS game
 * 
 * This module bootstraps the entire application by:
 * - Setting up canvas elements and their rendering contexts
 * - Initializing all game systems (UI, rendering, input, game logic)
 * - Starting the main game loop
 * - Handling window resize events
 * 
 * Key Features:
 * - Dynamic canvas sizing based on container dimensions
 * - Responsive layout handling
 * - Centralized initialization sequence
 * - Window resize support for responsive gameplay
 */

import { initGame, startGameLoop } from './core/Game.js';
import { initRenderer } from './rendering/Renderer.js';
import { initMinimapRenderer } from './rendering/MinimapRenderer.js';
import { initInput } from './input/InputManager.js';
import { initUI } from './ui/UIManager.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from './config/constants.js';
import { preloadBuildingAssets, preloadUnitAssets, preloadTileAssets } from './utils/AssetLoader.js';
import { BUILDING_STATS, UNIT_STATS, TILES } from './config/entityStats.js';


/**
 * Main Entry Point
 * Initializes all game systems and starts the game loop when the page loads.
 * Sets up canvas dimensions, rendering contexts, and event handlers.
 */
window.onload = async () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const mapCanvas = document.getElementById('mapCanvas');
    const mapCtx = mapCanvas.getContext('2d');
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');

    // Set canvas size to fill the game area container
    const gameArea = document.getElementById('gameArea');
    const resizeCanvas = () => {
        // Use clientWidth/Height to get the full content area dimensions
        canvas.width = gameArea.clientWidth;
        canvas.height = gameArea.clientHeight;
        mapCanvas.width = MAP_WIDTH * TILE_SIZE;
        mapCanvas.height = MAP_HEIGHT * TILE_SIZE;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Preload building and unit assets
    console.log('🎨 Loading game assets...');
    await Promise.all([
        preloadBuildingAssets(BUILDING_STATS),
        preloadUnitAssets(UNIT_STATS),
        preloadTileAssets(TILES)
    ]);
    console.log('✅ All assets loaded!');

    // Start Game Logic (Generates Map)
    initGame();

    // Initialize Systems
    initUI();
    initRenderer(canvas, ctx, mapCanvas, mapCtx);
    initMinimapRenderer(minimapCanvas, minimapCtx);
    initInput(canvas, minimapCanvas);

    // Start Loop
    startGameLoop();
};
