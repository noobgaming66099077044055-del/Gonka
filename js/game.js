/**
 * Turbo Poyga - Main Game Orchestrator & Loop
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Systems
    this.audio = window.audioManager;
    this.particles = new ParticleSystem();

    // Configuration / Selected options
    this.selectedTrackId = 'city';
    this.selectedCarId = 'red_fury';
    this.totalLaps = 3;
    this.botCount = 3;
    this.botDifficulty = 'medium';

    // Race State
    this.state = 'MENU'; // MENU, COUNTDOWN, RACING, PAUSED, FINISHED
    this.currentTrack = null;
    this.playerCar = null;
    this.cars = []; // all cars (player + bots)
    this.raceStartTime = 0;
    this.raceTimer = 0;
    this.countdownTimer = 0;
    this.countdownVal = 3;
    this.isPaused = false;
    this.maxSpeedAchieved = 0;

    // Camera
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetZoom: 1.0
    };

    // Timing
    this.lastTime = performance.now();

    // Bind methods
    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    this.buildMenuUI();
    requestAnimationFrame(this.loop);
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Set up Keyboard, Touch and UI Button Listeners
  setupEventListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Audio & Pause HUD buttons
    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const isMuted = this.audio.toggleMute();
        btnSound.textContent = isMuted ? '🔇' : '🔊';
      });
    }

    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => this.togglePause());
    }

    // Menu Actions
    document.getElementById('btn-start-race').addEventListener('click', () => {
      this.audio.ensureContext();
      this.startRace();
    });

    document.getElementById('btn-instructions').addEventListener('click', () => {
      document.getElementById('instructions-modal').classList.remove('hidden');
    });

    document.getElementById('btn-close-instructions').addEventListener('click', () => {
      document.getElementById('instructions-modal').classList.add('hidden');
    });

    // Pause Screen Actions
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => {
      document.getElementById('pause-screen').classList.add('hidden');
      this.startRace();
    });
    document.getElementById('btn-change-track').addEventListener('click', () => {
      document.getElementById('pause-screen').classList.add('hidden');
      this.returnToMenu();
    });
    document.getElementById('btn-to-main-menu').addEventListener('click', () => {
      document.getElementById('pause-screen').classList.add('hidden');
      this.returnToMenu();
    });

    // Results Screen Actions
    document.getElementById('btn-play-again').addEventListener('click', () => {
      document.getElementById('results-screen').classList.add('hidden');
      this.startRace();
    });
    document.getElementById('btn-results-change-track').addEventListener('click', () => {
      document.getElementById('results-screen').classList.add('hidden');
      this.returnToMenu();
    });

    // Config Selects
    document.getElementById('select-laps').addEventListener('change', (e) => {
      this.totalLaps = parseInt(e.target.value, 10);
    });
    document.getElementById('select-bots').addEventListener('change', (e) => {
      this.botCount = parseInt(e.target.value, 10);
    });
    document.getElementById('select-difficulty').addEventListener('change', (e) => {
      this.botDifficulty = e.target.value;
    });

    // Touch controls setup (for mobile / tablet or touch screens)
    this.setupTouchControls();
  }

  setupTouchControls() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const touchPanel = document.getElementById('touch-controls');
    if (isTouchDevice && touchPanel) {
      touchPanel.classList.remove('hidden');
    }

    const bindTouch = (id, key, isTrue) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        if (this.playerCar) this.playerCar.controls[key] = isTrue;
      };
      const end = (e) => {
        e.preventDefault();
        if (this.playerCar) this.playerCar.controls[key] = !isTrue;
      };
      el.addEventListener('touchstart', start);
      el.addEventListener('touchend', end);
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
    };

    bindTouch('btn-left', 'steerLeft', true);
    bindTouch('btn-right', 'steerRight', true);
    bindTouch('btn-gas', 'gas', true);
    bindTouch('btn-brake', 'brake', true);
    bindTouch('btn-nitro', 'nitro', true);
  }

  // Keyboard Handlers
  handleKeyDown(e) {
    if (e.repeat) return;

    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (this.state === 'RACING' || this.state === 'PAUSED') {
        this.togglePause();
        return;
      }
    }

    if (e.key === 'r' || e.key === 'R') {
      if (this.state === 'RACING' && this.playerCar && this.currentTrack) {
        this.resetPlayerToTrack();
        return;
      }
    }

    if (!this.playerCar || this.state !== 'RACING') return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.playerCar.controls.gas = true;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.playerCar.controls.brake = true;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.playerCar.controls.steerLeft = true;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.playerCar.controls.steerRight = true;
        break;
      case 'Shift':
      case ' ':
        this.playerCar.controls.nitro = true;
        break;
    }
  }

  handleKeyUp(e) {
    if (!this.playerCar) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.playerCar.controls.gas = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.playerCar.controls.brake = false;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.playerCar.controls.steerLeft = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.playerCar.controls.steerRight = false;
        break;
      case 'Shift':
      case ' ':
        this.playerCar.controls.nitro = false;
        break;
    }
  }

  // Recover car onto nearest spline point if user presses R or gets lost
  resetPlayerToTrack() {
    const pt = this.currentTrack.spline[this.playerCar.closestSplineIdx];
    this.playerCar.x = pt.x;
    this.playerCar.y = pt.y;
    this.playerCar.angle = pt.angle;
    this.playerCar.speed = 0;
    this.playerCar.vx = 0;
    this.playerCar.vy = 0;

    this.showHUDMessage("Moshina yo'lga qaytarildi!", 1800);
  }

  // Dynamic UI Generation for Track and Car Pickers
  buildMenuUI() {
    // 1. Build Track Cards
    const trackPicker = document.getElementById('track-picker');
    trackPicker.innerHTML = '';
    TRACKS.forEach(t => {
      const card = document.createElement('div');
      card.className = `track-card ${t.id === this.selectedTrackId ? 'selected' : ''}`;
      card.dataset.id = t.id;

      card.innerHTML = `
        <div class="track-preview-box">
          <canvas class="track-canvas-thumb" width="180" height="90"></canvas>
        </div>
        <div class="track-card-title">${t.name}</div>
        <div class="track-card-desc">${t.description}</div>
        <span class="track-difficulty ${t.diffClass}">${t.difficulty}</span>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTrackId = t.id;
      });

      trackPicker.appendChild(card);

      // Render thumbnail canvas
      const thumbCanvas = card.querySelector('.track-canvas-thumb');
      drawTrackThumbnail(thumbCanvas, t);
    });

    // 2. Build Car Cards
    const carPicker = document.getElementById('car-picker');
    carPicker.innerHTML = '';
    CAR_PRESETS.forEach(carPreset => {
      const card = document.createElement('div');
      card.className = `car-card ${carPreset.id === this.selectedCarId ? 'selected' : ''}`;
      card.dataset.id = carPreset.id;

      card.innerHTML = `
        <canvas class="car-preview-canvas" width="160" height="80"></canvas>
        <div class="car-card-name">${carPreset.name}</div>
        <div class="car-stats">
          <div class="car-stat-row">
            <span>Tezlik:</span>
            <div class="stat-bar-mini"><div class="stat-bar-fill" style="width: ${carPreset.stats.speed}%"></div></div>
          </div>
          <div class="car-stat-row">
            <span>Tezlanish:</span>
            <div class="stat-bar-mini"><div class="stat-bar-fill" style="width: ${carPreset.stats.accel}%; background: #00ff88"></div></div>
          </div>
          <div class="car-stat-row">
            <span>Burilish:</span>
            <div class="stat-bar-mini"><div class="stat-bar-fill" style="width: ${carPreset.stats.handling}%; background: #ff0055"></div></div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.car-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedCarId = carPreset.id;
      });

      carPicker.appendChild(card);

      // Draw car preview on small canvas
      const carCanvas = card.querySelector('.car-preview-canvas');
      const cCtx = carCanvas.getContext('2d');
      const dummyCar = new Car({
        x: 80,
        y: 40,
        angle: 0,
        color: carPreset.color,
        secondaryColor: carPreset.secondaryColor
      });
      dummyCar.draw(cCtx);
    });
  }

  // Start the Race
  startRace() {
    // Hide menus
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    // Build chosen Track
    const trackDef = TRACKS.find(t => t.id === this.selectedTrackId) || TRACKS[0];
    this.currentTrack = buildTrack(trackDef);

    // Reset particles
    this.particles.reset();

    // Create Player Car
    const carPreset = CAR_PRESETS.find(c => c.id === this.selectedCarId) || CAR_PRESETS[0];
    const playerStartPos = this.currentTrack.startGrid[0];

    this.playerCar = new Car({
      x: playerStartPos.x,
      y: playerStartPos.y,
      angle: playerStartPos.angle,
      color: carPreset.color,
      secondaryColor: carPreset.secondaryColor,
      maxSpeed: carPreset.maxSpeed,
      accel: carPreset.accel,
      handling: carPreset.handling,
      driftGrip: carPreset.driftGrip,
      name: "Siz (O'yinchi)"
    });

    this.cars = [this.playerCar];

    // Create AI Bot Opponents
    const numBots = Math.min(this.botCount, this.currentTrack.startGrid.length - 1);
    for (let i = 0; i < numBots; i++) {
      const gridSlot = this.currentTrack.startGrid[i + 1];
      const botProfile = BOT_ROSTER[i % BOT_ROSTER.length];

      const bot = new BotCar({
        x: gridSlot.x,
        y: gridSlot.y,
        angle: gridSlot.angle
      }, botProfile);

      bot.setDifficulty(this.botDifficulty);
      this.cars.push(bot);
    }

    // Set camera immediately on player
    this.camera.x = this.playerCar.x;
    this.camera.y = this.playerCar.y;
    this.maxSpeedAchieved = 0;

    // Start 3, 2, 1, GO Countdown
    this.startCountdown();
  }

  startCountdown() {
    this.state = 'COUNTDOWN';
    this.countdownVal = 3;
    const overlay = document.getElementById('countdown-overlay');
    const text = document.getElementById('countdown-text');
    overlay.classList.remove('hidden');
    text.textContent = '3';
    this.audio.playCountdownBeep(false);

    const stepCountdown = () => {
      this.countdownVal--;
      if (this.countdownVal > 0) {
        text.textContent = this.countdownVal;
        this.audio.playCountdownBeep(false);
        setTimeout(stepCountdown, 900);
      } else if (this.countdownVal === 0) {
        text.textContent = 'KETDIK!';
        text.style.color = '#00ff88';
        this.audio.playCountdownBeep(true);
        this.state = 'RACING';
        this.raceStartTime = performance.now();
        this.playerCar.lapStartTime = this.raceStartTime;
        this.cars.forEach(c => c.lapStartTime = this.raceStartTime);

        setTimeout(() => {
          overlay.classList.add('hidden');
          text.style.color = '#fff';
        }, 900);
      }
    };

    setTimeout(stepCountdown, 900);
  }

  togglePause() {
    if (this.state === 'RACING') {
      this.state = 'PAUSED';
      this.audio.stopAll();
      document.getElementById('pause-screen').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'RACING';
      document.getElementById('pause-screen').classList.add('hidden');
    }
  }

  returnToMenu() {
    this.state = 'MENU';
    this.audio.stopAll();
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  }

  showHUDMessage(msg, durationMs = 2000, isWarning = false) {
    const el = document.getElementById('hud-message');
    el.textContent = msg;
    el.className = `hud-msg ${isWarning ? 'warning' : ''}`;
    el.classList.remove('hidden');

    clearTimeout(this.msgTimeout);
    this.msgTimeout = setTimeout(() => {
      el.classList.add('hidden');
    }, durationMs);
  }

  // Game Loop
  loop(now) {
    const dt = Math.min((now - this.lastTime) / 16.666, 2.5); // normalized to 60fps
    this.lastTime = now;

    if (this.state === 'RACING' || this.state === 'COUNTDOWN' || this.state === 'FINISHED') {
      this.update(dt);
      this.render();
    }

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    if (this.state === 'PAUSED') return;

    // Update Race Timer
    if (this.state === 'RACING' && this.raceStartTime > 0) {
      this.raceTimer = (performance.now() - this.raceStartTime) / 1000;
    }

    // 1. Update AI Bots
    for (let car of this.cars) {
      if (car.isBot && this.state === 'RACING') {
        car.updateAI(this.currentTrack, this.cars, dt);
      }
    }

    // 2. Update Physics for All Cars
    for (let car of this.cars) {
      car.update(dt, this.currentTrack, this.particles);
    }

    // 3. Check and Resolve Car-to-Car Collisions
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        this.cars[i].checkCarCollision(this.cars[j], this.audio, this.particles);
      }
    }

    // 4. Update Particle System
    this.particles.update(dt);

    // 5. Update Audio for Player Car
    if (this.playerCar && this.state === 'RACING') {
      const speedKmH = Math.abs(this.playerCar.speed) * 16.5;
      if (speedKmH > this.maxSpeedAchieved) this.maxSpeedAchieved = speedKmH;

      const speedRatio = Math.min(1.0, Math.abs(this.playerCar.speed) / this.playerCar.baseMaxSpeed);
      this.audio.updateEngine(speedRatio, this.playerCar.controls.gas, this.playerCar.controls.brake);
      this.audio.updateSkid(this.playerCar.isDrifting, Math.abs(this.playerCar.speed) / 10);
      this.audio.updateNitro(this.playerCar.isNitroActive);
    }

    // 6. Camera Follow with Smooth Lerp
    if (this.playerCar) {
      const leadX = Math.cos(this.playerCar.angle) * (this.playerCar.speed * 8);
      const leadY = Math.sin(this.playerCar.angle) * (this.playerCar.speed * 8);
      const targetCamX = this.playerCar.x + leadX;
      const targetCamY = this.playerCar.y + leadY;

      this.camera.x += (targetCamX - this.camera.x) * 0.08 * dt;
      this.camera.y += (targetCamY - this.camera.y) * 0.08 * dt;

      // Slight zoom out at high speed
      const speedFactor = Math.abs(this.playerCar.speed) / 16;
      this.camera.targetZoom = 1.0 - speedFactor * 0.12;
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.05 * dt;
    }

    // 7. Check Lap Completions & Race Finish
    this.checkRaceProgress();

    // 8. Update HUD Elements
    this.updateHUD();
  }

  checkRaceProgress() {
    // Sort cars by race progress (laps completed + track distance)
    this.cars.sort((a, b) => b.progressDistance - a.progressDistance);

    // Player position
    const playerRank = this.cars.indexOf(this.playerCar) + 1;

    // Check if player completed a lap
    if (this.playerCar.justCompletedLap) {
      if (this.playerCar.lapsCompleted < this.totalLaps) {
        this.audio.playLapChime();
        this.showHUDMessage(`AYLANISH ${this.playerCar.lapsCompleted}/${this.totalLaps} TUGALLANDI! ⚡`, 1800);
      }
    }

    // Check if player completed race
    if (this.playerCar.lapsCompleted >= this.totalLaps && !this.playerCar.isFinished) {
      this.playerCar.isFinished = true;
      this.playerCar.totalRaceTime = this.raceTimer;
      this.finishRace(playerRank);
    }

    // Check if bots finished
    for (let car of this.cars) {
      if (car.isBot && car.lapsCompleted >= this.totalLaps && !car.isFinished) {
        car.isFinished = true;
        car.totalRaceTime = this.raceTimer;
      }
    }
  }

  finishRace(playerRank) {
    this.state = 'FINISHED';
    this.audio.stopAll();
    this.audio.playVictoryFanfare();

    // Add celebration confetti
    this.particles.addConfetti(this.playerCar.x, this.playerCar.y, 140);

    // Populate Results Screen
    setTimeout(() => {
      document.getElementById('hud').classList.add('hidden');
      const resultsScreen = document.getElementById('results-screen');
      resultsScreen.classList.remove('hidden');

      const title = document.getElementById('result-title');
      const badge = document.getElementById('result-badge');
      const msg = document.getElementById('result-message');

      if (playerRank === 1) {
        title.textContent = "G'ALABA!";
        badge.textContent = "1-O'RIN 🏆";
        badge.style.color = '#ffb700';
        msg.textContent = "Ajoyib haydash! Siz birinchi bo'lib marraga yetib keldingiz!";
      } else if (playerRank === 2) {
        title.textContent = "MARRA!";
        badge.textContent = "2-O'RIN 🥈";
        badge.style.color = '#c0c0c0';
        msg.textContent = "Yaxshi natija! Birinchilikka juda oz qoldi.";
      } else if (playerRank === 3) {
        title.textContent = "MARRA!";
        badge.textContent = "3-O'RIN 🥉";
        badge.style.color = '#cd7f32';
        msg.textContent = "Bronza medali! Keyingi safar g'alaba sizniki bo'ladi.";
      } else {
        title.textContent = "POYGA YAKUNLANDI";
        badge.textContent = `${playerRank}-O'RIN`;
        badge.style.color = '#ff4444';
        msg.textContent = "Xafa bo'lmang, mashg'ulot qiling va yana urinib ko'ring!";
      }

      document.getElementById('result-total-time').textContent = this.formatTime(this.playerCar.totalRaceTime);
      document.getElementById('result-best-lap').textContent = this.playerCar.bestLapTime ? this.formatTime(this.playerCar.bestLapTime) : '--:--.--';
      document.getElementById('result-max-speed').textContent = `${Math.round(this.maxSpeedAchieved)} km/h`;

      // Fill leaderboard table
      const tbody = document.getElementById('leaderboard-body');
      tbody.innerHTML = '';
      this.cars.forEach((c, idx) => {
        const row = document.createElement('tr');
        if (idx === 0) row.className = 'winner';
        if (c === this.playerCar) row.classList.add('player-row');

        const timeStr = c.totalRaceTime > 0 ? this.formatTime(c.totalRaceTime) : (c.isFinished ? 'Marra' : `Aylanish ${c.lapsCompleted}`);
        row.innerHTML = `
          <td><b>${idx + 1}</b></td>
          <td><span class="standing-color-indicator" style="background:${c.color}"></span>${c.name}</td>
          <td>${c.isBot ? 'Sportcar' : 'Custom'}</td>
          <td>${timeStr}</td>
        `;
        tbody.appendChild(row);
      });
    }, 1500);
  }

  // Update In-Game HUD Elements
  updateHUD() {
    if (!this.playerCar) return;

    // Speedometer
    const speedKmH = Math.round(Math.abs(this.playerCar.speed) * 16.5);
    document.getElementById('speed-val').textContent = speedKmH;
    const speedRatio = Math.min(1.0, speedKmH / 260);
    document.getElementById('speed-bar').style.width = `${speedRatio * 100}%`;

    // Nitro Bar
    const nitroRatio = this.playerCar.nitro / this.playerCar.maxNitro;
    document.getElementById('nitro-bar').style.width = `${nitroRatio * 100}%`;

    // Lap Counter
    const curLap = Math.min(this.totalLaps, this.playerCar.lapsCompleted + 1);
    document.getElementById('lap-counter').innerHTML = `${curLap}<span class="hud-sub">/${this.totalLaps}</span>`;

    // Position
    const playerRank = this.cars.indexOf(this.playerCar) + 1;
    document.getElementById('player-position').innerHTML = `${playerRank}<span class="hud-sub">/${this.cars.length}</span>`;

    // Timer
    document.getElementById('race-timer').textContent = this.formatTime(this.raceTimer);
    if (this.playerCar.bestLapTime) {
      document.getElementById('best-lap-time').textContent = this.formatTime(this.playerCar.bestLapTime);
    }

    // Live Standings Widget
    const standingsList = document.getElementById('standings-list');
    if (standingsList) {
      standingsList.innerHTML = '';
      this.cars.forEach((c, idx) => {
        const row = document.createElement('div');
        row.className = `standing-row ${c === this.playerCar ? 'player-row' : ''}`;
        row.innerHTML = `
          <span class="standing-rank">${idx + 1}.</span>
          <span class="standing-color-indicator" style="background: ${c.color}"></span>
          <span class="standing-name">${c.name}</span>
        `;
        standingsList.appendChild(row);
      });
    }

    // Minimap Rendering
    renderMinimap(
      this.minimapCtx,
      this.currentTrack,
      this.cars,
      this.playerCar,
      this.minimapCanvas.width,
      this.minimapCanvas.height
    );
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00.00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    const mm = m < 10 ? '0' + m : m;
    const ss = s < 10 ? '0' + s : s;
    const mss = ms < 10 ? '0' + ms : ms;
    return `${mm}:${ss}.${mss}`;
  }

  // Render Scene
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear Canvas with Track Background Terrain
    ctx.fillStyle = this.currentTrack.groundColor;
    ctx.fillRect(0, 0, w, h);

    // Apply Camera Transform
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Render Track (Road, Curbs, Lines, Scenery)
    renderTrack(ctx, this.currentTrack, this.camera, w / this.camera.zoom, h / this.camera.zoom);

    // 2. Render Skid Marks on Road Surface
    this.particles.drawSkids(ctx);

    // 3. Render Cars (Bots and Player)
    for (let car of this.cars) {
      car.draw(ctx);
    }

    // 4. Render Particles on top of cars (Smoke, Nitro flames, Sparks, Confetti)
    this.particles.drawParticles(ctx);

    // Restore Camera
    ctx.restore();
  }
}

// Start Game on window load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
