/**
 * @module AIController
 * @description AI opponent controller with strategic behavior
 * 
 * LATEST CHANGES (2025-11-21):
 * - Implemented Attack Waves: AI attacks in structured waves (Soldiers, Archers, Knights).
 * - Implemented Building Limits: AI respects limits for farms, barracks, etc.
 * - Implemented Expansion: AI builds new bases near discovered gold mines.
 * 
 * This module manages AI faction behavior through a state machine approach:
 * - GROWTH: Economy expansion and building
 * - DEFENSE: Responding to nearby threats
 * - ATTACK: Coordinated offensive operations
 * - SCOUT: Exploration and map control
 * - EXPAND: Building new bases
 */

import { units, buildings, gameState, map } from '../core/GameState.js';
import { FACTIONS, UNIT_STATS, BUILDING_STATS, TILES, AI_BUILDING_LIMITS, AI_WAVE_CONFIG, UPGRADES } from '../config/entityStats.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';

/**
 * @class AIController
 * @description Controls AI faction behavior and decision-making
 */
export default class AIController {
    constructor(factionId) {
        this.factionId = factionId;
        this.state = 'GROWTH'; // GROWTH, DEFENSE, ATTACK, SCOUT, EXPAND
        this.timer = 0;
        this.waveIndex = 0;
        this.lastAttackTime = 0;
        this.expansionTarget = null;
    }

    update() {
        this.timer++;
        if (this.timer < 15) return; // Update every ~0.5 seconds
        this.timer = 0;

        const myUnits = units.filter(u => !u.isDead && u.faction === this.factionId);
        const myBuildings = buildings.filter(b => !b.isDead && b.faction === this.factionId);

        // Ensure resources exist
        if (!gameState.factionResources[this.factionId]) {
            gameState.factionResources[this.factionId] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
        }
        const resources = gameState.factionResources[this.factionId];

        this.handleDefense(myUnits, myBuildings);
        this.handleEconomy(myUnits, myBuildings, resources);
        this.handleBuildings(myUnits, myBuildings, resources);
        this.handleArmy(myUnits, myBuildings, resources);
        this.handleAttack(myUnits, myBuildings);
        this.handleExpansion(myUnits, myBuildings, resources);
        this.handleScouting(myUnits, myBuildings);

        // Debug Log (every ~5 seconds)
        if (this.timer % 150 === 0) {
            console.log(`AI ${this.factionId} Resources: Gold ${resources.gold}, Wood ${resources.wood}, Food ${resources.foodUsed}/${resources.foodMax}`);
            console.log(`AI ${this.factionId} State: ${this.state}, Army: ${myUnits.filter(u => u.type !== 'peasant').length}`);
        }
    }

    handleDefense(myUnits, myBuildings) {
        const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
        if (!townHall) return;

        const enemies = units.filter(u => !u.isDead && u.faction !== this.factionId && u.faction !== FACTIONS.NEUTRAL.id);
        const threat = enemies.find(e => Math.abs(e.x - townHall.x) < 20 && Math.abs(e.y - townHall.y) < 20);

        if (threat) {
            this.state = 'DEFENSE';
            const army = myUnits.filter(u => u.type !== 'peasant');
            army.forEach(unit => {
                if (!unit.targetEntity) unit.moveTo(threat.x, threat.y, threat);
            });

            // Peasants fight if desperate
            if (Math.abs(threat.x - townHall.x) < 8) {
                myUnits.filter(u => u.type === 'peasant').forEach(p => {
                    if (!p.targetEntity) p.moveTo(threat.x, threat.y, threat);
                });
            }
        } else if (this.state === 'DEFENSE') {
            this.state = 'GROWTH';
        }
    }

    handleEconomy(myUnits, myBuildings, resources) {
        const peasants = myUnits.filter(u => u.type === 'peasant');
        const townHalls = myBuildings.filter(b => b.type === 'townhall' || b.type === 'keep');

        // Train Peasants (up to 20 per base roughly)
        townHalls.forEach(townHall => {
            if (!townHall.isBlueprint && peasants.length < 20 * townHalls.length) {
                if (resources.gold >= 50 && resources.foodUsed < resources.foodMax) {
                    townHall.trainUnit('peasant');
                }
            }
        });

        // Assign Peasants - FIXED: Now gathers BOTH gold and wood
        const goldMiners = peasants.filter(p => p.resourceType === 'gold');

        peasants.forEach(peasant => {
            // Reset if stuck (idle but has cargo)
            if (peasant.cargo > 0 && !peasant.isGathering && !peasant.isMoving) {
                peasant.startGathering(peasant.resourceType || 'gold', peasant.x, peasant.y); // Retry
            }

            if (!peasant.isGathering && !peasant.isBuilding && !peasant.isMoving && !peasant.targetEntity) {
                let type = 'wood';

                // Better resource balancing: 60% gold, 40% wood
                if (goldMiners.length < peasants.length * 0.6) {
                    type = 'gold';
                }

                if (type === 'gold') {
                    // Find nearest mine
                    const mines = buildings.filter(b => b.type === 'goldmine');
                    let best = null, minD = Infinity;
                    mines.forEach(m => {
                        const d = Math.abs(peasant.x - m.x) + Math.abs(peasant.y - m.y);
                        if (d < minD) { minD = d; best = m; }
                    });
                    if (best) peasant.startGathering('gold', best.x, best.y, best);
                } else {
                    // Find nearest tree
                    let best = null, minD = Infinity;
                    for (let i = 0; i < 20; i++) {
                        const rx = Math.floor(peasant.x + (Math.random() * 30 - 15));
                        const ry = Math.floor(peasant.y + (Math.random() * 30 - 15));
                        if (rx >= 0 && rx < MAP_WIDTH && ry >= 0 && ry < MAP_HEIGHT && map[ry][rx].id === TILES.TREE.id) {
                            const d = Math.abs(peasant.x - rx) + Math.abs(peasant.y - ry);
                            if (d < minD) { minD = d; best = { x: rx, y: ry }; }
                        }
                    }
                    if (best) peasant.startGathering('wood', best.x, best.y);
                }
            }
        });
    }

    handleBuildings(myUnits, myBuildings, resources) {
        const peasants = myUnits.filter(u => u.type === 'peasant');
        const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
        if (!townHall) return;

        // Research Logic (Blacksmith)
        const blacksmith = myBuildings.find(b => b.type === 'blacksmith' && !b.isBlueprint);
        if (blacksmith && blacksmith.stats.research) {
            blacksmith.stats.research.forEach(upgId => {
                if (!gameState.factionUpgrades[this.factionId].includes(upgId)) {
                    const upgrade = UPGRADES[upgId];
                    if (resources.gold >= upgrade.cost.gold && resources.wood >= upgrade.cost.wood) {
                        blacksmith.research(upgId);
                    }
                }
            });
        }

        // Check Limits
        const farmCount = myBuildings.filter(b => b.type === 'farm').length;
        const barracksCount = myBuildings.filter(b => b.type === 'barracks').length;
        const lumberMillCount = myBuildings.filter(b => b.type === 'lumbermill').length;
        const blacksmithCount = myBuildings.filter(b => b.type === 'blacksmith').length;
        const towerCount = myBuildings.filter(b => b.type === 'guardtower').length;

        // Build Logic with Limits
        // 1. Farms (Priority if low food)
        if (resources.foodMax - resources.foodUsed <= 6 && farmCount < AI_BUILDING_LIMITS.farm && !myBuildings.some(b => b.type === 'farm' && b.isBlueprint)) {
            this.tryBuild(peasants, resources, 'farm', townHall);
        }
        // 2. Barracks
        else if (barracksCount < AI_BUILDING_LIMITS.barracks) {
            this.tryBuild(peasants, resources, 'barracks', townHall);
        }
        // 3. Farms (Fill up to limit)
        else if (farmCount < AI_BUILDING_LIMITS.farm && farmCount < 3) { // Early game farms
            this.tryBuild(peasants, resources, 'farm', townHall);
        }
        // 4. Lumber Mill
        else if (lumberMillCount < AI_BUILDING_LIMITS.lumbermill) {
            this.tryBuild(peasants, resources, 'lumbermill', townHall);
        }
        // 5. Blacksmith
        else if (blacksmithCount < AI_BUILDING_LIMITS.blacksmith) {
            this.tryBuild(peasants, resources, 'blacksmith', townHall);
        }
        // 6. Towers
        else if (towerCount < AI_BUILDING_LIMITS.guardtower) {
            this.tryBuild(peasants, resources, 'guardtower', townHall);
        }
        // 7. Upgrade Town Hall
        else if (townHall.type === 'townhall') {
            townHall.upgrade();
        }
        // 8. More Farms (Late game)
        else if (farmCount < AI_BUILDING_LIMITS.farm) {
            this.tryBuild(peasants, resources, 'farm', townHall);
        }
    }

    handleArmy(myUnits, myBuildings, resources) {
        const barracksList = myBuildings.filter(b => b.type === 'barracks' && !b.isBlueprint);
        if (barracksList.length === 0 || resources.foodUsed >= resources.foodMax) return;

        const army = myUnits.filter(u => u.type !== 'peasant');

        // Determine target composition based on current Wave
        const waveConfig = AI_WAVE_CONFIG[Math.min(this.waveIndex, AI_WAVE_CONFIG.length - 1)];

        // Count current units
        const soldiers = army.filter(u => u.type === 'soldier').length;
        const archers = army.filter(u => u.type === 'archer').length;
        const knights = army.filter(u => u.type === 'knight').length;

        // Decide what to train to meet wave requirements
        let trainType = null;

        // If we haven't met the wave requirements yet, train for the wave
        if (soldiers < waveConfig.soldiers) trainType = 'soldier';
        else if (archers < waveConfig.archers) trainType = 'archer';
        else if (knights < waveConfig.knights) trainType = 'knight';

        // If wave requirements met, just train a balanced mix to fill supply
        if (!trainType) {
            const total = army.length || 1;
            if (archers / total < 0.4) trainType = 'archer';
            else if (soldiers / total < 0.4) trainType = 'soldier';
            else trainType = 'knight';
        }

        const cost = UNIT_STATS[trainType].cost;
        if (resources.gold >= cost.gold && resources.wood >= (cost.wood || 0)) {
            // Find a barracks that isn't busy (simple check)
            const barracks = barracksList[Math.floor(Math.random() * barracksList.length)];
            barracks.trainUnit(trainType);
        }
    }

    handleAttack(myUnits, myBuildings) {
        if (this.state === 'DEFENSE') return;

        const army = myUnits.filter(u => u.type !== 'peasant');
        const waveConfig = AI_WAVE_CONFIG[Math.min(this.waveIndex, AI_WAVE_CONFIG.length - 1)];

        // Check if we have enough units for the current wave
        const soldiers = army.filter(u => u.type === 'soldier').length;
        const archers = army.filter(u => u.type === 'archer').length;
        const knights = army.filter(u => u.type === 'knight').length;

        const readyForWave = soldiers >= waveConfig.soldiers &&
            archers >= waveConfig.archers &&
            knights >= waveConfig.knights;

        // Attack if wave is ready OR if we have a large enough army (fallback)
        // This prevents AI from getting stuck if it can't build specific units
        const forceAttack = army.length >= 12;

        if ((readyForWave || forceAttack) && this.state !== 'ATTACK') {
            this.state = 'ATTACK';
            if (readyForWave) this.waveIndex++; // Only advance wave if we actually met the requirements
        }

        if (this.state === 'ATTACK') {
            // If army is decimated, retreat
            if (army.length < 3) {
                this.state = 'GROWTH';
                const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
                if (townHall) {
                    army.forEach(u => u.moveTo(townHall.x, townHall.y));
                }
                return;
            }

            // Target Selection
            let target = null;
            const playerBuildings = buildings.filter(b => !b.isDead && b.faction === FACTIONS.PLAYER.id);
            const playerUnits = units.filter(u => !u.isDead && u.faction === FACTIONS.PLAYER.id);

            target = playerBuildings.find(b => b.type === 'townhall' || b.type === 'keep') ||
                playerBuildings[0] ||
                playerUnits[0];

            if (!target) {
                // Fallback to other enemies
                const enemies = [FACTIONS.ENEMY.id, FACTIONS.ALLY.id, FACTIONS.ENEMY_2.id].filter(id => id !== this.factionId);
                const targetFactionId = enemies[Math.floor(Math.random() * enemies.length)];
                const enemyBuildings = buildings.filter(b => !b.isDead && b.faction === targetFactionId);
                target = enemyBuildings[0];
            }

            if (target) {
                army.forEach(u => {
                    if (!u.targetEntity && !u.isMoving) {
                        u.moveTo(target.x, target.y, target);
                    }
                });
            } else {
                this.state = 'GROWTH';
            }
        }
    }

    handleExpansion(myUnits, myBuildings, resources) {
        // Only expand if we have a decent army and economy
        if (myUnits.length < 15 || resources.gold < 500) return;

        // Check if we already have an expansion task
        if (this.expansionTarget) {
            // Check if expansion is complete (building exists there)
            const nearbyBuilding = myBuildings.find(b => Math.abs(b.x - this.expansionTarget.x) < 10 && Math.abs(b.y - this.expansionTarget.y) < 10);
            if (nearbyBuilding) {
                this.expansionTarget = null; // Done
                return;
            }

            // If not, ensure a builder is going there
            const builder = myUnits.find(u => u.type === 'peasant' && !u.isBuilding && !u.isGathering);
            if (builder) {
                // Move to target and build townhall
                if (Math.abs(builder.x - this.expansionTarget.x) < 5 && Math.abs(builder.y - this.expansionTarget.y) < 5) {
                    builder.startBuilding('townhall', this.expansionTarget.x, this.expansionTarget.y);
                } else {
                    builder.moveTo(this.expansionTarget.x, this.expansionTarget.y);
                }
            }
            return;
        }

        // Find a new gold mine to expand to
        const mines = buildings.filter(b => b.type === 'goldmine');
        const myTownHalls = myBuildings.filter(b => b.type === 'townhall' || b.type === 'keep');

        for (const mine of mines) {
            // Check if we already have a base near this mine
            const nearBase = myTownHalls.some(th => Math.abs(th.x - mine.x) < 20 && Math.abs(th.y - mine.y) < 20);
            if (!nearBase) {
                // Found a candidate!
                // Find a valid build spot near it
                const bx = mine.x + 4;
                const by = mine.y;
                if (bx < MAP_WIDTH - 5 && by < MAP_HEIGHT - 5) {
                    this.expansionTarget = { x: bx, y: by };
                    break;
                }
            }
        }
    }

    handleScouting(myUnits, myBuildings) {
        if (this.state !== 'ATTACK' && this.state !== 'DEFENSE') {
            const army = myUnits.filter(u => u.type !== 'peasant');
            const idleUnits = army.filter(u => !u.isMoving && !u.targetEntity && !u.isAttacking);

            idleUnits.forEach(unit => {
                const scoutX = Math.floor(Math.random() * MAP_WIDTH);
                const scoutY = Math.floor(Math.random() * MAP_HEIGHT);
                if (scoutX >= 0 && scoutX < MAP_WIDTH && scoutY >= 0 && scoutY < MAP_HEIGHT) {
                    if (map[scoutY][scoutX].passable) {
                        unit.moveTo(scoutX, scoutY);
                    }
                }
            });
        }
    }

    tryBuild(peasants, resources, type, nearBuilding) {
        if (!nearBuilding) return;
        const cost = BUILDING_STATS[type].cost;
        if (resources.gold < cost.gold || resources.wood < cost.wood) return;

        const builder = peasants.find(p => !p.isBuilding && !p.isMoving);
        if (!builder) return;

        for (let i = 0; i < 30; i++) {
            const range = 12;
            const bx = Math.floor(nearBuilding.x + (Math.random() * range * 2 - range));
            const by = Math.floor(nearBuilding.y + (Math.random() * range * 2 - range));

            if (bx > 1 && bx < MAP_WIDTH - 2 && by > 1 && by < MAP_HEIGHT - 2) {
                const stats = BUILDING_STATS[type];
                let clear = true;

                for (let y = 0; y < stats.size; y++) {
                    for (let x = 0; x < stats.size; x++) {
                        if (!map[by + y][bx + x].passable || map[by + y][bx + x].id !== TILES.GRASS.id) clear = false;
                    }
                }

                if (clear) {
                    if (buildings.some(b =>
                        bx < b.x + b.size && bx + stats.size > b.x &&
                        by < b.y + b.size && by + stats.size > b.y
                    )) clear = false;
                }

                if (clear) {
                    builder.startBuilding(type, bx, by);
                    return;
                }
            }
        }
    }
}
