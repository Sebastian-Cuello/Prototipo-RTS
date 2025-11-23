/**
 * @module SoundManager
 * @description Professional audio management system (Refactored Façade)
 */

import AudioMixer from './audio/AudioMixer.js';
import SpatialAudioSystem from './audio/SpatialAudioSystem.js';
import SoundRegistry from './audio/SoundRegistry.js';
import MusicPlayer from './audio/MusicPlayer.js';
import SfxPlayer from './audio/SfxPlayer.js';

export default class SoundManager {
    constructor() {
        this.mixer = new AudioMixer();
        this.spatial = new SpatialAudioSystem();
        this.registry = null; // Needs spatial context
        this.musicPlayer = null;
        this.sfxPlayer = null;

        this.initialized = false;
        this.musicStarted = false;
    }

    init() {
        if (this.initialized) return;

        this.spatial.init();
        this.registry = new SoundRegistry(this.spatial.context);
        this.musicPlayer = new MusicPlayer(this.mixer, this.registry);
        this.sfxPlayer = new SfxPlayer(this.mixer, this.registry, this.spatial);

        this.loadAssets();
        this.initialized = true;
        console.log('✅ SoundManager initialized (Modular)');
    }

    loadAssets() {
        // Music (Streaming)
        this.registry.loadMusic('bgm_peaceful', 'assets/sounds/music/theme.mp3');
        this.registry.loadMusic('bgm_battle', 'assets/sounds/music/theme.mp3');

        // SFX (Buffers)
        this.registry.loadSfx('select_unit', 'assets/sounds/sfx/select.mp3');
        this.registry.loadSfx('command_move', 'assets/sounds/sfx/move.mp3');
        this.registry.loadSfx('command_attack', 'assets/sounds/sfx/attack_cmd.mp3');

        this.registry.loadSfx('gather_gold', 'assets/sounds/sfx/gather_gold.mp3');
        this.registry.loadSfx('gather_wood', 'assets/sounds/sfx/wood.mp3');

        this.registry.loadSfx('build_start', 'assets/sounds/sfx/build_start.mp3');
        this.registry.loadSfx('build_complete', 'assets/sounds/sfx/build_complete.mp3');
        this.registry.loadSfx('building_destroyed', 'assets/sounds/sfx/destroyed.mp3');

        // Variations
        // Note: In a real engine this would be data-driven
        const swordSounds = [
            'assets/sounds/sfx/sword1.mp3',
            'assets/sounds/sfx/sword2.mp3',
            'assets/sounds/sfx/sword3.mp3'
        ];
        swordSounds.forEach((path, i) => this.registry.loadSfx(`attack_sword_${i}`, path));
        this.registry.registerVariation('attack_sword', swordSounds.map((_, i) => `attack_sword_${i}`));

        const bowSounds = [
            'assets/sounds/sfx/bow1.mp3',
            'assets/sounds/sfx/bow2.mp3'
        ];
        bowSounds.forEach((path, i) => this.registry.loadSfx(`attack_bow_${i}`, path));
        this.registry.registerVariation('attack_bow', bowSounds.map((_, i) => `attack_bow_${i}`));

        // Voice
        const yesSounds = ['assets/sounds/voice/yes1.mp3', 'assets/sounds/voice/yes2.mp3', 'assets/sounds/voice/yes3.mp3'];
        yesSounds.forEach((path, i) => this.registry.loadSfx(`voice_yes_${i}`, path));
        this.registry.registerVariation('voice_yes', yesSounds.map((_, i) => `voice_yes_${i}`));

        this.registry.loadSfx('level_up', 'assets/sounds/sfx/level_up.mp3');
    }

    // ========================================
    // PUBLIC API
    // ========================================

    play(key, options = {}) {
        if (!this.initialized) return;
        this.sfxPlayer.play(key, options);
    }

    playSpatial(key, x, y, options = {}) {
        if (!this.initialized) return;
        this.sfxPlayer.play(key, { ...options, spatial: true, x, y });
    }

    playMusic(key, options = {}) {
        if (!this.initialized) return;
        this.musicPlayer.play(key, options.fadeInDuration);
    }

    stopMusic(fadeOutDuration = 2000) {
        if (!this.initialized) return;
        this.musicPlayer.stop(fadeOutDuration);
    }

    setVolume(category, value) {
        this.mixer.setVolume(category, value);
        this.musicPlayer.updateVolume();
        this.sfxPlayer.updateVolumes();
    }

    getVolume(category) {
        return this.mixer.getVolume(category);
    }

    toggleMute() {
        const isMuted = this.mixer.toggleMute();
        this.musicPlayer.updateVolume();
        this.sfxPlayer.updateVolumes();
        return isMuted;
    }

    duckMusic() {
        this.mixer.requestDuck();
        this.musicPlayer.updateVolume();
    }

    unduckMusic() {
        this.mixer.releaseDuck();
        this.musicPlayer.updateVolume();
    }

    updateListener(x, y, z) {
        if (this.spatial) {
            this.spatial.updateListener(x, y, z);
        }
    }

    async resumeContext() {
        if (this.spatial) {
            await this.spatial.resume();
        }
    }

    tryPlayMusic() {
        this.resumeContext();
        if (this.musicStarted) return;

        // Start default music
        this.playMusic('bgm_peaceful', { fadeInDuration: 2000 });
        this.musicStarted = true;
    }
}

export const soundManager = new SoundManager();