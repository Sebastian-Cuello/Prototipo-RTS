/**
 * @module MapGenerator (REFACTORED)
 * @description Advanced procedural map generation with multiple biomes
 */

import { MAP_WIDTH, MAP_HEIGHT } from '../config/constants.js';
import { TILES } from '../config/entityStats.js';
import { map, units, buildings, setMap, setSpatialHash, setPathfinder } from '../core/GameState.js';
import SpatialHash from './SpatialHash.js';
import Pathfinder from '../systems/Pathfinder.js';
import { initFog } from '../systems/FogOfWar.js';

// Sub-modules
import TerrainGenerator, { MAP_TEMPLATES } from './TerrainGenerator.js';
import FeatureGenerator from './FeatureGenerator.js';
import ResourceDistributor from './ResourceDistributor.js';
import SpawnManager from './SpawnManager.js';
import MapBalancer from './MapBalancer.js';

// ========================================
// MAIN GENERATION FUNCTION
// ========================================
export { MAP_TEMPLATES };

export function generateMap(template = MAP_TEMPLATES.RANDOM) {
    console.time('MapGeneration');
    console.log(`🗺️ Generating map: ${template}`);

    // Select random template if needed
    if (template === MAP_TEMPLATES.RANDOM) {
        const templates = [
            MAP_TEMPLATES.FOREST,
            MAP_TEMPLATES.OPEN,
            MAP_TEMPLATES.ISLANDS,
            MAP_TEMPLATES.HIGHLANDS
        ];
        template = templates[Math.floor(Math.random() * templates.length)];
        console.log(`   → Selected: ${template}`);
    }

    // Instantiate generators
    const terrainGenerator = new TerrainGenerator();
    const featureGenerator = new FeatureGenerator();
    const resourceDistributor = new ResourceDistributor();
    const spawnManager = new SpawnManager();
    const mapBalancer = new MapBalancer();

    // 1. Generate base terrain
    console.time('Terrain');
    const newMap = terrainGenerator.generate(template);
    setMap(newMap);
    console.timeEnd('Terrain');

    // 2. Apply features
    console.time('Features');
    featureGenerator.apply(newMap, template);
    console.timeEnd('Features');

    // 3. Clear spawn areas (to ensure space for bases)
    spawnManager.clearSpawnAreas(newMap);

    // 4. Place resources
    console.time('Resources');
    resourceDistributor.place(newMap, buildings);
    console.timeEnd('Resources');

    // 5. Spawn entities
    console.time('Spawning');
    spawnManager.spawn(newMap, units, buildings);
    console.timeEnd('Spawning');

    // 6. Initialize systems
    console.time('Systems');
    setSpatialHash(new SpatialHash(10));
    setPathfinder(new Pathfinder(MAP_WIDTH, MAP_HEIGHT, TILES, newMap));
    initFog();
    console.timeEnd('Systems');

    // 7. Validate balance
    console.time('Balance');
    mapBalancer.validate(newMap, buildings);
    console.timeEnd('Balance');

    console.timeEnd('MapGeneration');
}