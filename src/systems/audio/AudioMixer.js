/**
 * @module AudioMixer
 * @description Manages volume levels, muting, and ducking logic.
 */
export default class AudioMixer {
    constructor() {
        this.volumes = {
            master: 1.0,
            music: 0.7,
            sfx_combat: 0.8,
            sfx_ui: 0.6,
            sfx_gather: 0.5,
            sfx_building: 0.6,
            ambient: 0.4,
            voice: 0.9
        };

        this.isMuted = false;

        // Ducking
        this.duckingRefCount = 0;
        this.duckAmount = 0.3; // Target volume multiplier when ducking
        this.duckTransitionTime = 0.3; // Seconds

        this.loadSettings();
    }

    setVolume(category, value) {
        this.volumes[category] = Math.max(0, Math.min(1, value));
        this.saveSettings();
    }

    getVolume(category) {
        return this.volumes[category] || 1.0;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.saveSettings();
        return this.isMuted;
    }

    getEffectiveVolume(category) {
        if (this.isMuted) return 0;

        let vol = (this.volumes[category] || 1.0) * this.volumes.master;

        // Apply ducking to music
        if (category === 'music' && this.duckingRefCount > 0) {
            vol *= this.duckAmount;
        }

        return vol;
    }

    requestDuck() {
        this.duckingRefCount++;
    }

    releaseDuck() {
        this.duckingRefCount = Math.max(0, this.duckingRefCount - 1);
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('audioSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                // Merge to ensure new categories are preserved
                this.volumes = { ...this.volumes, ...settings.volumes };
                this.isMuted = settings.isMuted || false;
            }
        } catch (e) {
            console.warn('Failed to load audio settings', e);
        }
    }

    saveSettings() {
        try {
            const data = {
                volumes: this.volumes,
                isMuted: this.isMuted
            };
            localStorage.setItem('audioSettings', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save audio settings', e);
        }
    }
}
