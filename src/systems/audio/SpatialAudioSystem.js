/**
 * @module SpatialAudioSystem
 * @description Wraps WebAudio Context and Listener.
 */
export default class SpatialAudioSystem {
    constructor() {
        this.context = null;
        this.listener = null;
        this.initialized = false;
    }

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();
            this.listener = this.context.listener;
            this.initialized = true;

            // Initial position
            this.updateListener(0, 0, 0);

            console.log('✅ Spatial Audio System initialized');
        } catch (e) {
            console.warn('⚠️ WebAudio not supported', e);
        }
    }

    async resume() {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    updateListener(x, y, z = 0) {
        if (!this.initialized) return;

        // WebAudio listener orientation/position
        // For a top-down RTS, listener is usually "above" the ground looking down.
        // Or we can simulate it being the camera.

        if (this.listener.positionX) {
            this.listener.positionX.setValueAtTime(x, this.context.currentTime);
            this.listener.positionY.setValueAtTime(y, this.context.currentTime);
            this.listener.positionZ.setValueAtTime(z, this.context.currentTime);
        } else {
            // Deprecated API fallback
            this.listener.setPosition(x, y, z);
        }
    }

    createPanner() {
        if (!this.initialized) return null;

        const panner = this.context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse'; // or 'linear'
        panner.refDistance = 1;
        panner.maxDistance = 50;
        panner.rolloffFactor = 1;

        return panner;
    }

    createGain() {
        if (!this.initialized) return null;
        return this.context.createGain();
    }

    get destination() {
        return this.context ? this.context.destination : null;
    }

    get currentTime() {
        return this.context ? this.context.currentTime : 0;
    }
}
