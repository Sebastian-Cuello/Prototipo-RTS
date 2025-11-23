/**
 * @module EntityStats
 * @description Entity definitions and game data
 * 
 * This module contains all static game data:
 * - Tile types and properties
 * - Faction definitions (colors, IDs)
 * - Unit statistics (health, attack, cost, etc.)
 * - Building statistics (size, trainable units, etc.)
 * - Upgrade definitions (effects, costs)
 * 
 * Key Data Structures:
 * - TILES: Terrain types (grass, tree, water, mountain)
 * - FACTIONS: Player, Enemy, Ally, Enemy_2, Neutral
 * - UNIT_STATS: Peasant, Soldier, Archer, Knight
 * - BUILDING_STATS: Town Hall, Barracks, Farm, etc.
 * - UPGRADES: Attack, Defense, Health upgrades
 */

export const TILES = {
    GRASS: { id: 0, color: '#38761d', passable: true, name: 'Grass' },
    WATER: { id: 1, color: '#4a86e8', passable: false, name: 'Water' },
    TREE: { id: 2, color: '#6aa84f', passable: false, name: 'Forest' },
    STONE: { id: 3, color: '#7f8c8d', passable: false, name: 'Stone' },
    MOUNTAIN: { id: 4, color: '#676767', passable: false, name: 'Mountain' },
};

export const FACTIONS = {
    PLAYER: { id: 0, color: '#00AAFF', unitColor: '#FFF', unitSymbol: 'P', name: 'Human' },
    ENEMY: { id: 1, color: '#FF0000', unitColor: '#E74C3C', unitSymbol: 'O', name: 'Orc' },
    ALLY: { id: 2, color: '#00FF00', unitColor: '#2ECC71', unitSymbol: 'A', name: 'Elf' },
    ENEMY_2: { id: 3, color: '#8E44AD', unitColor: '#9B59B6', unitSymbol: 'U', name: 'Undead' },
    NEUTRAL: { id: 4, color: '#AAAAAA', unitColor: '#CCCCCC', unitSymbol: 'N', name: 'Neutral' }
};

export const UNIT_STATS = {
    peasant: { name: 'Peasant', symbol: 'P', health: 40, attack: 5, range: 1, speed: 2.6, cost: { gold: 50, food: 1 }, maxHealth: 40, buildTime: 5, image: 'assets/units/peasant.png' },
    soldier: { name: 'Soldier', symbol: 'S', health: 70, attack: 10, range: 1, speed: 1.95, cost: { gold: 100, food: 2 }, maxHealth: 70, buildTime: 10 },
    archer: { name: 'Archer', symbol: 'A', health: 50, attack: 8, range: 5, speed: 2.34, cost: { gold: 120, food: 2 }, maxHealth: 50, buildTime: 12 },
    knight: { name: 'Knight', symbol: 'K', health: 120, attack: 15, range: 1, speed: 3.25, cost: { gold: 200, food: 3 }, maxHealth: 120, buildTime: 15 },
};

export const BUILDING_STATS = {
    townhall: { name: 'Town Hall', symbol: 'H', health: 1500, size: 3, cost: { gold: 300, wood: 200 }, maxHealth: 1500, trainUnits: ['peasant'], upgradeTo: 'keep', buildable: true, image: 'assets/buildings/townhall.png', foodCapacity: 5 },
    keep: { name: 'Keep', symbol: 'K', health: 2000, size: 3, cost: { gold: 500, wood: 200 }, maxHealth: 2000, trainUnits: ['peasant'], image: 'assets/buildings/keep.png' },
    barracks: { name: 'Barracks', symbol: 'B', health: 800, size: 3, cost: { gold: 150, wood: 100 }, maxHealth: 800, trainUnits: ['soldier', 'archer', 'knight'], buildable: true, image: 'assets/buildings/barracks.png' },
    farm: { name: 'Farm', symbol: 'F', health: 400, size: 2, cost: { gold: 80, wood: 50 }, maxHealth: 400, foodCapacity: 5, buildable: true, image: 'assets/buildings/farm.png' },
    guardtower: { name: 'Guard Tower', symbol: 'T', health: 500, size: 2, cost: { gold: 150, wood: 50 }, maxHealth: 500, attack: 10, range: 6, attackCooldown: 30, buildable: true, image: 'assets/buildings/guardtower.png' },
    lumbermill: { name: 'Lumber Mill', symbol: 'L', health: 600, size: 3, cost: { gold: 150, wood: 50 }, maxHealth: 600, buildable: true, image: 'assets/buildings/lumbermill.png' },
    blacksmith: { name: 'Blacksmith', symbol: 'S', health: 700, size: 3, cost: { gold: 150, wood: 100 }, maxHealth: 700, buildable: true, image: 'assets/buildings/blacksmith.png' },
    goldmine: { name: 'Gold Mine', symbol: 'G', health: 10000, size: 2, cost: { gold: 0, wood: 0 }, maxHealth: 10000, neutral: true, image: 'assets/buildings/goldmine.png' }
};

export const UPGRADES = {
    iron_swords: { name: 'Iron Swords', cost: { gold: 200, wood: 100 }, effect: { attack: 2 }, description: '+2 Attack for all units' },
    steel_armor: { name: 'Steel Armor', cost: { gold: 200, wood: 150 }, effect: { maxHealth: 20 }, description: '+20 Health for all units' }
};

// Add research capabilities to Blacksmith
BUILDING_STATS.blacksmith.research = ['iron_swords', 'steel_armor'];

export const AI_BUILDING_LIMITS = {
    farm: 12,
    barracks: 3,
    lumbermill: 1,
    blacksmith: 1,
    guardtower: 5
};

export const AI_WAVE_CONFIG = [
    { soldiers: 2, archers: 2, knights: 0 }, // Wave 1
    { soldiers: 3, archers: 3, knights: 1 }, // Wave 2
    { soldiers: 4, archers: 4, knights: 2 }, // Wave 3
    { soldiers: 5, archers: 5, knights: 3 }  // General Wave (repeated)
];
