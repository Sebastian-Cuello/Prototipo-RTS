/**
 * @module SpatialHash
 * @description Spatial partitioning for efficient entity queries
 * 
 * This module provides a spatial hash grid for fast entity lookups:
 * - Divides the game world into a grid of cells
 * - Entities are stored in cells based on their position
 * - Enables O(1) nearest neighbor queries instead of O(n)
 * 
 * Key Features:
 * - Configurable cell size for optimal performance
 * - Insert, remove, and update operations
 * - Efficient range queries (getNearby)
 * - Automatic cell management
 * - Hash-based cell storage
 * 
 * Performance Benefits:
 * - Dramatically reduces collision detection complexity
 * - Enables efficient "find nearest enemy" queries
 * - Scales well with large numbers of entities
 * 
 * Usage:
 * - Entities automatically register on creation
 * - Update when entity moves to different cell
 * - Remove on entity death
 */

/**
 * @class SpatialHash
 * @description Grid-based spatial partitioning for efficient entity queries
 */
export default class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    _getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    insert(entity) {
        const key = this._getKey(entity.x, entity.y);
        if (!this.buckets.has(key)) {
            this.buckets.set(key, new Set());
        }
        this.buckets.get(key).add(entity);
    }

    remove(entity) {
        const key = this._getKey(entity.x, entity.y);
        if (this.buckets.has(key)) {
            this.buckets.get(key).delete(entity);
            if (this.buckets.get(key).size === 0) {
                this.buckets.delete(key);
            }
        }
    }

    update(entity) {
        if (entity._spatialKey) {
            const oldKey = entity._spatialKey;
            const newKey = this._getKey(entity.x, entity.y);

            if (oldKey !== newKey) {
                if (this.buckets.has(oldKey)) {
                    this.buckets.get(oldKey).delete(entity);
                    if (this.buckets.get(oldKey).size === 0) {
                        this.buckets.delete(oldKey);
                    }
                }

                if (!this.buckets.has(newKey)) {
                    this.buckets.set(newKey, new Set());
                }
                this.buckets.get(newKey).add(entity);
                entity._spatialKey = newKey;
            }
        } else {
            this.insert(entity);
            entity._spatialKey = this._getKey(entity.x, entity.y);
        }
    }

    query(x, y, range) {
        const results = [];
        const startX = Math.floor((x - range) / this.cellSize);
        const endX = Math.floor((x + range) / this.cellSize);
        const startY = Math.floor((y - range) / this.cellSize);
        const endY = Math.floor((y + range) / this.cellSize);

        for (let by = startY; by <= endY; by++) {
            for (let bx = startX; bx <= endX; bx++) {
                const key = `${bx},${by}`;
                if (this.buckets.has(key)) {
                    for (const entity of this.buckets.get(key)) {
                        const dx = entity.x - x;
                        const dy = entity.y - y;
                        if (dx * dx + dy * dy <= range * range) {
                            results.push(entity);
                        }
                    }
                }
            }
        }
        return results;
    }

    clear() {
        this.buckets.clear();
    }
}
