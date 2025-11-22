/**
 * @module SoundManager (REFACTORED)
 * @description Professional audio management system
 */

export default class SoundManager {
    constructor() {
        this.sounds = {};
        this.categories = {
            music: [],
            sfx_combat: [],
            sfx_ui: [],
            sfx_gather: [],
            sfx_building: [],
            ambient: [],
            voice: []
        };

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
        this.currentMusic = null;
        this.isDucking = false;
        this.duckAmount = 0.3;

        this.audioPools = {};
        this.activeInstances = [];
        this.variations = {};

        // Spatial audio
        this.audioContext = null;
        this.listener = null;

        this.loadVolumeSettings();
    }

    init() {
        // Initialize spatial audio
        this.initSpatialAudio();

        // Load music


        this.load('bgm_peaceful', 'assets/sounds/music/theme.mp3', {
            category: 'music',
            loop: true,
            baseVolume: 0.6
        });

        this.load('bgm_battle', 'assets/sounds/music/theme.mp3', {
            category: 'music',
            loop: true,
            baseVolume: 0.7
        });

        // Combat SFX with variations
        this.loadVariation('attack_sword', [
            'assets/sounds/sfx/sword1.mp3',
            'assets/sounds/sfx/sword2.mp3',
            'assets/sounds/sfx/sword3.mp3'
        ], { category: 'sfx_combat', baseVolume: 0.7 });

        this.loadVariation('attack_bow', [
            'assets/sounds/sfx/bow1.mp3',
            'assets/sounds/sfx/bow2.mp3'
        ], { category: 'sfx_combat', baseVolume: 0.6 });

        // UI SFX
        this.load('select_unit', 'assets/sounds/sfx/select.mp3', {
            category: 'sfx_ui',
            baseVolume: 0.5
        });

        this.load('command_move', 'assets/sounds/sfx/move.mp3', {
            category: 'sfx_ui',
            baseVolume: 0.6
        });

        this.load('command_attack', 'assets/sounds/sfx/attack_cmd.mp3', {
            category: 'sfx_ui',
            baseVolume: 0.6
        });

        // Gathering
        this.load('gather_gold', 'assets/sounds/sfx/gather_gold.mp3', {
            category: 'sfx_gather',
            baseVolume: 0.5
        });

        this.load('gather_wood', 'assets/sounds/sfx/wood.mp3', {
            category: 'sfx_gather',
            baseVolume: 0.5
        });

        // Building
        this.load('build_start', 'assets/sounds/sfx/build_start.mp3', {
            category: 'sfx_building',
            baseVolume: 0.6
        });

        this.load('build_complete', 'assets/sounds/sfx/build_complete.mp3', {
            category: 'sfx_building',
            baseVolume: 0.7
        });

        this.load('building_destroyed', 'assets/sounds/sfx/destroyed.mp3', {
            category: 'sfx_building',
            baseVolume: 0.8
        });

        // Ambient
        this.load('ambient_forest', 'assets/sounds/ambient/forest.mp3', {
            category: 'ambient',
            loop: true,
            baseVolume: 0.3
        });

        this.load('ambient_wind', 'assets/sounds/ambient/wind.mp3', {
            category: 'ambient',
            loop: true,
            baseVolume: 0.2
        });

        this.load('ambient_birds', 'assets/sounds/ambient/birds.mp3', {
            category: 'ambient',
            loop: true,
            baseVolume: 0.25
        });

        // Voice lines with variations
        this.loadVariation('voice_yes', [
            'assets/sounds/voice/yes1.mp3',
            'assets/sounds/voice/yes2.mp3',
            'assets/sounds/voice/yes3.mp3'
        ], { category: 'voice', baseVolume: 0.8 });

        this.loadVariation('voice_attack', [
            'assets/sounds/voice/attack1.mp3',
            'assets/sounds/voice/attack2.mp3'
        ], { category: 'voice', baseVolume: 0.8 });

        this.load('voice_not_enough_gold', 'assets/sounds/voice/not_enough_gold.mp3', {
            category: 'voice',
            baseVolume: 0.8
        });

        this.load('voice_construction_complete', 'assets/sounds/voice/construction_complete.mp3', {
            category: 'voice',
            baseVolume: 0.8
        });

        this.load('voice_under_attack', 'assets/sounds/voice/under_attack.mp3', {
            category: 'voice',
            baseVolume: 0.9
        });

        // Pre-create pools for frequently used sounds
        ['attack_sword_0', 'attack_bow_0', 'select_unit', 'command_move'].forEach(key => {
            this.createPool(key, 8);
        });

        console.log('✅ SoundManager initialized with', Object.keys(this.sounds).length, 'sounds');
    }

    // ========================================
    // LOADING
    // ========================================
    load(key, path, options = {}) {
        const {
            category = 'sfx_ui',
            loop = false,
            baseVolume = 0.8,
            fadeIn = 0,
            fadeOut = 0
        } = options;

        const audio = new Audio(path);
        audio.loop = loop;
        audio.volume = 0; // Start at 0
        audio.category = category;
        audio.baseVolume = baseVolume;
        audio.fadeIn = fadeIn;
        audio.fadeOut = fadeOut;
        audio.preload = 'auto';

        audio.onerror = () => {
            console.warn(`🔇 Sound file not found: ${path}`);
        };

        this.sounds[key] = audio;

        // Add to category
        if (!this.categories[category]) {
            this.categories[category] = [];
        }
        this.categories[category].push(key);

        // Set initial volume
        this.updateSoundVolume(audio);
    }

    loadVariation(baseKey, paths, options = {}) {
        paths.forEach((path, index) => {
            const key = `${baseKey}_${index}`;
            this.load(key, path, options);
        });

        // Store variation info
        this.variations[baseKey] = paths.map((_, i) => `${baseKey}_${i}`);
    }

    // ========================================
    // PLAYBACK
    // ========================================
    play(key, options = {}) {
        if (this.isMuted) return;

        // Check for variations
        if (this.variations[key]) {
            const variants = this.variations[key];
            key = variants[Math.floor(Math.random() * variants.length)];
        }

        const sound = this.sounds[key];
        if (!sound) {
            console.warn(`Sound not found: ${key}`);
            return;
        }

        const {
            duck = false,
            priority = 0,
            maxInstances = 5,
            volume = 1.0, // Multiplier
            pitch = 1.0,  // Playback rate
            delay = 0
        } = options;

        // Delay if needed
        if (delay > 0) {
            setTimeout(() => this.play(key, { ...options, delay: 0 }), delay);
            return;
        }

        // Ducking
        if (duck) {
            this.duckMusic();
        }

        // Play
        if (sound.loop) {
            // Music/Ambient - use original
            if (sound.paused) {
                sound.volume = sound.baseVolume * this.volumes[sound.category] * this.volumes.master * volume;
                sound.playbackRate = pitch;
                sound.play().catch(e => console.warn('Play failed', e));
            }
        } else {
            // SFX - use pool
            if (this.countActiveInstances(key) >= maxInstances) {
                return; // Too many instances
            }

            const pooled = this.getFromPool(key);
            pooled.volume = sound.baseVolume * this.volumes[sound.category] * this.volumes.master * volume;
            pooled.playbackRate = pitch;
            pooled.play().catch(e => { });

            // Track instance
            this.activeInstances.push({ key, audio: pooled, timestamp: Date.now() });

            // Auto-unduck when done
            if (duck) {
                pooled.addEventListener('ended', () => {
                    this.unduckMusic();
                }, { once: true });
            }
        }
    }

    playSpatial(key, x, y, options = {}) {
        if (this.isMuted) return;

        // If no spatial audio support, fallback
        if (!this.audioContext) {
            this.play(key, options);
            return;
        }

        // Check for variations
        if (this.variations[key]) {
            const variants = this.variations[key];
            key = variants[Math.floor(Math.random() * variants.length)];
        }

        const sound = this.sounds[key];
        if (!sound) return;

        const {
            maxDistance = 50,
            rolloffFactor = 1,
            volume = 1.0
        } = options;

        try {
            // Create nodes
            const pooled = this.getFromPool(key);
            const source = this.audioContext.createMediaElementSource(pooled);
            const panner = this.audioContext.createPanner();
            const gainNode = this.audioContext.createGain();

            // Configure panner
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = maxDistance;
            panner.rolloffFactor = rolloffFactor;

            // Set position
            panner.positionX.setValueAtTime(x, this.audioContext.currentTime);
            panner.positionY.setValueAtTime(y, this.audioContext.currentTime);
            panner.positionZ.setValueAtTime(0, this.audioContext.currentTime);

            // Connect
            source.connect(panner);
            panner.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Set volume
            const finalVolume = sound.baseVolume * this.volumes[sound.category] * this.volumes.master * volume;
            gainNode.gain.setValueAtTime(finalVolume, this.audioContext.currentTime);

            // Play
            pooled.play().catch(e => { });

            return { source, panner, gainNode };
        } catch (e) {
            console.warn('Spatial audio failed, using fallback', e);
            this.play(key, options);
        }
    }

    playMusic(key, options = {}) {
        const {
            fadeOutDuration = 2000,
            fadeInDuration = 2000,
            immediate = false
        } = options;

        const newMusic = this.sounds[key];
        if (!newMusic) {
            console.warn(`Music not found: ${key}`);
            return;
        }

        // Already playing
        if (this.currentMusic === newMusic && !this.currentMusic.paused) {
            return;
        }

        if (immediate) {
            // Immediate switch
            if (this.currentMusic) {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
            }

            newMusic.volume = newMusic.baseVolume * this.volumes.music * this.volumes.master;
            newMusic.play().catch(e => { });
            this.currentMusic = newMusic;
        } else {
            // Crossfade
            if (this.currentMusic && !this.currentMusic.paused) {
                this.fadeOut(this.currentMusic, fadeOutDuration);
            }

            this.fadeIn(newMusic, fadeInDuration);
            this.currentMusic = newMusic;
        }
    }

    stopMusic(fadeOutDuration = 2000) {
        if (this.currentMusic) {
            if (fadeOutDuration > 0) {
                this.fadeOut(this.currentMusic, fadeOutDuration);
            } else {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
            }
            this.currentMusic = null;
        }
    }

    stopAll(category = null) {
        if (category) {
            // Stop specific category
            if (this.categories[category]) {
                this.categories[category].forEach(key => {
                    const sound = this.sounds[key];
                    if (sound && !sound.paused) {
                        sound.pause();
                        sound.currentTime = 0;
                    }
                });
            }
        } else {
            // Stop everything
            Object.values(this.sounds).forEach(sound => {
                sound.pause();
                sound.currentTime = 0;
            });

            this.currentMusic = null;
        }
    }

    // ========================================
    // VOLUME CONTROL
    // ========================================
    setVolume(category, value) {
        this.volumes[category] = Math.max(0, Math.min(1, value));
        this.updateAllVolumes();
        this.saveVolumeSettings();
    }

    getVolume(category) {
        return this.volumes[category] || 1.0;
    }

    updateAllVolumes() {
        Object.entries(this.sounds).forEach(([key, sound]) => {
            this.updateSoundVolume(sound);
        });
    }

    updateSoundVolume(sound) {
        const categoryVolume = this.volumes[sound.category] || this.volumes.sfx_ui;
        sound.volume = sound.baseVolume * categoryVolume * this.volumes.master;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;

        if (this.isMuted) {
            // Mute all
            this.volumesBeforeMute = { ...this.volumes };
            Object.keys(this.volumes).forEach(key => {
                this.volumes[key] = 0;
            });
        } else {
            // Restore
            this.volumes = { ...this.volumesBeforeMute };
        }

        this.updateAllVolumes();
        this.saveVolumeSettings();

        return this.isMuted;
    }

    loadVolumeSettings() {
        try {
            const saved = localStorage.getItem('audioSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.volumes = { ...this.volumes, ...settings };
            }
        } catch (e) {
            console.warn('Failed to load audio settings', e);
        }
    }

    saveVolumeSettings() {
        try {
            localStorage.setItem('audioSettings', JSON.stringify(this.volumes));
        } catch (e) {
            console.warn('Failed to save audio settings', e);
        }
    }

    // ========================================
    // DUCKING
    // ========================================
    duckMusic() {
        if (this.isDucking) return;

        this.isDucking = true;

        this.categories.music.forEach(key => {
            const sound = this.sounds[key];
            if (sound && !sound.paused) {
                this.fadeTo(sound, sound.volume * this.duckAmount, 300);
            }
        });

        // Auto-unduck after 3s (safety)
        setTimeout(() => {
            if (this.isDucking) this.unduckMusic();
        }, 3000);
    }

    unduckMusic() {
        if (!this.isDucking) return;

        this.isDucking = false;

        this.categories.music.forEach(key => {
            const sound = this.sounds[key];
            if (sound && !sound.paused) {
                const targetVolume = sound.baseVolume * this.volumes.music * this.volumes.master;
                this.fadeTo(sound, targetVolume, 500);
            }
        });
    }

    // ========================================
    // FADING
    // ========================================
    fadeIn(audio, duration = 1000) {
        const targetVolume = audio.baseVolume * this.volumes[audio.category] * this.volumes.master;
        audio.volume = 0;
        audio.play().catch(e => { });
        this.fadeTo(audio, targetVolume, duration);
    }

    fadeOut(audio, duration = 1000, onComplete = null) {
        this.fadeTo(audio, 0, duration, () => {
            audio.pause();
            audio.currentTime = 0;
            if (onComplete) onComplete();
        });
    }

    fadeTo(audio, targetVolume, duration, onComplete = null) {
        if (!audio) return;

        const startVolume = audio.volume;
        const volumeDiff = targetVolume - startVolume;
        const startTime = Date.now();

        const fade = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            audio.volume = startVolume + (volumeDiff * progress);

            if (progress < 1) {
                requestAnimationFrame(fade);
            } else {
                audio.volume = targetVolume;
                if (onComplete) onComplete();
            }
        };

        requestAnimationFrame(fade);
    }

    // ========================================
    // AUDIO POOLING
    // ========================================
    createPool(key, size = 5) {
        const sound = this.sounds[key];
        if (!sound) return;

        this.audioPools[key] = [];

        for (let i = 0; i < size; i++) {
            const clone = sound.cloneNode();
            clone.volume = sound.volume;
            clone.category = sound.category;
            clone.baseVolume = sound.baseVolume;
            clone.inUse = false;

            clone.addEventListener('ended', () => {
                clone.inUse = false;
                clone.currentTime = 0;
            });

            this.audioPools[key].push(clone);
        }
    }

    getFromPool(key) {
        if (!this.audioPools[key]) {
            this.createPool(key, 5);
        }

        const pool = this.audioPools[key];

        // Find available
        let available = pool.find(audio => !audio.inUse);

        // If all busy, reuse oldest
        if (!available) {
            available = pool[0];
            available.pause();
            available.currentTime = 0;
        }

        available.inUse = true;
        return available;
    }

    countActiveInstances(key) {
        return this.activeInstances.filter(i => i.key === key).length;
    }

    // ========================================
    // SPATIAL AUDIO
    // ========================================
    initSpatialAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.listener = this.audioContext.listener;

            // Default listener position
            this.updateListenerPosition(0, 0, 0);

            console.log('✅ Spatial audio initialized');
        } catch (e) {
            console.warn('⚠️ Spatial audio not supported', e);
        }
    }

    updateListenerPosition(x, y, z = 0) {
        if (!this.listener) return;

        try {
            this.listener.positionX.setValueAtTime(x, this.audioContext.currentTime);
            this.listener.positionY.setValueAtTime(y, this.audioContext.currentTime);
            this.listener.positionZ.setValueAtTime(z, this.audioContext.currentTime);
        } catch (e) {
            // Fallback for older browsers
            this.listener.setPosition(x, y, z);
        }
    }

    // ========================================
    // UTILITY
    // ========================================
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('🔊 AudioContext resumed');
            } catch (e) {
                console.warn('Failed to resume AudioContext', e);
            }
        }
    }

    tryPlayMusic() {
        this.resumeContext();

        if (this.musicStarted) return;

        const bgm = this.sounds['bgm_menu'] || this.sounds['bgm_peaceful'];
        if (bgm) {
            bgm.play().then(() => {
                this.musicStarted = true;
                this.currentMusic = bgm;
                console.log('🎵 Background music started');
            }).catch(e => {
                // console.warn('⏸️ Autoplay prevented. Waiting for user interaction.');
            });
        }
    }

    preload(keys) {
        // Force preload specific sounds
        keys.forEach(key => {
            const sound = this.sounds[key];
            if (sound) {
                sound.load();
            }
        });
    }

    getStats() {
        return {
            totalSounds: Object.keys(this.sounds).length,
            categories: Object.entries(this.categories).map(([name, keys]) => ({
                name,
                count: keys.length
            })),
            activeInstances: this.activeInstances.length,
            poolsCreated: Object.keys(this.audioPools).length,
            currentMusic: this.currentMusic ? 'Playing' : 'None',
            volumes: this.volumes,
            isMuted: this.isMuted,
            spatialAudioEnabled: !!this.audioContext
        };
    }
}

export const soundManager = new SoundManager();