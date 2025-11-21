/**
 * @module SoundManager
 * @description Manages audio playback for the game
 * 
 * Features:
 * - Preloading of sound assets
 * - Background music playback (looping)
 * - Sound effects playback (one-shot)
 * - Volume control (placeholder)
 */

export default class SoundManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.isMuted = false;
    }

    init() {
        // Placeholder for loading sounds
        // In a real scenario, we would load files here.
        // Since we don't have files, we'll just log for now or try to load if files existed.

        this.load('bgm', 'assets/sounds/music/theme.mp3', true);
        this.load('select_unit', 'assets/sounds/sfx/select_unit.mp3');
        this.load('command_move', 'assets/sounds/sfx/command_move.mp3');
        this.load('command_attack', 'assets/sounds/sfx/command_attack.mp3');
        this.load('attack_sword', 'assets/sounds/sfx/attack_sword.mp3');
        this.load('attack_bow', 'assets/sounds/sfx/attack_bow.mp3');
        this.load('build_start', 'assets/sounds/sfx/build_start.mp3');
        this.load('build_complete', 'assets/sounds/sfx/build_complete.mp3');
        this.load('gather_gold', 'assets/sounds/sfx/gather_gold.mp3');
        this.load('gather_wood', 'assets/sounds/sfx/gather_wood.mp3');
    }

    load(key, path, isMusic = false) {
        const audio = new Audio(path);
        if (isMusic) {
            audio.loop = true;
            audio.volume = 0.5;
        } else {
            audio.volume = 0.8;
        }

        // Add error handling so the game doesn't crash if files are missing
        audio.onerror = () => {
            console.warn(`Sound file not found: ${path}`);
        };

        this.sounds[key] = audio;
    }

    play(key) {
        if (this.isMuted) return;
        const sound = this.sounds[key];
        if (sound) {
            // Clone for overlapping sounds (except music)
            if (sound.loop) {
                if (sound.paused) sound.play().catch(e => console.warn("Audio play failed", e));
            } else {
                const clone = sound.cloneNode();
                clone.volume = sound.volume;
                clone.play().catch(e => { }); // Ignore errors (e.g. no user interaction yet)
            }
        }
    }

    stopMusic(key) {
        const sound = this.sounds[key];
        if (sound && sound.loop) {
            sound.pause();
            sound.currentTime = 0;
        }
    }

    tryPlayMusic() {
        if (this.musicStarted) return;

        const bgm = this.sounds['bgm'];
        if (bgm) {
            bgm.play().then(() => {
                this.musicStarted = true;
                console.log("Background music started.");
            }).catch(e => {
                console.warn("Autoplay prevented. Waiting for interaction.", e);
            });
        }
    }
}

export const soundManager = new SoundManager();
