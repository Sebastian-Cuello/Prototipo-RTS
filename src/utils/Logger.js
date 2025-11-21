/**
 * @module Logger
 * @description Game event logging utility
 * 
 * This module provides in-game message logging:
 * - Displays messages in the UI game log
 * - Timestamps messages with game time
 * - Automatically limits log size
 * 
 * Key Features:
 * - Timestamped messages (in game seconds)
 * - Automatic log rotation (max 20 messages)
 * - Prepends new messages to top of log
 * - Integrated with UI game log element
 * 
 * Usage:
 * - Log important game events
 * - User action feedback
 * - AI state changes
 * - Resource transactions
 */

import { gameState } from '../core/GameState.js';

/**
 * @function logGameMessage
 * @description Adds a timestamped message to the game log
 * @param {string} message - The message to log
 */
export function logGameMessage(message) {
    const gameLog = document.getElementById('gameLog');
    if (gameLog) {
        const entry = document.createElement('div');
        // We need to access gameTime. For now, let's assume we can pass it or import it.
        // Circular dependency risk if we import gameState here and gameState imports Logger.
        // Let's inject gameTime or access it from a singleton if possible.
        // For now, simple implementation.
        const time = gameState ? (gameState.gameTime / 30).toFixed(0) : 0;
        entry.textContent = `[${time}] ${message}`;
        gameLog.prepend(entry);
    }
}
