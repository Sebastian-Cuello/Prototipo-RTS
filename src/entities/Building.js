/**
 * @module Building
 * @description Building entity class for structures and production
 * 
 * This module manages all building functionality including:
 * - Unit training and production queues
 * - Technology research (upgrades)
 * - Blueprint/construction phase
 * - Defensive capabilities (Guard Tower)
 * 
 * Key Features:
 * - Multi-unit training queue with progress tracking
 * - Research system for faction-wide upgrades
 * - Blueprint construction phase
 * - Automatic upgrade application to existing units
 * - Defensive tower AI (Guard Tower)
 * - Food capacity provision (Farm)
 * 
 * Building Types:
 * - Town Hall/Keep: Trains peasants, provides food capacity
 * - Barracks: Trains military units
 * - Farm: Provides food capacity for unit production
 * - Lumber Mill: Wood gathering drop-off point
 * - Blacksmith: Research attack/defense upgrades
 * - Guard Tower: Defensive structure with auto-attack
 * - Gold Mine: Resource gathering point (neutral)
 */

import Entity from './Entity.js';
import { BUILDING_STATS, UNIT_STATS, FACTIONS, UPGRADES } from '../config/entityStats.js';
import { gameState, units, buildings } from '../core/GameState.js';
import { logGameMessage } from '../utils/Logger.js';
import { updateResourcesUI, updateSelectionPanel } from '../ui/UIManager.js';
import { soundManager } from '../systems/SoundManager.js';
import Unit from './Unit.js';

/**
 * @class Building
 * @extends Entity
 * @description Represents a static structure that produces units or provides benefits
 */
export default class Building extends Entity {
    constructor(x, y, faction, type, isBlueprint = false) {
        super(x, y, faction, BUILDING_STATS[type]);
        this.type = type;
        this.size = this.stats.size;
        this.isBlueprint = isBlueprint;
        this.trainingQueue = [];
        this.trainingProgress = 0;
        this.attackCooldown = 0; // For Guard Tower

        // Update food capacity if not a blueprint
        if (!this.isBlueprint && this.stats.foodCapacity) {
            if (!gameState.factionResources[this.faction]) {
                gameState.factionResources[this.faction] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
            }
            gameState.factionResources[this.faction].foodMax += this.stats.foodCapacity;

            if (this.faction === FACTIONS.PLAYER.id) {
                gameState.resources.foodMax = gameState.factionResources[this.faction].foodMax;
                updateResourcesUI();
            }
        }
    }

    die() {
        super.die();
        if (this.stats.foodCapacity) {
            if (gameState.factionResources[this.faction]) {
                gameState.factionResources[this.faction].foodMax -= this.stats.foodCapacity;
                // Prevent negative food max (safety, though base is 5)
                if (gameState.factionResources[this.faction].foodMax < 5) {
                    gameState.factionResources[this.faction].foodMax = 5;
                }
            }

            if (this.faction === FACTIONS.PLAYER.id) {
                gameState.resources.foodMax = gameState.factionResources[this.faction].foodMax;
                updateResourcesUI();
            }
        }
    }

    update() {
        if (this.isDead || this.isBlueprint) return;

        // Training logic
        if (this.trainingQueue.length > 0) {
            this.trainingProgress++;
            const unitType = this.trainingQueue[0];
            const unitStats = UNIT_STATS[unitType];

            if (this.trainingProgress >= unitStats.buildTime * 30) { // Time * 30 frames
                this.trainingQueue.shift();
                this.trainingProgress = 0;
                this.spawnUnit(unitType);
            }
        }

        // Guard Tower Attack Logic
        if (this.stats.attack) {
            if (this.attackCooldown > 0) this.attackCooldown--;
            else {
                // Find target
                const range = this.stats.range;
                const target = units.find(u =>
                    !u.isDead &&
                    u.faction !== this.faction &&
                    u.faction !== FACTIONS.NEUTRAL.id && // Towers don't attack neutral gold mines
                    Math.abs(u.x - this.x) <= range &&
                    Math.abs(u.y - this.y) <= range
                );

                if (target) {
                    this.attackCooldown = this.stats.attackCooldown;
                    target.health -= this.stats.attack;
                    if (target.health <= 0) {
                        target.die();
                        logGameMessage(`${this.stats.name} eliminated an enemy!`);
                    }
                }
            }
        }
    }

    spawnUnit(unitType) {
        // Spawn slightly outside the building
        const newUnit = new Unit(this.x + this.size, this.y + this.size, this.faction, unitType);
        units.push(newUnit);

        // Update food used for this faction
        if (!gameState.factionResources[this.faction]) {
            gameState.factionResources[this.faction] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
        }
        gameState.factionResources[this.faction].foodUsed += newUnit.stats.cost.food;

        if (this.faction === FACTIONS.PLAYER.id) {
            gameState.resources.foodUsed = gameState.factionResources[this.faction].foodUsed;
            updateResourcesUI();
            soundManager.play('build_complete');
        }

        logGameMessage(`${newUnit.stats.name} trained at ${this.stats.name}.`);
    }

    trainUnit(unitType) {
        const unitStats = UNIT_STATS[unitType];

        // Check resources for THIS faction
        if (!gameState.factionResources[this.faction]) {
            gameState.factionResources[this.faction] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
        }
        const resources = gameState.factionResources[this.faction];

        if (resources.foodUsed + unitStats.cost.food > resources.foodMax) {
            if (this.faction === FACTIONS.PLAYER.id) logGameMessage("Not enough food capacity!");
            return;
        }
        if (resources.gold < unitStats.cost.gold || resources.wood < unitStats.cost.wood) {
            if (this.faction === FACTIONS.PLAYER.id) logGameMessage("Not enough resources!");
            return;
        }

        resources.gold -= unitStats.cost.gold;
        if (unitStats.cost.wood) resources.wood -= unitStats.cost.wood;

        if (this.faction === FACTIONS.PLAYER.id) {
            gameState.resources.gold = resources.gold;
            gameState.resources.wood = resources.wood;
            updateResourcesUI();
        }

        this.trainingQueue.push(unitType);
        if (this.trainingQueue.length === 1) this.trainingProgress = 0;
    }

    upgrade() {
        if (!this.stats.upgradeTo) return;
        const upgradeType = this.stats.upgradeTo;
        const upgradeStats = BUILDING_STATS[upgradeType];

        // Check resources for THIS faction
        if (!gameState.factionResources[this.faction]) {
            gameState.factionResources[this.faction] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
        }
        const resources = gameState.factionResources[this.faction];

        if (resources.gold >= upgradeStats.cost.gold && resources.wood >= upgradeStats.cost.wood) {
            resources.gold -= upgradeStats.cost.gold;
            resources.wood -= upgradeStats.cost.wood;

            if (this.faction === FACTIONS.PLAYER.id) {
                gameState.resources.gold = resources.gold;
                gameState.resources.wood = resources.wood;
                updateResourcesUI();
            }

            this.type = upgradeType;
            this.stats = upgradeStats;
            this.health = this.stats.maxHealth; // Heal on upgrade
            this.maxHealth = this.stats.maxHealth;

            logGameMessage(`Upgraded to ${this.stats.name}!`);
            updateSelectionPanel(); // Refresh UI
        } else {
            logGameMessage("Not enough resources to upgrade!");
        }
    }

    research(upgradeId) {
        const upgrade = UPGRADES[upgradeId];
        if (!upgrade) return;

        // Check if already researched
        if (gameState.factionUpgrades[this.faction].includes(upgradeId)) {
            logGameMessage("Already researched!");
            return;
        }

        // Check resources
        const resources = gameState.factionResources[this.faction];
        if (resources.gold >= upgrade.cost.gold && resources.wood >= upgrade.cost.wood) {
            resources.gold -= upgrade.cost.gold;
            resources.wood -= upgrade.cost.wood;

            if (this.faction === FACTIONS.PLAYER.id) {
                gameState.resources.gold = resources.gold;
                gameState.resources.wood = resources.wood;
                updateResourcesUI();
            }

            // Apply Upgrade
            gameState.factionUpgrades[this.faction].push(upgradeId);
            logGameMessage(`Researched ${upgrade.name}!`);

            // Apply to existing units
            units.filter(u => !u.isDead && u.faction === this.faction).forEach(u => {
                const effect = upgrade.effect;
                for (let key in effect) {
                    u.stats[key] = (u.stats[key] || 0) + effect[key];
                    if (key === 'maxHealth') {
                        u.maxHealth = u.stats.maxHealth;
                        u.health += effect[key]; // Heal the difference
                    }
                }
            });

            updateSelectionPanel();
        } else {
            logGameMessage("Not enough resources for research!");
        }
    }
}
