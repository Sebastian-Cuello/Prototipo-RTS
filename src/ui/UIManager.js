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
import { soundManager } from '../systems/SoundManager.js';
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

    // Initialize Tooltip
    tooltip.init();
    document.addEventListener('mousemove', (e) => {
        tooltip.update(e.clientX, e.clientY);
    });

    // Initialize Audio UI
    initAudioUI();
}

// --- Audio UI ---
export function initAudioUI() {
    // Create settings button
    const audioBtn = document.createElement('button');
    audioBtn.id = 'audio-settings-btn';
    audioBtn.className = 'ui-button';
    audioBtn.innerHTML = '🔊';
    audioBtn.title = 'Audio Settings';
    audioBtn.onclick = () => toggleAudioSettings();
    document.body.appendChild(audioBtn);

    // Create panel
    createAudioSettingsPanel();
}

function createAudioSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'audio-settings-panel';
    panel.className = 'settings-panel hidden';

    panel.innerHTML = `
        <div class="settings-header">
            <h3>🔊 Audio Settings</h3>
            <button class="close-btn" id="close-audio-btn">✕</button>
        </div>
        <div class="settings-content">
            ${createVolumeSlider('master', 'Master Volume')}
            ${createVolumeSlider('music', 'Music')}
            ${createVolumeSlider('sfx_combat', 'Combat SFX')}
            ${createVolumeSlider('sfx_ui', 'UI Sounds')}
            ${createVolumeSlider('ambient', 'Ambient')}
            ${createVolumeSlider('voice', 'Voice Lines')}
            
            <div class="settings-actions">
                <button id="mute-all-btn" class="settings-btn">🔊 Mute All</button>
                <button id="test-sound-btn" class="settings-btn">🎵 Test Sound</button>
            </div>
            
            <div class="settings-info">
                <small>Settings are saved automatically</small>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Wire up events
    wireAudioEvents();
}

function createVolumeSlider(category, label) {
    const value = Math.round(soundManager.getVolume(category) * 100);

    return `
        <div class="volume-control">
            <label>${label}</label>
            <input type="range" 
                   id="volume-${category}" 
                   class="volume-slider"
                   min="0" 
                   max="100" 
                   value="${value}"
                   data-category="${category}">
            <span id="volume-${category}-value" class="volume-value">${value}%</span>
        </div>
    `;
}

function wireAudioEvents() {
    // Close button
    document.getElementById('close-audio-btn').addEventListener('click', toggleAudioSettings);

    // Volume sliders
    document.querySelectorAll('.volume-slider').forEach(slider => {
        const category = slider.dataset.category;
        const valueDisplay = document.getElementById(`volume-${category}-value`);

        slider.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            soundManager.setVolume(category, value);
            valueDisplay.textContent = `${Math.round(e.target.value)}%`;
        });
    });

    // Mute button
    document.getElementById('mute-all-btn').addEventListener('click', () => {
        const isMuted = soundManager.toggleMute();
        document.getElementById('mute-all-btn').textContent = isMuted ? '🔇 Unmute All' : '🔊 Mute All';
    });

    // Test sound button
    document.getElementById('test-sound-btn').addEventListener('click', () => {
        soundManager.play('voice_yes', { duck: false });
    });
}

function toggleAudioSettings() {
    const panel = document.getElementById('audio-settings-panel');
    panel.classList.toggle('hidden');
}

// --- Tooltip System ---
const tooltip = {
    element: null,
    visible: false,

    init() {
        this.element = document.createElement('div');
        this.element.id = 'custom-tooltip';
        this.element.className = 'tooltip hidden';
        document.body.appendChild(this.element);
    },

    show(x, y, content) {
        this.element.innerHTML = content;
        this.element.style.left = `${x + 10}px`;
        this.element.style.top = `${y + 10}px`;
        this.element.classList.remove('hidden');
        this.visible = true;
    },

    hide() {
        this.element.classList.add('hidden');
        this.visible = false;
    },

    update(x, y) {
        if (this.visible) {
            this.element.style.left = `${x + 10}px`;
            this.element.style.top = `${y + 10}px`;
        }
    }
};

function createUnitTooltip(unitType) {
    const stats = UNIT_STATS[unitType];

    return `
        <div class="tooltip-header">
            <span class="tooltip-icon">${stats.symbol}</span>
            <span class="tooltip-name">${stats.name}</span>
        </div>
        <div class="tooltip-stats">
            <div>❤️ Health: ${stats.maxHealth}</div>
            <div>⚔️ Damage: ${stats.damage}</div>
            <div>🎯 Range: ${stats.range}</div>
            <div>👟 Speed: ${stats.speed}</div>
        </div>
        <div class="tooltip-cost">
            <span>💰 ${stats.cost.gold}G</span>
            <span>🍖 ${stats.cost.food}F</span>
            ${stats.cost.wood ? `<span>🪵 ${stats.cost.wood}W</span>` : ''}
        </div>
        <div class="tooltip-time">
            ⏱️ Build time: ${stats.trainTime || 30}s
        </div>
        <div class="tooltip-description">
            ${stats.description || 'Basic military unit.'}
        </div>
    `;
}

// --- Notifications & Feedback ---
const notifications = [];

export function showNotification(message, type = 'info', duration = 3000) {
    const notification = {
        id: Date.now(),
        message,
        type, // 'info', 'warning', 'error', 'success'
        timestamp: Date.now()
    };

    notifications.push(notification);

    const notifElement = document.createElement('div');
    notifElement.className = `notification notification-${type}`;
    notifElement.textContent = message;
    notifElement.id = `notif-${notification.id}`;

    const container = document.getElementById('notification-container') || createNotificationContainer();
    container.appendChild(notifElement);

    // Auto-remove
    setTimeout(() => {
        notifElement.classList.add('fade-out');
        setTimeout(() => {
            notifElement.remove();
            notifications.splice(notifications.findIndex(n => n.id === notification.id), 1);
        }, 300);
    }, duration);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    document.body.appendChild(container);
    return container;
}

function showFloatingText(element, text, type) {
    const floater = document.createElement('div');
    floater.className = `floating-text ${type}`;
    floater.textContent = text;

    const rect = element.getBoundingClientRect();
    floater.style.left = `${rect.left + rect.width / 2}px`;
    floater.style.top = `${rect.top}px`;

    document.body.appendChild(floater);

    setTimeout(() => floater.remove(), 1000);
}

export function enterBuildingMode(type) {
    gameState.buildingMode = type;
    showNotification(`Building Mode: ${type}`, 'info');
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

const ACTION_HOTKEYS = {
    // Buildings
    'farm': 'F',
    'barracks': 'B',
    'lumbermill': 'L',
    'blacksmith': 'K',
    'guardtower': 'T',

    // Units
    'peasant': 'P',
    'soldier': 'S',
    'archer': 'A',
    'knight': 'N'
};

export function updateSelectionPanel() {
    if (!ui.actionGrid) return;

    ui.actionGrid.innerHTML = '';

    if (gameState.selectedEntities.length === 0) {
        // No selection
        ui.selectedPortrait.textContent = '❓';
        ui.selectedName.textContent = 'No Unit Selected';
        ui.selectedSubInfo.textContent = '';
        ui.selectedHealth.style.width = '0%';
        ui.selectedMana.style.width = '0%';
        return;
    }

    // ✅ MULTI-SELECTION
    if (gameState.selectedEntities.length > 1) {
        displayMultiSelection(gameState.selectedEntities);
        return;
    }

    const selected = gameState.selectedEntities[0];

    // General Info
    ui.selectedPortrait.textContent = selected.stats.symbol;
    ui.selectedPortrait.style.color = selected.faction === FACTIONS.PLAYER.id ? FACTIONS.PLAYER.unitColor : FACTIONS.ENEMY.unitColor;
    ui.selectedName.textContent = selected.stats.name;
    ui.selectedHealth.style.width = `${(selected.health / selected.maxHealth) * 100}%`;
    const factionName = Object.values(FACTIONS).find(f => f.id === selected.faction)?.name || 'Unknown';
    ui.selectedSubInfo.textContent = factionName;
    ui.selectedMana.style.width = '0%';

    // Actions
    if (selected instanceof Unit && selected.type === 'peasant' && selected.faction === FACTIONS.PLAYER.id) {
        // Peasant Actions: Build Buildings
        for (const type in BUILDING_STATS) {
            const stats = BUILDING_STATS[type];
            if (stats.buildable) {
                const canAfford = gameState.resources.gold >= stats.cost.gold && gameState.resources.wood >= stats.cost.wood;
                const tooltipHTML = `
                    <div class="tooltip-header"><span class="tooltip-icon">${stats.symbol}</span><span class="tooltip-name">${stats.name}</span></div>
                    <div class="tooltip-cost"><span>💰 ${stats.cost.gold}G</span><span>🪵 ${stats.cost.wood}W</span></div>
                    <div class="tooltip-description">Build a ${stats.name}.</div>
                `;

                const btn = createActionButton(
                    stats.symbol,
                    `Build ${stats.name}`,
                    () => enterBuildingMode(type),
                    tooltipHTML,
                    type,
                    canAfford
                );
                ui.actionGrid.appendChild(btn);
            }
        }
    } else if (selected instanceof Building && !selected.isBlueprint && selected.faction === FACTIONS.PLAYER.id) {
        // Building Actions: Train Units
        if (selected.stats.trainUnits) {
            selected.stats.trainUnits.forEach(unitType => {
                const stats = UNIT_STATS[unitType];
                const canAfford = gameState.resources.gold >= stats.cost.gold &&
                    gameState.resources.wood >= (stats.cost.wood || 0) &&
                    gameState.resources.foodUsed + stats.cost.food <= gameState.resources.foodMax;

                const tooltipHTML = createUnitTooltip(unitType);

                const btn = createActionButton(
                    stats.symbol,
                    `Train ${stats.name}`,
                    () => selected.trainUnit(unitType),
                    tooltipHTML,
                    unitType,
                    canAfford
                );

                // Show queue info
                const count = selected.trainingQueue.filter(t => t === unitType).length;
                if (count > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'unit-count-badge';
                    badge.textContent = `+${count}`;
                    btn.appendChild(badge);
                }

                ui.actionGrid.appendChild(btn);
            });
        }

        // Show Training Progress
        if (selected.trainingQueue.length > 0) {
            const currentUnit = selected.trainingQueue[0];
            const progress = (selected.trainingProgress / UNIT_STATS[currentUnit].trainTime) * 100;

            const trainingPanel = document.createElement('div');
            trainingPanel.className = 'training-panel';
            trainingPanel.innerHTML = `
                <div class="training-current">
                    <span class="training-icon">${UNIT_STATS[currentUnit].symbol}</span>
                    <div class="progress-bar-container small">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <span class="training-count">${selected.trainingQueue.length}</span>
                </div>
            `;
            ui.actionGrid.insertBefore(trainingPanel, ui.actionGrid.firstChild);
        }

        // Building Actions: Research
        if (selected.stats.research) {
            selected.stats.research.forEach(upgradeId => {
                const upgrade = UPGRADES[upgradeId];
                const isResearched = gameState.factionUpgrades[selected.faction].includes(upgradeId);

                if (!isResearched) {
                    const canAfford = gameState.resources.gold >= upgrade.cost.gold && gameState.resources.wood >= upgrade.cost.wood;
                    const tooltipHTML = `
                        <div class="tooltip-header"><span class="tooltip-icon">⚡</span><span class="tooltip-name">${upgrade.name}</span></div>
                        <div class="tooltip-cost"><span>💰 ${upgrade.cost.gold}G</span><span>🪵 ${upgrade.cost.wood}W</span></div>
                        <div class="tooltip-description">${upgrade.description}</div>
                    `;

                    const btn = createActionButton(
                        '⚡',
                        `Research ${upgrade.name}`,
                        () => selected.research(upgradeId),
                        tooltipHTML,
                        null, // No hotkey for research yet
                        canAfford
                    );
                    ui.actionGrid.appendChild(btn);
                }
            });
        }
    } else if (selected instanceof Building && selected.isBlueprint) {
        const progress = (selected.health / selected.maxHealth) * 100; // Using health as build progress for now
        ui.actionGrid.innerHTML = `
            <div class="construction-panel">
                <div class="construction-title">⚒️ UNDER CONSTRUCTION</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                    <span class="progress-text">${Math.floor(progress)}%</span>
                </div>
            </div>
        `;
    }
}

function displayMultiSelection(entities) {
    // Group by type
    const groups = {};
    entities.forEach(entity => {
        const type = entity.type;
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(entity);
    });

    // Display summary
    ui.selectedPortrait.textContent = '👥';
    ui.selectedName.textContent = `${entities.length} Units Selected`;

    // Calculate average health
    const avgHealth = entities.reduce((sum, e) => sum + e.health, 0) / entities.length;
    const avgMaxHealth = entities.reduce((sum, e) => sum + e.maxHealth, 0) / entities.length;
    ui.selectedHealth.style.width = `${(avgHealth / avgMaxHealth) * 100}%`;
    ui.selectedSubInfo.textContent = Object.keys(groups).map(type => `${groups[type].length} ${UNIT_STATS[type].name}`).join(', ');

    // Action Grid: Show unit type buttons
    Object.entries(groups).forEach(([type, units]) => {
        const stats = UNIT_STATS[type];
        const tooltipHTML = `<div>Click to select only ${stats.name}</div>`;

        const btn = createActionButton(
            stats.symbol,
            `${units.length}x ${stats.name}`,
            () => {
                // Select only this type
                gameState.selectedEntities.forEach(e => e.selected = false);
                gameState.selectedEntities = units;
                units.forEach(u => u.selected = true);
                updateSelectionPanel();
            },
            tooltipHTML,
            type
        );

        // Show count badge
        const countBadge = document.createElement('span');
        countBadge.className = 'unit-count-badge';
        countBadge.textContent = units.length;
        btn.appendChild(countBadge);

        ui.actionGrid.appendChild(btn);
    });
}

export function createActionButton(symbol, title, onClick, tooltipContent, actionType, canAfford = true) {
    const btn = document.createElement('div');
    btn.className = `action-btn ${!canAfford ? 'disabled' : ''}`;
    btn.textContent = symbol;

    // Add hotkey badge
    const hotkey = ACTION_HOTKEYS[actionType];
    if (hotkey) {
        const hotkeyBadge = document.createElement('span');
        hotkeyBadge.className = 'hotkey-badge';
        hotkeyBadge.textContent = hotkey;
        btn.appendChild(hotkeyBadge);

        // Add to tooltip
        if (tooltipContent) {
            tooltipContent += `<div class="tooltip-hotkey">Hotkey: <kbd>${hotkey}</kbd></div>`;
        }
    }

    // Custom tooltip
    if (tooltipContent) {
        btn.addEventListener('mouseenter', (e) => {
            tooltip.show(e.clientX, e.clientY, tooltipContent);
        });

        btn.addEventListener('mouseleave', () => {
            tooltip.hide();
        });
    }

    btn.onclick = () => {
        if (!canAfford) {
            showFloatingText(btn, '❌ Not enough resources', 'error');
            // playSound('error');
            return;
        }

        const result = onClick();

        if (result === false) {
            // Action failed
            showFloatingText(btn, '❌ Cannot perform', 'error');
            // playSound('error');
        } else {
            // Success feedback
            btn.classList.add('action-clicked');
            setTimeout(() => btn.classList.remove('action-clicked'), 200);
            showFloatingText(btn, '✓', 'success');
        }
    };

    return btn;
}
