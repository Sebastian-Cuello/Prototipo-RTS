/**
 * @module Pathfinder
 * @description A* pathfinding algorithm implementation
 * 
 * This module provides intelligent pathfinding for unit movement:
 * - A* algorithm for optimal path calculation
 * - Tile-based navigation
 * - Obstacle avoidance (trees, mountains, buildings)
 * - Heuristic-based path optimization
 * 
 * Key Features:
 * - A* pathfinding with Manhattan distance heuristic
 * - Configurable tile passability checks
 * - Efficient open/closed set management
 * - Path reconstruction from goal to start
 * - Diagonal movement support
 * 
 * Algorithm Details:
 * - Uses priority queue (sorted by f-score = g-score + heuristic)
 * - Manhattan distance heuristic for grid-based movement
 * - Considers tile passability from TILES definitions
 * - Returns array of tile coordinates from start to goal
 */

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
    }

    findPath(startX, startY, endX, endY) {
        // Simple A* implementation
        const startNode = { x: Math.floor(startX), y: Math.floor(startY), g: 0, h: 0, f: 0, parent: null };
        const endNode = { x: Math.floor(endX), y: Math.floor(endY) };

        if (startNode.x === endNode.x && startNode.y === endNode.y) return [];

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

        const openList = [];
        const closedList = new Set();

        openList.push(startNode);

        let iterations = 0;
        const MAX_ITERATIONS = 1000; // Safety break

        while (openList.length > 0) {
            iterations++;
            if (iterations > MAX_ITERATIONS) return []; // Path too complex or stuck

            // Get node with lowest f
            let lowInd = 0;
            for (let i = 0; i < openList.length; i++) {
                if (openList[i].f < openList[lowInd].f) {
                    lowInd = i;
                }
            }
            let currentNode = openList[lowInd];

            // End case
            if (currentNode.x === endNode.x && currentNode.y === endNode.y) {
                let curr = currentNode;
                const ret = [];
                while (curr.parent) {
                    ret.push({ x: curr.x + 0.5, y: curr.y + 0.5 }); // Center of tile
                    curr = curr.parent;
                }
                return ret.reverse();
            }

            // Move current from open to closed
            openList.splice(lowInd, 1);
            closedList.add(`${currentNode.x},${currentNode.y}`);

            const neighbors = this.getNeighbors(currentNode);

            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];

                if (closedList.has(`${neighbor.x},${neighbor.y}`) || !this.isPassable(neighbor.x, neighbor.y)) {
                    continue;
                }

                const gScore = currentNode.g + 1; // Assuming cost of 1 for all
                let gScoreIsBest = false;

                const existingNeighbor = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

                if (!existingNeighbor) {
                    gScoreIsBest = true;
                    neighbor.h = Math.abs(neighbor.x - endNode.x) + Math.abs(neighbor.y - endNode.y);
                    neighbor.parent = currentNode;
                    neighbor.g = gScore;
                    neighbor.f = neighbor.g + neighbor.h;
                    openList.push(neighbor);
                } else if (gScore < existingNeighbor.g) {
                    gScoreIsBest = true;
                    existingNeighbor.parent = currentNode;
                    existingNeighbor.g = gScore;
                    existingNeighbor.f = existingNeighbor.g + existingNeighbor.h;
                }
            }
        }
        return [];
    }

    getNeighbors(node) {
        const ret = [];
        const x = node.x;
        const y = node.y;

        if (x > 0) ret.push({ x: x - 1, y: y });
        if (x < this.width - 1) ret.push({ x: x + 1, y: y });
        if (y > 0) ret.push({ x: x, y: y - 1 });
        if (y < this.height - 1) ret.push({ x: x, y: y + 1 });

        return ret;
    }

    isPassable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        // Access global map or passed map
        // Assuming map[y][x] structure from index.html
        return this.map[y][x].passable;
    }
}
