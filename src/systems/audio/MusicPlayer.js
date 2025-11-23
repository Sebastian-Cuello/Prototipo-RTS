/**
 * @module MusicPlayer
 * @description Handles background music playback and crossfading.
 */
export default class MusicPlayer {
    constructor(mixer, registry) {
        this.mixer = mixer;
        this.registry = registry;
        this.currentTrack = null;
        this.currentKey = null;
        this.fadeInterval = null;
    }

    play(key, fadeDuration = 2000) {
        if (this.currentKey === key) return;

        const newTrack = this.registry.getMusic(key);
        if (!newTrack) {
            console.warn(`Music track not found: ${key}`);
            return;
        }

        const oldTrack = this.currentTrack;

        // Setup new track
        newTrack.volume = 0;
        newTrack.currentTime = 0;
        newTrack.play().catch(e => console.warn('Music play failed', e));

        this.currentTrack = newTrack;
        this.currentKey = key;

        // Crossfade
        this.startCrossfade(oldTrack, newTrack, fadeDuration);
    }

    stop(fadeDuration = 2000) {
        if (this.currentTrack) {
            this.fadeOut(this.currentTrack, fadeDuration, () => {
                this.currentTrack.pause();
                this.currentTrack.currentTime = 0;
                this.currentTrack = null;
                this.currentKey = null;
            });
        }
    }

    updateVolume() {
        // Called when mixer volume changes, but only if not fading
        if (!this.fadeInterval && this.currentTrack) {
            this.currentTrack.volume = this.mixer.getEffectiveVolume('music');
        }
    }

    startCrossfade(oldTrack, newTrack, duration) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);

        const startTime = Date.now();
        const targetVol = this.mixer.getEffectiveVolume('music');

        this.fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Fade out old
            if (oldTrack) {
                oldTrack.volume = Math.max(0, targetVol * (1 - progress));
            }

            // Fade in new
            if (newTrack) {
                newTrack.volume = targetVol * progress;
            }

            if (progress >= 1) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (oldTrack) {
                    oldTrack.pause();
                    oldTrack.currentTime = 0;
                }
            }
        }, 50);
    }

    fadeOut(track, duration, onComplete) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);

        const startTime = Date.now();
        const startVol = track.volume;

        this.fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            track.volume = Math.max(0, startVol * (1 - progress));

            if (progress >= 1) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                if (onComplete) onComplete();
            }
        }, 50);
    }
}
