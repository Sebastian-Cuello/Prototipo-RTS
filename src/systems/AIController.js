/**
 * @module AIController
 * @description Orchestrates AI behavior through specialized managers
 */

import { units, buildings, gameState } from '../core/GameState.js';
import { AI_TUNING } from '../config/aiTuning.js';
import { Profiler } from '../utils/Profiler.js';

import { AILogger } from '../ai/AILogger.js';
import AIWorldView from '../ai/AIWorldView.js';
import AIEconomyManager from '../ai/AIEconomyManager.js';
import AIBuildManager from '../ai/AIBuildManager.js';
import AIArmyManager from '../ai/AIArmyManager.js';
import AIAttackManager from '../ai/AIAttackManager.js';
import AIDefenseManager from '../ai/AIDefenseManager.js';
import AIScoutManager from '../ai/AIScoutManager.js';
import AIMicroManager from '../ai/AIMicroManager.js';
import AIStrategyManager from '../ai/AIStrategyManager.js';

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
        this.personality = JSON.parse(JSON.stringify(AI_PERSONALITIES[randomPersonality]));

        // Difficulty adjustments
        this.reactionTime = AI_TUNING.REACTION_TIME[difficulty] || AI_TUNING.REACTION_TIME.NORMAL;
        this.microManagement = difficulty === 'HARD';

        console.log(`🤖 AI ${factionId} initialized as: ${this.personality.name} (${difficulty})`);

        // State
        this.state = 'GROWTH';
        this.timer = 0;

        // Initialize logger
        this.logger = new AILogger(factionId, true);

        // Initialize managers
        this.worldView = new AIWorldView(factionId);
        this.economyManager = new AIEconomyManager(factionId, this.worldView, this.personality);
        this.buildManager = new AIBuildManager(factionId, this.worldView, this.personality, this.logger);
        this.armyManager = new AIArmyManager(factionId, this.worldView, this.personality, this.logger);
        this.attackManager = new AIAttackManager(factionId, this.worldView, this.personality);
        this.defenseManager = new AIDefenseManager(factionId, this.worldView, this.personality);
        this.scoutManager = new AIScoutManager(factionId, this.worldView, this.personality);
        this.microManager = new AIMicroManager(factionId, this.worldView, this.personality);
        this.strategyManager = new AIStrategyManager(factionId, this.worldView, this.personality);
    }

    update() {
        Profiler.start('AI_Update');
        this.timer++;

        const myUnits = units.filter(u => !u.isDead && u.faction === this.factionId);
        const myBuildings = buildings.filter(b => !b.isDead && b.faction === this.factionId);

        // Ensure resources exist
        if (!gameState.factionResources[this.factionId]) {
            gameState.factionResources[this.factionId] = {
                gold: 0, wood: 0, stone: 0, foodUsed: 0, foodMax: 5
            };
        }
        const resources = gameState.factionResources[this.factionId];

        // Update WorldView (exploration tracking)
        this.worldView.update(myUnits);

        // Staggered Updates (optimize by running at different intervals)

        // 1. Combat Micro (Every 10 frames for all AI, not just HARD difficulty)
        // This ensures AI units respond to threats and attack when discovered
        if (this.timer % 10 === 0) {
            Profiler.start('AI_Micro');
            this.microManager.update(myUnits);
            Profiler.end('AI_Micro');
        }

        // 2. Defense & Raids (Fast: ~0.5s)
        if (this.timer % this.reactionTime === 0) {
            const newState = this.defenseManager.update(myUnits, myBuildings, this.state);
            if (newState) this.state = newState;
        }

        // 3. Economy, Buildings, & Army Training (Medium: ~1s)
        if (this.timer % 30 === 0) {
            this.economyManager.update(myUnits, myBuildings, resources);
            this.buildManager.update(myUnits, myBuildings, resources);
            this.armyManager.update(myUnits, myBuildings, resources);
        }

        // 4. Attack (Slow: ~3s)
        if (this.timer % 90 === 0) {
            const newState = this.attackManager.update(myUnits, myBuildings, this.state);
            if (newState) {
                this.logger.log('Strategy', `State: ${this.state} -> ${newState}`);
                this.state = newState;
            }
        }

        // 5. Scouting (Very Slow: ~5s)
        if (this.timer % 150 === 0) {
            this.scoutManager.update(myUnits, myBuildings);
        }

        // 6. Strategy Adaptation (Ultra Slow: ~10s)
        if (this.timer % 300 === 0) {
            const newState = this.strategyManager.update(myUnits, myBuildings, resources, this.state);
            if (newState) this.state = newState;

            // Debug Log
            const army = myUnits.filter(u => u.type !== 'peasant');
            console.log(`🤖 AI ${this.factionId} [${this.personality.name}] State:${this.state} | Army:${army.length} | G:${resources.gold} W:${resources.wood} F:${resources.foodUsed}/${resources.foodMax}`);
        }

        Profiler.end('AI_Update');
    }
}

