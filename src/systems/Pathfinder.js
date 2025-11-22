/**
 * @module Pathfinder
 * @description A* pathfinding algorithm implementation with optimizations
 * 
 * This module provides intelligent pathfinding for unit movement:
 * - A* algorithm for optimal path calculation
 * - Tile-based navigation with diagonal movement
 * - Obstacle avoidance (trees, mountains, buildings)
 * - MinHeap for performance (O(1) retrieval)
 * - Path caching to reduce redundant calculations
 * - Octile distance heuristic
 * 
 * Key Features:
 * - 8-directional movement (cardinal + diagonal)
 * - Corner cutting prevention
 * - Path caching mechanism
 * - Efficient priority queue (MinHeap)
 */

class MinHeap {
    constructor() {
        this.heap = [];
    }

    push(node) {
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        const min = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.bubbleDown(0);
        return min;
    }

    bubbleUp(idx) {
        while (idx > 0) {
            const parent = Math.floor((idx - 1) / 2);
            if (this.heap[idx].f >= this.heap[parent].f) break;
            [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
            idx = parent;
        }
    }

    bubbleDown(idx) {
        while (true) {
            let smallest = idx;
            const left = 2 * idx + 1;
            const right = 2 * idx + 2;

            if (left < this.heap.length && this.heap[left].f < this.heap[smallest].f)
                smallest = left;
            if (right < this.heap.length && this.heap[right].f < this.heap[smallest].f)
                smallest = right;
            if (smallest === idx) break;

            [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
            idx = smallest;
        }
    }

    get length() { return this.heap.length; }
}

/**
 * @class Pathfinder
 * @description Implements A* pathfinding for unit navigation
 */
export default class Pathfinder {
    constructor(mapWidth, mapHeight, tiles, map) {
        this.width = mapWidth;
        this.height = mapHeight;
        this.tiles = tiles;
        this.map = map; // Reference to the game map (2D array of tile objects)
        this.pathCache = new Map();
        this.cacheMaxSize = 500;
    }

    findPath(startX, startY, endX, endY, useCache = true) {
        const sX = Math.floor(startX);
        const sY = Math.floor(startY);
        const eX = Math.floor(endX);
        const eY = Math.floor(endY);

        if (sX === eX && sY === eY) return [];

        const key = `${sX},${sY}-${eX},${eY}`;

        if (useCache && this.pathCache.has(key)) {
            return [...this.pathCache.get(key)]; // Return clone
        }

        const path = this._computePath(sX, sY, eX, eY);

        if (useCache && path.length > 0) {
            if (this.pathCache.size >= this.cacheMaxSize) {
                const firstKey = this.pathCache.keys().next().value;
                this.pathCache.delete(firstKey);
            }
            this.pathCache.set(key, path);
        }

        return path;
    }

    _computePath(startX, startY, endX, endY) {
        const startNode = { x: startX, y: startY, g: 0, h: 0, f: 0, parent: null };
        const endNode = { x: endX, y: endY };

        // Check if end is passable
        if (!this.isPassable(endNode.x, endNode.y)) {
            // Find nearest passable neighbor to target
            const neighbors = this.getNeighbors(endNode);
            let best = null;
            let minDist = Infinity;
            for (let n of neighbors) {
                if (this.isPassable(n.x, n.y)) {
                    const d = Math.abs(n.x - startNode.x) + Math.abs(n.y - startNode.y);
                    if (d < minDist) {
                        minDist = d;
                        best = n;
                    }
                }
            }
            if (best) {
                endNode.x = best.x;
                endNode.y = best.y;
            } else {
                return []; // Cannot reach
            }
        }

        const openList = new MinHeap();
        const closedList = new Set();
        const openSet = new Map(); // For fast lookup

        openList.push(startNode);
        openSet.set(`${startNode.x},${startNode.y}`, startNode);

        let iterations = 0;
        const MAX_ITERATIONS = 2000; // Increased limit for complex paths

        while (openList.length > 0) {
            iterations++;
            if (iterations > MAX_ITERATIONS) return [];

            const currentNode = openList.pop();
            openSet.delete(`${currentNode.x},${currentNode.y}`);

            // End case
            if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
                let curr = currentNode;
                const ret = [];
                while (curr.parent) {
                    ret.push({ x: curr.x + 0.5, y: curr.y + 0.5 }); // Center of tile
                    curr = curr.parent;
                }
                return this.smoothPath(ret.reverse());
            }

            closedList.add(`${currentNode.x},${currentNode.y}`);

            const neighbors = this.getNeighbors(currentNode);

            for (let neighbor of neighbors) {
                if (closedList.has(`${neighbor.x},${neighbor.y}`) || !this.isPassable(neighbor.x, neighbor.y)) {
                    continue;
                }

                const gScore = currentNode.g + neighbor.cost;
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                const existingNeighbor = openSet.get(neighborKey);

                if (!existingNeighbor) {
                    // Octile distance heuristic
                    const dx = Math.abs(neighbor.x - endNode.x);
                    const dy = Math.abs(neighbor.y - endNode.y);
                    neighbor.h = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);

                    neighbor.parent = currentNode;
                    neighbor.g = gScore;
                    neighbor.f = neighbor.g + neighbor.h;

                    openList.push(neighbor);
                    openSet.set(neighborKey, neighbor);
                } else if (gScore < existingNeighbor.g) {
                    existingNeighbor.parent = currentNode;
                    existingNeighbor.g = gScore;
                    existingNeighbor.f = existingNeighbor.g + existingNeighbor.h;
                    // Note: In a proper MinHeap implementation with decrease-key, we'd update position.
                    // Here we rely on the fact that we might re-add it or just accept sub-optimality for simplicity
                    // Or we can just push it again (lazy deletion)
                    openList.push(existingNeighbor);
                }
            }
        }
        return [];
    }

    getNeighbors(node) {
        const ret = [];
        const x = node.x;
        const y = node.y;

        // 8 directions: N, S, E, W, NE, NW, SE, SW
        const directions = [
            { x: -1, y: 0, cost: 1.0 },   // Left
            { x: 1, y: 0, cost: 1.0 },    // Right
            { x: 0, y: -1, cost: 1.0 },   // Up
            { x: 0, y: 1, cost: 1.0 },    // Down
            { x: -1, y: -1, cost: 1.414 }, // Up-Left
            { x: 1, y: -1, cost: 1.414 },  // Up-Right
            { x: -1, y: 1, cost: 1.414 },  // Down-Left
            { x: 1, y: 1, cost: 1.414 }    // Down-Right
        ];

        for (let dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;

            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                // Check for diagonal corner cutting
                if (dir.cost > 1) {
                    if (!this.isDiagonalPassable(x, y, dir.x, dir.y)) {
                        continue;
                    }
                }
                ret.push({ x: nx, y: ny, cost: dir.cost });
            }
        }

        return ret;
    }

    isPassable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.map[y][x].passable;
    }

    isDiagonalPassable(x, y, dx, dy) {
        // Check if the two adjacent cardinal tiles are passable
        return this.isPassable(x + dx, y) && this.isPassable(x, y + dy);
    }

    smoothPath(path) {
        if (path.length <= 2) return path;

        const smoothed = [path[0]];
        let current = 0;

        while (current < path.length - 1) {
            let farthest = current + 1;

            // Look ahead as far as possible
            for (let i = path.length - 1; i > current; i--) {
                if (this.hasLineOfSight(path[current], path[i])) {
                    farthest = i;
                    break;
                }
            }

            smoothed.push(path[farthest]);
            current = farthest;
        }

        return smoothed;
    }

    hasLineOfSight(start, end) {
        let x0 = Math.floor(start.x);
        let y0 = Math.floor(start.y);
        let x1 = Math.floor(end.x);
        let y1 = Math.floor(end.y);

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (!this.isPassable(x0, y0)) return false;
            if (x0 === x1 && y0 === y1) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return true;
    }

    clearCache() {
        this.pathCache.clear();
    }
}
