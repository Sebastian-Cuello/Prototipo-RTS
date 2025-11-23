/**
 * @module GameState
 * @description Global game state management
 * 
 * This module provides centralized state management for:
 * - Player and faction resources (gold, wood, stone, food)
 * - Faction-specific upgrades and research
 * - Selected entities and current build mode
 * - Game time and pause state
 * - All game entities (units, buildings, map)
 * - Game systems (AI controllers, spatial hash, pathfinder, fog of war)
 * 
 * Key Features:
 * - Immutable exports with setter functions for controlled modifications
 * - Per-faction resource tracking
 * - Upgrade tracking system
 * - Entity array management (units, buildings)
 * - System instance management (pathfinder, spatial hash, AI)
 * 
 * @property {Object} gameState - Main game state object
 * @property {Object} gameState.resources - Player resources
 * @property {Object} gameState.factionResources - Resources for each faction (0=Player, 1=Enemy, 2=Ally, 3=Enemy2)
 * @property {Object} gameState.factionUpgrades - Researched upgrades per faction
 * @property {Array} gameState.selectedEntities - Currently selected units/buildings
 */

export const gameState = {
    resources: { gold: 500, wood: 500, stone: 150, foodUsed: 0, foodMax: 5 },
    factionResources: {
        0: { gold: 500, wood: 500, stone: 150, foodUsed: 0, foodMax: 5 },
        1: { gold: 500, wood: 500, stone: 150, foodUsed: 0, foodMax: 5 },
        2: { gold: 500, wood: 500, stone: 150, foodUsed: 0, foodMax: 5 },
        3: { gold: 500, wood: 500, stone: 150, foodUsed: 0, foodMax: 5 }
    },
    factionUpgrades: {
        0: [], 1: [], 2: [], 3: []
    },
    selectedEntities: [],
    buildingMode: null,
    targetEntity: null,
    gameTime: 0,
    paused: false,
};

export let map = [];
export let units = [];
export let buildings = [];
export let fogMap = [];
export let aiControllers = [];
export let spatialHash = null;
export let pathfinder = null;

export function setMap(newMap) { map = newMap; }
export function setUnits(newUnits) { units = newUnits; }
export function setBuildings(newBuildings) { buildings = newBuildings; }
export function setFogMap(newFogMap) { fogMap = newFogMap; }
export function setAIControllers(newAIControllers) { aiControllers = newAIControllers; }
export function setSpatialHash(newSpatialHash) { spatialHash = newSpatialHash; }
export function setPathfinder(newPathfinder) { pathfinder = newPathfinder; }
