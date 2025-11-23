/**
 * @module Profiler
 * @description Simple performance profiling utility
 */

export const Profiler = {
    metrics: {},
    enabled: true,
    frame: 0,
    reportInterval: 60, // Report every 60 frames

    start(label) {
        if (!this.enabled) return;
        if (!this.metrics[label]) {
            this.metrics[label] = { total: 0, count: 0, max: 0 };
        }
        this.metrics[label].startTime = performance.now();
    },

    end(label) {
        if (!this.enabled || !this.metrics[label]) return;
        const duration = performance.now() - this.metrics[label].startTime;
        this.metrics[label].total += duration;
        this.metrics[label].count++;
        this.metrics[label].max = Math.max(this.metrics[label].max, duration);
    },

    tick() {
        if (!this.enabled) return;
        this.frame++;
        if (this.frame % this.reportInterval === 0) {
            this.report();
            this.reset();
        }
    },

    report() {
        console.group('📊 Performance Report (Avg per frame)');
        const sortedMetrics = Object.entries(this.metrics).sort((a, b) => b[1].total - a[1].total);

        for (const [label, data] of sortedMetrics) {
            if (data.count === 0) continue;
            const avg = (data.total / data.count).toFixed(2);
            const max = data.max.toFixed(2);
            const total = data.total.toFixed(2);

            // Highlight slow operations (> 2ms is suspicious for 60fps target which is 16ms total)
            const icon = avg > 2 ? '⚠️' : '✅';
            console.log(`${icon} ${label}: Avg: ${avg}ms | Max: ${max}ms | Total: ${total}ms`);
        }
        console.groupEnd();
    },

    reset() {
        for (const key in this.metrics) {
            this.metrics[key].total = 0;
            this.metrics[key].count = 0;
            this.metrics[key].max = 0;
        }
    }
};
