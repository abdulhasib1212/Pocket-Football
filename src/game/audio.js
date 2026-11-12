/**
 * Procedural Web Audio Sound Synthesizer
 * Zero external audio assets; lightweight, low-latency, and clean.
 * Strictly natural football audio: punchy leather kicks, turf passes, and crisp whistles.
 * No buzzing sawtooth or continuous hiss!
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    
    // Volume controls (0.0 to 1.0)
    this.masterVolume = 0.8;
    this.sfxVolume = 0.9;
    this.isMuted = false;

    // Gain nodes for audio routing
    this.masterGainNode = null;
    this.sfxGainNode = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        
        // Setup audio routing graph
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGainNode.connect(this.ctx.destination);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGainNode && this.ctx && !this.isMuted) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setCrowdVolume() {}

  toggleSound() {
    this.isMuted = !this.isMuted;
    this.enabled = !this.isMuted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.05
      );
    }
    return !this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    this.enabled = !this.isMuted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  startCrowdAmbience() {}
  stopCrowdAmbience() {}
  swellCrowd() {}

  // --- Natural Authentic Football Sound Effects ---

  /**
   * Powerful, deep leather strike when shooting
   */
  playShoot(charge = 0.5) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      const chargeNorm = Math.max(0, Math.min(1, charge));

      // 1. Primary leather ball impact (warm triangle wave drop)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();

      const startFreq = 120 + chargeNorm * 30; // 120Hz to 150Hz
      const endFreq = 36;

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(startFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(endFreq, now + 0.1);

      const impactVol = 0.35 + chargeNorm * 0.25;
      gain1.gain.setValueAtTime(impactVol, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc1.connect(gain1);
      gain1.connect(this.sfxGainNode);

      osc1.start(now);
      osc1.stop(now + 0.12);

      // 2. Sub-bass boom on powerful shots
      if (chargeNorm > 0.4) {
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(75, now);
        subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.08);

        subGain.gain.setValueAtTime(0.28 * chargeNorm, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        subOsc.connect(subGain);
        subGain.connect(this.sfxGainNode);

        subOsc.start(now);
        subOsc.stop(now + 0.1);
      }
    } catch (e) {}
  }

  /**
   * Crisp, standard kick impact
   */
  playKick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  /**
   * Crisp, snappy ground pass
   */
  playPass() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.07);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  /**
   * Subtle, natural ball snatch / tackle interception
   * Clean low turf thud - no buzzing sawtooth!
   */
  playTackle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Soft low-frequency foot-to-ball displacement
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.06);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  playPostClank() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      [1020, 1480].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(now);
        osc.stop(now + 0.23);
      });
    } catch (e) {}
  }

  playTap() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  playWhistle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      const freqs = [2850, 3180];
      freqs.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.setValueAtTime(freq + 40, now + 0.08);
        osc.frequency.setValueAtTime(freq - 30, now + 0.16);
        osc.frequency.setValueAtTime(freq + 20, now + 0.24);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
        gain.gain.setValueAtTime(0.22, now + 0.26);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.34);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(now);
        osc.stop(now + 0.35);
      });
    } catch (e) {}
  }

  playFullTimeWhistle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const blasts = [
        { delay: 0.0, duration: 0.2 },
        { delay: 0.28, duration: 0.2 },
        { delay: 0.58, duration: 0.65 }
      ];

      const freqs = [2850, 3180];

      blasts.forEach((blast) => {
        freqs.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const startTime = this.ctx.currentTime + blast.delay;
          const endTime = startTime + blast.duration;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          osc.frequency.setValueAtTime(freq + 35, startTime + blast.duration * 0.4);

          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
          gain.gain.setValueAtTime(0.22, endTime - 0.04);
          gain.gain.linearRampToValueAtTime(0.001, endTime);

          osc.connect(gain);
          gain.connect(this.sfxGainNode);

          osc.start(startTime);
          osc.stop(endTime + 0.01);
        });
      });
    } catch (e) {}
  }

  playGoalChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.26, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(t);
        osc.stop(t + 0.46);
      });
    } catch (e) {}
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.04);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
}
