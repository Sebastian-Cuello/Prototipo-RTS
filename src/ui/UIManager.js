/**
 * @module UIManager
 * @description User interface management and updates
 * 
 * This module manages all UI elements and interactions including:
 * - Resource display (gold, wood, stone, food)
 * - Selection panel (unit/building info, health, actions)
 * - Action buttons (build, train, research)
 * - Dynamic button generation based on selected entity
 * 
 * Key Features:
 * - Real-time resource updates
 * - Dynamic action grid based on selection
 * - Building mode activation
 * - Training queue visualization
 * - Research button generation
 * - Cost display on action buttons
 * - Health/mana bar updates
 * - Faction-specific UI coloring
 * 
 * UI Elements Managed:
 * - Resource counters (gold, wood, stone, food)
 * - Selected unit/building portrait and stats
 * - Action grid with context-sensitive buttons
 * - Training queue counts
 * - Research availability indicators
 */

import { gameState, units, buildings } from '../core/GameState.js';
import { FACTIONS, UNIT_STATS, BUILDING_STATS, UPGRADES } from '../config/entityStats.js';
import Unit from '../entities/Unit.js';
import Building from '../entities/Building.js';

const ui = {};

export function initUI() {
    ui.gold = document.getElementById('gold');
    ui.wood = document.getElementById('wood');
    ui.stone = document.getElementById('stone');
    ui.food = document.getElementById('food');
    ui.selectedPortrait = document.getElementById('selectedPortrait');
    ui.selectedName = document.getElementById('selectedName');
    ui.selectedSubInfo = document.getElementById('selectedSubInfo');
    ui.selectedHealth = document.getElementById('selectedHealth');
    ui.selectedMana = document.getElementById('selectedMana');
    ui.actionGrid = document.getElementById('actionGrid');
    ui.selectedUnitCount = document.getElementById('selectedUnitCount');
    ui.gameLog = document.getElementById('gameLog');
}

export function enterBuildingMode(type) {
    gameState.buildingMode = type;
    // Optional: Visual feedback or log
}

export function updateResourcesUI() {
    if (!ui.gold) return; // Not initialized

    ui.gold.textContent = gameState.resources.gold;
    ui.wood.textContent = gameState.resources.wood;
    ui.stone.textContent = gameState.resources.stone;

    // Recalculate food capacity
    const totalFoodCapacity = buildings
        .filter(b => b.type === 'farm' && !b.isBlueprint && !b.isDead && b.faction === FACTIONS.PLAYER.id)
        .reduce((sum, b) => sum + b.stats.foodCapacity, 0) + 5; // Start with 5 base capacity

    gameState.resources.foodMax = totalFoodCapacity;

    const usedFood = units.filter(u => !u.isDead && u.faction === FACTIONS.PLAYER.id).reduce((sum, u) => sum + u.stats.cost.food, 0);
    gameState.resources.foodUsed = usedFood;

    ui.food.textContent = `${gameState.resources.foodUsed}/${gameState.resources.foodMax}`;
}

export function updateSelectionPanel() {
    if (!ui.actionGrid) return;

    const selected = gameState.selectedEntities[0];
    ui.actionGrid.innerHTML = '';

    if (!selected || selected.isDead) {
        gameState.selectedEntities = [];
        ui.selectedPortrait.textContent = '❓';
        ui.selectedName.textContent = 'No Unit Selected';
        ui.selectedSubInfo.textContent = '';
        ui.selectedHealth.style.width = '0%';
        ui.selectedMana.style.width = '0%';
        return;
    }

    // General Info
    ui.selectedPortrait.textContent = selected.stats.symbol;
    ui.selectedPortrait.style.color = selected.faction === FACTIONS.PLAYER.id ? FACTIONS.PLAYER.unitColor : FACTIONS.ENEMY.unitColor;
    ui.selectedName.textContent = selected.stats.name;
    ui.selectedHealth.style.width = `${(selected.health / selected.maxHealth) * 100}%`;
    const factionName = Object.values(FACTIONS).find(f => f.id === selected.faction)?.name || 'Unknown';
    ui.selectedSubInfo.textContent = factionName;

    // Units don't have mana in this basic version
    ui.selectedMana.style.width = '0%';

    // Actions
    if (selected instanceof Unit && selected.type === 'peasant' && selected.faction === FACTIONS.PLAYER.id) {
        // Peasant Actions: Build Buildings
        for (const type in BUILDING_STATS) {
            const stats = BUILDING_STATS[type];
            // Only show buildable buildings
            if (stats.buildable) {
                const btn = createActionButton(stats.symbol, `Build ${stats.name}`, () => enterBuildingMode(type));
                btn.title = `${stats.name} (Gold: ${stats.cost.gold}, Wood: ${stats.cost.wood})`;
                btn.innerHTML += `<span class="action-cost">${stats.cost.gold}G</span>`;
                ui.actionGrid.appendChild(btn);
            }
        }
    } else if (selected instanceof Building && !selected.isBlueprint && selected.faction === FACTIONS.PLAYER.id) {
        // Building Actions: Train Units
        if (selected.stats.trainUnits) {
            selected.stats.trainUnits.forEach(unitType => {
                const stats = UNIT_STATS[unitType];
                const btn = createActionButton(stats.symbol, `Train ${stats.name}`, () => selected.trainUnit(unitType));
                btn.title = `Train ${stats.name} (Gold: ${stats.cost.gold}, Food: ${stats.cost.food})`;
                btn.innerHTML += `<span class="action-cost">${stats.cost.gold}G / ${stats.cost.food}F</span>`;

                // Show queue info
                const count = selected.trainingQueue.filter(t => t === unitType).length;
                if (count > 0) {
                    btn.innerHTML += `<span class="action-cost" style="bottom: 12px; right: 2px;">+${count}</span>`;
                }

                ui.actionGrid.appendChild(btn);
            });
        }

        // Building Actions: Research
        if (selected.stats.research) {
            selected.stats.research.forEach(upgradeId => {
                const upgrade = UPGRADES[upgradeId];
                const isResearched = gameState.factionUpgrades[selected.faction].includes(upgradeId);

                if (!isResearched) {
                    const btn = createActionButton('⚡', `Research ${upgrade.name}`, () => selected.research(upgradeId));
                    btn.title = `${upgrade.description} (Gold: ${upgrade.cost.gold}, Wood: ${upgrade.cost.wood})`;
                    btn.innerHTML += `<span class="action-cost">${upgrade.cost.gold}G</span>`;
                    ui.actionGrid.appendChild(btn);
                }
            });
        }
    } else if (selected instanceof Building && selected.isBlueprint) {
        ui.actionGrid.innerHTML = '<div class="action-btn disabled">UNDER CONSTRUCTION</div>';
    }
}

export function createActionButton(symbol, title, onClick) {
    const btn = document.createElement('div');
    btn.className = 'action-btn';
    btn.textContent = symbol;
    btn.title = title;
    btn.onclick = onClick;
    return btn;
}
