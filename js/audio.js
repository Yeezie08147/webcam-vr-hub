/**
 * AudioEngine - Procedural Web Audio API Sound Synthesizer
 * 100% Zero external assets. Generates rich VR sound effects and procedural synthwave beats.
 */
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgmPlaying = false;
        this.bgmVolume = 0.35;
        this.sfxVolume = 0.7;
        this.bgmMaster = null;
        this.sfxMaster = null;
        this.bgmTimer = null;
        this.currentStep = 0;
        this.isMuted = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.bgmMaster = this.ctx.createGain();
        this.bgmMaster.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);

        this.sfxMaster = this.ctx.createGain();
        this.sfxMaster.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);

        this.bgmMaster.connect(this.ctx.destination);
        this.sfxMaster.connect(this.ctx.destination);

        this.initialized = true;
    }

    ensureContext() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setBgmVolume(val) {
        this.bgmVolume = Math.max(0, Math.min(1, val));
        if (this.bgmMaster && this.ctx) {
            this.bgmMaster.gain.setValueAtTime(this.isMuted ? 0 : this.bgmVolume, this.ctx.currentTime);
        }
    }

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        if (this.sfxMaster && this.ctx) {
            this.sfxMaster.gain.setValueAtTime(this.isMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.bgmMaster && this.sfxMaster && this.ctx) {
            this.bgmMaster.gain.setValueAtTime(this.isMuted ? 0 : this.bgmVolume, this.ctx.currentTime);
            this.sfxMaster.gain.setValueAtTime(this.isMuted ? 0 : this.sfxVolume, this.ctx.currentTime);
        }
        return this.isMuted;
    }

    /* ---------------- SFX METHODS ---------------- */

    playUiHover() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.07);
    }

    playUiClick() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(1040, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playSaberSwing(speed = 1.0) {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const duration = Math.max(0.12, 0.28 / speed);

        // Noise buffer for whoosh
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(1400 * Math.min(speed, 2.5), now + duration * 0.4);
        filter.frequency.exponentialRampToValueAtTime(400, now + duration);
        filter.Q.value = 3.5;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.3 * Math.min(speed, 1.8), now + duration * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // Sine base
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.linearRampToValueAtTime(180, now + duration * 0.4);
        osc.frequency.linearRampToValueAtTime(100, now + duration);

        oscGain.gain.setValueAtTime(0.15, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxMaster);

        osc.connect(oscGain);
        oscGain.connect(this.sfxMaster);

        noise.start(now);
        osc.start(now);
        noise.stop(now + duration);
        osc.stop(now + duration);
    }

    playSaberHit(isRightHand = true) {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        // Punchy resonant clash
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        const baseFreq = isRightHand ? 440 : 330;
        osc1.frequency.setValueAtTime(baseFreq * 2.2, now);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.18);

        osc2.frequency.setValueAtTime(baseFreq * 3.1, now);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.15);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxMaster);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.23);
        osc2.stop(now + 0.23);
    }

    playFruitSlice() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxMaster);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    playBombExplosion() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const duration = 0.8;

        // Sub bass drop
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(25, now + duration);

        subGain.gain.setValueAtTime(0.7, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        sub.connect(subGain);
        subGain.connect(this.sfxMaster);

        // Noise rumble
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + duration);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxMaster);

        sub.start(now);
        noise.start(now);
        sub.stop(now + duration);
        noise.stop(now + duration);
    }

    playFireballCast() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.36);
    }

    playLightning() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.setValueAtTime(320, now + 0.04);
        osc.frequency.setValueAtTime(2400, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.22);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    playShield() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        [440, 554, 659].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(this.sfxMaster);
            osc.start(now);
            osc.stop(now + 0.5);
        });
    }

    playDodgeWhoosh() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.33);
    }

    playBulletTime(enable = true) {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(enable ? 400 : 150, now);
        osc.frequency.exponentialRampToValueAtTime(enable ? 120 : 500, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.45);
    }

    playPunchImpact(power = 1.0) {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const p = Math.min(2.0, Math.max(0.4, power));

        // Sub thud
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120 * p, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + 0.18);
        subGain.gain.setValueAtTime(0.5 * p, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        sub.connect(subGain);
        subGain.connect(this.sfxMaster);

        // Leather slap / crack
        const noiseBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.1), this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.Q.value = 2.0;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4 * p, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxMaster);

        sub.start(now);
        noise.start(now);
        sub.stop(now + 0.22);
        noise.stop(now + 0.1);
    }

    playBoxingBell() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const freqs = [1568, 2093, 3136];
        freqs.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now);
            gain.gain.setValueAtTime(0.18 / (i + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(this.sfxMaster);
            osc.start(now);
            osc.stop(now + 1.3);
        });
    }

    playGlassShatter() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        [2400, 3100, 3950, 4800].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.015);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.15 + idx * 0.02);

            gain.gain.setValueAtTime(0.12, now + idx * 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(this.sfxMaster);
            osc.start(now + idx * 0.015);
            osc.stop(now + 0.3);
        });
    }

    playTimeFreeze(freeze = true) {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freeze ? 600 : 200, now);
        osc.frequency.exponentialRampToValueAtTime(freeze ? 120 : 700, now + 0.25);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    /* ---------------- HOLE IN THE WALL SFX ---------------- */

    playWallApproach(progress = 0) {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        const startFreq = 80 + progress * 140;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(startFreq + 60, now + 0.08);

        gain.gain.setValueAtTime(0.06 + progress * 0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playWallPass() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        // Bright multi-tone victory chime (E5, G#5, B5, E6)
        const notes = [659.25, 830.61, 987.77, 1318.51];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.04);

            gain.gain.setValueAtTime(0.18, now + idx * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(this.sfxMaster);
            osc.start(now + idx * 0.04);
            osc.stop(now + 0.5);
        });

        // Glass shatter noise burst
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'highpass';
        nFilter.frequency.setValueAtTime(3500, now);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.15, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.sfxMaster);
        noise.start(now);
    }

    playWallCrash() {
        this.ensureContext();
        if (this.isMuted) return;
        const now = this.ctx.currentTime;

        // Low heavy impact thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(gain);
        gain.connect(this.sfxMaster);
        osc.start(now);
        osc.stop(now + 0.4);

        // Harsh buzzer buzz
        const buzz = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        buzz.type = 'sawtooth';
        buzz.frequency.setValueAtTime(140, now);
        buzz.frequency.setValueAtTime(110, now + 0.15);
        bGain.gain.setValueAtTime(0.25, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        buzz.connect(bGain);
        bGain.connect(this.sfxMaster);
        buzz.start(now);
        buzz.stop(now + 0.36);
    }

    /* ---------------- PROCEDURAL SYNTHWAVE BGM ---------------- */

    startBgm() {
        this.ensureContext();
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;
        this.currentStep = 0;

        const bpm = 124;
        const stepTime = (60 / bpm) / 4; // 16th notes

        const bassNotes = [
            110, 110, 220, 110,
            110, 110, 164.8, 110,
            98, 98, 196, 98,
            87.3, 87.3, 174.6, 130.8
        ];

        const leadNotes = [
            440, 523.25, 659.25, 880,
            523.25, 659.25, 880, 1046.5,
            392, 493.88, 587.33, 783.99,
            349.23, 440, 523.25, 659.25
        ];

        const step = () => {
            if (!this.bgmPlaying) return;

            const now = this.ctx.currentTime;
            const idx = this.currentStep % 16;

            // Kick
            if (idx % 4 === 0) {
                const kick = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kick.type = 'sine';
                kick.frequency.setValueAtTime(150, now);
                kick.frequency.exponentialRampToValueAtTime(35, now + 0.12);

                kickGain.gain.setValueAtTime(0.35, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

                kick.connect(kickGain);
                kickGain.connect(this.bgmMaster);
                kick.start(now);
                kick.stop(now + 0.15);
            }

            // Snare
            if (idx === 4 || idx === 12) {
                const snareOsc = this.ctx.createOscillator();
                const snareGain = this.ctx.createGain();
                snareOsc.type = 'triangle';
                snareOsc.frequency.setValueAtTime(220, now);
                snareGain.gain.setValueAtTime(0.18, now);
                snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                snareOsc.connect(snareGain);
                snareGain.connect(this.bgmMaster);
                snareOsc.start(now);
                snareOsc.stop(now + 0.1);
            }

            // Hi-Hat
            if (idx % 2 === 1) {
                const hatGain = this.ctx.createGain();
                hatGain.gain.setValueAtTime(0.04, now);
                hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                
                const hatOsc = this.ctx.createOscillator();
                hatOsc.type = 'sawtooth';
                hatOsc.frequency.setValueAtTime(8000, now);
                hatOsc.connect(hatGain);
                hatGain.connect(this.bgmMaster);
                hatOsc.start(now);
                hatOsc.stop(now + 0.05);
            }

            // Synth Bassline
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            const bassFilter = this.ctx.createBiquadFilter();

            bassOsc.type = 'sawtooth';
            bassOsc.frequency.setValueAtTime(bassNotes[idx], now);

            bassFilter.type = 'lowpass';
            bassFilter.frequency.setValueAtTime(800, now);
            bassFilter.frequency.exponentialRampToValueAtTime(250, now + stepTime * 0.9);

            bassGain.gain.setValueAtTime(0.16, now);
            bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.9);

            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(this.bgmMaster);

            bassOsc.start(now);
            bassOsc.stop(now + stepTime);

            // Lead Melody
            if (idx % 2 === 0) {
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                leadOsc.type = 'sine';
                leadOsc.frequency.setValueAtTime(leadNotes[idx], now);

                leadGain.gain.setValueAtTime(0.08, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 1.5);

                leadOsc.connect(leadGain);
                leadGain.connect(this.bgmMaster);
                leadOsc.start(now);
                leadOsc.stop(now + stepTime * 1.5);
            }

            this.currentStep++;
            this.bgmTimer = setTimeout(step, stepTime * 1000);
        };

        step();
    }

    stopBgm() {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

// Global instance
window.soundFx = new AudioEngine();
