/**
 * @module AllianceSystem
 * @description Manages faction relationships and alliances
 * 
 * This system provides a centralized way to determine if two factions
 * are allies or enemies. Supports different game modes:
 * - FREE_FOR_ALL: All factions are enemies
 * - TEAMS: Factions grouped into allied teams
 * - CUSTOM: Custom alliance matrix
 */

export default class AllianceSystem {
    constructor(config = { mode: 'FREE_FOR_ALL' }) {
        this.config = config;
        this.alliances = new Map();
        this.initializeAlliances();
    }

    /**
     * Initialize alliances based on configuration mode
     */
    initializeAlliances() {
        switch (this.config.mode) {
            case 'FREE_FOR_ALL':
                this.initializeFreeForAll();
                break;
            case 'TEAMS':
                this.initializeTeams();
                break;
            case 'CUSTOM':
                this.initializeCustom();
                break;
            default:
                console.warn(`Unknown alliance mode: ${this.config.mode}, defaulting to FREE_FOR_ALL`);
                this.initializeFreeForAll();
        }
    }

    /**
     * Free-for-all: Everyone is enemies with everyone else
     */
    initializeFreeForAll() {
        // In free-for-all, we don't need to set anything
        // areEnemies will return true for all different factions
        console.log('🤝 Alliance System: FREE_FOR_ALL mode initialized');
        console.log('   All factions are enemies with each other');
    }

    /**
     * Team-based alliances from config
     */
    initializeTeams() {
        if (!this.config.teams) {
            console.warn('TEAMS mode selected but no teams defined, falling back to FREE_FOR_ALL');
            this.initializeFreeForAll();
            return;
        }

        // Set alliances between team members
        Object.entries(this.config.teams).forEach(([teamName, factionIds]) => {
            // Set all members of this team as allies to each other
            for (let i = 0; i < factionIds.length; i++) {
                for (let j = 0; j < factionIds.length; j++) {
                    if (i !== j) {
                        this.setAlliance(factionIds[i], factionIds[j], true);
                    }
                }
            }
        });

        console.log('🤝 Alliance System: TEAMS mode initialized', this.config.teams);
    }

    /**
     * Custom alliance matrix from config
     */
    initializeCustom() {
        if (!this.config.custom) {
            console.warn('CUSTOM mode selected but no custom alliances defined, falling back to FREE_FOR_ALL');
            this.initializeFreeForAll();
            return;
        }

        // Apply custom alliance rules
        Object.entries(this.config.custom).forEach(([key, value]) => {
            const [faction1, faction2] = key.split('-').map(Number);
            this.setAlliance(faction1, faction2, value);
        });

        console.log('🤝 Alliance System: CUSTOM mode initialized');
    }

    /**
     * Set alliance between two factions
     * @param {number} faction1 - First faction ID
     * @param {number} faction2 - Second faction ID
     * @param {boolean} areAllies - True if they are allies, false if enemies
     */
    setAlliance(faction1, faction2, areAllies) {
        const key1 = `${faction1}-${faction2}`;
        const key2 = `${faction2}-${faction1}`;

        this.alliances.set(key1, areAllies);
        this.alliances.set(key2, areAllies); // Symmetric relationship
    }

    /**
     * Check if two factions are allies
     * @param {number} faction1 - First faction ID
     * @param {number} faction2 - Second faction ID
     * @returns {boolean} True if factions are allies
     */
    areAllies(faction1, faction2) {
        // Same faction is always allied
        if (faction1 === faction2) return true;

        // In FREE_FOR_ALL mode, no one is allied (except same faction)
        if (this.config.mode === 'FREE_FOR_ALL') return false;

        const key = `${faction1}-${faction2}`;
        return this.alliances.get(key) === true;
    }

    /**
     * Check if two factions are enemies
     * @param {number} faction1 - First faction ID
     * @param {number} faction2 - Second faction ID
     * @returns {boolean} True if factions are enemies
     */
    areEnemies(faction1, faction2) {
        // Same faction is never an enemy
        if (faction1 === faction2) return false;

        // Factions are enemies if they are not allies
        const result = !this.areAllies(faction1, faction2);

        // DEBUG: Log some checks
        if (Math.random() < 0.001) {
            console.log(`Alliance Check: ${faction1} vs ${faction2} = ${result ? 'ENEMIES' : 'ALLIES'}`);
        }

        return result;
    }

    /**
     * Get all enemy faction IDs for a given faction
     * @param {number} faction - Faction ID
     * @param {Array<number>} allFactionIds - Array of all faction IDs in game
     * @returns {Array<number>} Array of enemy faction IDs
     */
    getAllEnemies(faction, allFactionIds) {
        return allFactionIds.filter(factionId => this.areEnemies(faction, factionId));
    }

    /**
     * Get all allied faction IDs for a given faction
     * @param {number} faction - Faction ID
     * @param {Array<number>} allFactionIds - Array of all faction IDs in game
     * @returns {Array<number>} Array of allied faction IDs
     */
    getAllAllies(faction, allFactionIds) {
        return allFactionIds.filter(factionId => this.areAllies(faction, factionId));
    }

    /**
     * Change alliance mode at runtime
     * @param {Object} newConfig - New configuration
     */
    reconfigure(newConfig) {
        this.config = newConfig;
        this.alliances.clear();
        this.initializeAlliances();
    }
}
