/**
 * @module Unit
 * @description Unit entity class with movement, combat, and gathering capabilities
 * 
 * This module manages all unit behavior including:
 * - Movement with A* pathfinding
 * - Combat and attack logic
 * - Resource gathering (gold from mines, wood from trees)
 * - Building construction (for peasants)
 * - Upgrade application
 * 
 * Key Features:
 * - A* pathfinding for intelligent movement
 * - Automatic attack targeting and cooldown management
 * - Resource gathering cycle (gather -> return to town hall -> repeat)
 * - Building construction with progress tracking
 * - Dynamic stat modification through upgrades
 * - Spatial hash integration for efficient collision detection
 * 
 * Unit Types:
 * - Peasant: Gathers resources and constructs buildings
 * - Soldier: Basic melee combat unit
 * - Archer: Ranged combat unit
 * - Knight: Heavy melee unit
 */

import Entity from './Entity.js';
import { UNIT_STATS, BUILDING_STATS, UPGRADES, FACTIONS } from '../config/entityStats.js';
import { gameState, spatialHash, pathfinder, buildings, units } from '../core/GameState.js';
import { logGameMessage } from '../utils/Logger.js';
import { updateResourcesUI, updateSelectionPanel } from '../ui/UIManager.js';
import { soundManager } from '../systems/SoundManager.js';
import Building from './Building.js';

/**
 * @class Unit
 * @extends Entity
 * @description Represents a movable game unit with various capabilities
 */
export default class Unit extends Entity {
    constructor(x, y, faction, type) {
        super(x, y, faction, UNIT_STATS[type]);
        this.type = type;
        // Clone stats to allow modification
        this.stats = { ...UNIT_STATS[type] };

        // Apply Upgrades
        if (gameState.factionUpgrades[faction]) {
            gameState.factionUpgrades[faction].forEach(upgId => {
                const effect = UPGRADES[upgId].effect;
                for (let key in effect) {
                    this.stats[key] = (this.stats[key] || 0) + effect[key];
                }
            });
        }

        this.health = this.stats.maxHealth;
        this.maxHealth = this.stats.maxHealth;

        this.targetX = x;
        this.targetY = y;
        this.isMoving = false;
        this.targetEntity = null;
        this.attackCooldown = 0;

        // Resource Gathering
        this.isGathering = false;
        this.resourceType = null; // 'gold', 'wood'
        this.cargo = 0;
        this.maxCargo = 100;
        this.gatherTarget = null;
        this.returnTarget = null;
        this.gatherTimer = 0;

        // Building
        this.isBuilding = false;
        this.buildTarget = null;

        // Pathfinding
        this.path = [];
        this.pathIndex = 0;
        this.repathTimer = 0;
    }

    update() {
        if (this.isDead) return;
        if (spatialHash) spatialHash.update(this);

        // 1. Attack Cooldown
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.repathTimer > 0) this.repathTimer--;

        // 2. Unit Movement
        if (this.isMoving) {
            this.moveTowardsTarget();
        }

        // 3. Attack Logic
        if (this.targetEntity && !this.isMoving && !this.isGathering && !this.isBuilding) {
            this.engageTarget();
        }

        // 4. Building Logic (Peasant only)
        if (this.isBuilding && this.buildTarget) {
            this.build();
        }

        // 5. Gathering Logic (Peasant only)
        if (this.isGathering) {
            this.gatherResource();
        }
    }

    moveTowardsTarget() {
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const nextNode = this.path[this.pathIndex];
            const dx = nextNode.x - this.x;
            const dy = nextNode.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const speed = this.stats.speed * 0.03;

            if (dist < speed) {
                this.x = nextNode.x;
                this.y = nextNode.y;
                this.pathIndex++;
                if (this.pathIndex >= this.path.length) {
                    this.isMoving = false;
                    this.path = [];
                }
            } else {
                const angle = Math.atan2(dy, dx);
                this.x += Math.cos(angle) * speed;
                this.y += Math.sin(angle) * speed;
            }
        } else {
            // Fallback or direct move if no path (shouldn't happen if logic is correct)
            // But if we are close to final target (e.g. attacking), we might want to stop or adjust
            this.isMoving = false;
        }
    }

    // Simplified logic: move directly to the tile center
    moveTo(targetTileX, targetTileY, targetEntity = null) {
        this.targetX = targetTileX + 0.5;
        this.targetY = targetTileY + 0.5;
        this.isMoving = true;
        this.targetEntity = targetEntity;

        // Reset other states unless specified
        if (!this.isBuilding) this.buildTarget = null;
        if (!this.isGathering) {
            this.gatherTarget = null;
            this.returnTarget = null;
        }

        // Calculate Path
        if (pathfinder) {
            // Optimization: If we are already moving to this target and have a path, don't recalculate
            // unless it's a new request or target moved significantly
            const distToTarget = Math.abs(this.targetX - this.x) + Math.abs(this.targetY - this.y);

            // Always pathfind if we have no path
            // Or if we are far away (re-evaluate)
            this.path = pathfinder.findPath(this.x, this.y, this.targetX, this.targetY);
            this.pathIndex = 0;
            if (this.path.length === 0) {
                // No path found or already there
                this.isMoving = false;
            }
        }
    }

    engageTarget() {
        if (this.targetEntity.isDead) {
            this.targetEntity = null;
            this.isMoving = false;
            return;
        }

        // Check range again to be safe
        const dist = Math.sqrt(Math.pow(this.targetEntity.x - this.x, 2) + Math.pow(this.targetEntity.y - this.y, 2));

        // FIX: If target moved out of range, chase it!
        if (dist > this.stats.range + 0.5) {
            // Only repath if timer is ready
            if (this.repathTimer === 0) {
                this.moveTo(this.targetEntity.getTileX(), this.targetEntity.getTileY(), this.targetEntity);
                this.repathTimer = 30; // Repath every 0.5 seconds approx
            }
            return;
        }

        if (this.attackCooldown === 0) {
            this.attackCooldown = 30; // 1 second
            this.targetEntity.health -= this.stats.attack;

            if (this.targetEntity.health <= 0) {
                this.targetEntity.die();
                this.targetEntity = null;
                this.isMoving = false;
                logGameMessage(`${this.stats.name} destroyed the enemy!`);
            } else {
                // Play attack sound
                if (this.type === 'archer') soundManager.play('attack_bow');
                else soundManager.play('attack_sword');
            }
        }
    }

    startBuilding(buildingType, x, y, bypassCost = false) {
        if (this.type !== 'peasant') return logGameMessage("Only Peasants can build!");
        const cost = BUILDING_STATS[buildingType].cost;

        if (this.faction === FACTIONS.PLAYER.id && !bypassCost) {
            if (gameState.resources.gold >= cost.gold && gameState.resources.wood >= cost.wood) {
                gameState.resources.gold -= cost.gold;
                gameState.resources.wood -= cost.wood;
                updateResourcesUI();
            } else {
                return logGameMessage(`Not enough resources to build ${BUILDING_STATS[buildingType].name}!`);
            }
        }

        // FIX: Use this.faction (which is the ID) directly, not this.faction.id
        const blueprint = new Building(x, y, this.faction, buildingType, true);
        buildings.push(blueprint);

        this.buildTarget = blueprint;
        this.isBuilding = true;
        this.isGathering = false; // Stop gathering
        this.moveTo(x, y);

        if (this.faction === FACTIONS.PLAYER.id) {
            soundManager.play('build_start');
            logGameMessage(`${this.stats.name} starts building ${blueprint.stats.name}.`);
        }
    }

    build() {
        if (!this.buildTarget || this.buildTarget.isDead) {
            this.isBuilding = false;
            this.buildTarget = null;
            return;
        }

        const dist = Math.sqrt(Math.pow(this.buildTarget.x - this.x, 2) + Math.pow(this.buildTarget.y - this.y, 2));

        // If close enough, build. If not, move closer.
        if (dist < 2.5) {
            this.isMoving = false; // Stop moving to focus on building
            this.buildTarget.health += 5; // Simple build rate
            this.buildTarget.health = Math.min(this.buildTarget.health, this.buildTarget.maxHealth);

            if (this.buildTarget.health >= this.buildTarget.maxHealth) {
                this.buildTarget.isBlueprint = false;

                // Update food capacity for the faction
                if (this.buildTarget.stats.foodCapacity) {
                    if (!gameState.factionResources[this.faction]) {
                        gameState.factionResources[this.faction] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
                    }
                    gameState.factionResources[this.faction].foodMax += this.buildTarget.stats.foodCapacity;

                    if (this.faction === FACTIONS.PLAYER.id) {
                        gameState.resources.foodMax = gameState.factionResources[this.faction].foodMax;
                        updateResourcesUI();
                    }
                }

                this.isBuilding = false;
                this.buildTarget = null;
                soundManager.play('build_complete');
                logGameMessage("Building complete!");
            }
        } else if (!this.isMoving) {
            // If we are not moving but too far, move closer
            this.moveTo(this.buildTarget.x, this.buildTarget.y);
        }
    }

    // --- Resource Gathering Logic ---

    startGathering(resourceType, targetX, targetY, targetEntity = null) {
        if (this.type !== 'peasant') return;
        this.isGathering = true;
        this.isBuilding = false;
        this.resourceType = resourceType;
        // If gathering gold, target is the mine building
        if (resourceType === 'gold' && targetEntity) {
            this.gatherTarget = targetEntity;
        } else {
            this.gatherTarget = { x: targetX, y: targetY }; // Simple object for tile target (wood)
        }
        this.returnTarget = null;
        this.moveTo(targetX, targetY);
    }

    gatherResource() {
        if (this.gatherTimer > 0) {
            this.gatherTimer--;
            return;
        }

        if (this.cargo < this.maxCargo) {
            // Go to resource
            if (!this.gatherTarget) {
                // Find nearest resource if target is lost/null
                // (Simplified: just stop gathering if target lost)
                this.isGathering = false;
                return;
            }

            const dist = Math.sqrt(Math.pow(this.gatherTarget.x - this.x, 2) + Math.pow(this.gatherTarget.y - this.y, 2));

            // Interaction distance depends on target type
            let interactDist = 1.5;
            if (this.resourceType === 'gold' && this.gatherTarget instanceof Building) {
                interactDist = this.gatherTarget.size / 2 + 1.0; // Building radius + reach
            }

            if (dist > interactDist) {
                this.moveTo(this.gatherTarget.x, this.gatherTarget.y);
            } else {
                this.isMoving = false;
                this.gatherTimer = 60; // Gather time (2 seconds)
                this.cargo = Math.min(this.cargo + 10, this.maxCargo);

                if (this.resourceType === 'gold') soundManager.play('gather_gold');
                else soundManager.play('gather_wood');
            }
        } else {
            // Return to Town Hall
            if (!this.returnTarget) {
                // Find nearest Town Hall of MY faction
                // FIX: Use this.faction directly
                const townHalls = buildings.filter(b => !b.isDead && (b.type === 'townhall' || b.type === 'keep') && b.faction === this.faction);
                let closest = null;
                let minDst = Infinity;

                townHalls.forEach(th => {
                    const d = Math.sqrt(Math.pow(th.x - this.x, 2) + Math.pow(th.y - this.y, 2));
                    if (d < minDst) {
                        minDst = d;
                        closest = th;
                    }
                });

                if (closest) {
                    this.returnTarget = closest;
                } else {
                    // No town hall? Stop gathering.
                    this.isGathering = false;
                    return;
                }
            }

            const dist = Math.sqrt(Math.pow(this.returnTarget.x - this.x, 2) + Math.pow(this.returnTarget.y - this.y, 2));
            if (dist > 2.5) { // Town hall is big
                this.moveTo(this.returnTarget.x, this.returnTarget.y);
            } else {
                this.isMoving = false;
                this.gatherTimer = 30; // Deposit time

                // Deposit Resources
                // FIX: Deposit into FACTION resources
                if (!gameState.factionResources[this.faction]) {
                    // Initialize if missing (safety)
                    gameState.factionResources[this.faction] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
                }

                if (this.resourceType === 'gold') gameState.factionResources[this.faction].gold += this.cargo;
                else if (this.resourceType === 'wood') gameState.factionResources[this.faction].wood += this.cargo;

                // Sync player resources for UI if this is the player
                if (this.faction === FACTIONS.PLAYER.id) {
                    gameState.resources.gold = gameState.factionResources[this.faction].gold;
                    gameState.resources.wood = gameState.factionResources[this.faction].wood;
                    updateResourcesUI();
                }

                this.cargo = 0;
                this.returnTarget = null; // Find nearest again next time

                // Go back to resource
                if (this.gatherTarget) {
                    this.moveTo(this.gatherTarget.x, this.gatherTarget.y);
                }
            }
        }
    }
}
