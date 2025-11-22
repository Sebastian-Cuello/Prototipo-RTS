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
 * @module SpatialHash (ENHANCED)
 * @description Advanced spatial partitioning with caching and utilities
 */

export default class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.buckets = new Map();
        
        // Query caching
        this.queryCache = new Map();
        this.cacheMaxAge = 5;
        this.cacheFrame = 0;
        
        // Debug
        this.debugEnabled = false;
    }
    
    // ========================================
    // CORE METHODS
    // ========================================
    
    _getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }
    
    _getCellsForEntity(entity) {
        const size = entity.size || 1;
        const cells = [];
        
        const minX = Math.floor(entity.x / this.cellSize);
        const minY = Math.floor(entity.y / this.cellSize);
        const maxX = Math.floor((entity.x + size) / this.cellSize);
        const maxY = Math.floor((entity.y + size) / this.cellSize);
        
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                cells.push(`${x},${y}`);
            }
        }
        
        return cells;
    }
    
    insert(entity) {
        const cells = this._getCellsForEntity(entity);
        
        cells.forEach(key => {
            if (!this.buckets.has(key)) {
                this.buckets.set(key, new Set());
            }
            this.buckets.get(key).add(entity);
        });
        
        entity._spatialKeys = cells;
    }
    
    remove(entity) {
        if (entity._spatialKeys) {
            entity._spatialKeys.forEach(key => {
                if (this.buckets.has(key)) {
                    this.buckets.get(key).delete(entity);
                    
                    if (this.buckets.get(key).size === 0) {
                        this.buckets.delete(key);
                    }
                }
            });
            
            entity._spatialKeys = null;
        }
    }
    
    update(entity) {
        const oldKeys = entity._spatialKeys || [this._getKey(entity.x, entity.y)];
        const newKeys = this._getCellsForEntity(entity);
        
        const changed = oldKeys.length !== newKeys.length ||
                        oldKeys.some((key, i) => key !== newKeys[i]);
        
        if (changed) {
            oldKeys.forEach(key => {
                if (this.buckets.has(key)) {
                    this.buckets.get(key).delete(entity);
                    
                    if (this.buckets.get(key).size === 0) {
                        this.buckets.delete(key);
                    }
                }
            });
            
            newKeys.forEach(key => {
                if (!this.buckets.has(key)) {
                    this.buckets.set(key, new Set());
                }
                this.buckets.get(key).add(entity);
            });
            
            entity._spatialKeys = newKeys;
        }
    }
    
    clear() {
        this.buckets.clear();
        this.queryCache.clear();
    }
    
    // ========================================
    // QUERY METHODS
    // ========================================
    
    query(x, y, range) {
        const results = [];
        const startX = Math.floor((x - range) / this.cellSize);
        const endX = Math.floor((x + range) / this.cellSize);
        const startY = Math.floor((y - range) / this.cellSize);
        const endY = Math.floor((y + range) / this.cellSize);
        
        const rangeSquared = range * range;
        
        for (let by = startY; by <= endY; by++) {
            for (let bx = startX; bx <= endX; bx++) {
                const key = `${bx},${by}`;
                const bucket = this.buckets.get(key);
                
                if (bucket) {
                    for (const entity of bucket) {
                        const dx = entity.x - x;
                        const dy = entity.y - y;
                        
                        if (dx * dx + dy * dy <= rangeSquared) {
                            results.push(entity);
                        }
                    }
                }
            }
        }
        
        return results;
    }
    
    getNearby(x, y, range, filter = null) {
        const results = this.query(x, y, range);
        return filter ? results.filter(filter) : results;
    }
    
    queryCached(x, y, range, cacheKey = null) {
        const key = cacheKey || `${Math.floor(x)},${Math.floor(y)},${range}`;
        const cached = this.queryCache.get(key);
        
        if (cached && this.cacheFrame - cached.frame < this.cacheMaxAge) {
            return cached.results;
        }
        
        const results = this.query(x, y, range);
        
        this.queryCache.set(key, {
            results,
            frame: this.cacheFrame
        });
        
        return results;
    }
    
    queryByType(x, y, range, entityType) {
        return this.query(x, y, range).filter(e => e.type === entityType);
    }
    
    queryByFaction(x, y, range, faction) {
        return this.query(x, y, range).filter(e => e.faction === faction);
    }
    
    queryEnemies(x, y, range, myFaction, neutralId) {
        return this.query(x, y, range).filter(e => 
            e.faction !== myFaction && e.faction !== neutralId
        );
    }
    
    findNearest(x, y, maxRange, predicate = null) {
        const candidates = this.query(x, y, maxRange);
        
        let nearest = null;
        let minDist = Infinity;
        
        for (const entity of candidates) {
            if (predicate && !predicate(entity)) continue;
            
            const dx = entity.x - x;
            const dy = entity.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist) {
                minDist = dist;
                nearest = entity;
            }
        }
        
        return nearest;
    }
    
    // ========================================
    // RAYCAST
    // ========================================
    
    raycast(x1, y1, x2, y2, predicate = null) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(distance * 2);
        
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        for (let i = 0; i <= steps; i++) {
            const x = x1 + stepX * i;
            const y = y1 + stepY * i;
            
            const entities = this.query(x, y, 0.5);
            
            for (const entity of entities) {
                if (predicate && !predicate(entity)) continue;
                
                const ex = entity.x + (entity.size || 1) / 2;
                const ey = entity.y + (entity.size || 1) / 2;
                const radius = (entity.size || 1) / 2;
                
                const dist = Math.sqrt((x - ex) ** 2 + (y - ey) ** 2);
                
                if (dist <= radius) {
                    return {
                        entity,
                        point: { x, y },
                        distance: Math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
                    };
                }
            }
        }
        
        return null;
    }
    
    hasLineOfSight(x1, y1, x2, y2, blockingPredicate) {
        return this.raycast(x1, y1, x2, y2, blockingPredicate) === null;
    }
    
    // ========================================
    // UTILITIES
    // ========================================
    
    incrementFrame() {
        this.cacheFrame++;
        
        if (this.cacheFrame % 100 === 0) {
            for (const [key, entry] of this.queryCache.entries()) {
                if (this.cacheFrame - entry.frame > this.cacheMaxAge * 10) {
                    this.queryCache.delete(key);
                }
            }
        }
    }
    
    clearCache() {
        this.queryCache.clear();
    }
    
    toggleDebug() {
        this.debugEnabled = !this.debugEnabled;
        return this.debugEnabled;
    }
    
    getStats() {
        let totalEntities = 0;
        let maxBucketSize = 0;
        let activeBuckets = 0;
        
        for (const bucket of this.buckets.values()) {
            totalEntities += bucket.size;
            activeBuckets++;
            maxBucketSize = Math.max(maxBucketSize, bucket.size);
        }
        
        return {
            totalBuckets: this.buckets.size,
            activeBuckets,
            totalEntities,
            maxBucketSize,
            avgBucketSize: totalEntities / activeBuckets || 0,
            cellSize: this.cellSize,
            cacheSize: this.queryCache.size,
            cacheFrame: this.cacheFrame
        };
    }
    
    drawDebug(ctx, camera, tileSize) {
        if (!this.debugEnabled) return;
        
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        
        const startX = Math.floor(camera.x / (this.cellSize * tileSize));
        const endX = Math.ceil((camera.x + ctx.canvas.width) / (this.cellSize * tileSize));
        const startY = Math.floor(camera.y / (this.cellSize * tileSize));
        const endY = Math.ceil((camera.y + ctx.canvas.height) / (this.cellSize * tileSize));
        
        for (let x = startX; x <= endX; x++) {
            const worldX = x * this.cellSize * tileSize;
            ctx.beginPath();
            ctx.moveTo(worldX, startY * this.cellSize * tileSize);
            ctx.lineTo(worldX, endY * this.cellSize * tileSize);
            ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y++) {
            const worldY = y * this.cellSize * tileSize;
            ctx.beginPath();
            ctx.moveTo(startX * this.cellSize * tileSize, worldY);
            ctx.lineTo(endX * this.cellSize * tileSize, worldY);
            ctx.stroke();
        }
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const key = `${x},${y}`;
                const bucket = this.buckets.get(key);
                
                if (bucket && bucket.size > 0) {
                    const worldX = (x + 0.5) * this.cellSize * tileSize;
                    const worldY = (y + 0.5) * this.cellSize * tileSize;
                    
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                    ctx.fillRect(
                        x * this.cellSize * tileSize,
                        y * this.cellSize * tileSize,
                        this.cellSize * tileSize,
                        this.cellSize * tileSize
                    );
                    
                    ctx.fillStyle = '#ffff00';
                    ctx.fillText(bucket.size.toString(), worldX, worldY);
                }
            }
        }
        
        ctx.restore();
    }
}
