/**
 * @module AssetLoader
 * @description Image asset loading and management system
 * 
 * This module handles:
 * - Preloading building images
 * - Preloading unit images
 * - Image caching
 * - Fallback to CSS rendering if image fails
 * 
 * Key Features:
 * - Async image loading
 * - Error handling for missing images
 * - Centralized asset management
 */

const buildingImages = {};
const unitImages = {};
let assetsLoaded = false;

/**
 * Preload all building images
 * @param {Object} buildingStats - Building configuration from entityStats
 * @returns {Promise} - Resolves when all images are loaded
 */
export function preloadBuildingAssets(buildingStats) {
    const imagePromises = [];

    for (const buildingType in buildingStats) {
        const stats = buildingStats[buildingType];

        // Skip buildings without image property
        if (!stats.image) continue;

        const img = new Image();
        const promise = new Promise((resolve, reject) => {
            img.onload = () => {
                buildingImages[buildingType] = img;
                console.log(`✓ Loaded image for ${buildingType}: ${stats.image}`);
                resolve();
            };
            img.onerror = () => {
                console.warn(`⚠ Failed to load image for ${buildingType}: ${stats.image}`);
                buildingImages[buildingType] = null; // Will fallback to CSS rendering
                resolve(); // Don't reject, just use fallback
            };
            img.src = stats.image;
        });

        imagePromises.push(promise);
    }

    return Promise.all(imagePromises).then(() => {
        assetsLoaded = true;
        console.log('🎨 All building assets loaded!');
    });
}

/**
 * Get the loaded image for a building type
 * @param {string} buildingType - Building type identifier
 * @returns {Image|null} - The loaded image or null if not available
 */
export function getBuildingImage(buildingType) {
    return buildingImages[buildingType] || null;
}

/**
 * Preload all unit images
 * @param {Object} unitStats - Unit configuration from entityStats
 * @returns {Promise} - Resolves when all images are loaded
 */
export function preloadUnitAssets(unitStats) {
    const imagePromises = [];

    for (const unitType in unitStats) {
        const stats = unitStats[unitType];

        // Skip units without image property
        if (!stats.image) continue;

        const img = new Image();
        const promise = new Promise((resolve, reject) => {
            img.onload = () => {
                unitImages[unitType] = img;
                console.log(`✓ Loaded image for ${unitType}: ${stats.image}`);
                resolve();
            };
            img.onerror = () => {
                console.warn(`⚠ Failed to load image for ${unitType}: ${stats.image}`);
                unitImages[unitType] = null; // Will fallback to CSS rendering
                resolve(); // Don't reject, just use fallback
            };
            img.src = stats.image;
        });

        imagePromises.push(promise);
    }

    return Promise.all(imagePromises).then(() => {
        console.log('🎨 All unit assets loaded!');
    });
}

/**
 * Get the loaded image for a unit type
 * @param {string} unitType - Unit type identifier
 * @returns {Image|null} - The loaded image or null if not available
 */
export function getUnitImage(unitType) {
    return unitImages[unitType] || null;
}

const tileImages = {};

/**
 * Preload all tile images
 * @param {Object} tiles - Tile definitions from entityStats
 * @returns {Promise}
 */
export function preloadTileAssets(tiles) {
    const imagePromises = [];

    for (const tileKey in tiles) {
        const tile = tiles[tileKey];
        // Map tile IDs to image paths (convention)
        let imagePath = null;
        if (tile.id === 0) imagePath = 'assets/tiles/grass.png';
        else if (tile.id === 2) imagePath = 'assets/tiles/tree.png';

        if (!imagePath) continue;

        const img = new Image();
        const promise = new Promise((resolve) => {
            img.onload = () => {
                tileImages[tile.id] = img;
                console.log(`✓ Loaded tile image for ${tile.name}`);
                resolve();
            };
            img.onerror = () => {
                console.warn(`⚠ Failed to load tile image for ${tile.name}`);
                tileImages[tile.id] = null;
                resolve();
            };
            img.src = imagePath;
        });
        imagePromises.push(promise);
    }

    return Promise.all(imagePromises);
}

export function getTileImage(tileId) {
    return tileImages[tileId] || null;
}

export function areAssetsLoaded() {
    return assetsLoaded;
}
