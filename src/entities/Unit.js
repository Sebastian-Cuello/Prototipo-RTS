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
 * - Visual feedback via Particle System (combat effects)
 * 
 * Unit Types:
 * - Peasant: Gathers resources and constructs buildings
 * - Soldier: Basic melee combat unit
 * - Archer: Ranged combat unit
 * - Knight: Heavy melee unit
 */

import Entity from './Entity.js';
import { UNIT_STATS, BUILDING_STATS, UPGRADES, FACTIONS } from '../config/entityStats.js';
import { gameState, spatialHash, pathfinder, buildings, units, map, allianceSystem } from '../core/GameState.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants.js';
import { logGameMessage } from '../utils/Logger.js';
import { updateResourcesUI, updateSelectionPanel } from '../ui/UIManager.js';
import { soundManager } from '../systems/SoundManager.js';
import { renderer, updateTileRenderer } from '../rendering/Renderer.js';
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

        // Smart Commands
        this.isPatrolling = false;
        this.patrolStart = null;
        this.patrolEnd = null;
        this.holdPosition = false;
        this.scanForEnemies = false;

        // New Features Initialization
        this.leashPoint = { x, y };
        this.leashDistance = 15;
        this.stance = 'aggressive'; // 'aggressive', 'defensive', 'passive', 'hold'
        this.autoAcquireRange = 8;

        this.experience = 0;
        this.level = 1;
        this.maxLevel = 3;
        this.killCount = 0;

        this.pathValidationTimer = 0;
        this.gatherStuckTimer = 0;
        this.hasPlayerCommand = false;
    }

    update() {
        if (this.isDead) return;
        if (spatialHash) spatialHash.update(this);

        // 1. Attack Cooldown
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.repathTimer > 0) this.repathTimer--;
        if (this.pathValidationTimer > 0) this.pathValidationTimer--;

        // 2. Path Validation
        if (this.isMoving && this.pathValidationTimer === 0) {
            if (!this.isPathValid()) {
                this.repath();
            }
            this.pathValidationTimer = 30; // Check every 1s
        }

        // 3. Unit Movement
        if (this.isMoving) {
            this.moveTowardsTarget();
        }

        // 4. Auto-Acquire Targets
        // Improved: AI units can auto-acquire even while moving
        if (!this.targetEntity && this.shouldAutoAcquire()) {
            if (this.stance === 'aggressive' || this.stance === 'defensive') {
                const enemy = this.findNearestEnemy();
                if (enemy) {
                    const dist = Math.sqrt(
                        Math.pow(enemy.x - this.x, 2) +
                        Math.pow(enemy.y - this.y, 2)
                    );

                    if (dist < this.autoAcquireRange) {
                        this.targetEntity = enemy;

                        if (this.stance === 'aggressive') {
                            // Chase target
                            this.moveTo(enemy.getTileX(), enemy.getTileY(), enemy);
                        }
                        // Defensive stance: only attack if in range, don't chase
                    }
                }
            }
        }

        // 5. Attack Logic
        if (this.targetEntity && !this.isMoving && !this.isGathering && !this.isBuilding) {
            this.engageTarget();
        }

        // 6. Building Logic (Peasant only)
        if (this.isBuilding && this.buildTarget) {
            this.build();
        }

        // 7. Gathering Logic (Peasant only)
        if (this.isGathering) {
            this.gatherResource();
        }

        // 8. Smart Commands (Patrol)
        if (this.isPatrolling && !this.isMoving && !this.targetEntity) {
            // Reached patrol end, go back to start
            const atEnd = Math.abs(this.x - this.patrolEnd.x) < 1 &&
                Math.abs(this.y - this.patrolEnd.y) < 1;
            const atStart = Math.abs(this.x - this.patrolStart.x) < 1 &&
                Math.abs(this.y - this.patrolStart.y) < 1;

            if (atEnd) {
                this.moveTo(this.patrolStart.x, this.patrolStart.y);
            } else if (atStart) {
                this.moveTo(this.patrolEnd.x, this.patrolEnd.y);
            }
        }
    }

    isPathValid() {
        // Check if next few nodes in path are still passable
        if (!this.path || this.path.length === 0) return false;

        for (let i = this.pathIndex; i < Math.min(this.pathIndex + 3, this.path.length); i++) {
            const node = this.path[i];
            const tx = Math.floor(node.x);
            const ty = Math.floor(node.y);

            if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) {
                return false;
            }

            if (!map[ty][tx].passable) {
                return false; // Path is blocked
            }

            // Check for buildings blocking path
            const blocked = buildings.some(b =>
                !b.isDead &&
                tx >= b.x && tx < b.x + b.size &&
                ty >= b.y && ty < b.y + b.size
            );

            if (blocked) return false;
        }

        return true;
    }

    repath() {
        // console.log(`Unit ${this.type} repathing...`);
        if (pathfinder) {
            this.path = pathfinder.findPath(this.x, this.y, this.targetX, this.targetY);
            this.pathIndex = 0;

            if (this.path.length === 0) {
                this.isMoving = false;
                this.targetEntity = null;
            }
        }
    }

    moveTowardsTarget() {
        if (this.path.length === 0 || this.pathIndex >= this.path.length) {
            this.isMoving = false;
            return;
        }

        const nextNode = this.path[this.pathIndex];
        const dx = nextNode.x - this.x;
        const dy = nextNode.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const speed = this.stats.speed * 0.03;

        if (dist < speed) {
            // Reached waypoint
            this.x = nextNode.x;
            this.y = nextNode.y;
            this.pathIndex++;

            if (this.pathIndex >= this.path.length) {
                this.isMoving = false;
                this.path = [];
            }
        } else {
            // Calculate desired velocity
            let desiredAngle = Math.atan2(dy, dx);

            // Check for nearby units and avoid
            const avoidanceVector = this.calculateAvoidance();

            if (avoidanceVector.magnitude > 0) {
                // Blend desired direction with avoidance
                const blendFactor = 0.3;
                desiredAngle += avoidanceVector.angle * blendFactor;
            }

            // Move
            this.x += Math.cos(desiredAngle) * speed;
            this.y += Math.sin(desiredAngle) * speed;
        }
    }

    calculateAvoidance() {
        const AVOIDANCE_RADIUS = 1.5;
        const nearbyUnits = spatialHash ? spatialHash.query(this.x, this.y, AVOIDANCE_RADIUS) : [];

        let avoidX = 0;
        let avoidY = 0;
        let count = 0;

        nearbyUnits.forEach(other => {
            if (other === this || other.isDead) return;
            if (!(other instanceof Unit)) return;

            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < AVOIDANCE_RADIUS && dist > 0.1) {
                // Avoid this unit
                const strength = (AVOIDANCE_RADIUS - dist) / AVOIDANCE_RADIUS;
                avoidX += (dx / dist) * strength;
                avoidY += (dy / dist) * strength;
                count++;
            }
        });

        if (count === 0) {
            return { magnitude: 0, angle: 0 };
        }

        avoidX /= count;
        avoidY /= count;

        const magnitude = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
        const angle = Math.atan2(avoidY, avoidX);

        return { magnitude, angle };
    }

    // Simplified logic: move directly to the tile center
    moveTo(targetTileX, targetTileY, targetEntity = null) {
        const newTargetX = targetTileX + 0.5;
        const newTargetY = targetTileY + 0.5;

        // Check if target changed significantly
        const targetChanged = (
            Math.abs(this.targetX - newTargetX) > 1 ||
            Math.abs(this.targetY - newTargetY) > 1
        );

        // Only repath if needed
        if (!this.isMoving || targetChanged || this.path.length === 0) {
            this.targetX = newTargetX;
            this.targetY = newTargetY;
            this.targetEntity = targetEntity;
            this.hasPlayerCommand = true; // Assume explicit move is player command

            // Check if we're already at target
            const distToTarget = Math.abs(this.targetX - this.x) + Math.abs(this.targetY - this.y);
            if (distToTarget < 0.5) {
                this.isMoving = false;
                return;
            }

            // Calculate new path
            if (pathfinder) {
                this.path = pathfinder.findPath(this.x, this.y, this.targetX, this.targetY);
                this.pathIndex = 0;

                if (this.path.length === 0) {
                    this.isMoving = false;
                    // console.warn(`No path found for unit ${this.type} to (${this.targetX}, ${this.targetY})`);
                } else {
                    this.isMoving = true;
                }
            }
        }

        // Reset states
        if (!this.isBuilding) this.buildTarget = null;
        if (!this.isGathering) {
            this.gatherTarget = null;
            this.returnTarget = null;
        }
    }

    moveToWithFormation(targetTileX, targetTileY, formationOffset, targetEntity = null) {
        // Apply formation offset
        const finalX = targetTileX + formationOffset.x;
        const finalY = targetTileY + formationOffset.y;

        this.moveTo(finalX, finalY, targetEntity);
    }

    engageTarget() {
        if (!this.targetEntity || this.targetEntity.isDead) {
            this.targetEntity = null;
            this.isMoving = false;
            return;
        }

        const dist = Math.sqrt(
            Math.pow(this.targetEntity.x - this.x, 2) +
            Math.pow(this.targetEntity.y - this.y, 2)
        );

        // Check leash distance
        const distFromLeash = Math.sqrt(
            Math.pow(this.x - this.leashPoint.x, 2) +
            Math.pow(this.y - this.leashPoint.y, 2)
        );

        if (distFromLeash > this.leashDistance && !this.isPlayerControlled()) {
            // Too far from leash point, return
            // console.log(`Unit ${this.type} returning to leash point`);
            this.targetEntity = null;
            this.moveTo(this.leashPoint.x, this.leashPoint.y);
            return;
        }

        // Out of range, chase
        if (dist > this.stats.range + 0.5) {
            if (this.repathTimer === 0) {
                this.moveTo(
                    this.targetEntity.getTileX(),
                    this.targetEntity.getTileY(),
                    this.targetEntity
                );
                this.repathTimer = 30;
            }
            return;
        }

        // In range, attack
        if (this.attackCooldown === 0) {
            this.performAttack();
        }
    }

    isPlayerControlled() {
        return this.faction === FACTIONS.PLAYER.id && this.hasPlayerCommand;
    }

    /**
     * Determine if unit should automatically search for enemies
     * AI units always auto-acquire, player units only when not busy
     */
    shouldAutoAcquire() {
        // AI units: always search for enemies (unless gathering or building)
        if (this.faction !== FACTIONS.PLAYER.id) {
            return !this.isGathering && !this.isBuilding;
        }

        // Player units: only when idle (not moving, gathering, or building)
        return !this.isMoving && !this.isGathering && !this.isBuilding;
    }

    performAttack() {
        this.attackCooldown = 30;
        const damage = this.stats.attack;

        this.targetEntity.health -= damage;

        if (this.targetEntity.health <= 0) {
            // Gain experience on kill
            const expGain = this.targetEntity instanceof Building ? 50 : 25;
            this.gainExperience(expGain);
            this.killCount++;

            this.targetEntity.die();
            this.targetEntity = null;
            this.isMoving = false;

            if (this.faction === FACTIONS.PLAYER.id) {
                logGameMessage(`${this.stats.name} destroyed the enemy!`);
            }
        } else {
            // Play sound
            if (this.type === 'archer') {
                soundManager.playSpatial('attack_bow', this.x, this.y);
            } else {
                soundManager.playSpatial('attack_sword', this.x, this.y);
            }

            // Particle effect
            if (renderer && renderer.particleSystem) {
                renderer.particleSystem.swordHit(
                    this.targetEntity.x * TILE_SIZE,
                    this.targetEntity.y * TILE_SIZE
                );
            }
        }
    }

    gainExperience(amount) {
        this.experience += amount;

        const expNeeded = this.level * 100;

        if (this.experience >= expNeeded && this.level < this.maxLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.experience = 0;

        // Apply stat bonuses
        this.stats.maxHealth = Math.floor(this.stats.maxHealth * 1.15);
        this.health = this.stats.maxHealth; // Full heal on level up
        this.stats.attack = Math.floor(this.stats.attack * 1.1);

        // Visual feedback
        if (this.faction === FACTIONS.PLAYER.id) {
            logGameMessage(`${this.stats.name} reached level ${this.level}! ⭐`);
            soundManager.play('level_up');
        }

        // Particle effect
        if (renderer && renderer.particleSystem) {
            renderer.particleSystem.emit(
                this.x * TILE_SIZE,
                this.y * TILE_SIZE,
                20,
                { color: '#ffd700', size: 4, life: 40, spread: 3 }
            );
        }
    }

    findNearestEnemy() {
        const nearbyEntities = spatialHash ? spatialHash.query(this.x, this.y, this.autoAcquireRange) : [];

        let nearest = null;
        let minDist = Infinity;

        nearbyEntities.forEach(entity => {
            if (entity === this || entity.isDead) return;
            if (entity.faction === FACTIONS.NEUTRAL.id) return;

            // Use alliance system to determine if enemy
            if (!allianceSystem.areEnemies(this.faction, entity.faction)) return;

            const dist = Math.sqrt(
                Math.pow(entity.x - this.x, 2) +
                Math.pow(entity.y - this.y, 2)
            );

            if (dist < minDist) {
                minDist = dist;
                nearest = entity;
            }
        });

        return nearest;
    }

    setStance(stance) {
        this.stance = stance;

        if (stance === 'hold') {
            this.isMoving = false;
            this.path = [];
            this.holdPosition = true;
        } else {
            this.holdPosition = false;
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
        this.gatherStuckTimer = 0; // Anti-stuck timer

        if (resourceType === 'gold' && targetEntity) {
            this.gatherTarget = targetEntity;
        } else {
            this.gatherTarget = { x: targetX, y: targetY };
        }

        this.returnTarget = null;
        this.cargo = 0; // Reset cargo
        this.moveTo(targetX, targetY);
    }

    gatherResource() {
        // Anti-stuck mechanism
        this.gatherStuckTimer++;

        if (this.gatherStuckTimer > 300) { // 10 seconds
            // console.warn(`Unit ${this.type} stuck gathering, resetting...`);
            this.isGathering = false;
            this.gatherTarget = null;
            this.returnTarget = null;
            this.cargo = 0;
            this.gatherTimer = 0;
            return;
        }

        if (this.gatherTimer > 0) {
            this.gatherTimer--;
            return;
        }

        // Validate gather target still exists
        if (this.resourceType === 'gold') {
            if (!this.gatherTarget || (this.gatherTarget instanceof Building && this.gatherTarget.isDead)) {
                this.isGathering = false;
                logGameMessage("Gold mine depleted or destroyed!");
                return;
            }
        }

        if (this.cargo < this.maxCargo) {
            // Gather phase
            if (!this.gatherTarget) {
                this.isGathering = false;
                return;
            }

            const dist = Math.sqrt(
                Math.pow(this.gatherTarget.x - this.x, 2) +
                Math.pow(this.gatherTarget.y - this.y, 2)
            );

            let interactDist = 1.5;
            if (this.resourceType === 'gold' && this.gatherTarget instanceof Building) {
                interactDist = this.gatherTarget.size / 2 + 1.0;
            }

            if (dist > interactDist) {
                if (!this.isMoving) {
                    this.moveTo(this.gatherTarget.x, this.gatherTarget.y);
                }
            } else {
                // Close enough to gather
                this.isMoving = false;
                this.gatherTimer = 60;
                this.cargo = Math.min(this.cargo + 10, this.maxCargo);
                this.gatherStuckTimer = 0; // Reset stuck timer

                if (this.resourceType === 'gold') {
                    soundManager.playSpatial('gather_gold', this.x, this.y);
                } else {
                    soundManager.playSpatial('gather_wood', this.x, this.y);
                    // updateTileRenderer(this.gatherTarget.x, this.gatherTarget.y);
                }
            }
        } else {
            // Return phase
            if (!this.returnTarget) {
                const townHalls = buildings.filter(b =>
                    !b.isDead &&
                    (b.type === 'townhall' || b.type === 'keep') &&
                    b.faction === this.faction
                );

                if (townHalls.length === 0) {
                    this.isGathering = false;
                    logGameMessage("No town hall to return resources!");
                    return;
                }

                // Find closest town hall
                let closest = townHalls[0];
                let minDist = Infinity;

                townHalls.forEach(th => {
                    const d = Math.sqrt(
                        Math.pow(th.x - this.x, 2) +
                        Math.pow(th.y - this.y, 2)
                    );
                    if (d < minDist) {
                        minDist = d;
                        closest = th;
                    }
                });

                this.returnTarget = closest;
            }

            const dist = Math.sqrt(
                Math.pow(this.returnTarget.x - this.x, 2) +
                Math.pow(this.returnTarget.y - this.y, 2)
            );

            if (dist > 2.5) {
                if (!this.isMoving) {
                    this.moveTo(this.returnTarget.x, this.returnTarget.y);
                }
            } else {
                // Close enough to deposit
                this.isMoving = false;
                this.gatherTimer = 30;
                this.gatherStuckTimer = 0; // Reset stuck timer

                // Deposit resources
                if (!gameState.factionResources[this.faction]) {
                    gameState.factionResources[this.faction] = {
                        gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5
                    };
                }

                if (this.resourceType === 'gold') {
                    gameState.factionResources[this.faction].gold += this.cargo;
                } else if (this.resourceType === 'wood') {
                    gameState.factionResources[this.faction].wood += this.cargo;
                }

                // Sync player UI
                if (this.faction === FACTIONS.PLAYER.id) {
                    gameState.resources.gold = gameState.factionResources[this.faction].gold;
                    gameState.resources.wood = gameState.factionResources[this.faction].wood;
                    updateResourcesUI();
                }

                this.cargo = 0;
                this.returnTarget = null;

                // Return to gather
                if (this.gatherTarget) {
                    this.moveTo(this.gatherTarget.x, this.gatherTarget.y);
                }
            }
        }
    }
}
