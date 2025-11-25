/**
 * @module Constants
 * @description Game configuration constants
 * 
 * This module defines core game constants:
 * - Map dimensions
 * - Rendering parameters
 * - Game loop timing
 * 
 * Key Constants:
 * - TILE_SIZE: Pixel size of each map tile
 * - MAP_WIDTH/HEIGHT: Map dimensions in tiles
 * - MS_PER_UPDATE: Fixed timestep for game logic (30 FPS)
 */

export const TILE_SIZE = 64;
export const MAP_WIDTH = 75;
export const MAP_HEIGHT = 75;
export const UI_PANEL_HEIGHT = 150;
export const MINIMAP_SIZE = 150;
export const MS_PER_UPDATE = 1000 / 30;
