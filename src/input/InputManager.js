/**
 * @module InputManager
 * @description Mouse and keyboard input handling
 * 
 * This module manages all user input including:
 * - Unit/building selection (click and drag box)
 * - Movement and attack commands (right-click)
 * - Building placement mode
 * - Formation movement for multiple units
 * - Resource gathering commands
 * - Minimap camera navigation
 * - Keyboard controls
 * 
 * Key Features:
 * - Drag-box selection for multiple units
 * - Context-sensitive right-click actions
 * - Building placement validation
 * - Formation movement for groups
 * - Smart command targeting (attack vs move vs gather)
 * - Minimap click-to-navigate
 * - Keyboard state tracking
 * 
 * Input Modes:
 * - Selection mode: Click or drag to select units/buildings
 * - Building mode: Click to place building blueprint
 * - Command mode: Right-click to issue orders (move/attack/gather)
 * - Minimap mode: Click minimap to move camera
 */

import { gameState, units, buildings, map } from '../core/GameState.js';
import { camera } from '../rendering/Camera.js';
import { setDragState } from '../rendering/Renderer.js';
import { updateSelectionPanel, enterBuildingMode } from '../ui/UIManager.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { FACTIONS, BUILDING_STATS, TILES } from '../config/entityStats.js';
import { logGameMessage } from '../utils/Logger.js';
import { soundManager } from '../systems/SoundManager.js';
import Unit from '../entities/Unit.js';
import Building from '../entities/Building.js';

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragCurrentX = 0;
let dragCurrentY = 0;

let mouseX = 0;
let mouseY = 0;

export const keys = {};

export function getMousePosition() {
    return { x: mouseX, y: mouseY };
}

export function initInput(canvas, minimapCanvas) {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        soundManager.tryPlayMusic();
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    // Canvas Mouse Events
    canvas.addEventListener('mousedown', (event) => {
        soundManager.tryPlayMusic();
        if (event.button === 0) { // Left Click
            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left + camera.x;
            const clickY = event.clientY - rect.top + camera.y;

            isDragging = true;
            dragStartX = clickX;
            dragStartY = clickY;
            dragCurrentX = clickX;
            dragCurrentY = clickY;
            setDragState(true, dragStartX, dragStartY, dragCurrentX, dragCurrentY);
        }
    });

    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;
        const worldMouseX = mouseX + camera.x;
        const worldMouseY = mouseY + camera.y;

        if (isDragging) {
            dragCurrentX = worldMouseX;
            dragCurrentY = worldMouseY;
            setDragState(true, dragStartX, dragStartY, dragCurrentX, dragCurrentY);
        }
    });

    canvas.addEventListener('mouseup', (event) => {
        if (event.button === 0 && isDragging) {
            isDragging = false;
            setDragState(false, 0, 0, 0, 0);

            const rect = canvas.getBoundingClientRect();
            const releaseX = event.clientX - rect.left + camera.x;
            const releaseY = event.clientY - rect.top + camera.y;

            // Determine selection rectangle
            const minX = Math.min(dragStartX, releaseX);
            const maxX = Math.max(dragStartX, releaseX);
            const minY = Math.min(dragStartY, releaseY);
            const maxY = Math.max(dragStartY, releaseY);

            // Clear previous selection
            gameState.selectedEntities.forEach(e => e.selected = false);
            gameState.selectedEntities = [];

            // Select Units in Rectangle
            if (maxX - minX > 5 && maxY - minY > 5) {
                units.forEach(u => {
                    if (!u.isDead && u.faction === FACTIONS.PLAYER.id &&
                        u.x * TILE_SIZE + TILE_SIZE / 2 >= minX && u.x * TILE_SIZE + TILE_SIZE / 2 <= maxX &&
                        u.y * TILE_SIZE + TILE_SIZE / 2 >= minY && u.y * TILE_SIZE + TILE_SIZE / 2 <= maxY) {
                        u.selected = true;
                        gameState.selectedEntities.push(u);
                    }
                });
            } else {
                // Single Click Selection
                const clickX = releaseX;
                const clickY = releaseY;
                const tileX = Math.floor(clickX / TILE_SIZE);
                const tileY = Math.floor(clickY / TILE_SIZE);

                const clickedUnit = units.find(u => !u.isDead && Math.abs(u.x - tileX) < 1 && Math.abs(u.y - tileY) < 1);
                const clickedBuilding = buildings.find(b => !b.isDead && tileX >= b.x && tileX < b.x + b.size && tileY >= b.y && tileY < b.y + b.size);

                const selectedEntity = clickedUnit || clickedBuilding;

                if (selectedEntity && selectedEntity.faction === FACTIONS.PLAYER.id) {
                    selectedEntity.selected = true;
                    gameState.selectedEntities.push(selectedEntity);
                }
            }

            if (gameState.selectedEntities.length > 0) {
                soundManager.play('select_unit');
            }

            updateSelectionPanel();
        }
    });

    canvas.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Prevent right-click menu

        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left + camera.x;
        const clickY = event.clientY - rect.top + camera.y;

        const tileX = Math.floor(clickX / TILE_SIZE);
        const tileY = Math.floor(clickY / TILE_SIZE);

        const selected = gameState.selectedEntities[0];
        if (!selected) return;

        // 1. Building Mode
        if (gameState.buildingMode && selected.type === 'peasant') {
            const stats = BUILDING_STATS[gameState.buildingMode];

            // Check if the proposed building area is clear and on passable ground
            let canBuild = true;
            for (let y = 0; y < stats.size; y++) {
                for (let x = 0; x < stats.size; x++) {
                    const currentTileX = tileX + x;
                    const currentTileY = tileY + y;

                    if (currentTileX < 0 || currentTileX >= MAP_WIDTH || currentTileY < 0 || currentTileY >= MAP_HEIGHT) {
                        canBuild = false; // Out of bounds
                        break;
                    }
                    const tile = map[currentTileY][currentTileX];
                    if (!tile.passable || tile.id !== TILES.GRASS.id) {
                        canBuild = false; // Not passable or not grass
                        break;
                    }
                    // Check for overlap with existing buildings
                    if (buildings.some(b =>
                        currentTileX < b.x + b.size && currentTileX + 1 > b.x && currentTileY < b.y + b.size && currentTileY + 1 > b.y
                    )) {
                        canBuild = false; // Overlaps with another building
                        break;
                    }
                }
                if (!canBuild) break;
            }

            if (canBuild) {
                selected.startBuilding(gameState.buildingMode, tileX, tileY);
                gameState.buildingMode = null; // Exit build mode
            } else {
                logGameMessage("Cannot build there! Obstacle, water, or existing structure.");
            }

            // 2. Unit Command Mode (Move/Attack/Gather)
        } else if (selected instanceof Unit) {
            const targetUnit = units.find(u => !u.isDead && Math.abs(u.x - tileX) < 1 && Math.abs(u.y - tileY) < 1 && u.faction !== selected.faction);
            const targetBuilding = buildings.find(b => !b.isDead && tileX >= b.x && tileX < b.x + b.size && tileY >= b.y && tileY < b.y + b.size && b.faction !== selected.faction);
            const tile = map[tileY][tileX];
            const targetEntity = targetUnit || targetBuilding;

            // Filter selected entities to only include Units (just in case)
            const selectedUnits = gameState.selectedEntities.filter(e => e instanceof Unit && e.faction === FACTIONS.PLAYER.id);

            if (selectedUnits.length > 1) {
                // --- FORMATION MOVEMENT ---
                // Simple Grid Formation
                const count = selectedUnits.length;
                const cols = Math.ceil(Math.sqrt(count));
                const spacing = 1.5; // Distance between units

                // Center of formation is the clicked tile
                const startX = tileX - (cols * spacing) / 2;
                const startY = tileY - (Math.ceil(count / cols) * spacing) / 2;

                selectedUnits.forEach((unit, index) => {
                    const col = index % cols;
                    const row = Math.floor(index / cols);

                    let tx = startX + col * spacing;
                    let ty = startY + row * spacing;

                    // Clamp to map
                    tx = Math.max(1, Math.min(MAP_WIDTH - 2, tx));
                    ty = Math.max(1, Math.min(MAP_HEIGHT - 2, ty));

                    // If attacking, all attack the target
                    if (targetEntity && targetEntity.faction !== FACTIONS.NEUTRAL.id) {
                        unit.moveTo(targetEntity.x, targetEntity.y, targetEntity);
                    } else {
                        unit.moveTo(Math.floor(tx), Math.floor(ty));
                    }
                });

                if (targetEntity && targetEntity.faction !== FACTIONS.NEUTRAL.id) {
                    soundManager.play('command_attack');
                    logGameMessage(`Group ordered to attack ${targetEntity.stats.name}.`);
                } else {
                    soundManager.play('command_move');
                    logGameMessage(`Group ordered to move.`);
                }

            } else {
                // Single Unit Command
                if (targetEntity) {
                    if (targetEntity.faction !== selected.faction && targetEntity.faction !== FACTIONS.NEUTRAL.id) {
                        // Attack Enemy
                        selected.moveTo(targetEntity.getTileX(), targetEntity.getTileY(), targetEntity);
                        soundManager.play('command_attack');
                        logGameMessage(`${selected.stats.name} attacking ${targetEntity.stats.name}!`);
                    } else if (targetEntity.faction === FACTIONS.NEUTRAL.id && targetEntity.type === 'goldmine' && selected.type === 'peasant') {
                        // Gather Gold
                        selected.startGathering('gold', targetEntity.x, targetEntity.y, targetEntity);
                        soundManager.play('command_move');
                        logGameMessage("Peasant gathering gold.");
                    } else if (targetEntity.faction === selected.faction && targetEntity instanceof Building && targetEntity.health < targetEntity.maxHealth && selected.type === 'peasant') {
                        // Repair (using build logic)
                        selected.buildTarget = targetEntity;
                        selected.isBuilding = true;
                        selected.isGathering = false;
                        selected.moveTo(targetEntity.x, targetEntity.y);
                        logGameMessage("Peasant repairing.");
                    } else {
                        // Move to friendly/neutral unit/building
                        selected.moveTo(tileX, tileY);
                    }
                } else {
                    // Move to Ground / Gather Wood
                    if (tile.id === TILES.TREE.id && selected.type === 'peasant') {
                        selected.startGathering('wood', tileX, tileY);
                        logGameMessage("Peasant gathering wood.");
                    } else if (tile.passable) {
                        selected.moveTo(tileX, tileY);
                    } else {
                        logGameMessage("Cannot move there!");
                    }
                }
            }
        }
    });

    // Minimap Click to Move Camera
    minimapCanvas.addEventListener('mousedown', (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const mapX = (x / minimapCanvas.width) * (MAP_WIDTH * TILE_SIZE);
        const mapY = (y / minimapCanvas.height) * (MAP_HEIGHT * TILE_SIZE);

        camera.x = mapX - canvas.width / 2;
        camera.y = mapY - canvas.height / 2;

        // Clamp
        camera.x = Math.max(0, Math.min(camera.x, MAP_WIDTH * TILE_SIZE - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, MAP_HEIGHT * TILE_SIZE - canvas.height));
    });
}
