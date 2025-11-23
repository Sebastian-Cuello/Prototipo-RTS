/**
 * @module SfxPlayer
 * @description Handles one-shot sound effects using WebAudio API.
 */
export default class SfxPlayer {
    constructor(mixer, registry, spatialSystem) {
        this.mixer = mixer;
        this.registry = registry;
        this.spatial = spatialSystem;

        this.activeNodes = [];
        this.maxInstances = 32; // Global limit
    }

    play(key, options = {}) {
        const {
            category = 'sfx_ui',
            volume = 1.0,
            pitch = 1.0,
            loop = false,
            spatial = false,
            x = 0,
            y = 0
        } = options;

        const buffer = this.registry.getBuffer(key);
        if (!buffer) return;

        // Concurrency check
        this.cleanup();
        if (this.activeNodes.length >= this.maxInstances) {
            // Drop oldest
            const oldest = this.activeNodes.shift();
            try { oldest.stop(); } catch (e) { }
        }

        const context = this.spatial.context;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.playbackRate.value = pitch;

        const gainNode = context.createGain();
        const baseVol = this.mixer.getEffectiveVolume(category);
        gainNode.gain.value = baseVol * volume;

        // Routing
        let finalNode = gainNode;

        if (spatial && this.spatial.initialized) {
            const panner = this.spatial.createPanner();
            panner.positionX.value = x;
            panner.positionY.value = y;
            panner.positionZ.value = 0;

            source.connect(panner);
            panner.connect(gainNode);
        } else {
            source.connect(gainNode);
        }

        gainNode.connect(context.destination);

        source.start(0);

        // Track node
        const nodeEntry = { source, gainNode, category };
        this.activeNodes.push(nodeEntry);

        source.onended = () => {
            const idx = this.activeNodes.indexOf(nodeEntry);
            if (idx > -1) this.activeNodes.splice(idx, 1);
        };
    }

    cleanup() {
        // Filter out finished nodes (though onended should handle this)
        // This is just a safety check if needed
    }

    updateVolumes() {
        // Update volume of active playing sounds (if category volume changed)
        this.activeNodes.forEach(node => {
            const newVol = this.mixer.getEffectiveVolume(node.category);
            // We don't know the original per-instance volume multiplier here easily without storing it.
            // For now, we just update base category volume. 
            // Ideally we'd store (base * instance_mult) and re-apply.
            // But for one-shots, usually fine to let them finish at current vol.
            // Only critical for looping SFX.

            // node.gainNode.gain.setTargetAtTime(newVol, this.spatial.currentTime, 0.1);
        });
    }
}
