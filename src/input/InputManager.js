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

const HOTKEYS = {
    // Buildings
    'KeyB': 'barracks',
    'KeyF': 'farm',
    'KeyL': 'lumbermill',
    'KeyT': 'guardtower',
    'KeyK': 'blacksmith',

    // Unit production
    'KeyS': 'soldier',
    'KeyA': 'archer',
    'KeyN': 'knight',
    'KeyP': 'peasant',

    // Commands
    'KeyH': 'stop',      // Halt
    'KeyG': 'patrol',
    'KeyX': 'scatter',   // Spread formation

    // Other
    'Escape': 'cancel'
};

// Control Groups
const controlGroups = {};

function setControlGroup(num) {
    controlGroups[num] = [...gameState.selectedEntities];
    logGameMessage(`Control group ${num} set (${controlGroups[num].length} units)`);
    soundManager.play('select_unit');
}

function selectControlGroup(num) {
    if (!controlGroups[num] || controlGroups[num].length === 0) return;

    // Clear current selection
    gameState.selectedEntities.forEach(e => e.selected = false);
    gameState.selectedEntities = [];

    // Select group (filter dead units)
    controlGroups[num] = controlGroups[num].filter(e => !e.isDead);
    controlGroups[num].forEach(e => {
        e.selected = true;
        gameState.selectedEntities.push(e);
    });

    updateSelectionPanel();
    soundManager.play('select_unit');
}

function handleHotkey(action) {
    const selected = gameState.selectedEntities[0];
    if (!selected) return;

    // Building hotkeys
    if (['barracks', 'farm', 'lumbermill', 'guardtower', 'blacksmith'].includes(action)) {
        if (selected.type === 'peasant') {
            enterBuildingMode(action);
            logGameMessage(`Build mode: ${action}`);
        }
    }

    // Unit production
    if (['soldier', 'archer', 'knight', 'peasant'].includes(action)) {
        if (selected instanceof Building && selected.stats.trains?.includes(action)) {
            selected.trainUnit(action);
        }
    }

    // Commands
    if (action === 'stop') {
        gameState.selectedEntities.forEach(e => {
            if (e instanceof Unit) {
                e.stop();
            }
        });
    }

    if (action === 'patrol') {
        gameState.commandMode = 'patrol_start';
        logGameMessage("Patrol mode: Click start point");
    }

    if (action === 'cancel') {
        gameState.buildingMode = null;
        gameState.commandMode = null;
        logGameMessage("Cancelled.");
    }
}

export function updateCameraFromKeys(canvas) {
    const speed = 10; // pixels per frame

    if (keys['KeyW'] || keys['ArrowUp']) camera.y -= speed;
    if (keys['KeyS'] || keys['ArrowDown']) camera.y += speed;
    if (keys['KeyA'] || keys['ArrowLeft']) camera.x -= speed;
    if (keys['KeyD'] || keys['ArrowRight']) camera.x += speed;

    // Edge scrolling (mouse near edge)
    const { x: mouseX, y: mouseY } = getMousePosition();
    const edgeThreshold = 50;

    if (mouseX < edgeThreshold) camera.x -= speed;
    if (mouseX > canvas.width - edgeThreshold) camera.x += speed;
    if (mouseY < edgeThreshold) camera.y -= speed;
    if (mouseY > canvas.height - edgeThreshold) camera.y += speed;

    // Clamp camera
    camera.x = Math.max(0, Math.min(camera.x, MAP_WIDTH * TILE_SIZE - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, MAP_HEIGHT * TILE_SIZE - canvas.height));
}

export function getMousePosition() {
    return { x: mouseX, y: mouseY };
}

export function initInput(canvas, minimapCanvas) {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        soundManager.tryPlayMusic();

        // Handle hotkeys
        if (HOTKEYS[e.code]) {
            handleHotkey(HOTKEYS[e.code]);
        }

        // Control groups (Ctrl + number)
        if (e.ctrlKey && e.code >= 'Digit1' && e.code <= 'Digit9') {
            const groupNum = parseInt(e.code.replace('Digit', ''));
            setControlGroup(groupNum);
        }
        // Select control group (just number)
        else if (!e.ctrlKey && e.code >= 'Digit1' && e.code <= 'Digit9') {
            const groupNum = parseInt(e.code.replace('Digit', ''));
            selectControlGroup(groupNum);
        }
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

    let lastClickTime = 0;
    let lastClickedUnit = null;

    canvas.addEventListener('mouseup', (event) => {
        if (event.button === 0 && isDragging) {
            isDragging = false;
            setDragState(false, 0, 0, 0, 0);

            const rect = canvas.getBoundingClientRect();
            const releaseX = event.clientX - rect.left + camera.x;
            const releaseY = event.clientY - rect.top + camera.y;

            const minX = Math.min(dragStartX, releaseX);
            const maxX = Math.max(dragStartX, releaseX);
            const minY = Math.min(dragStartY, releaseY);
            const maxY = Math.max(dragStartY, releaseY);

            // SHIFT: Add to selection
            if (!event.shiftKey) {
                gameState.selectedEntities.forEach(e => e.selected = false);
                gameState.selectedEntities = [];
            }

            // Select Units in Rectangle
            if (maxX - minX > 5 && maxY - minY > 5) {
                units.forEach(u => {
                    if (!u.isDead && u.faction === FACTIONS.PLAYER.id &&
                        u.x * TILE_SIZE + TILE_SIZE / 2 >= minX &&
                        u.x * TILE_SIZE + TILE_SIZE / 2 <= maxX &&
                        u.y * TILE_SIZE + TILE_SIZE / 2 >= minY &&
                        u.y * TILE_SIZE + TILE_SIZE / 2 <= maxY) {

                        if (!gameState.selectedEntities.includes(u)) {
                            u.selected = true;
                            gameState.selectedEntities.push(u);
                        }
                    }
                });

                // CTRL: Also select buildings in box
                if (event.ctrlKey) {
                    buildings.forEach(b => {
                        if (!b.isDead && b.faction === FACTIONS.PLAYER.id &&
                            b.x * TILE_SIZE >= minX &&
                            (b.x + b.size) * TILE_SIZE <= maxX &&
                            b.y * TILE_SIZE >= minY &&
                            (b.y + b.size) * TILE_SIZE <= maxY) {

                            if (!gameState.selectedEntities.includes(b)) {
                                b.selected = true;
                                gameState.selectedEntities.push(b);
                            }
                        }
                    });
                }
            } else {
                // Single Click Selection
                const clickX = releaseX;
                const clickY = releaseY;
                const tileX = Math.floor(clickX / TILE_SIZE);
                const tileY = Math.floor(clickY / TILE_SIZE);

                const clickedUnit = units.find(u => !u.isDead && Math.abs(u.x - tileX) < 1 && Math.abs(u.y - tileY) < 1);
                const clickedBuilding = buildings.find(b => !b.isDead && tileX >= b.x && tileX < b.x + b.size && tileY >= b.y && tileY < b.y + b.size);

                const selectedEntity = clickedUnit || clickedBuilding;

                // Double-click to Select All of Type
                const now = Date.now();
                const isDoubleClick = (now - lastClickTime) < 300;

                if (isDoubleClick && lastClickedUnit && clickedUnit === lastClickedUnit) {
                    // Select all units of same type on screen
                    gameState.selectedEntities.forEach(e => e.selected = false);
                    gameState.selectedEntities = [];

                    units.forEach(u => {
                        if (!u.isDead &&
                            u.faction === FACTIONS.PLAYER.id &&
                            u.type === clickedUnit.type &&
                            isOnScreen(u, canvas)) {
                            u.selected = true;
                            gameState.selectedEntities.push(u);
                        }
                    });
                } else if (selectedEntity && selectedEntity.faction === FACTIONS.PLAYER.id) {
                    if (!gameState.selectedEntities.includes(selectedEntity)) {
                        selectedEntity.selected = true;
                        gameState.selectedEntities.push(selectedEntity);
                    }
                }

                lastClickTime = now;
                lastClickedUnit = clickedUnit;
            }

            if (gameState.selectedEntities.length > 0) {
                soundManager.play('select_unit');
            }

            updateSelectionPanel();
        }
    });

    function isOnScreen(unit, canvas) {
        const x = unit.x * TILE_SIZE;
        const y = unit.y * TILE_SIZE;
        return x >= camera.x && x <= camera.x + canvas.width &&
            y >= camera.y && y <= camera.y + canvas.height;
    }

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

            // 2. Patrol Mode
        } else if (gameState.commandMode === 'patrol_start') {
            const selectedUnits = gameState.selectedEntities.filter(e => e instanceof Unit && e.faction === FACTIONS.PLAYER.id);
            selectedUnits.forEach(u => {
                u.patrol(u.x, u.y, tileX, tileY);
            });
            gameState.commandMode = null;
            logGameMessage("Patrol route set.");

            // 3. Unit Command Mode (Move/Attack/Gather)
        } else if (selected instanceof Unit) {
            const targetUnit = units.find(u => !u.isDead && Math.abs(u.x - tileX) < 1 && Math.abs(u.y - tileY) < 1 && u.faction !== selected.faction);
            const targetBuilding = buildings.find(b => !b.isDead && tileX >= b.x && tileX < b.x + b.size && tileY >= b.y && tileY < b.y + b.size && b.faction !== selected.faction);
            const tile = map[tileY][tileX];
            const targetEntity = targetUnit || targetBuilding;

            // Filter selected entities to only include Units (just in case)
            const selectedUnits = gameState.selectedEntities.filter(e => e instanceof Unit && e.faction === FACTIONS.PLAYER.id);

            if (selectedUnits.length > 1) {
                // --- FORMATION MOVEMENT ---
                const formationType = keys['ShiftLeft'] ? 'line' : 'grid'; // Shift for Line formation
                const positions = getFormationPositions(tileX, tileY, selectedUnits, formationType);

                selectedUnits.forEach((unit, index) => {
                    const pos = positions[index];

                    // If attacking, all attack the target
                    if (targetEntity && targetEntity.faction !== FACTIONS.NEUTRAL.id) {
                        unit.moveTo(targetEntity.x, targetEntity.y, targetEntity);
                    } else {
                        unit.moveTo(pos.x, pos.y);
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

    function getFormationPositions(centerX, centerY, units, formationType = 'grid') {
        const positions = [];
        const count = units.length;

        switch (formationType) {
            case 'line':
                // Horizontal line
                const lineSpacing = 1.5;
                const lineStart = centerX - (count * lineSpacing) / 2;
                units.forEach((unit, i) => {
                    positions.push({
                        x: lineStart + i * lineSpacing,
                        y: centerY
                    });
                });
                break;

            case 'grid':
            default:
                const cols = Math.ceil(Math.sqrt(count));
                const spacing = 1.5;
                const startX = centerX - (cols * spacing) / 2;
                const startY = centerY - (Math.ceil(count / cols) * spacing) / 2;

                units.forEach((unit, index) => {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    positions.push({
                        x: startX + col * spacing,
                        y: startY + row * spacing
                    });
                });
        }

        // Validate and adjust for obstacles
        return positions.map(pos => {
            let { x, y } = pos;

            // If blocked, find nearest passable
            if (!isPassable(Math.floor(x), Math.floor(y))) {
                const nearest = findNearestPassable(x, y, 5);
                if (nearest) {
                    x = nearest.x;
                    y = nearest.y;
                }
            }

            return {
                x: Math.max(1, Math.min(MAP_WIDTH - 2, x)),
                y: Math.max(1, Math.min(MAP_HEIGHT - 2, y))
            };
        });
    }

    function isPassable(x, y) {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
        return map[y][x].passable;
    }

    function findNearestPassable(x, y, maxRadius) {
        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    const nx = Math.floor(x + dx);
                    const ny = Math.floor(y + dy);
                    if (isPassable(nx, ny)) {
                        return { x: nx, y: ny };
                    }
                }
            }
        }
        return null;
    }

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
