/**
 * GamePix HTML5 SDK v3 Integration Bridge
 * Handles lifecycle, ads (interstitial / reward), pause/resume, audio events,
 * score/level reporting, and celebratory moments with safe standalone fallbacks.
 */
export class GamePixBridge {
  constructor() {
    this.isReady = false;
    this.isShowingAd = false;
    this.loadedPromise = null;
    this._unsubscribers = [];
  }

  get sdk() {
    if (typeof window === 'undefined') return null;
    return window.GamePix || null;
  }

  /**
   * Initialize GamePix SDK and signal game loaded.
   * Registers platform PAUSE / RESUME / SOUND_ON / SOUND_OFF handlers.
   */
  init({ onPause, onResume, onSoundOff, onSoundOn } = {}) {
    const gpx = this.sdk;
    if (!gpx) return Promise.resolve(false);

    try {
      if (typeof gpx.loaded === 'function') {
        this.loadedPromise = Promise.resolve(gpx.loaded())
          .then(() => {
            this.isReady = true;
            return true;
          })
          .catch(() => false);
      } else if (gpx.game && typeof gpx.game.gameLoaded === 'function') {
        gpx.game.gameLoaded();
        this.isReady = true;
        this.loadedPromise = Promise.resolve(true);
      }
    } catch (err) {
      // Gracefully continue if SDK initialization fails offline
    }

    const CONST = gpx.CONST || gpx.Events || {};
    const bindEvent = (eventName, handler) => {
      if (!eventName || typeof handler !== 'function') return;
      try {
        if (gpx.events && typeof gpx.events.on === 'function') {
          const unsub = gpx.events.on(eventName, handler);
          if (typeof unsub === 'function') this._unsubscribers.push(unsub);
        } else if (typeof gpx.addEventListener === 'function') {
          const unsub = gpx.addEventListener(eventName, handler);
          if (typeof unsub === 'function') this._unsubscribers.push(unsub);
        }
      } catch (err) {}
    };

    bindEvent(CONST.PAUSE || 'PAUSE', () => {
      if (typeof onPause === 'function') onPause();
    });
    bindEvent(CONST.RESUME || 'RESUME', () => {
      if (typeof onResume === 'function') onResume();
    });
    bindEvent(CONST.SOUND_OFF || 'SOUNDOFF', () => {
      if (typeof onSoundOff === 'function') onSoundOff();
    });
    bindEvent(CONST.SOUND_ON || 'SOUNDON', () => {
      if (typeof onSoundOn === 'function') onSoundOn();
    });

    return this.loadedPromise || Promise.resolve(true);
  }

  gameStart() {
    const gpx = this.sdk;
    if (!gpx) return;
    try {
      if (gpx.lifecycle && typeof gpx.lifecycle.gameStart === 'function') {
        gpx.lifecycle.gameStart();
      } else if (typeof gpx.start === 'function') {
        gpx.start();
      }
    } catch (err) {}
  }

  gameStop() {
    const gpx = this.sdk;
    if (!gpx) return;
    try {
      if (typeof gpx.gameStop === 'function') {
        gpx.gameStop();
      }
    } catch (err) {}
  }

  updateScore(score) {
    const gpx = this.sdk;
    if (!gpx) return;
    const numericScore = Math.max(0, Math.floor(Number(score) || 0));
    try {
      if (typeof gpx.updateScore === 'function') {
        gpx.updateScore(numericScore);
      }
    } catch (err) {}
  }

  updateLevel(level) {
    const gpx = this.sdk;
    if (!gpx) return;
    const numericLevel = Math.max(1, Math.floor(Number(level) || 1));
    try {
      if (typeof gpx.updateLevel === 'function') {
        gpx.updateLevel(numericLevel);
      }
    } catch (err) {}
  }

  happyMoment() {
    const gpx = this.sdk;
    if (!gpx) return;
    try {
      if (typeof gpx.happyMoment === 'function') {
        gpx.happyMoment();
      }
    } catch (err) {}
  }

  sadMoment() {
    const gpx = this.sdk;
    if (!gpx) return;
    try {
      if (typeof gpx.sadMoment === 'function') {
        gpx.sadMoment();
      }
    } catch (err) {}
  }

  /**
   * Triggers a GamePix interstitial ad break with safe audio/gameplay lifecycle callbacks.
   * Ensures standalone/offline or blocked embeds never soft-lock.
   */
  async requestInterstitialAd({ onBeforeAd, onAfterAd } = {}) {
    if (this.isShowingAd) return { success: false, skipped: true };
    const gpx = this.sdk;

    if (!gpx || typeof gpx.interstitialAd !== 'function') {
      if (typeof onAfterAd === 'function') onAfterAd({ success: false });
      return { success: false };
    }

    this.isShowingAd = true;
    if (typeof onBeforeAd === 'function') {
      try {
        onBeforeAd();
      } catch (err) {}
    }

    try {
      if (!this.isReady && this.loadedPromise) {
        await Promise.race([
          this.loadedPromise,
          new Promise((resolve) => setTimeout(resolve, 1000))
        ]);
      }

      // Add a fallback timeout only if running inside a non-GamePix third-party iframe
      // (no GamePix parent response and no local #adMainContainer simulator rendered).
      let timeoutId = null;
      const adPromise = Promise.resolve(gpx.interstitialAd()).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      const safetyPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          const hasTestAdDom = typeof document !== 'undefined' && !!document.getElementById('adMainContainer');
          if (!hasTestAdDom && window.parent !== window) {
            resolve({ success: false, timeout: true });
          }
        }, 2500);
      });

      const res = await Promise.race([adPromise, safetyPromise]);
      return res || { success: false };
    } catch (err) {
      return { success: false, error: err };
    } finally {
      this.isShowingAd = false;
      if (typeof onAfterAd === 'function') {
        try {
          onAfterAd();
        } catch (err) {}
      }
    }
  }

  async requestRewardAd({ onBeforeAd, onAfterAd } = {}) {
    if (this.isShowingAd) return { success: false, skipped: true };
    const gpx = this.sdk;

    if (!gpx || typeof gpx.rewardAd !== 'function') {
      if (typeof onAfterAd === 'function') onAfterAd({ success: false });
      return { success: false };
    }

    this.isShowingAd = true;
    if (typeof onBeforeAd === 'function') {
      try {
        onBeforeAd();
      } catch (err) {}
    }

    try {
      const res = await Promise.resolve(gpx.rewardAd());
      return res || { success: false };
    } catch (err) {
      return { success: false, error: err };
    } finally {
      this.isShowingAd = false;
      if (typeof onAfterAd === 'function') {
        try {
          onAfterAd();
        } catch (err) {}
      }
    }
  }
}
