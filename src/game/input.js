/**
 * Input Handler
 * Captures WASD / ZQSD / Arrow keys, Space/J for kicks, X/K for passes, Q/Tab for player switching, and touch controls.
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};

    this.kickRequested = false;
    this.passRequested = false;
    this.switchRequested = false;
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

    this.setupKeyboard();
    this.setupTouch();
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

      // Space or J: Shoot / Tackle
      if (e.code === 'Space' || e.code === 'KeyJ' || e.key === 'j' || e.key === 'J' || e.key === ' ') {
        this.kickRequested = true;
        e.preventDefault();
      }
      // X or K: Ground Pass
      if (e.code === 'KeyX' || e.code === 'KeyK' || e.key === 'x' || e.key === 'X' || e.key === 'k' || e.key === 'K') {
        this.passRequested = true;
        e.preventDefault();
      }
      // Q or Tab: Switch Player
      if (e.code === 'KeyQ' || e.code === 'Tab' || e.key === 'q' || e.key === 'Q') {
        this.switchRequested = true;
        e.preventDefault();
      }
      if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        this.resetRequested = true;
      }
      if (e.code === 'KeyC' || e.key === 'c' || e.key === 'C') {
        this.cameraToggleRequested = true;
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    if (this.canvas) {
      this.canvas.setAttribute('tabindex', '0');
      this.canvas.addEventListener('keydown', (e) => handleKey(e, true));
      this.canvas.addEventListener('keyup', (e) => handleKey(e, false));
      this.canvas.addEventListener('click', () => this.canvas.focus());
      // Ensure canvas is focused initially
      setTimeout(() => this.canvas.focus(), 100);
    }
  }

  setupTouch() {
    if (!this.canvas) return;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;

        // Left half of screen controls movement joystick
        if (tx < rect.width * 0.5) {
          this.touchJoystick.active = true;
          this.touchJoystick.startX = tx;
          this.touchJoystick.startY = ty;
          this.touchJoystick.currentX = tx;
          this.touchJoystick.currentY = ty;
        } else {
          // Right half: top half is Shoot, bottom half is Pass
          if (ty < rect.height * 0.5) {
            this.kickRequested = true;
          } else {
            this.passRequested = true;
          }
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.touchJoystick.active && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;

        this.touchJoystick.currentX = tx;
        this.touchJoystick.currentY = ty;

        const dx = tx - this.touchJoystick.startX;
        const dy = ty - this.touchJoystick.startY;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 45;

        if (dist > 5) {
          this.touchJoystick.dirX = dx / Math.min(dist, maxRadius);
          this.touchJoystick.dirY = dy / Math.min(dist, maxRadius);
        } else {
          this.touchJoystick.dirX = 0;
          this.touchJoystick.dirY = 0;
        }
        e.preventDefault();
      }
    }, { passive: false });

    const endTouch = () => {
      this.touchJoystick.active = false;
      this.touchJoystick.dirX = 0;
      this.touchJoystick.dirY = 0;
    };

    this.canvas.addEventListener('touchend', endTouch);
    this.canvas.addEventListener('touchcancel', endTouch);
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;

    // Support QWERTY (WASD), AZERTY (ZQSD), and Arrow keys
    // UP: W, Z, ArrowUp
    if (
      this.keys['KeyW'] ||
      this.keys['KeyZ'] ||
      this.keys['w'] ||
      this.keys['W'] ||
      this.keys['z'] ||
      this.keys['Z'] ||
      this.keys['ArrowUp']
    ) {
      dy -= 1;
    }

    // DOWN: S, ArrowDown
    if (
      this.keys['KeyS'] ||
      this.keys['s'] ||
      this.keys['S'] ||
      this.keys['ArrowDown']
    ) {
      dy += 1;
    }

    // LEFT: A, Q, ArrowLeft
    if (
      this.keys['KeyA'] ||
      this.keys['a'] ||
      this.keys['A'] ||
      this.keys['ArrowLeft']
    ) {
      dx -= 1;
    }

    // RIGHT: D, ArrowRight
    if (
      this.keys['KeyD'] ||
      this.keys['d'] ||
      this.keys['D'] ||
      this.keys['ArrowRight']
    ) {
      dx += 1;
    }

    // Merge with touch joystick if active
    if (this.touchJoystick.active) {
      dx += this.touchJoystick.dirX;
      dy += this.touchJoystick.dirY;
    }

    // Normalize diagonal velocity
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    return { x: dx, y: dy };
  }

  isKickHeld() {
    return !!(
      this.keys['Space'] ||
      this.keys['KeyJ'] ||
      this.keys['j'] ||
      this.keys['J'] ||
      this.keys[' '] ||
      this.touchKickHeld
    );
  }

  isPassHeld() {
    return !!(
      this.keys['KeyX'] ||
      this.keys['KeyK'] ||
      this.keys['x'] ||
      this.keys['X'] ||
      this.keys['k'] ||
      this.keys['K'] ||
      this.touchPassHeld
    );
  }

  consumeKick() {
    const kicked = this.kickRequested;
    this.kickRequested = false;
    return kicked;
  }

  consumePass() {
    const passed = this.passRequested;
    this.passRequested = false;
    return passed;
  }

  consumeSwitch() {
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
