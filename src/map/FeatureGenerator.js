/**
 * @module FeatureGenerator
 * @description Handles placement of terrain features (lakes, mountains, decorations)
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { TILES } from '../config/entityStats.js';
import { MAP_TEMPLATES } from './TerrainGenerator.js';

export default class FeatureGenerator {
    apply(map, template) {
        console.log(`   → Applying features for: ${template}`);

        switch (template) {
            case MAP_TEMPLATES.FOREST:
                this.addWaterLakes(map, 2 + Math.floor(Math.random() * 2));
                this.addMountainRanges(map, 1 + Math.floor(Math.random() * 2));
                break;

            case MAP_TEMPLATES.OPEN:
                this.addWaterLakes(map, 1);
                this.addMountainRanges(map, 1);
                break;

            case MAP_TEMPLATES.HIGHLANDS:
                this.addMountainRanges(map, 4 + Math.floor(Math.random() * 3));
                this.addWaterLakes(map, 3);
                break;

            case MAP_TEMPLATES.ISLANDS:
                // Islands already have their shape, maybe add some mountains?
                // Original code didn't add extra features to islands besides the shape.
                // Let's add some small mountains for variety.
                this.addMountainRanges(map, 1);
                break;
        }

        this.addDecorations(map);
    }

    addWaterLakes(map, count) {
        for (let i = 0; i < count; i++) {
            const cx = 15 + Math.floor(Math.random() * (MAP_WIDTH - 30));
            const cy = 15 + Math.floor(Math.random() * (MAP_HEIGHT - 30));
            const radius = 4 + Math.floor(Math.random() * 5);

            this.addCircularFeature(map, cx, cy, radius, TILES.WATER, 1.0);
        }
    }

    addMountainRanges(map, count) {
        for (let i = 0; i < count; i++) {
            const startX = Math.floor(Math.random() * MAP_WIDTH);
            const startY = Math.floor(Math.random() * MAP_HEIGHT);
            const length = 12 + Math.floor(Math.random() * 15);
            const direction = Math.random() * Math.PI * 2;

            let x = startX;
            let y = startY;

            for (let j = 0; j < length; j++) {
                // Draw mountain cluster
                this.addCircularFeature(map, Math.floor(x), Math.floor(y), 2, TILES.MOUNTAIN, 0.7);

                // Move along direction with noise
                x += Math.cos(direction) + (Math.random() - 0.5);
                y += Math.sin(direction) + (Math.random() - 0.5);

                x = Math.max(5, Math.min(MAP_WIDTH - 5, x));
                y = Math.max(5, Math.min(MAP_HEIGHT - 5, y));
            }
        }
    }

    addDecorations(map) {
        // Add visual variety (flowers, rocks, etc.)
        // Optimized: Removed object creation for decorations as they are currently not rendered.
        // This avoids unnecessary GC pressure.
        /*
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (map[y][x].id === TILES.GRASS.id && Math.random() < 0.03) {
                    map[y][x] = {
                        ...map[y][x],
                        decoration: Math.random() > 0.5 ? 'flower' : 'rock'
                    };
                }
            }
        }
        */
    }

    addCircularFeature(map, cx, cy, radius, tile, probability) {
        for (let y = cy - radius; y <= cy + radius; y++) {
            for (let x = cx - radius; x <= cx + radius; x++) {
                if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                    if (dist <= radius && Math.random() < probability) {
                        map[y][x] = tile;
                    }
                }
            }
        }
    }
}
