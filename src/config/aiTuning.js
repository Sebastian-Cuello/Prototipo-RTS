/**
 * @module aiTuning
 * @description Centralized configuration for AI behavior
 */

export const AI_TUNING = {
    // General
    REACTION_TIME: {
        EASY: 30,
        NORMAL: 15,
        HARD: 10
    },

    // Economy
    ECONOMY: {
        MIN_PEASANTS: 5,
        MAX_PEASANTS_PER_BASE: 20,
        GOLD_WOOD_RATIO: 0.6, // 60% gold, 40% wood
        EXPANSION_GOLD_THRESHOLD: 500,
        EXPANSION_ARMY_THRESHOLD: 15
    },

    // Combat
    COMBAT: {
        MICRO_RANGE: 15, // Range to check for micro targets
        KITE_DISTANCE: 4,
        CHASE_TOLERANCE: 5, // How far to chase beyond range
        RETREAT_HEALTH_THRESHOLD: 0.3, // Retreat if health < 30% (if implemented)
        GROUP_RADIUS: 10 // Radius to consider units part of a group
    },

    // Scouting
    SCOUTING: {
        GRID_SIZE: 15,
        SCOUT_INTERVAL: 150,
        MAX_SCOUTS: 3
    },

    // Building Limits
    LIMITS: {
        farm: 10,
        barracks: 5,
        lumbermill: 2,
        blacksmith: 1,
        guardtower: 10,
        goldmine: 5,
        townhall: 3
    },

    // Wave Config (from entityStats, moved here or referenced)
    // We can keep AI_WAVE_CONFIG in entityStats if it's shared, or move it here.
    // For now, let's keep it there to minimize diffs, but we could override here.
};
