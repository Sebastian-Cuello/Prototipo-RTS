/**
 * @module Entity
 * @description Base entity class for all game objects
 * 
 * This module defines the base Entity class that is extended by Unit and Building.
 * 
 * Key Features:
 * - Position and faction management
 * - Health tracking and display
 * - Selection state
 * - Spatial hash integration for efficient queries
 * - Death handling and cleanup
 * 
 * All units and buildings inherit from this base class.
 */

import { spatialHash } from '../core/GameState.js';

/**
 * @class Entity
 * @description Base class for all game entities (units and buildings)
 * 
 * Provides core functionality:
 * - Position tracking (x, y coordinates in tile space)
 * - Faction ownership
 * - Health management
 * - Selection state
 * - Spatial hash registration
 * - Death state and cleanup
 */
export default class Entity {
    constructor(x, y, faction, stats) {
        this.x = x;
        this.y = y;
        this.faction = faction;
        this.stats = stats;
        this.health = stats.maxHealth;
        this.maxHealth = stats.maxHealth;
        this.selected = false;
        this.isDead = false;
        if (spatialHash) spatialHash.insert(this);
    }

    die() {
        this.isDead = true;
        if (spatialHash) spatialHash.remove(this);
    }

    draw() {
        // Base draw on canvas: circle for units, square for buildings
    }

    getTileX() { return Math.floor(this.x); }
    getTileY() { return Math.floor(this.y); }
}
