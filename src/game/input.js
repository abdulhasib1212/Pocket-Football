/**
 * Input Handler
 * Supports Single-Player (WASD/Arrows + Space/J + X/K + Q/Tab + Touch)
 * and Local 2P Multiplayer (P1: WASD + Space/X/Q, P2: Arrow Keys + J/K/L).
 */
export class InputManager {
  constructor(canvas, localMultiplayer = false) {
    this.canvas = canvas;
    this.localMultiplayer = !!localMultiplayer;
    this.keys = {};

    // P1 / Solo action triggers
    this.kickRequested = false;
    this.passRequested = false;
    this.switchRequested = false;

    // P2 action triggers (Local Multiplayer)
    this.p2KickRequested = false;
    this.p2PassRequested = false;
    this.p2SwitchRequested = false;

    this.resetRequested = false;
    this.cameraToggleRequested = false;

    // Virtual touch joystick state
    this.touchJoystick = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dirX: 0,
      dirY: 0,
    };

    // Touch action hold states & sub-frame tap guards
    this.touchKickHeld = false;
    this.touchKickPolled = false;
    this.touchKickPendingRelease = false;

    this.touchPassHeld = false;
    this.touchPassPolled = false;
    this.touchPassPendingRelease = false;

    this.setupKeyboard();
  }

  setLocalMultiplayer(enabled) {
    this.localMultiplayer = !!enabled;
    this.clearActiveInputs();
  }

  setupKeyboard() {
    const handleKey = (e, isDown) => {
      this.keys[e.code] = isDown;
      if (e.key) {
        this.keys[e.key] = isDown;
        this.keys[e.key.toLowerCase()] = isDown;
        this.keys[e.key.toUpperCase()] = isDown;
      }

      if (!isDown) return;

      // Prevent arrow keys / Space from scrolling viewport
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space' ||
        e.key === ' '
      ) {
        e.preventDefault();
      }

      if (e.repeat) return;

      if (this.localMultiplayer) {
        // --- PLAYER 1: Space (Shoot/Tackle), X (Pass), Q (Switch) ---
        if (e.code === 'Space' || e.key === ' ') {
          this.kickRequested = true;
        }
        if (e.code === 'KeyX' || e.key === 'x' || e.key === 'X') {
          this.passRequested = true;
          e.preventDefault();
        }
        if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
          this.switchRequested = true;
          e.preventDefault();
        }

        // --- PLAYER 2: J (Shoot/Tackle), K (Pass), L (Switch) ---
        if (e.code === 'KeyJ' || e.key === 'j' || e.key === 'J') {
          this.p2KickRequested = true;
          e.preventDefault();
        }
        if (e.code === 'KeyK' || e.key === 'k' || e.key === 'K') {
          this.p2PassRequested = true;
          e.preventDefault();
        }
        if (e.code === 'KeyL' || e.key === 'l' || e.key === 'L') {
          this.p2SwitchRequested = true;
          e.preventDefault();
        }
      } else {
        // --- SINGLE PLAYER: Space or J (Shoot/Tackle), X or K (Pass), Q/Tab (Switch) ---
        if (e.code === 'Space' || e.code === 'KeyJ' || e.key === 'j' || e.key === 'J' || e.key === ' ') {
          this.kickRequested = true;
          e.preventDefault();
        }
        if (e.code === 'KeyX' || e.code === 'KeyK' || e.key === 'x' || e.key === 'X' || e.key === 'k' || e.key === 'K') {
          this.passRequested = true;
          e.preventDefault();
        }
        if (e.code === 'KeyQ' || e.code === 'Tab' || e.key === 'q' || e.key === 'Q') {
          this.switchRequested = true;
          e.preventDefault();
        }
      }

      if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        this.resetRequested = true;
      }
      if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
        this.cameraToggleRequested = true;
      }
    };

    this._onWindowKeyDown = (e) => handleKey(e, true);
    this._onWindowKeyUp = (e) => handleKey(e, false);
    window.addEventListener('keydown', this._onWindowKeyDown);
    window.addEventListener('keyup', this._onWindowKeyUp);

    if (this.canvas) {
      this.canvas.setAttribute('tabindex', '0');
      this.canvas.addEventListener('keydown', (e) => handleKey(e, true));
      this.canvas.addEventListener('keyup', (e) => handleKey(e, false));
      this.canvas.addEventListener('click', () => this.canvas.focus());
      // Ensure canvas is focused initially
      setTimeout(() => this.canvas.focus(), 100);
    }
  }

  setTouchJoystick(active, dirX = 0, dirY = 0) {
    this.touchJoystick.active = !!active;
    this.touchJoystick.dirX = active ? dirX : 0;
    this.touchJoystick.dirY = active ? dirY : 0;
  }

  startTouchKick() {
    this.touchKickHeld = true;
    this.touchKickPolled = false;
    this.touchKickPendingRelease = false;
    this.kickRequested = true;
  }

  endTouchKick() {
    if (this.touchKickHeld && !this.touchKickPolled) {
      this.touchKickPendingRelease = true;
    }
    this.touchKickHeld = false;
  }

  startTouchPass() {
    this.touchPassHeld = true;
    this.touchPassPolled = false;
    this.touchPassPendingRelease = false;
    this.passRequested = true;
  }

  endTouchPass() {
    if (this.touchPassHeld && !this.touchPassPolled) {
      this.touchPassPendingRelease = true;
    }
    this.touchPassHeld = false;
  }

  requestTouchSwitch() {
    this.switchRequested = true;
  }

  clearActiveInputs() {
    this.keys = {};
    this.kickRequested = false;
    this.passRequested = false;
    this.switchRequested = false;
    this.p2KickRequested = false;
    this.p2PassRequested = false;
    this.p2SwitchRequested = false;
    this.resetRequested = false;
    this.cameraToggleRequested = false;
    this.touchKickHeld = false;
    this.touchKickPolled = false;
    this.touchKickPendingRelease = false;
    this.touchPassHeld = false;
    this.touchPassPolled = false;
    this.touchPassPendingRelease = false;
    this.setTouchJoystick(false, 0, 0);
  }

  destroy() {
    if (this._onWindowKeyDown) {
      window.removeEventListener('keydown', this._onWindowKeyDown);
    }
    if (this._onWindowKeyUp) {
      window.removeEventListener('keyup', this._onWindowKeyUp);
    }
  }

  getWasdVector() {
    let dx = 0;
    let dy = 0;

    if (
      this.keys['KeyW'] ||
      this.keys['KeyZ'] ||
      this.keys['w'] ||
      this.keys['W'] ||
      this.keys['z'] ||
      this.keys['Z']
    ) {
      dy -= 1;
    }
    if (this.keys['KeyS'] || this.keys['s'] || this.keys['S']) {
      dy += 1;
    }
    if (this.keys['KeyA'] || this.keys['a'] || this.keys['A']) {
      dx -= 1;
    }
    if (this.keys['KeyD'] || this.keys['d'] || this.keys['D']) {
      dx += 1;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  getArrowVector() {
    let dx = 0;
    let dy = 0;
    if (this.keys['ArrowUp']) dy -= 1;
    if (this.keys['ArrowDown']) dy += 1;
    if (this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['ArrowRight']) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  getMovementVector(slot = 'p1') {
    if (this.localMultiplayer) {
      if (slot === 'p2') {
        return this.getArrowVector();
      }
      const wasd = this.getWasdVector();
      let dx = wasd.x;
      let dy = wasd.y;
      if (this.touchJoystick.active) {
        dx += this.touchJoystick.dirX;
        dy += this.touchJoystick.dirY;
      }
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      return { x: dx, y: dy };
    }

    // Single player merges WASD + Arrows + Touch
    const wasd = this.getWasdVector();
    const arrows = this.getArrowVector();
    let dx = wasd.x + arrows.x;
    let dy = wasd.y + arrows.y;

    if (this.touchJoystick.active) {
      dx += this.touchJoystick.dirX;
      dy += this.touchJoystick.dirY;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  isKickHeld(slot = 'p1') {
    if (this.localMultiplayer) {
      if (slot === 'p2') {
        return !!(this.keys['KeyJ'] || this.keys['j'] || this.keys['J']);
      }
      if (this.touchKickHeld) {
        this.touchKickPolled = true;
        return true;
      }
      if (this.touchKickPendingRelease) {
        this.touchKickPendingRelease = false;
        return true;
      }
      return !!(this.keys['Space'] || this.keys[' ']);
    }

    if (this.touchKickHeld) {
      this.touchKickPolled = true;
      return true;
    }
    if (this.touchKickPendingRelease) {
      this.touchKickPendingRelease = false;
      return true;
    }
    return !!(
      this.keys['Space'] ||
      this.keys['KeyJ'] ||
      this.keys['j'] ||
      this.keys['J'] ||
      this.keys[' ']
    );
  }

  isPassHeld(slot = 'p1') {
    if (this.localMultiplayer) {
      if (slot === 'p2') {
        return !!(this.keys['KeyK'] || this.keys['k'] || this.keys['K']);
      }
      if (this.touchPassHeld) {
        this.touchPassPolled = true;
        return true;
      }
      if (this.touchPassPendingRelease) {
        this.touchPassPendingRelease = false;
        return true;
      }
      return !!(this.keys['KeyX'] || this.keys['x'] || this.keys['X']);
    }

    if (this.touchPassHeld) {
      this.touchPassPolled = true;
      return true;
    }
    if (this.touchPassPendingRelease) {
      this.touchPassPendingRelease = false;
      return true;
    }
    return !!(
      this.keys['KeyX'] ||
      this.keys['KeyK'] ||
      this.keys['x'] ||
      this.keys['X'] ||
      this.keys['k'] ||
      this.keys['K']
    );
  }

  consumeKick(slot = 'p1') {
    if (this.localMultiplayer && slot === 'p2') {
      const kicked = this.p2KickRequested;
      this.p2KickRequested = false;
      return kicked;
    }
    const kicked = this.kickRequested;
    this.kickRequested = false;
    return kicked;
  }

  consumePass(slot = 'p1') {
    if (this.localMultiplayer && slot === 'p2') {
      const passed = this.p2PassRequested;
      this.p2PassRequested = false;
      return passed;
    }
    const passed = this.passRequested;
    this.passRequested = false;
    return passed;
  }

  consumeSwitch(slot = 'p1') {
    if (this.localMultiplayer && slot === 'p2') {
      const sw = this.p2SwitchRequested;
      this.p2SwitchRequested = false;
      return sw;
    }
    const sw = this.switchRequested;
    this.switchRequested = false;
    return sw;
  }

  consumeReset() {
    const res = this.resetRequested;
    this.resetRequested = false;
    return res;
  }

  consumeCameraToggle() {
    const cam = this.cameraToggleRequested;
    this.cameraToggleRequested = false;
    return cam;
  }
}
