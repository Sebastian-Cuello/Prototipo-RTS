/**
 * @module AIArmyManager
 * @description Manages AI army unit training
 */

import { AI_TUNING } from '../config/aiTuning.js';
import { UNIT_STATS, AI_WAVE_CONFIG } from '../config/entityStats.js';
import { units } from '../core/GameState.js';

export default class AIArmyManager {
    constructor(factionId, worldView, personality, logger) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
        this.logger = logger;
        this.waveIndex = 0;
    }

    update(myUnits, myBuildings, resources) {
        const barracksList = myBuildings.filter(b => b.type === 'barracks' && !b.isBlueprint);

        if (barracksList.length === 0) {
            this.logger.log('Army', 'No Barracks', 'Waiting for barracks');
            return;
        }

        if (resources.foodUsed >= resources.foodMax) {
            this.logger.log('Army', 'Food Capped', `${resources.foodUsed}/${resources.foodMax}`);
            return;
        }

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
            this.logger.log('Army', `Training ${trainType}`, `G:${cost.gold} Army:${army.length}`);
        } else {
            this.logger.log('Army', 'Insufficient Resources', `Need G:${cost.gold} Have:${resources.gold}`);
        }
    }

    analyzeEnemyComposition() {
        const enemyUnits = units.filter(u => !u.isDead && u.faction !== this.factionId && u.faction !== -1);
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
}
