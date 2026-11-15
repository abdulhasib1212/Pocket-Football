/**
 * CrazyGames HTML5 SDK v3 Bridge
 * Safely handles SDK initialization, gameplay lifecycle events, happytime celebrations,
 * and midgame/rewarded ads with graceful fallback when running outside CrazyGames.
 */
export class CrazyGamesBridge {
  constructor() {
    this.sdk = null;
    this.initialized = false;
    this.initPromise = null;
    this.loadListenerAttached = false;
    this.environment = 'disabled';
    this.isGameplayActive = false;
    this.isAdPlaying = false;
    this.lastMidgameAdAt = 0;
    this.midgameCooldownMs = 45000;
  }

  async init() {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    if (typeof window === 'undefined') return false;
    if (!window.CrazyGames || !window.CrazyGames.SDK) {
      if (!this.loadListenerAttached && typeof window.addEventListener === 'function') {
        this.loadListenerAttached = true;
        window.addEventListener('load', () => {
          this.init();
        }, { once: true });
      }
      return false;
    }

    this.initPromise = (async () => {
      try {
        this.sdk = window.CrazyGames.SDK;
        await this.sdk.init();
        this.environment = this.sdk.environment || 'crazygames';
        this.initialized = true;
        return true;
      } catch (err) {
        // Running offline, in preview sandbox, or SDK unavailable
        this.initialized = false;
        this.environment = 'disabled';
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  isAvailable() {
    return this.initialized && this.sdk && this.environment !== 'disabled';
  }

  gameplayStart() {
    if (this.isGameplayActive) return;
    this.isGameplayActive = true;
    if (!this.isAvailable()) return;
    try {
      if (this.sdk.game && typeof this.sdk.game.gameplayStart === 'function') {
        this.sdk.game.gameplayStart();
      }
    } catch (e) {}
  }

  gameplayStop() {
    if (!this.isGameplayActive) return;
    this.isGameplayActive = false;
    if (!this.isAvailable()) return;
    try {
      if (this.sdk.game && typeof this.sdk.game.gameplayStop === 'function') {
        this.sdk.game.gameplayStop();
      }
    } catch (e) {}
  }

  happytime() {
    if (!this.isAvailable()) return;
    try {
      if (this.sdk.game && typeof this.sdk.game.happytime === 'function') {
        this.sdk.game.happytime();
      }
    } catch (e) {}
  }

  /**
   * Requests a midgame or rewarded ad with clean audio/pause lifecycle callbacks.
   * Gracefully resolves without blocking if SDK is unavailable or on cooldown.
   */
  requestAd(type = 'midgame', { onAdStart, onAdEnd } = {}) {
    if (type === 'midgame') {
      const now = Date.now();
      if (now - this.lastMidgameAdAt < this.midgameCooldownMs) {
        if (onAdEnd) onAdEnd();
        return Promise.resolve({ shown: false, reason: 'cooldown' });
      }
    }

    if (!this.isAvailable() || !this.sdk.ad || typeof this.sdk.ad.requestAd !== 'function') {
      if (onAdEnd) onAdEnd();
      return Promise.resolve({ shown: false, reason: 'unavailable' });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        this.isAdPlaying = false;
        if (onAdEnd) onAdEnd();
        resolve(result);
      };

      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => {
            this.isAdPlaying = true;
            this.gameplayStop();
            if (onAdStart) onAdStart();
          },
          adFinished: () => {
            if (type === 'midgame') {
              this.lastMidgameAdAt = Date.now();
            }
            finish({ shown: true });
          },
          adError: (error) => {
            finish({ shown: false, error });
          },
        });
      } catch (err) {
        finish({ shown: false, error: err });
      }
    });
  }
}
