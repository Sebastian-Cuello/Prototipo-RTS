/**
 * @module AIScoutManager
 * @description Manages AI scouting and map exploration
 */

import { AI_TUNING } from '../config/aiTuning.js';

export default class AIScoutManager {
    constructor(factionId, worldView, personality) {
        this.factionId = factionId;
        this.worldView = worldView;
        this.personality = personality;
    }

    update(myUnits, myBuildings) {
        // Update exploration in WorldView (done in Controller or here?)
        // WorldView.update(myUnits) is called by Controller.

        // Manage Scouts
        const army = myUnits.filter(u => u.type !== 'peasant');
        const scouts = army.filter(u => !u.isMoving && !u.targetEntity && !u.isAttacking).slice(0, AI_TUNING.SCOUTING.MAX_SCOUTS);

        scouts.forEach(scout => {
            this.assignScoutTarget(scout);
        });
    }

    assignScoutTarget(scout) {
        const grid = this.worldView.getExplorationGrid();

        // Find nearest unexplored or old cell
        // Optimization: Don't scan entire grid every frame.
        // Pick random candidates and choose best.

        let best = null;
        let maxScore = -Infinity;

        for (let i = 0; i < 10; i++) {
            const cell = grid[Math.floor(Math.random() * grid.length)];

            const dist = Math.abs(cell.x - scout.x) + Math.abs(cell.y - scout.y);
            const age = Date.now() - cell.lastSeen;

            // Score: High age, Low distance, Unexplored bonus
            let score = age - dist * 100;
            if (!cell.isExplored) score += 100000;

            if (score > maxScore) {
                maxScore = score;
                best = cell;
            }
        }

        if (best) {
            scout.moveTo(best.x, best.y);
        }
    }
}
