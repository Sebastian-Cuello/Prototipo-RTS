/**
 * @module Game
 * @description Core game loop and logic controller
 * 
 * This module manages:
 * - Fixed timestep game loop using requestAnimationFrame
 * - Game initialization (map generation, AI setup, entity spawning)
 * - Entity updates (units, buildings, AI controllers)
 * - Dead entity cleanup
 * - Camera controls and boundary clamping
 * - FPS calculation and display
 * - Periodic UI updates (resources, selection, fog of war)
 * 
 * Key Features:
 * - Fixed timestep for consistent game logic (30 updates/sec)
 * - Variable framerate rendering
 * - Lag compensation to maintain smooth updates
 * - Keyboard-based camera movement (WASD/Arrow keys)
 * - Automatic entity cleanup (dead units/buildings)
 */

import { gameState, units, setUnits, buildings, setBuildings, aiControllers, setAIControllers } from './GameState.js';
import { MS_PER_UPDATE, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants.js';
import { updateFog } from '../systems/FogOfWar.js';
import { draw, drawStaticMap } from '../rendering/Renderer.js';
import { drawMinimap } from '../rendering/MinimapRenderer.js';
import { updateResourcesUI, updateSelectionPanel } from '../ui/UIManager.js';
import AIController from '../systems/AIController.js';
import { FACTIONS } from '../config/entityStats.js';
import { generateMap, spawnInitialEntities } from '../map/MapGenerator.js';
import { camera } from '../rendering/Camera.js';
import { keys, getMousePosition, updateCameraFromKeys } from '../input/InputManager.js';

let lastTime = 0;
let lag = 0;
let frameCount = 0;
let fpsTimer = 0;
let actualFPS = 0;

import { soundManager } from '../systems/SoundManager.js';
import { preloadTileAssets } from '../utils/AssetLoader.js';
import { TILES } from '../config/entityStats.js';

export function initGame() {
    generateMap();
    spawnInitialEntities();
    preloadTileAssets(TILES);

    // Initialize AI
    const ais = [];
    ais.push(new AIController(FACTIONS.ENEMY.id));
    ais.push(new AIController(FACTIONS.ALLY.id));
    ais.push(new AIController(FACTIONS.ENEMY_2.id));
    setAIControllers(ais);

    // Initialize Audio
    soundManager.init();

    drawStaticMap(); // Initial draw
}

function updateGameLogic() {
    gameState.gameTime++;

    // Update AI
    aiControllers.forEach(ai => ai.update());

    // Unit and Building updates
    units.forEach(u => u.update());
    buildings.forEach(b => b.update());

    // Remove dead entities
    setUnits(units.filter(u => !u.isDead));
    setBuildings(buildings.filter(b => !b.isDead));

    // Update UI elements dependent on game logic
    if (gameState.gameTime % 15 === 0) {
        updateSelectionPanel();
        updateResourcesUI();
        updateFog();
    }
}

export function startGameLoop() {
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    if (gameState.paused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const elapsed = currentTime - lastTime;
    lastTime = currentTime;

    lag += elapsed;
    while (lag >= MS_PER_UPDATE) {
        updateGameLogic();
        lag -= MS_PER_UPDATE;
    }

    draw();
    drawMinimap();

    // FPS Calculation
    frameCount++;
    fpsTimer += elapsed;
    if (fpsTimer >= 1000) {
        actualFPS = frameCount;
        const fpsElem = document.getElementById('fps');
        if (fpsElem) fpsElem.textContent = actualFPS.toFixed(0);
        frameCount = 0;
        fpsTimer = 0;
    }

    // Update Camera
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        updateCameraFromKeys(canvas);
    }

    requestAnimationFrame(gameLoop);
}
