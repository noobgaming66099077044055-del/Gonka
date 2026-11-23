/**
 * AI Bot Opponents for Turbo Poyga
 */

// Bot Personalities
const BOT_ROSTER = [
  {
    name: 'Timur (Tezkor)',
    color: '#ffaa00',
    secondaryColor: '#332200',
    topSpeedFactor: 1.0,
    accelFactor: 1.02,
    corneringSkill: 0.95,
    nitroAggression: 0.85
  },
  {
    name: 'Jasur (Drifter)',
    color: '#9b51e0',
    secondaryColor: '#1c0f2a',
    topSpeedFactor: 0.98,
    accelFactor: 1.05,
    corneringSkill: 0.90,
    nitroAggression: 0.95
  },
  {
    name: 'Alex (Pro)',
    color: '#00e5ff',
    secondaryColor: '#002933',
    topSpeedFactor: 1.02,
    accelFactor: 0.98,
    corneringSkill: 0.98,
    nitroAggression: 0.80
  },
  {
    name: 'Sarah (Shiddat)',
    color: '#ff0077',
    secondaryColor: '#330018',
    topSpeedFactor: 0.99,
    accelFactor: 1.03,
    corneringSkill: 0.94,
    nitroAggression: 0.90
  },
  {
    name: 'Farhod (Bo\'ron)',
    color: '#00ff88',
    secondaryColor: '#003319',
    topSpeedFactor: 0.97,
    accelFactor: 1.01,
    corneringSkill: 0.92,
    nitroAggression: 0.75
  }
];

class BotCar extends Car {
  constructor(config = {}, botProfile = {}) {
    super({
      ...config,
      isBot: true,
      name: botProfile.name || config.name || "Bot",
      color: botProfile.color || config.color || '#ffaa00',
      secondaryColor: botProfile.secondaryColor || '#222'
    });

    this.profile = botProfile;
    this.difficulty = 'medium'; // easy, medium, hard
    this.laneOffset = (Math.random() - 0.5) * 35; // individual racing line
    this.targetLaneOffset = this.laneOffset;
    this.lookaheadDist = 200; // pixels ahead on spline

    // Apply profile factors
    this.baseMaxSpeed *= (botProfile.topSpeedFactor || 1.0);
    this.accel *= (botProfile.accelFactor || 1.0);
    this.corneringSkill = botProfile.corneringSkill || 0.95;
    this.nitroAggression = botProfile.nitroAggression || 0.85;

    // AI timer for lane changes and reactions
    this.aiDecisionTimer = Math.random() * 60;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    if (diff === 'easy') {
      this.maxSpeed = this.baseMaxSpeed * 0.88;
      this.corneringSkill = 0.82;
      this.lookaheadDist = 170;
    } else if (diff === 'medium') {
      this.maxSpeed = this.baseMaxSpeed * 0.96;
      this.corneringSkill = 0.93;
      this.lookaheadDist = 210;
    } else if (diff === 'hard') {
      this.maxSpeed = this.baseMaxSpeed * 1.04;
      this.corneringSkill = 0.99;
      this.lookaheadDist = 240;
    }
  }

  // Update AI Decisions
  updateAI(track, allCars, dt) {
    if (this.isFinished) {
      this.controls.gas = false;
      this.controls.brake = true;
      this.controls.steerLeft = false;
      this.controls.steerRight = false;
      this.controls.nitro = false;
      return;
    }

    const spline = track.spline;
    const n = spline.length;

    // 1. Target Waypoint on Spline
    // Step forward along spline based on lookahead distance
    const lookaheadSteps = Math.floor((this.lookaheadDist / track.totalLength) * n);
    const targetIdx = (this.closestSplineIdx + lookaheadSteps) % n;
    const targetPt = spline[targetIdx];

    // Smoothly adjust lane offset toward targetLaneOffset
    this.laneOffset += (this.targetLaneOffset - this.laneOffset) * 0.05;

    // Compute target coordinates with lane offset along track normal
    const targetX = targetPt.x + targetPt.nx * this.laneOffset;
    const targetY = targetPt.y + targetPt.ny * this.laneOffset;

    // 2. Steering Decision
    const angleToTarget = Math.atan2(targetY - this.y, targetX - this.x);
    let angleDiff = angleToTarget - this.angle;

    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const deadzone = 0.04;
    this.controls.steerLeft = angleDiff < -deadzone;
    this.controls.steerRight = angleDiff > deadzone;

    // 3. Upcoming Corner Detection & Speed Control
    // Sample curve further ahead
    const farLookaheadSteps = Math.floor((320 / track.totalLength) * n);
    const farTargetIdx = (this.closestSplineIdx + farLookaheadSteps) % n;
    const farPt = spline[farTargetIdx];
    const curveDiff = Math.abs(farPt.angle - targetPt.angle);

    // Sharp turn ahead -> ease off throttle or brake
    const isSharpCurve = curveDiff > 0.6;
    if (isSharpCurve && this.speed > 8.0) {
      this.controls.gas = false;
      this.controls.brake = this.speed > 10.5;
    } else {
      this.controls.gas = true;
      this.controls.brake = false;
    }

    // 4. Nitro Usage on Straights
    if (!isSharpCurve && Math.abs(angleDiff) < 0.15 && this.speed > 11.0 && this.nitro > 25) {
      if (Math.random() < this.nitroAggression * 0.05) {
        this.controls.nitro = true;
      }
    } else {
      this.controls.nitro = false;
    }

    // 5. Obstacle Avoidance & Overtaking Logic
    this.aiDecisionTimer += dt;
    if (this.aiDecisionTimer > 30) {
      this.aiDecisionTimer = 0;

      // Look for cars immediately in front
      const forwardX = Math.cos(this.angle);
      const forwardY = Math.sin(this.angle);
      const rightX = -Math.sin(this.angle);
      const rightY = Math.cos(this.angle);

      let carAhead = null;
      let minAheadDist = 120;

      for (let other of allCars) {
        if (other === this) continue;
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distForward = dx * forwardX + dy * forwardY;
        const distLateral = Math.abs(dx * rightX + dy * rightY);

        if (distForward > 10 && distForward < minAheadDist && distLateral < 30) {
          minAheadDist = distForward;
          carAhead = other;
        }
      }

      // If there's a car right in front, switch lanes to overtake!
      if (carAhead) {
        const side = this.laneOffset > 0 ? -1 : 1;
        this.targetLaneOffset = side * (track.trackWidth * 0.28);
      } else {
        // Return to natural cruising line
        if (Math.random() < 0.15) {
          this.targetLaneOffset = (Math.random() - 0.5) * (track.trackWidth * 0.4);
        }
      }
    }
  }
}
