/**
 * @module SoundRegistry
 * @description Handles loading and storage of audio assets.
 */
export default class SoundRegistry {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.buffers = {}; // For SFX (WebAudio)
        this.musicTracks = {}; // For Music (HTML5 Audio)
        this.variations = {};
    }

    async loadSfx(key, path) {
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.buffers[key] = audioBuffer;
            // console.log(`✅ Loaded SFX: ${key}`);
        } catch (e) {
            console.warn(`❌ Failed to load SFX: ${key} (${path})`, e);
        }
    }

    loadMusic(key, path) {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.loop = true;
        this.musicTracks[key] = audio;
        // console.log(`✅ Registered Music: ${key}`);
    }

    registerVariation(baseKey, keys) {
        this.variations[baseKey] = keys;
    }

    getBuffer(key) {
        // Check variations
        if (this.variations[key]) {
            const variants = this.variations[key];
            key = variants[Math.floor(Math.random() * variants.length)];
        }
        return this.buffers[key];
    }

    getMusic(key) {
        return this.musicTracks[key];
    }
}
