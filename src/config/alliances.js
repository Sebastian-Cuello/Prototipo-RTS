/**
 * @module AllianceConfig
 * @description Configuration for faction alliances and team modes
 * 
 * This file defines how factions interact with each other.
 * Change the mode and configuration to alter gameplay dynamics.
 */

import { FACTIONS } from './entityStats.js';

/**
 * Alliance configuration
 * 
 * Modes:
 * - FREE_FOR_ALL: All factions fight each other
 * - TEAMS: Factions are grouped into teams
 * - CUSTOM: Define specific alliance/enemy relationships
 */
export const ALLIANCE_CONFIG = {
    // Current game mode
    mode: 'FREE_FOR_ALL', // Options: 'FREE_FOR_ALL', 'TEAMS', 'CUSTOM'

    // Team configuration (used when mode is 'TEAMS')
    // Example: Player + Ally vs Enemy + Enemy_2
    teams: {
        team1: [FACTIONS.PLAYER.id, FACTIONS.ALLY.id],
        team2: [FACTIONS.ENEMY.id, FACTIONS.ENEMY_2.id]
    },

    // Custom alliance matrix (used when mode is 'CUSTOM')
    // Format: 'faction1-faction2': true/false
    // true = allies, false = enemies
    custom: {
        // Example: Player allied with Ally, enemies with others
        // '0-2': true,  // Player allies with Ally
        // '0-1': false, // Player enemies with Enemy
        // '0-3': false, // Player enemies with Enemy_2
        // '1-3': true,  // Enemy allies with Enemy_2
    }
};

/**
 * Preset configurations for quick switching
 */
export const ALLIANCE_PRESETS = {
    FREE_FOR_ALL: {
        mode: 'FREE_FOR_ALL'
    },

    PLAYER_VS_ALL: {
        mode: 'TEAMS',
        teams: {
            player: [FACTIONS.PLAYER.id],
            enemies: [FACTIONS.ENEMY.id, FACTIONS.ALLY.id, FACTIONS.ENEMY_2.id]
        }
    },

    TWO_TEAMS: {
        mode: 'TEAMS',
        teams: {
            team1: [FACTIONS.PLAYER.id, FACTIONS.ALLY.id],
            team2: [FACTIONS.ENEMY.id, FACTIONS.ENEMY_2.id]
        }
    },

    PLAYER_AND_ALLY: {
        mode: 'CUSTOM',
        custom: {
            '0-2': true, // Player allies with Ally
        }
    }
};
