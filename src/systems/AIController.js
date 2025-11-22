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
const AI_PERSONALITIES = {
    RUSHER: {
        name: "Rusher",
        economyFocus: 0.3,
        militaryFocus: 0.7,
        expansionThreshold: 8,
        buildPriority: ['barracks', 'barracks', 'farm'],
        preferredUnits: ['soldier', 'soldier', 'archer']
    },
    TURTLE: {
        name: "Turtle",
        economyFocus: 0.6,
        militaryFocus: 0.4,
        expansionThreshold: 20,
        buildPriority: ['farm', 'guardtower', 'guardtower', 'barracks'],
        preferredUnits: ['archer', 'soldier', 'knight']
    },
    BOOMER: {
        name: "Boomer",
        economyFocus: 0.8,
        militaryFocus: 0.2,
        expansionThreshold: 15,
        buildPriority: ['farm', 'farm', 'lumbermill', 'barracks'],
        preferredUnits: ['knight', 'archer', 'soldier']
    },
    AGGRESSIVE: {
        name: "Aggressive",
        economyFocus: 0.5,
        militaryFocus: 0.5,
        expansionThreshold: 12,
        buildPriority: ['barracks', 'farm', 'blacksmith'],
        preferredUnits: ['soldier', 'archer', 'knight']
    }
};

export default class AIController {
    constructor(factionId, difficulty = 'NORMAL') {
        this.factionId = factionId;
        this.difficulty = difficulty;

        // Select random personality
        const personalities = Object.keys(AI_PERSONALITIES);
        const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
        this.personality = JSON.parse(JSON.stringify(AI_PERSONALITIES[randomPersonality])); // Deep copy

        // Difficulty adjustments
        this.reactionTime = difficulty === 'HARD' ? 10 : difficulty === 'EASY' ? 30 : 15;
        this.microManagement = difficulty === 'HARD';

        console.log(`AI ${factionId} initialized as: ${this.personality.name} (${difficulty})`);

        this.state = 'GROWTH';
        this.timer = 0;
        this.waveIndex = 0;
        this.lastAttackTime = 0;
        this.expansionTarget = null;

        // New attributes
        this.knownEnemyLocations = [];
        this.lastScoutTime = 0;
        this.strategyTimer = 0;
        this.failedAttacks = 0;

        // Scouting Memory
        this.explorationGrid = this.initializeExplorationGrid();
    }

    initializeExplorationGrid() {
        const GRID_SIZE = 15;
        const grid = [];

        for (let y = 0; y < MAP_HEIGHT; y += GRID_SIZE) {
            for (let x = 0; x < MAP_WIDTH; x += GRID_SIZE) {
                grid.push({
                    x: x + GRID_SIZE / 2,
                    y: y + GRID_SIZE / 2,
                    lastSeen: 0,
                    timesVisited: 0
                });
            }
        }

        return grid;
    }

    update() {
        this.timer++;

        const myUnits = units.filter(u => !u.isDead && u.faction === this.factionId);
        const myBuildings = buildings.filter(b => !b.isDead && b.faction === this.factionId);

        // Ensure resources exist
        if (!gameState.factionResources[this.factionId]) {
            gameState.factionResources[this.factionId] = { gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5 };
        }
        const resources = gameState.factionResources[this.factionId];

        // Staggered Updates

        // Combat Micro (Every frame if enabled)
        if (this.microManagement) {
            this.handleCombatMicro(myUnits);

            // Formations (Less frequent)
            if (this.timer % 60 === 0) {
                const army = myUnits.filter(u => u.type !== 'peasant');
                this.handleCombatFormation(army);
            }
        }

        // Defense & Raids (Fast: ~0.5s)
        if (this.timer % this.reactionTime === 0) {
            this.handleDefense(myUnits, myBuildings);
            this.detectAndRespondToRaids(myUnits, myBuildings);
        }

        // Economy & Army (Medium: ~1s)
        if (this.timer % 30 === 0) {
            this.handleEconomy(myUnits, myBuildings, resources);
            this.handleArmy(myUnits, myBuildings, resources);
        }

        // Buildings & Attack (Slow: ~3s)
        if (this.timer % 90 === 0) {
            this.handleBuildings(myUnits, myBuildings, resources);
            this.handleAttack(myUnits, myBuildings);
        }

        // Expansion & Scouting (Very Slow: ~5s)
        if (this.timer % 150 === 0) {
            this.handleExpansion(myUnits, myBuildings, resources);
            this.handleScouting(myUnits, myBuildings);
        }

        // Strategy Adaptation (Ultra Slow: ~10s)
        if (this.timer % 300 === 0) {
            this.adaptStrategy(myUnits, myBuildings, resources);

            // Debug Log
            console.log(`AI ${this.factionId} [${this.personality.name}] Res: G${resources.gold} W${resources.wood} F${resources.foodUsed}/${resources.foodMax} State: ${this.state}`);
        }
    }

    adaptStrategy(myUnits, myBuildings, resources) {
        const army = myUnits.filter(u => u.type !== 'peasant');
        const peasants = myUnits.filter(u => u.type === 'peasant');

        // Economic Health
        const goldRate = resources.gold / (peasants.length || 1);
        const isEconomyStrong = goldRate > 20 && peasants.length > 10;
        const isEconomyWeak = goldRate < 10 || peasants.length < 5;

        // Pressure
        const nearbyEnemies = this.detectNearbyThreats(myBuildings);
        const isUnderPressure = nearbyEnemies.length > 3;

        if (isUnderPressure && !isEconomyStrong) {
            // Emergency Defense
            this.personality.militaryFocus = 0.8;
            this.personality.economyFocus = 0.2;
            // console.log(`AI ${this.factionId}: Emergency Defense Mode`);
        } else if (isEconomyWeak && !isUnderPressure) {
            // Recover Economy
            this.personality.economyFocus = 0.7;
            this.personality.militaryFocus = 0.3;
            // console.log(`AI ${this.factionId}: Economy Recovery Mode`);
        } else if (isEconomyStrong && army.length > 15) {
            // Prepare Attack
            this.personality.militaryFocus = 0.7;
            this.personality.economyFocus = 0.3;
            // console.log(`AI ${this.factionId}: Offensive Mode`);
        }
    }

    detectNearbyThreats(myBuildings) {
        const threats = [];
        const enemies = units.filter(u => !u.isDead && u.faction !== this.factionId && u.faction !== FACTIONS.NEUTRAL.id);

        myBuildings.forEach(b => {
            enemies.forEach(e => {
                if (Math.abs(e.x - b.x) < 15 && Math.abs(e.y - b.y) < 15) {
                    if (!threats.includes(e)) threats.push(e);
                }
            });
        });
        return threats;
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

    handleCombatMicro(myUnits) {
        const army = myUnits.filter(u => u.type !== 'peasant');

        // Cache de enemigos visibles para evitar recalcular
        const visibleEnemiesCache = new Map();

        const getVisibleForUnit = (unit) => {
            const key = `${Math.floor(unit.x)},${Math.floor(unit.y)}`;
            if (!visibleEnemiesCache.has(key)) {
                visibleEnemiesCache.set(key, this.getVisibleEnemies(unit));
            }
            return visibleEnemiesCache.get(key);
        };

        // Separar por rol
        const archers = army.filter(u => u.type === 'archer');
        const melee = army.filter(u => u.type === 'soldier' || u.type === 'knight');

        // Aplicar micro a TODOS, no solo los que atacan
        archers.forEach(archer => {
            this.handleKiting(archer);

            const visibleEnemies = getVisibleForUnit(archer);
            if (visibleEnemies.length > 0) {
                const bestTarget = this.selectPriorityTarget(archer, visibleEnemies, true); // Include buildings for archers
                if (bestTarget) {
                    // Solo cambiar target si el nuevo es MUCHO mejor
                    if (!archer.targetEntity || archer.targetEntity.isDead ||
                        this.shouldSwitchTarget(archer, bestTarget)) {
                        archer.attackTarget(bestTarget);
                    }
                }
            }
        });

        // Melee también necesita micro
        melee.forEach(unit => {
            const visibleEnemies = getVisibleForUnit(unit);
            if (visibleEnemies.length > 0) {
                const bestTarget = this.selectPriorityTarget(unit, visibleEnemies);
                if (bestTarget && (!unit.targetEntity || unit.targetEntity.isDead)) {
                    unit.attackTarget(bestTarget);
                }
            }
        });
    }

    handleCombatFormation(army) {
        if (!this.microManagement || army.length < 6 || 
       (this.state !== 'ATTACK' && this.state !== 'DEFENSE')) return;

        const archers = army.filter(u => u.type === 'archer');
        const melee = army.filter(u => u.type === 'soldier' || u.type === 'knight');

        if (archers.length === 0 || melee.length === 0) return;

        // Calcular centro del ejército
        const avgX = army.reduce((sum, u) => sum + u.x, 0) / army.length;
        const avgY = army.reduce((sum, u) => sum + u.y, 0) / army.length;

        // Encontrar dirección hacia enemigos más cercanos
        const nearestEnemy = units.find(u =>
            !u.isDead &&
            u.faction !== this.factionId &&
            u.faction !== FACTIONS.NEUTRAL.id
        );

        if (!nearestEnemy) return;

        const angleToEnemy = Math.atan2(nearestEnemy.y - avgY, nearestEnemy.x - avgX);

        // Solo reposicionar unidades si están muy dispersas y no en combate
        melee.forEach((unit, idx) => {
            if (unit.targetEntity || unit.isAttacking) return; // No interrumpir combate

            const spread = 0.4;
            const angle = angleToEnemy + (idx - melee.length / 2) * spread;
            const formationX = avgX + Math.cos(angle) * 2;
            const formationY = avgY + Math.sin(angle) * 2;

            const dist = Math.abs(unit.x - formationX) + Math.abs(unit.y - formationY);
            if (dist > 5) {
                unit.moveTo(formationX, formationY);
            }
        });

        archers.forEach((unit, idx) => {
            if (unit.targetEntity || unit.isAttacking) return;

            const spread = 0.4;
            const angle = angleToEnemy + Math.PI + (idx - archers.length / 2) * spread;
            const formationX = avgX + Math.cos(angle) * 5;
            const formationY = avgY + Math.sin(angle) * 5;

            const dist = Math.abs(unit.x - formationX) + Math.abs(unit.y - formationY);
            if (dist > 5) {
                unit.moveTo(formationX, formationY);
            }
        });
    }

    handleKiting(unit) {
        if (unit.type !== 'archer') return;

        // Solo kite si hay enemigos MELEE cerca
        const nearbyMelee = units.filter(u =>
            !u.isDead &&
            u.faction !== this.factionId &&
            (u.type === 'soldier' || u.type === 'knight') &&
            Math.abs(u.x - unit.x) < 3 && Math.abs(u.y - unit.y) < 3
        );

        if (nearbyMelee.length > 0) {
            const enemy = nearbyMelee[0];

            // Calcular dirección de escape
            const angle = Math.atan2(unit.y - enemy.y, unit.x - enemy.x);
            const retreatDistance = 4; // Mantenerse a distancia de ataque
            let retreatX = unit.x + Math.cos(angle) * retreatDistance;
            let retreatY = unit.y + Math.sin(angle) * retreatDistance;

            // Validar posición
            let rx = Math.floor(retreatX);
            let ry = Math.floor(retreatY);

            // Intentar dirección alternativa si está bloqueado
            if (!(rx > 0 && rx < MAP_WIDTH && ry > 0 && ry < MAP_HEIGHT && map[ry][rx].passable)) {
                // Probar ángulos alternativos (perpendiculares)
                const altAngles = [angle + Math.PI / 2, angle - Math.PI / 2];
                for (const altAngle of altAngles) {
                    retreatX = unit.x + Math.cos(altAngle) * retreatDistance;
                    retreatY = unit.y + Math.sin(altAngle) * retreatDistance;
                    rx = Math.floor(retreatX);
                    ry = Math.floor(retreatY);

                    if (rx > 0 && rx < MAP_WIDTH && ry > 0 && ry < MAP_HEIGHT && map[ry][rx].passable) {
                        break; // Encontramos una dirección válida
                    }
                }
            }

            if (rx > 0 && rx < MAP_WIDTH && ry > 0 && ry < MAP_HEIGHT &&
                map[ry][rx].passable) {

                // Moverse Y atacar al mismo tiempo (stutter step)
                unit.moveTo(retreatX, retreatY);

                // Si está en rango, disparar mientras retrocede
                const dist = Math.abs(enemy.x - unit.x) + Math.abs(enemy.y - unit.y);
                if (dist <= unit.stats.range) {
                    unit.attackTarget(enemy);
                }
            }
        }
    }

    shouldSwitchTarget(unit, newTarget) {
        const currentTarget = unit.targetEntity;
        if (!currentTarget || currentTarget.isDead) return true;

        const currentScore = this.getTargetScore(unit, currentTarget);
        const newScore = this.getTargetScore(unit, newTarget);

        // Solo cambiar si el nuevo target es 50% mejor
        return newScore > currentScore * 1.5;
    }

    getTargetScore(unit, target) {
        const priorities = { 'peasant': 1, 'archer': 4, 'soldier': 2, 'knight': 3 };
        const distance = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
        const healthFactor = (1 - target.health / target.maxHealth);
        const priority = priorities[target.type] || 1;

        return priority * 10 + healthFactor * 5 - distance * 0.5;
    }

    selectPriorityTarget(unit, visibleEnemies, includeBuildings = false) {
        const priorities = {
            'peasant': 1,
            'archer': 4,    // Kill high damage dealers first
            'soldier': 2,
            'knight': 3,
            // Buildings
            'farm': 2,
            'barracks': 5,
            'townhall': 10,
            'guardtower': 3
        };

        let targets = visibleEnemies;

        if (includeBuildings && this.state === 'ATTACK') {
            const visibleBuildings = buildings.filter(b =>
                !b.isDead &&
                b.faction !== this.factionId &&
                b.faction !== FACTIONS.NEUTRAL.id &&
                Math.abs(b.x - unit.x) < unit.stats.range + 3 &&
                Math.abs(b.y - unit.y) < unit.stats.range + 3
            );
            targets = [...visibleEnemies, ...visibleBuildings];
        }

        let bestTarget = null;
        let bestScore = -Infinity;

        targets.forEach(target => {
            const distance = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
            const healthFactor = (1 - target.health / target.maxHealth); // Prefer wounded
            const priority = priorities[target.type] || 1;

            // Score: Priority + Wounded - Distance penalty
            const score = priority * 10 + healthFactor * 5 - distance * 0.5;

            if (score > bestScore && distance <= unit.stats.range) {
                bestScore = score;
                bestTarget = target;
            }
        });

        return bestTarget;
    }

    getVisibleEnemies(unit) {
        const range = unit.stats.range + 2; // Slightly larger than attack range
        return units.filter(u =>
            !u.isDead &&
            u.faction !== this.factionId &&
            u.faction !== FACTIONS.NEUTRAL.id &&
            Math.abs(u.x - unit.x) < range && Math.abs(u.y - unit.y) < range
        );
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

        // Research Logic
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

        // Dynamic Build Order based on Personality
        const buildOrder = this.personality.buildPriority;

        // Counts
        const counts = {
            farm: myBuildings.filter(b => b.type === 'farm').length,
            barracks: myBuildings.filter(b => b.type === 'barracks').length,
            lumbermill: myBuildings.filter(b => b.type === 'lumbermill').length,
            blacksmith: myBuildings.filter(b => b.type === 'blacksmith').length,
            guardtower: myBuildings.filter(b => b.type === 'guardtower').length
        };

        // 1. Always ensure food
        if (resources.foodMax - resources.foodUsed <= 6 && counts.farm < AI_BUILDING_LIMITS.farm && !myBuildings.some(b => b.type === 'farm' && b.isBlueprint)) {
            this.tryBuild(peasants, resources, 'farm', townHall);
            return;
        }

        // 2. Follow Personality Build Order
        for (const type of buildOrder) {
            if (counts[type] < AI_BUILDING_LIMITS[type]) {
                // Check if we are already building one
                if (!myBuildings.some(b => b.type === type && b.isBlueprint)) {
                    this.tryBuild(peasants, resources, type, townHall);
                    return;
                }
            }
        }

        // 3. Fill remaining limits if resources abound
        if (resources.gold > 500) {
            if (counts.barracks < AI_BUILDING_LIMITS.barracks) this.tryBuild(peasants, resources, 'barracks', townHall);
            else if (counts.farm < AI_BUILDING_LIMITS.farm) this.tryBuild(peasants, resources, 'farm', townHall);
        }

        // 4. Upgrade Town Hall
        if (townHall.type === 'townhall' && resources.gold > 1000) {
            townHall.upgrade();
        }
    }

    handleArmy(myUnits, myBuildings, resources) {
        const barracksList = myBuildings.filter(b => b.type === 'barracks' && !b.isBlueprint);
        if (barracksList.length === 0 || resources.foodUsed >= resources.foodMax) return;

        const army = myUnits.filter(u => u.type !== 'peasant');

        // Counter Unit Logic
        const counterUnit = this.analyzeEnemyComposition();
        let trainType = null;

        // 30% chance to train counter unit if identified
        if (counterUnit && Math.random() < 0.3) {
            trainType = counterUnit;
        } else {
            // Use Wave Config but adjusted by personality preferences
            const waveConfig = AI_WAVE_CONFIG[Math.min(this.waveIndex, AI_WAVE_CONFIG.length - 1)];
            const soldiers = army.filter(u => u.type === 'soldier').length;
            const archers = army.filter(u => u.type === 'archer').length;
            const knights = army.filter(u => u.type === 'knight').length;

            if (soldiers < waveConfig.soldiers) trainType = 'soldier';
            else if (archers < waveConfig.archers) trainType = 'archer';
            else if (knights < waveConfig.knights) trainType = 'knight';
            else {
                // Train preferred unit
                const preferred = this.personality.preferredUnits;
                trainType = preferred[Math.floor(Math.random() * preferred.length)];
            }
        }

        const cost = UNIT_STATS[trainType].cost;
        if (resources.gold >= cost.gold && resources.wood >= (cost.wood || 0)) {
            const barracks = barracksList[Math.floor(Math.random() * barracksList.length)];
            barracks.trainUnit(trainType);
        }
    }

    analyzeEnemyComposition() {
        const enemyUnits = units.filter(u => !u.isDead && u.faction !== this.factionId && u.faction !== FACTIONS.NEUTRAL.id);
        if (enemyUnits.length === 0) return null;

        const soldiers = enemyUnits.filter(u => u.type === 'soldier').length;
        const archers = enemyUnits.filter(u => u.type === 'archer').length;
        const knights = enemyUnits.filter(u => u.type === 'knight').length;

        // Simple Rock-Paper-Scissors: Knight > Archer > Soldier > Knight
        if (archers > soldiers && archers > knights) return 'knight';
        if (knights > soldiers && knights > archers) return 'soldier'; // Cheap counter
        if (soldiers > archers && soldiers > knights) return 'archer';

        return null;
    }

    detectAndRespondToRaids(myUnits, myBuildings) {
        const peasants = myUnits.filter(u => u.type === 'peasant');

        peasants.forEach(peasant => {
            const nearbyEnemies = units.filter(u =>
                !u.isDead &&
                u.faction !== this.factionId &&
                u.faction !== FACTIONS.NEUTRAL.id &&
                Math.abs(u.x - peasant.x) < 8 && Math.abs(u.y - peasant.y) < 8
            );

            if (nearbyEnemies.length > 0) {
                // Raid Detected
                // 1. Flee
                const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
                if (townHall) {
                    peasant.moveTo(townHall.x, townHall.y);
                }

                // 2. Call for help
                const army = myUnits.filter(u => u.type !== 'peasant');
                const nearbyDefenders = army.filter(u =>
                    Math.abs(u.x - peasant.x) < 20 && Math.abs(u.y - peasant.y) < 20
                ).slice(0, 5);

                nearbyDefenders.forEach(defender => {
                    if (!defender.targetEntity) defender.moveTo(nearbyEnemies[0].x, nearbyEnemies[0].y, nearbyEnemies[0]);
                });
            }
        });
    }

    handleAttack(myUnits, myBuildings) {
        if (this.state === 'DEFENSE') return;

        const army = myUnits.filter(u => u.type !== 'peasant');
        const forceAttack = army.length >= this.personality.expansionThreshold;

        if (forceAttack && this.state !== 'ATTACK') {
            this.state = 'ATTACK';
            this.waveIndex++;
        }

        if (this.state === 'ATTACK') {
            if (army.length < 3) {
                this.state = 'GROWTH';
                const townHall = myBuildings.find(b => b.type === 'townhall' || b.type === 'keep');
                if (townHall) army.forEach(u => u.moveTo(townHall.x, townHall.y));
                return;
            }

            const targets = this.findMultipleTargets();
            if (targets.length === 0) {
                this.state = 'GROWTH';
                return;
            }

            // Dividir ejército BALANCEADAMENTE si es grande
            if (army.length > 12 && targets.length > 1) {
                const groups = this.createBalancedGroups(army, 2);

                groups.forEach((group, idx) => {
                    const target = targets[idx % targets.length];
                    group.forEach(u => {
                        if (!u.targetEntity && !u.isMoving) {
                            u.moveTo(target.x, target.y, target);
                        }
                    });
                });
            } else {
                // Ataque concentrado
                const target = targets[0];
                army.forEach(u => {
                    if (!u.targetEntity && !u.isMoving) {
                        u.moveTo(target.x, target.y, target);
                    }
                });
            }
        }
    }

    createBalancedGroups(army, numGroups) {
        // Separar por tipo
        const soldiers = army.filter(u => u.type === 'soldier');
        const archers = army.filter(u => u.type === 'archer');
        const knights = army.filter(u => u.type === 'knight');

        const groups = Array.from({ length: numGroups }, () => []);

        // Distribuir equitativamente cada tipo
        [soldiers, archers, knights].forEach(unitType => {
            unitType.forEach((unit, idx) => {
                groups[idx % numGroups].push(unit);
            });
        });

        return groups;
    }

    findMultipleTargets() {
        const playerBuildings = buildings.filter(b => !b.isDead && b.faction === FACTIONS.PLAYER.id);
        if (playerBuildings.length === 0) {
            const playerUnits = units.filter(u => !u.isDead && u.faction === FACTIONS.PLAYER.id);
            return playerUnits.length > 0 ? [playerUnits[0]] : [];
        }

        // Prioritize expansions (Town Halls) and Production
        const expansions = playerBuildings.filter(b => b.type === 'townhall' || b.type === 'keep');
        const production = playerBuildings.filter(b => b.type === 'barracks' || b.type === 'farm');

        const targets = [...expansions, ...production, ...playerBuildings];
        return [...new Set(targets)].slice(0, 2); // Return up to 2 unique targets
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
        if (this.state === 'ATTACK' || this.state === 'DEFENSE') return;

        const army = myUnits.filter(u => u.type !== 'peasant');
        const scouts = army.filter(u => !u.isMoving && !u.targetEntity && !u.isAttacking).slice(0, 3);

        // Actualizar grid con unidades visibles
        myUnits.forEach(unit => {
            this.updateExplorationGrid(unit.x, unit.y);
        });

        scouts.forEach(scout => {
            // Encontrar área menos explorada
            const targetArea = this.findLeastExploredArea(scout);

            if (targetArea && map[Math.floor(targetArea.y)][Math.floor(targetArea.x)].passable) {
                scout.moveTo(targetArea.x, targetArea.y);
            }
        });
    }

    updateExplorationGrid(x, y) {
        const VISION_RANGE = 10;
        const now = Date.now();

        this.explorationGrid.forEach(cell => {
            const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
            if (dist < VISION_RANGE) {
                cell.lastSeen = now;
                cell.timesVisited++;
            }
        });
    }

    findLeastExploredArea(scout) {
        let best = null;
        let lowestScore = Infinity;

        this.explorationGrid.forEach(cell => {
            // Priorizar áreas nunca vistas o vistas hace mucho
            const timeSinceLastSeen = Date.now() - cell.lastSeen;
            const distanceFromScout = Math.abs(cell.x - scout.x) + Math.abs(cell.y - scout.y);

            // Score: tiempo sin ver - distancia - veces visitado
            const score = -timeSinceLastSeen / 1000 + distanceFromScout * 2 + cell.timesVisited * 50;

            if (score < lowestScore) {
                lowestScore = score;
                best = cell;
            }
        });

        return best;
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
