/**
 * Procedural Web Audio Music, Crowd Atmosphere & Sound Effects Synthesizer
 * Zero external audio assets; lightweight, low-latency, and clean.
 *
 * Includes:
 * - Separate Master, Music/Atmosphere, and SFX gain buses
 * - 3 distinct broadcast/presentation music tracks:
 *   - 'menu': Energetic, upbeat football-themed instrumental
 *   - 'halftime': Crisp broadcast analysis presentation music
 *   - 'fulltime': Triumphant full-time / trophy presentation anthem
 * - 3-Layer Dynamic Match Crowd & Chant Atmosphere:
 *   1. Stadium Ambience: continuous, warm pink-filtered crowd murmur that swells near goal
 *   2. Crowd Reactions: goal build-up & fade roar, saves, tackles, missed shots, final whistle
 *   3. Occasional Chants: rotating terrace chants & drum claps spaced naturally apart
 * - Natural football SFX + celebratory goal fanfare
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;

    // Volume controls (0.0 to 1.0)
    this.masterVolume = 0.8;
    this.musicVolume = 0.65;
    this.sfxVolume = 0.9;
    this.isMuted = false;

    // Gain nodes for audio routing
    this.masterGainNode = null;
    this.musicGainNode = null;
    this.musicDuckGainNode = null;
    this.crowdAtmosphereGainNode = null;
    this.sfxGainNode = null;

    // Shared noise buffers
    this.noiseBuffer = null;     // Short white noise for crisp percussion
    this.crowdLoopBuffer = null; // Seamless warm pink/brown noise for continuous crowd murmur

    // Music sequencer state (menu, halftime, fulltime)
    this.currentTrack = null; // 'menu' | 'halftime' | 'fulltime' | null
    this.schedulerId = null;
    this.nextNoteTime = 0;
    this.currentStep = 0;
    this.isMusicDucked = false;
    this.duckTimeoutId = null;

    // 3-Layer Match Crowd & Chant State
    this.isCrowdActive = false;
    this.isCrowdPaused = false;
    this.isTournamentFinal = false;
    this.smoothedDanger = 0;
    this.chantTimer = 7.5;
    this.chantHoldOffTimer = 0;
    this.lastChantIndex = -1;
    this.lastCheerTime = -10;
    this.lastMissTime = -10;

    // Active Layer 1 Web Audio nodes
    this.crowdSourceNode = null;
    this.crowdLfoNode = null;
    this.crowdLfoGainNode = null;
    this.crowdLowFilter = null;
    this.crowdBodyFilter = null;
    this.crowdLayerGain = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Setup audio routing graph:
        // sfxGainNode -------------------------------------> masterGainNode -> destination
        // musicGainNode -> musicDuckGainNode --------------> masterGainNode -> destination
        // crowdAtmosphereGainNode -> musicDuckGainNode ----> masterGainNode -> destination
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGainNode.connect(this.ctx.destination);

        this.musicDuckGainNode = this.ctx.createGain();
        this.musicDuckGainNode.gain.setValueAtTime(this.isMusicDucked ? 0.32 : 1.0, this.ctx.currentTime);
        this.musicDuckGainNode.connect(this.masterGainNode);

        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        this.musicGainNode.connect(this.musicDuckGainNode);

        this.crowdAtmosphereGainNode = this.ctx.createGain();
        this.crowdAtmosphereGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        this.crowdAtmosphereGainNode.connect(this.musicDuckGainNode);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGainNode.connect(this.masterGainNode);

        // Pre-build noise buffers
        this.noiseBuffer = this.createNoiseBuffer(0.6);
        this.crowdLoopBuffer = this.createCrowdBuffer(3.5);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (this.currentTrack && !this.isMuted && this.musicVolume > 0.005) {
          this.ensureMusicSchedulerRunning();
        }
        if (this.isCrowdActive && !this.isCrowdPaused && !this.isMuted && this.musicVolume > 0.005) {
          this.ensureCrowdNodesStarted();
        }
      }).catch(() => {});
    } else if (this.ctx) {
      if (this.currentTrack && !this.isMuted && this.musicVolume > 0.005) {
        this.ensureMusicSchedulerRunning();
      }
      if (this.isCrowdActive && !this.isCrowdPaused && !this.isMuted && this.musicVolume > 0.005) {
        this.ensureCrowdNodesStarted();
      }
    }
  }

  createNoiseBuffer(seconds = 0.5) {
    if (!this.ctx) return null;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Generates a warm, seamless pink/brownian filtered noise loop for realistic stadium murmur.
   */
  createCrowdBuffer(seconds = 3.5) {
    if (!this.ctx) return null;
    const length = Math.max(256, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let peak = 0.001;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.996 * b0 + white * 0.055;
      b1 = 0.965 * b1 + white * 0.095;
      b2 = 0.85 * b2 + white * 0.14;
      const sample = b0 * 0.55 + b1 * 0.35 + b2 * 0.1;
      data[i] = sample;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }

    // Normalize and cross-fade ends so loop boundaries are completely click-free
    const norm = 0.68 / peak;
    for (let i = 0; i < length; i++) {
      data[i] *= norm;
    }
    const fadeSamples = Math.min(Math.floor(this.ctx.sampleRate * 0.12), Math.floor(length * 0.15));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      const blended = data[i] * t + data[tailIdx] * (1 - t);
      data[i] = blended;
      data[tailIdx] = blended;
    }
    return buffer;
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, Number(val) || 0));
    if (this.masterGainNode && this.ctx && !this.isMuted) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, Number(val) || 0));
    if (this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
    if (this.crowdAtmosphereGainNode && this.ctx) {
      this.crowdAtmosphereGainNode.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
    if (this.musicVolume <= 0.005) {
      this.stopMusicScheduler();
    } else if (!this.isMuted) {
      if (this.currentTrack) {
        this.ensureMusicSchedulerRunning();
      }
      if (this.isCrowdActive && !this.isCrowdPaused) {
        this.ensureCrowdNodesStarted();
      }
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(val) || 0));
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setCrowdVolume(val) {
    this.setMusicVolume(val);
  }

  setMusicDucked(ducked) {
    this.isMusicDucked = !!ducked;
    if (this.musicDuckGainNode && this.ctx) {
      this.musicDuckGainNode.gain.setTargetAtTime(
        this.isMusicDucked ? 0.32 : 1.0,
        this.ctx.currentTime,
        0.08
      );
    }
  }

  duckMusicTemporarily(durationSec = 1.2) {
    if (!this.ctx || !this.musicDuckGainNode) return;
    if (this.duckTimeoutId) {
      clearTimeout(this.duckTimeoutId);
      this.duckTimeoutId = null;
    }
    const prevDucked = this.isMusicDucked;
    this.musicDuckGainNode.gain.setTargetAtTime(0.28, this.ctx.currentTime, 0.04);
    this.duckTimeoutId = setTimeout(() => {
      this.duckTimeoutId = null;
      if (this.musicDuckGainNode && this.ctx) {
        this.musicDuckGainNode.gain.setTargetAtTime(
          (prevDucked || this.isMusicDucked) ? 0.32 : 1.0,
          this.ctx.currentTime,
          0.18
        );
      }
    }, Math.max(200, durationSec * 1000));
  }

  toggleSound() {
    this.setMuted(!this.isMuted);
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
    if (this.isMuted) {
      this.stopMusicScheduler();
    } else if (this.musicVolume > 0.005) {
      if (this.currentTrack) {
        this.ensureMusicSchedulerRunning();
      }
      if (this.isCrowdActive && !this.isCrowdPaused) {
        this.ensureCrowdNodesStarted();
      }
    }
  }

  // =========================================================================
  // LAYER 1 & LAYER 3: STADIUM CROWD AMBIENCE & OCCASIONAL BACKGROUND CHANTS
  // =========================================================================

  getNextChantDelay(isInitial = false) {
    if (this.isTournamentFinal) {
      return isInitial ? (5.0 + Math.random() * 2.5) : (8.5 + Math.random() * 5.0);
    }
    return isInitial ? (6.5 + Math.random() * 3.5) : (11.5 + Math.random() * 6.0);
  }

  startCrowdAmbience(options = {}) {
    this.isCrowdActive = true;
    this.isCrowdPaused = false;
    this.isTournamentFinal = !!options.isTournamentFinal;
    this.smoothedDanger = 0;
    this.chantHoldOffTimer = 1.2;
    this.chantTimer = this.getNextChantDelay(true);

    if (this.ctx && this.ctx.state === 'running' && !this.isMuted && this.musicVolume > 0.005) {
      this.ensureCrowdNodesStarted();
    }
  }

  ensureCrowdNodesStarted() {
    if (!this.ctx || !this.crowdAtmosphereGainNode || !this.crowdLoopBuffer) return;
    if (this.crowdSourceNode) {
      // Already running; ensure gain matches active/unpaused state
      const now = this.ctx.currentTime;
      const baseVol = this.isTournamentFinal ? 0.16 : 0.11;
      if (this.crowdLayerGain && !this.isCrowdPaused) {
        this.crowdLayerGain.gain.setTargetAtTime(baseVol, now, 0.25);
      }
      return;
    }

    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.crowdLoopBuffer;
      src.loop = true;

      // Warm low murmur + stadium vocal body presence
      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(this.isTournamentFinal ? 520 : 420, now);

      const bodyFilter = this.ctx.createBiquadFilter();
      bodyFilter.type = 'bandpass';
      bodyFilter.frequency.setValueAtTime(this.isTournamentFinal ? 790 : 710, now);
      bodyFilter.Q.setValueAtTime(0.85, now);

      const lowTapGain = this.ctx.createGain();
      lowTapGain.gain.setValueAtTime(0.75, now);

      const bodyTapGain = this.ctx.createGain();
      bodyTapGain.gain.setValueAtTime(0.45, now);

      const masterCrowdGain = this.ctx.createGain();
      const baseVol = this.isTournamentFinal ? 0.16 : 0.11;
      masterCrowdGain.gain.setValueAtTime(0.001, now);
      masterCrowdGain.gain.setTargetAtTime(this.isCrowdPaused ? 0.001 : baseVol, now, 0.35);

      // Gentle breathing LFO so stadium murmur undulates naturally
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(this.isTournamentFinal ? 0.26 : 0.21, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.022, now);
      lfo.connect(lfoGain);
      lfoGain.connect(masterCrowdGain.gain);

      src.connect(lowFilter);
      lowFilter.connect(lowTapGain);
      lowTapGain.connect(masterCrowdGain);

      src.connect(bodyFilter);
      bodyFilter.connect(bodyTapGain);
      bodyTapGain.connect(masterCrowdGain);

      masterCrowdGain.connect(this.crowdAtmosphereGainNode);

      src.start(now);
      lfo.start(now);

      this.crowdSourceNode = src;
      this.crowdLfoNode = lfo;
      this.crowdLfoGainNode = lfoGain;
      this.crowdLowFilter = lowFilter;
      this.crowdBodyFilter = bodyFilter;
      this.crowdLayerGain = masterCrowdGain;
    } catch (e) {}
  }

  teardownCrowdNodes() {
    const src = this.crowdSourceNode;
    const lfo = this.crowdLfoNode;
    const lfoGain = this.crowdLfoGainNode;
    const lowFilter = this.crowdLowFilter;
    const bodyFilter = this.crowdBodyFilter;
    const layerGain = this.crowdLayerGain;

    this.crowdSourceNode = null;
    this.crowdLfoNode = null;
    this.crowdLfoGainNode = null;
    this.crowdLowFilter = null;
    this.crowdBodyFilter = null;
    this.crowdLayerGain = null;

    if (layerGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        layerGain.gain.cancelScheduledValues(now);
        layerGain.gain.setTargetAtTime(0.0001, now, 0.12);
      } catch (e) {}
    }

    const cleanup = () => {
      try { if (src) src.stop(); } catch (e) {}
      try { if (lfo) lfo.stop(); } catch (e) {}
      try { if (src) src.disconnect(); } catch (e) {}
      try { if (lfo) lfo.disconnect(); } catch (e) {}
      try { if (lfoGain) lfoGain.disconnect(); } catch (e) {}
      try { if (lowFilter) lowFilter.disconnect(); } catch (e) {}
      try { if (bodyFilter) bodyFilter.disconnect(); } catch (e) {}
      try { if (layerGain) layerGain.disconnect(); } catch (e) {}
    };

    if (this.ctx && layerGain) {
      setTimeout(cleanup, 280);
    } else {
      cleanup();
    }
  }

  stopCrowdAmbience() {
    this.isCrowdActive = false;
    this.isCrowdPaused = false;
    this.smoothedDanger = 0;
    this.chantHoldOffTimer = 0;
    this.teardownCrowdNodes();
  }

  setCrowdPaused(paused) {
    this.isCrowdPaused = !!paused;
    if (!this.ctx || !this.crowdLayerGain) return;
    const now = this.ctx.currentTime;
    if (this.isCrowdPaused) {
      this.crowdLayerGain.gain.setTargetAtTime(0.015, now, 0.12);
    } else if (this.isCrowdActive) {
      const baseVol = this.isTournamentFinal ? 0.16 : 0.11;
      const targetVol = baseVol + this.smoothedDanger * (this.isTournamentFinal ? 0.24 : 0.20);
      this.crowdLayerGain.gain.setTargetAtTime(targetVol, now, 0.18);
    }
  }

  /**
   * Called each frame during active match play:
   * - Swells Layer 1 stadium ambience smoothly as ball approaches either goal
   * - Counts down and triggers occasional Layer 3 terrace chants
   */
  updateCrowdExcitement(dangerNorm = 0, dt = 0.016) {
    if (!this.isCrowdActive || this.isCrowdPaused) return;
    const clamped = Math.max(0, Math.min(1, Number(dangerNorm) || 0));
    const lerpRate = clamped > this.smoothedDanger ? 4.5 : 1.8;
    this.smoothedDanger += (clamped - this.smoothedDanger) * Math.min(1, dt * lerpRate);

    if (this.chantHoldOffTimer > 0) {
      this.chantHoldOffTimer = Math.max(0, this.chantHoldOffTimer - dt);
    }

    if (this.ctx && this.ctx.state === 'running' && !this.isMuted && this.musicVolume > 0.005) {
      if (!this.crowdSourceNode) {
        this.ensureCrowdNodesStarted();
      }
      const now = this.ctx.currentTime;
      const baseVol = this.isTournamentFinal ? 0.16 : 0.11;
      const swellSpan = this.isTournamentFinal ? 0.25 : 0.21;
      const targetGain = baseVol + this.smoothedDanger * swellSpan;

      if (this.crowdLayerGain) {
        this.crowdLayerGain.gain.setTargetAtTime(targetGain, now, 0.16);
      }
      if (this.crowdLowFilter) {
        const lowFreq = (this.isTournamentFinal ? 520 : 420) + this.smoothedDanger * 380;
        this.crowdLowFilter.frequency.setTargetAtTime(lowFreq, now, 0.18);
      }
      if (this.crowdBodyFilter) {
        const bodyFreq = (this.isTournamentFinal ? 790 : 710) + this.smoothedDanger * 260;
        this.crowdBodyFilter.frequency.setTargetAtTime(bodyFreq, now, 0.18);
      }

      // Layer 3: Occasional background chant (paused right after goal roars or pause menu)
      if (this.chantHoldOffTimer <= 0) {
        this.chantTimer -= dt;
        if (this.chantTimer <= 0) {
          this.triggerStadiumChant();
          this.chantTimer = this.getNextChantDelay(false);
        }
      }
    }
  }

  /**
   * Layer 3: Plays one of 4 distinct stadium chants subtly behind play without repeating back-to-back.
   */
  triggerStadiumChant() {
    if (!this.enabled || !this.ctx || !this.crowdAtmosphereGainNode || this.musicVolume <= 0.005) return;

    try {
      const now = this.ctx.currentTime;
      let idx = Math.floor(Math.random() * 4);
      if (idx === this.lastChantIndex) {
        idx = (idx + 1 + Math.floor(Math.random() * 3)) % 4;
      }
      this.lastChantIndex = idx;

      const energyScale = this.isTournamentFinal ? 1.28 : 1.0;

      // Helper: layered warm stadium voice/horn note routed to crowdAtmosphereGainNode
      const playChantVoice = (freq, startDelay, dur, vol) => {
        const t = now + startDelay;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq * 1.004, t); // Subtle chorus width

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(980, t);

        const peak = vol * energyScale;
        gain.gain.setValueAtTime(0.0005, t);
        gain.gain.linearRampToValueAtTime(peak, t + Math.min(0.08, dur * 0.25));
        gain.gain.setValueAtTime(peak * 0.88, Math.max(t + 0.08, t + dur - 0.09));
        gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.crowdAtmosphereGainNode);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + dur + 0.03);
        osc2.stop(t + dur + 0.03);
      };

      // Helper: distant stadium drum stomp + crowd clap
      const playStadiumClap = (startDelay, kind = 'clap') => {
        const t = now + startDelay;
        if (kind === 'drum') {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(110, t);
          osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
          gain.gain.setValueAtTime(0.11 * energyScale, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          osc.connect(gain);
          gain.connect(this.crowdAtmosphereGainNode);
          osc.start(t);
          osc.stop(t + 0.19);
        } else if (this.crowdLoopBuffer) {
          const src = this.ctx.createBufferSource();
          src.buffer = this.crowdLoopBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1350, t);
          bp.Q.setValueAtTime(1.1, t);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.085 * energyScale, t + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
          src.connect(bp);
          bp.connect(gain);
          gain.connect(this.crowdAtmosphereGainNode);
          src.start(t);
          src.stop(t + 0.15);
        }
      };

      // Gentle crowd murmur swell behind chant
      if (this.crowdLoopBuffer) {
        const swellSrc = this.ctx.createBufferSource();
        swellSrc.buffer = this.crowdLoopBuffer;
        const swellFilter = this.ctx.createBiquadFilter();
        swellFilter.type = 'bandpass';
        swellFilter.frequency.setValueAtTime(840, now);
        swellFilter.Q.setValueAtTime(0.9, now);
        const swellGain = this.ctx.createGain();
        swellGain.gain.setValueAtTime(0.001, now);
        swellGain.gain.linearRampToValueAtTime(0.075 * energyScale, now + 0.55);
        swellGain.gain.linearRampToValueAtTime(0.065 * energyScale, now + 2.4);
        swellGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);
        swellSrc.connect(swellFilter);
        swellFilter.connect(swellGain);
        swellGain.connect(this.crowdAtmosphereGainNode);
        swellSrc.start(now);
        swellSrc.stop(now + 3.45);
      }

      if (idx === 0) {
        // Chant 0: Classic rising terrace "O-lé, O-lé!" phrase + double clap
        playChantVoice(261.63, 0.10, 0.34, 0.042); // C4
        playChantVoice(329.63, 0.48, 0.52, 0.048); // E4
        playChantVoice(392.00, 1.08, 0.56, 0.052); // G4
        playChantVoice(329.63, 1.72, 0.62, 0.046); // E4
        playStadiumClap(0.10, 'drum');
        playStadiumClap(1.08, 'drum');
        playStadiumClap(2.42, 'clap');
        playStadiumClap(2.68, 'clap');
      } else if (idx === 1) {
        // Chant 1: Rhythmic Stomp-Stomp-Clap + Stadium Call
        [0.08, 0.42, 1.45, 1.79].forEach((d) => playStadiumClap(d, 'drum'));
        [0.78, 2.15].forEach((d) => playStadiumClap(d, 'clap'));
        playChantVoice(293.66, 0.85, 0.52, 0.045); // D4
        playChantVoice(349.23, 2.22, 0.65, 0.050); // F4
      } else if (idx === 2) {
        // Chant 2: Rolling 5-note terrace cadence
        playChantVoice(220.00, 0.08, 0.32, 0.040); // A3
        playChantVoice(261.63, 0.44, 0.32, 0.044); // C4
        playChantVoice(293.66, 0.80, 0.42, 0.048); // D4
        playChantVoice(329.63, 1.28, 0.44, 0.050); // E4
        playChantVoice(261.63, 1.80, 0.72, 0.046); // C4
        playStadiumClap(0.08, 'drum');
        playStadiumClap(1.28, 'clap');
        playStadiumClap(1.80, 'drum');
      } else {
        // Chant 3: Anthemic major call-and-response
        playChantVoice(261.63, 0.08, 0.45, 0.046); // C4
        playChantVoice(392.00, 0.58, 0.48, 0.048); // G4
        playChantVoice(329.63, 1.15, 0.42, 0.045); // E4
        playChantVoice(261.63, 1.65, 0.78, 0.048); // C4
        playStadiumClap(0.58, 'clap');
        playStadiumClap(1.65, 'drum');
        playStadiumClap(2.45, 'clap');
      }
    } catch (e) {}
  }

  // =========================================================================
  // LAYER 2: CROWD REACTIONS (Goals, Saves, Tackles, Missed Shots, Full Time)
  // =========================================================================

  /**
   * Big crowd roar when a goal is scored: builds up cleanly, holds celebratory peak,
   * and gradually fades back into normal stadium ambience.
   */
  playGoalCelebration(scoringTeam = 'blue') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    // Hold off background chants briefly so the goal roar breathes cleanly
    this.chantHoldOffTimer = 5.5;
    this.smoothedDanger = 0.85;

    try {
      const now = this.ctx.currentTime;
      const finalBoost = this.isTournamentFinal ? 1.2 : 1.0;
      const teamScale = scoringTeam === 'blue' ? 1.0 : 0.88;
      const peakScale = finalBoost * teamScale;

      if (this.crowdLoopBuffer) {
        // Warm low roar body
        const lowSrc = this.ctx.createBufferSource();
        lowSrc.buffer = this.crowdLoopBuffer;
        lowSrc.loop = true;

        const lowFilter = this.ctx.createBiquadFilter();
        lowFilter.type = 'lowpass';
        lowFilter.frequency.setValueAtTime(520, now);
        lowFilter.frequency.linearRampToValueAtTime(1150, now + 0.42);
        lowFilter.frequency.linearRampToValueAtTime(460, now + 3.5);

        const lowGain = this.ctx.createGain();
        lowGain.gain.setValueAtTime(0.02, now);
        // Build up over 0.38s -> roar peak until 1.35s -> fade smoothly back into ambience by 3.55s
        lowGain.gain.linearRampToValueAtTime(0.42 * peakScale, now + 0.38);
        lowGain.gain.setValueAtTime(0.40 * peakScale, now + 1.35);
        lowGain.gain.exponentialRampToValueAtTime(0.002, now + 3.55);

        lowSrc.connect(lowFilter);
        lowFilter.connect(lowGain);
        lowGain.connect(this.sfxGainNode);
        lowSrc.start(now);
        lowSrc.stop(now + 3.6);

        // Bright vocal cheer crest
        const midSrc = this.ctx.createBufferSource();
        midSrc.buffer = this.crowdLoopBuffer;
        midSrc.loop = true;

        const midFilter = this.ctx.createBiquadFilter();
        midFilter.type = 'bandpass';
        midFilter.frequency.setValueAtTime(780, now);
        midFilter.frequency.linearRampToValueAtTime(1280, now + 0.42);
        midFilter.frequency.linearRampToValueAtTime(760, now + 3.3);
        midFilter.Q.setValueAtTime(0.85, now);

        const midGain = this.ctx.createGain();
        midGain.gain.setValueAtTime(0.01, now);
        midGain.gain.linearRampToValueAtTime(0.30 * peakScale, now + 0.42);
        midGain.gain.setValueAtTime(0.28 * peakScale, now + 1.25);
        midGain.gain.exponentialRampToValueAtTime(0.002, now + 3.35);

        midSrc.connect(midFilter);
        midFilter.connect(midGain);
        midGain.connect(this.sfxGainNode);
        midSrc.start(now);
        midSrc.stop(now + 3.4);
      }
    } catch (e) {}
  }

  /**
   * Short reactive cheer burst for GK saves and crisp tackles (cooldown-gated)
   */
  playCrowdCheer(intensity = 0.65) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode || !this.crowdLoopBuffer) return;

    const now = this.ctx.currentTime;
    if (now - this.lastCheerTime < 1.8) return;
    this.lastCheerTime = now;

    try {
      const level = Math.max(0.2, Math.min(1.0, intensity)) * (this.isTournamentFinal ? 1.18 : 1.0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.crowdLoopBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(760, now);
      filter.frequency.linearRampToValueAtTime(1120, now + 0.16);
      filter.frequency.linearRampToValueAtTime(720, now + 0.85);
      filter.Q.setValueAtTime(0.95, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.002, now);
      gain.gain.linearRampToValueAtTime(0.22 * level, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.92);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGainNode);
      src.start(now);
      src.stop(now + 0.95);
    } catch (e) {}
  }

  /**
   * Collective disappointed "ooohhh..." groan on wide/over missed shots & woodwork hits
   */
  playCrowdMiss() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode || !this.crowdLoopBuffer) return;

    const now = this.ctx.currentTime;
    if (now - this.lastMissTime < 2.0) return;
    this.lastMissTime = now;

    try {
      const level = this.isTournamentFinal ? 1.15 : 1.0;

      // Downward vowel-like filtered groan
      const src = this.ctx.createBufferSource();
      src.buffer = this.crowdLoopBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(940, now);
      filter.frequency.exponentialRampToValueAtTime(340, now + 1.05);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.002, now);
      gain.gain.linearRampToValueAtTime(0.24 * level, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 1.15);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGainNode);
      src.start(now);
      src.stop(now + 1.18);

      // Subtle warm low sigh pitch-drop underneath
      const sigh = this.ctx.createOscillator();
      const sighGain = this.ctx.createGain();
      sigh.type = 'sine';
      sigh.frequency.setValueAtTime(220, now);
      sigh.frequency.exponentialRampToValueAtTime(130, now + 0.9);
      sighGain.gain.setValueAtTime(0.001, now);
      sighGain.gain.linearRampToValueAtTime(0.055 * level, now + 0.12);
      sighGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      sigh.connect(sighGain);
      sighGain.connect(this.sfxGainNode);
      sigh.start(now);
      sigh.stop(now + 0.98);
    } catch (e) {}
  }

  /**
   * Final whistle crowd reaction based on match outcome ('celebration' | 'disappointment' | 'draw')
   */
  playFinalWhistleCrowd(outcome = 'celebration') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode || !this.crowdLoopBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const finalMult = this.isTournamentFinal ? 1.2 : 1.0;

      if (outcome === 'celebration') {
        const src = this.ctx.createBufferSource();
        src.buffer = this.crowdLoopBuffer;
        src.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, now);
        filter.frequency.linearRampToValueAtTime(1250, now + 0.45);
        filter.frequency.linearRampToValueAtTime(580, now + 3.4);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.44 * finalMult, now + 0.4);
        gain.gain.setValueAtTime(0.38 * finalMult, now + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.002, now + 3.45);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);
        src.start(now);
        src.stop(now + 3.5);
      } else if (outcome === 'disappointment') {
        const src = this.ctx.createBufferSource();
        src.buffer = this.crowdLoopBuffer;
        src.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(840, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 1.8);
        filter.Q.setValueAtTime(1.2, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.28 * finalMult, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.002, now + 2.2);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);
        src.start(now);
        src.stop(now + 2.25);
      } else {
        // 'draw': steady appreciative crowd applause swell
        const src = this.ctx.createBufferSource();
        src.buffer = this.crowdLoopBuffer;
        src.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(820, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.26 * finalMult, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.002, now + 2.4);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);
        src.start(now);
        src.stop(now + 2.45);
      }
    } catch (e) {}
  }

  /**
   * Trophy lift / general crowd swell helper
   */
  swellCrowd(intensity = 0.9, duration = 3.5) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode || !this.crowdLoopBuffer) return;

    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.crowdLoopBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.linearRampToValueAtTime(1150, now + Math.min(0.6, duration * 0.2));
      filter.frequency.linearRampToValueAtTime(520, now + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.36 * intensity, now + Math.min(0.45, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.002, now + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGainNode);
      src.start(now);
      src.stop(now + duration + 0.05);
    } catch (e) {}
  }

  // =========================================================================
  // PROCEDURAL MUSIC SYSTEM (Menu, Half-Time, Full-Time)
  // =========================================================================

  /**
   * Switch background music track smoothly ('menu' | 'halftime' | 'fulltime' | null)
   */
  setMusicTrack(trackName) {
    const normalized = (trackName === 'menu' || trackName === 'halftime' || trackName === 'fulltime')
      ? trackName
      : null;

    if (this.currentTrack === normalized) {
      if (normalized && !this.isMuted && this.musicVolume > 0.005) {
        this.ensureMusicSchedulerRunning();
      }
      return;
    }

    this.currentTrack = normalized;
    this.currentStep = 0;

    if (!normalized) {
      this.stopMusicScheduler();
      return;
    }

    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.06;
    }
    if (!this.isMuted && this.musicVolume > 0.005) {
      this.ensureMusicSchedulerRunning();
    }
  }

  stopMusic() {
    this.setMusicTrack(null);
  }

  ensureMusicSchedulerRunning() {
    if (this.schedulerId || !this.ctx || this.ctx.state !== 'running') return;
    if (!this.currentTrack || this.isMuted || this.musicVolume <= 0.005) return;

    this.nextNoteTime = Math.max(this.nextNoteTime || 0, this.ctx.currentTime + 0.04);
    const scheduleAheadTime = 0.16;

    this.schedulerId = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.currentTrack || this.isMuted || this.musicVolume <= 0.005) {
        return;
      }
      // Guard against huge time jumps if browser tab was backgrounded
      if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
        this.nextNoteTime = this.ctx.currentTime + 0.04;
      }
      while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
        const stepDuration = this.scheduleMusicStep(this.currentTrack, this.currentStep, this.nextNoteTime);
        this.nextNoteTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 32;
      }
    }, 45);
  }

  stopMusicScheduler() {
    if (this.schedulerId) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  playMusicTone(freq, time, duration, { type = 'triangle', vol = 0.12, cutoff = 1800, attack = 0.012 } = {}) {
    if (!this.ctx || !this.musicGainNode || !freq || freq <= 0) return;

    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, time);

      const safeAttack = Math.min(attack, duration * 0.4);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + safeAttack);
      gain.gain.exponentialRampToValueAtTime(0.0008, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);

      osc.start(time);
      osc.stop(time + duration + 0.02);
    } catch (e) {}
  }

  playMusicDrum(kind, time, vol = 0.14) {
    if (!this.ctx || !this.musicGainNode) return;
    try {
      if (kind === 'kick') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(118, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        osc.connect(gain);
        gain.connect(this.musicGainNode);
        osc.start(time);
        osc.stop(time + 0.13);
      } else if (kind === 'tom') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, time);
        osc.frequency.exponentialRampToValueAtTime(78, time + 0.14);
        gain.gain.setValueAtTime(vol * 0.85, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        osc.connect(gain);
        gain.connect(this.musicGainNode);
        osc.start(time);
        osc.stop(time + 0.16);
      } else if ((kind === 'hat' || kind === 'snare') && this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
        filter.frequency.setValueAtTime(kind === 'hat' ? 5200 : 1850, time);
        const gain = this.ctx.createGain();
        const dur = kind === 'hat' ? 0.04 : 0.09;
        gain.gain.setValueAtTime(vol * (kind === 'hat' ? 0.42 : 0.72), time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGainNode);
        src.start(time);
        src.stop(time + dur + 0.01);
      }
    } catch (e) {}
  }

  /**
   * Schedules a single 8th-note step for the active track and returns step duration in seconds.
   */
  scheduleMusicStep(track, step, time) {
    // MIDI-frequency lookup helpers for crisp musical phrases
    const N = {
      F2: 87.31, G2: 98.00, A2: 110.00, Bb2: 116.54, B2: 123.47,
      C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94,
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
      C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77, C6: 1046.50,
    };

    if (track === 'menu') {
      // Energetic, upbeat 124 BPM football theme (C -> Am -> F -> G)
      const stepDur = 60 / 124 / 2; // 8th note (~0.242s)
      const bass = [
        N.C3, 0, N.C3, N.G2, N.C3, 0, N.G2, 0,
        N.A2, 0, N.A2, N.E3, N.A2, 0, N.E3, 0,
        N.F2, 0, N.F2, N.C3, N.F2, 0, N.C3, 0,
        N.G2, 0, N.G2, N.D3, N.G2, N.A2, N.B2, 0,
      ];
      const lead = [
        N.E5, 0, N.G5, N.A5, N.G5, 0, N.E5, N.D5,
        N.C5, 0, N.E5, N.G5, N.A5, 0, N.E5, 0,
        N.F5, 0, N.A5, N.C6, N.A5, 0, N.F5, N.E5,
        N.D5, 0, N.G5, N.A5, N.G5, N.E5, N.D5, 0,
      ];
      const chordMap = {
        0: [N.C4, N.E4, N.G4],
        8: [N.A3, N.C4, N.E4],
        16: [N.F3, N.A3, N.C4],
        24: [N.G3, N.B3, N.D4],
      };

      if (bass[step]) {
        this.playMusicTone(bass[step], time, stepDur * 0.9, { type: 'triangle', vol: 0.18, cutoff: 750 });
      }
      if (lead[step]) {
        this.playMusicTone(lead[step], time, stepDur * 1.15, { type: 'triangle', vol: 0.12, cutoff: 2600 });
        this.playMusicTone(lead[step] * 0.5, time, stepDur * 0.95, { type: 'sine', vol: 0.05, cutoff: 1400 });
      }
      if (chordMap[step]) {
        chordMap[step].forEach((f) => {
          this.playMusicTone(f, time, stepDur * 6.5, { type: 'sine', vol: 0.045, cutoff: 1200, attack: 0.04 });
        });
      }
      if (step % 4 === 0) this.playMusicDrum('kick', time, 0.18);
      if (step % 4 === 2) this.playMusicDrum('snare', time, 0.11);
      if (step % 2 === 1) this.playMusicDrum('hat', time, 0.07);
      if (step === 30) this.playMusicDrum('tom', time, 0.13);
      return stepDur;
    }

    if (track === 'halftime') {
      // Crisp TV Broadcast Half-Time Presentation Theme (104 BPM, Fmaj7 -> Dm7 -> Bbmaj7 -> C)
      const stepDur = 60 / 104 / 2;
      const bass = [
        N.F2, 0, N.C3, 0, N.F2, 0, N.A2, 0,
        N.D3, 0, N.A2, 0, N.D3, 0, N.C3, 0,
        N.Bb2, 0, N.F3, 0, N.Bb2, 0, N.A2, 0,
        N.C3, 0, N.G2, 0, N.C3, 0, N.G2, 0,
      ];
      const epChords = {
        0: [N.F3, N.A3, N.C4, N.E4],
        8: [N.D3, N.F3, N.A3, N.C4],
        16: [N.Bb3, N.D4, N.F4, N.A4],
        24: [N.C4, N.E4, N.G4, N.Bb4],
      };
      const arp = [
        N.A4, N.C5, N.E5, 0, N.C5, 0, N.A4, 0,
        N.F4, N.A4, N.C5, 0, N.A4, 0, N.F4, 0,
        N.D5, N.F5, N.A5, 0, N.F5, 0, N.D5, 0,
        N.E5, N.G5, N.E5, 0, N.C5, 0, N.G4, 0,
      ];

      if (bass[step]) {
        this.playMusicTone(bass[step], time, stepDur * 1.1, { type: 'triangle', vol: 0.14, cutoff: 620 });
      }
      if (epChords[step]) {
        epChords[step].forEach((f) => {
          this.playMusicTone(f, time, stepDur * 6.8, { type: 'triangle', vol: 0.052, cutoff: 1400, attack: 0.025 });
        });
      }
      if (arp[step]) {
        this.playMusicTone(arp[step], time, stepDur * 1.3, { type: 'sine', vol: 0.08, cutoff: 2400 });
      }
      if (step % 4 === 0) this.playMusicDrum('kick', time, 0.13);
      if (step % 4 === 2) this.playMusicDrum('hat', time, 0.07);
      if (step % 8 === 4) this.playMusicDrum('snare', time, 0.065);
      return stepDur;
    }

    if (track === 'fulltime') {
      // Triumphant Post-Match & Trophy Presentation Anthem (112 BPM, C -> G -> Am -> F/G)
      const stepDur = 60 / 112 / 2;
      const bass = [
        N.C3, 0, N.C3, 0, N.G2, 0, N.C3, 0,
        N.G2, 0, N.G2, 0, N.D3, 0, N.G2, 0,
        N.A2, 0, N.A2, 0, N.E3, 0, N.A2, 0,
        N.F2, 0, N.F2, 0, N.G2, 0, N.G2, 0,
      ];
      const chords = {
        0: [N.C4, N.E4, N.G4, N.C5],
        8: [N.G3, N.B3, N.D4, N.G4],
        16: [N.A3, N.C4, N.E4, N.A4],
        24: [N.F3, N.A3, N.C4, N.F4],
        28: [N.G3, N.B3, N.D4, N.G4],
      };
      const anthem = [
        N.G4, 0, N.C5, N.D5, N.E5, 0, N.G5, 0,
        N.D5, 0, N.B4, N.D5, N.G5, 0, N.D5, 0,
        N.C5, 0, N.E5, N.G5, N.A5, 0, N.E5, 0,
        N.F5, 0, N.E5, N.D5, N.D5, 0, N.C5, 0,
      ];

      if (bass[step]) {
        this.playMusicTone(bass[step], time, stepDur * 1.2, { type: 'triangle', vol: 0.16, cutoff: 700 });
      }
      if (chords[step]) {
        chords[step].forEach((f) => {
          this.playMusicTone(f, time, stepDur * 3.8, { type: 'triangle', vol: 0.055, cutoff: 1350, attack: 0.04 });
        });
      }
      if (anthem[step]) {
        this.playMusicTone(anthem[step], time, stepDur * 1.75, { type: 'triangle', vol: 0.11, cutoff: 2500, attack: 0.02 });
        this.playMusicTone(anthem[step] * 0.5, time, stepDur * 1.5, { type: 'sine', vol: 0.05, cutoff: 1400 });
      }
      if (step % 4 === 0) this.playMusicDrum('kick', time, 0.16);
      if (step % 8 === 4) this.playMusicDrum('tom', time, 0.11);
      if (step % 8 === 6) this.playMusicDrum('snare', time, 0.085);
      return stepDur;
    }

    return 0.25;
  }

  // =========================================================================
  // NATURAL AUTHENTIC FOOTBALL SOUND EFFECTS (SFX Bus)
  // =========================================================================

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

      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();

      const startFreq = 120 + chargeNorm * 30;
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

  playTackle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

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

  /**
   * Short celebratory goal sound effect (stadium brass fanfare + warm crowd roar swell)
   */
  playGoalChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;

    try {
      this.duckMusicTemporarily(1.25);
      const now = this.ctx.currentTime;

      // 1. Celebratory stadium fanfare arpeggio + held victory chord
      const fanfare = [
        { freq: 523.25, delay: 0.0, dur: 0.16, vol: 0.24 },   // C5
        { freq: 659.25, delay: 0.075, dur: 0.16, vol: 0.24 }, // E5
        { freq: 783.99, delay: 0.15, dur: 0.18, vol: 0.26 },  // G5
        { freq: 1046.5, delay: 0.23, dur: 0.68, vol: 0.28 },  // C6 triumphant peak
        { freq: 783.99, delay: 0.23, dur: 0.65, vol: 0.16 },  // G5 harmony
        { freq: 523.25, delay: 0.23, dur: 0.65, vol: 0.16 },  // C5 harmony
      ];

      fanfare.forEach((n) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const t = now + n.delay;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2800, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(n.vol, t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGainNode);

        osc.start(t);
        osc.stop(t + n.dur + 0.02);
      });

      // 2. Warm sub-bass stadium boom
      const bass = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(130.81, now + 0.22);
      bass.frequency.exponentialRampToValueAtTime(65.41, now + 0.55);
      bassGain.gain.setValueAtTime(0.28, now + 0.22);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      bass.connect(bassGain);
      bassGain.connect(this.sfxGainNode);
      bass.start(now + 0.22);
      bass.stop(now + 0.6);

      // 3. Short celebratory crowd roar swell (bandpassed filtered noise envelope)
      if (this.noiseBuffer) {
        const cheerSrc = this.ctx.createBufferSource();
        cheerSrc.buffer = this.noiseBuffer;
        const cheerFilter = this.ctx.createBiquadFilter();
        cheerFilter.type = 'bandpass';
        cheerFilter.frequency.setValueAtTime(900, now);
        cheerFilter.Q.setValueAtTime(0.9, now);

        const cheerGain = this.ctx.createGain();
        cheerGain.gain.setValueAtTime(0.001, now);
        cheerGain.gain.linearRampToValueAtTime(0.18, now + 0.14);
        cheerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        cheerSrc.connect(cheerFilter);
        cheerFilter.connect(cheerGain);
        cheerGain.connect(this.sfxGainNode);
        cheerSrc.start(now);
        cheerSrc.stop(now + 0.6);
      }
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
