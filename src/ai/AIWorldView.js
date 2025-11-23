/**
 * @module AIWorldView
 * @description Interface for AI to access game state with "Fog of War" filtering
 */

import { spatialHash, map, units, buildings, allianceSystem } from '../core/GameState.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants.js';
import { AI_TUNING } from '../config/aiTuning.js';
import { FACTIONS } from '../config/entityStats.js';

export default class AIWorldView {
    constructor(factionId) {
        this.factionId = factionId;
        this.explorationGrid = this.initializeExplorationGrid();
    }

    initializeExplorationGrid() {
        const GRID_SIZE = AI_TUNING.SCOUTING.GRID_SIZE;
        const grid = [];

        for (let y = 0; y < MAP_HEIGHT; y += GRID_SIZE) {
            for (let x = 0; x < MAP_WIDTH; x += GRID_SIZE) {
                grid.push({
                    x: x + GRID_SIZE / 2,
                    y: y + GRID_SIZE / 2,
                    lastSeen: 0,
                    timesVisited: 0,
                    isExplored: false
                });
            }
        }
        return grid;
    }

    update(myUnits) {
        // Update exploration based on unit positions
        // This is a simplified "Fog of War" for the AI
        const GRID_SIZE = AI_TUNING.SCOUTING.GRID_SIZE;

        myUnits.forEach(unit => {
            const gridIndex = Math.floor(unit.y / GRID_SIZE) * Math.ceil(MAP_WIDTH / GRID_SIZE) + Math.floor(unit.x / GRID_SIZE);
            if (this.explorationGrid[gridIndex]) {
                this.explorationGrid[gridIndex].lastSeen = Date.now();
                this.explorationGrid[gridIndex].timesVisited++;
                this.explorationGrid[gridIndex].isExplored = true;
            }
        });
    }

    // Query Methods (Filtered by Vision)

    getUnitsInArea(x, y, radius) {
        if (!spatialHash) return [];
        return spatialHash.query(x, y, radius);
    }

    getEnemiesNear(x, y, radius) {
        if (!spatialHash) return [];

        const entities = spatialHash.query(x, y, radius);
        return entities.filter(e =>
            !e.isDead &&
            e.faction !== FACTIONS.NEUTRAL.id &&
            allianceSystem.areEnemies(this.factionId, e.faction)
        );
    }

    getVisibleEnemies(unit) {
        if (!spatialHash) return [];
        // Use spatial hash to get enemies in vision range
        const range = unit.stats.range + AI_TUNING.COMBAT.MICRO_RANGE;
        return spatialHash.queryEnemies(unit.x, unit.y, range, this.factionId, -1); // -1 for Neutral? Need to check constants.
    }

    // Helper to check if a position is explored
    isExplored(x, y) {
        const GRID_SIZE = AI_TUNING.SCOUTING.GRID_SIZE;
        const gridIndex = Math.floor(y / GRID_SIZE) * Math.ceil(MAP_WIDTH / GRID_SIZE) + Math.floor(x / GRID_SIZE);
        return this.explorationGrid[gridIndex] && this.explorationGrid[gridIndex].isExplored;
    }

    getExplorationGrid() {
        return this.explorationGrid;
    }
}
