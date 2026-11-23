/**
 * Web Audio API Sound Synthesizer for Turbo Poyga
 * Generates all sounds dynamically without external audio assets.
 */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Continuous sound nodes
    this.engineOsc = null;
    this.engineGain = null;
    this.skidSource = null;
    this.skidGain = null;
    this.nitroGain = null;
    this.nitroOsc = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.setupEngineSound();
      this.setupSkidSound();
      this.setupNitroSound();
      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  ensureContext() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime);
    }
    if (this.skidGain) {
      this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (this.nitroGain) {
      this.nitroGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Engine loop generator
  setupEngineSound() {
    if (!this.ctx) return;
    
    // Low frequency sawtooth for deep rumble
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Filter to soften the harshness of sawtooth
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
  }

  // Tire screech / drift noise generator
  setupSkidSound() {
    if (!this.ctx) return;

    // 1-second white noise buffer
    const bufferSize = this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.skidSource = this.ctx.createBufferSource();
    this.skidSource.buffer = noiseBuffer;
    this.skidSource.loop = true;

    // Bandpass filter to make it sound like tire friction
    this.skidFilter = this.ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.setValueAtTime(900, this.ctx.currentTime);
    this.skidFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.skidSource.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.ctx.destination);

    this.skidSource.start();
  }

  // Nitro rocket whoosh sound
  setupNitroSound() {
    if (!this.ctx) return;

    this.nitroOsc = this.ctx.createOscillator();
    this.nitroOsc.type = 'triangle';
    this.nitroOsc.frequency.setValueAtTime(220, this.ctx.currentTime);

    this.nitroGain = this.ctx.createGain();
    this.nitroGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.nitroOsc.connect(this.nitroGain);
    this.nitroGain.connect(this.ctx.destination);

    this.nitroOsc.start();
  }

  // Update dynamic engine sound in game loop
  updateEngine(speedRatio, isAccelerating, isBraking) {
    if (this.isMuted || !this.ctx || !this.engineOsc) return;

    const t = this.ctx.currentTime;
    const targetFreq = 40 + speedRatio * 180 + (isAccelerating ? 25 : 0);
    const targetFilter = 220 + speedRatio * 850;
    const targetGain = 0.05 + speedRatio * 0.12 + (isAccelerating ? 0.04 : 0);

    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.06);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.06);
  }

  // Update tire skid sound
  updateSkid(isSkidding, intensity = 1.0) {
    if (this.isMuted || !this.ctx || !this.skidGain) return;
    const t = this.ctx.currentTime;
    const targetGain = isSkidding ? Math.min(0.2, 0.08 * intensity) : 0;
    this.skidGain.gain.setTargetAtTime(targetGain, t, 0.05);
  }

  // Update nitro sound
  updateNitro(isNitroActive) {
    if (this.isMuted || !this.ctx || !this.nitroGain) return;
    const t = this.ctx.currentTime;
    const targetGain = isNitroActive ? 0.14 : 0;
    this.nitroGain.gain.setTargetAtTime(targetGain, t, 0.08);
    if (isNitroActive && this.nitroOsc) {
      this.nitroOsc.frequency.setTargetAtTime(380 + Math.random() * 40, t, 0.05);
    }
  }

  // Crash / Impact sound
  playCrash(intensity = 1.0) {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    const vol = Math.min(0.35, 0.15 * intensity);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Countdown beep: low beep for 3, 2, 1; high beep for GO!
  playCountdownBeep(isGo = false) {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = isGo ? 880 : 440;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.6 : 0.25));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + (isGo ? 0.65 : 0.28));
  }

  // Lap completed chime
  playLapChime() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, index) => {
      const t = this.ctx.currentTime + index * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  // Victory Fanfare
  playVictoryFanfare() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const notes = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.5 }  // C6
    ];

    let delay = 0;
    notes.forEach(note => {
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + note.d + 0.05);

      delay += note.d * 0.9;
    });
  }

  stopAll() {
    if (this.engineGain) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    if (this.skidGain) this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);
    if (this.nitroGain) this.nitroGain.gain.setValueAtTime(0, this.ctx.currentTime);
  }
}

// Global audio instance
window.audioManager = new SoundManager();
