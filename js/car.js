/**
 * Car Physics and Rendering Class for Turbo Poyga
 */

// Canvas roundRect polyfill for compatibility
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r = 4) {
    if (typeof r === 'number') {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
    } else {
      r = 4;
    }
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// Available Car Presets
const CAR_PRESETS = [
  {
    id: 'red_fury',
    name: "Qizil Bo'ri",
    color: '#ff1a40',
    secondaryColor: '#1a1a1a',
    maxSpeed: 14.8,
    accel: 0.22,
    handling: 0.046,
    driftGrip: 0.88,
    stats: { speed: 85, accel: 90, handling: 82 }
  },
  {
    id: 'blue_lightning',
    name: 'Moviy Chaqmoq',
    color: '#00d0ff',
    secondaryColor: '#0b1d3a',
    maxSpeed: 16.0,
    accel: 0.19,
    handling: 0.043,
    driftGrip: 0.90,
    stats: { speed: 96, accel: 78, handling: 80 }
  },
  {
    id: 'poison_green',
    name: 'Zahar Yashil (Drift)',
    color: '#00ff66',
    secondaryColor: '#112211',
    maxSpeed: 14.2,
    accel: 0.20,
    handling: 0.052,
    driftGrip: 0.82,
    stats: { speed: 78, accel: 84, handling: 98 }
  },
  {
    id: 'gold_beast',
    name: 'Oltin Qoplon',
    color: '#ffb700',
    secondaryColor: '#2b2000',
    maxSpeed: 15.2,
    accel: 0.23,
    handling: 0.048,
    driftGrip: 0.89,
    stats: { speed: 89, accel: 94, handling: 88 }
  }
];

class Car {
  constructor(config = {}) {
    this.name = config.name || "Poygachi";
    this.color = config.color || '#ff1a40';
    this.secondaryColor = config.secondaryColor || '#1a1a1a';
    this.isBot = config.isBot || false;

    // Physical dimensions
    this.width = 24;
    this.length = 46;
    this.radius = 22; // collision radius

    // Transform
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.angle = config.angle || 0;
    this.steerAngle = 0;

    // Speeds & Vectors
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;

    // Configurable Performance Stats
    this.baseMaxSpeed = config.maxSpeed || 14.8;
    this.maxSpeed = this.baseMaxSpeed;
    this.accel = config.accel || 0.21;
    this.brakePower = 0.32;
    this.reverseMaxSpeed = 4.5;
    this.steerRate = config.handling || 0.046;
    this.driftGrip = config.driftGrip || 0.88; // lateral grip
    this.drag = 0.982; // aerodynamic friction

    // Nitro System
    this.nitro = 100;
    this.maxNitro = 100;
    this.isNitroActive = false;
    this.nitroRechargeRate = 4.5; // per second

    // Status Flags
    this.isOffRoad = false;
    this.isDrifting = false;
    this.isBraking = false;
    this.isAccelerating = false;

    // Lap & Race Progress Tracking
    this.nextCheckpoint = 1;
    this.lapsCompleted = 0;
    this.justCompletedLap = false;
    this.lapStartTime = 0;
    this.bestLapTime = null;
    this.lapTimes = [];
    this.totalRaceTime = 0;
    this.isFinished = false;
    this.progressDistance = 0; // for real-time ranking
    this.closestSplineIdx = 0;

    // Prev position for skid tracking
    this.prevWheelL = null;
    this.prevWheelR = null;

    // Control Inputs
    this.controls = {
      gas: false,
      brake: false,
      steerLeft: false,
      steerRight: false,
      nitro: false
    };
  }

  resetPosition(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.steerAngle = 0;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.isNitroActive = false;
    this.isDrifting = false;
    this.prevWheelL = null;
    this.prevWheelR = null;
    this.closestSplineIdx = 0;
    this.nextCheckpoint = 1;
    this.lapsCompleted = 0;
    this.justCompletedLap = false;
    this.isFinished = false;
    this.lapTimes = [];
    this.bestLapTime = null;
    this.totalRaceTime = 0;
    this.nitro = 100;
  }

  update(dt, track, particleSystem) {
    if (this.isFinished) {
      // Smooth deceleration after finish line
      this.speed *= 0.95;
      this.vx *= 0.95;
      this.vy *= 0.95;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }

    // 1. Off-Road Check (Distance to Track Centerline)
    const closest = getClosestSplinePoint(track.spline, this.x, this.y, this.closestSplineIdx, 50);
    this.closestSplineIdx = closest.index;
    this.isOffRoad = closest.distance > (track.trackWidth / 2);

    // Speed caps and friction based on surface
    const surfaceSpeedLimit = this.isOffRoad ? 5.0 : this.baseMaxSpeed;
    const currentDrag = this.isOffRoad ? 0.92 : this.drag;

    // 2. Nitro Handling
    if (this.controls.nitro && this.nitro > 0 && this.speed > 2.0 && !this.isOffRoad) {
      this.isNitroActive = true;
      this.nitro = Math.max(0, this.nitro - 28 * (dt / 60));
      this.maxSpeed = this.baseMaxSpeed * 1.38;
      // Emit nitro flame exhaust
      if (particleSystem) {
        const backX = this.x - Math.cos(this.angle) * (this.length / 2 + 2);
        const backY = this.y - Math.sin(this.angle) * (this.length / 2 + 2);
        particleSystem.addNitroFlames(backX, backY, this.angle);
      }
    } else {
      this.isNitroActive = false;
      this.maxSpeed = surfaceSpeedLimit;
      // Passive nitro refill
      this.nitro = Math.min(this.maxNitro, this.nitro + this.nitroRechargeRate * (dt / 60));
    }

    // 3. Acceleration & Braking
    this.isAccelerating = this.controls.gas;
    this.isBraking = this.controls.brake;

    if (this.controls.gas) {
      const accelFactor = this.isNitroActive ? this.accel * 2.0 : this.accel;
      if (this.speed < this.maxSpeed) {
        this.speed += accelFactor * dt;
      }
    } else if (this.controls.brake) {
      if (this.speed > 0.5) {
        this.speed -= this.brakePower * dt;
      } else if (this.speed <= 0.5 && this.speed > -this.reverseMaxSpeed) {
        // Reverse
        this.speed -= 0.12 * dt;
      }
    }

    // Drag / Natural slowdown
    this.speed *= currentDrag;
    if (Math.abs(this.speed) < 0.05) this.speed = 0;

    // 4. Steering & Rotation
    let targetSteer = 0;
    if (this.controls.steerLeft) targetSteer -= 1;
    if (this.controls.steerRight) targetSteer += 1;

    // Steering responsiveness scales with speed (can't steer standing still)
    const speedRatio = Math.min(1.0, Math.abs(this.speed) / 4.0);
    const steerDir = this.speed >= 0 ? 1 : -1; // invert when reversing
    this.angle += targetSteer * this.steerRate * speedRatio * steerDir * dt;
    this.steerAngle = targetSteer * 0.45; // for wheel visual rotation

    // 5. Velocity and Drift Physics
    // Forward unit vector
    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);

    // Lateral (perpendicular) unit vector
    const rightX = -Math.sin(this.angle);
    const rightY = Math.cos(this.angle);

    // Project current velocity into forward and lateral components
    const currentForwardSpeed = this.vx * forwardX + this.vy * forwardY;
    const currentLateralSpeed = this.vx * rightX + this.vy * rightY;

    // Blend intended forward speed with current velocity
    const targetForwardSpeed = this.speed;
    const newForwardSpeed = currentForwardSpeed + (targetForwardSpeed - currentForwardSpeed) * 0.25;

    // Apply lateral grip (lower grip = more drift slide)
    const effectiveGrip = this.isOffRoad ? 0.75 : this.driftGrip;
    const newLateralSpeed = currentLateralSpeed * effectiveGrip;

    // Reconstruct velocity vector
    this.vx = forwardX * newForwardSpeed + rightX * newLateralSpeed;
    this.vy = forwardY * newForwardSpeed + rightY * newLateralSpeed;

    // Move car
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 6. Drift & Skid Marks Detection
    const driftSlip = Math.abs(currentLateralSpeed);
    this.isDrifting = driftSlip > 2.4 && Math.abs(this.speed) > 5.0 && !this.isOffRoad;

    // Compute rear wheel positions
    const rearDist = this.length * 0.38;
    const axleHalfW = this.width * 0.44;
    const rearCenterX = this.x - forwardX * rearDist;
    const rearCenterY = this.y - forwardY * rearDist;

    const curWheelL = {
      x: rearCenterX + rightX * axleHalfW,
      y: rearCenterY + rightY * axleHalfW
    };
    const curWheelR = {
      x: rearCenterX - rightX * axleHalfW,
      y: rearCenterY - rightY * axleHalfW
    };

    if (particleSystem) {
      if ((this.isDrifting || (this.controls.brake && this.speed > 6.0)) && this.prevWheelL && this.prevWheelR) {
        const skidAlpha = Math.min(0.65, driftSlip * 0.12);
        particleSystem.addSkid(this.prevWheelL.x, this.prevWheelL.y, curWheelL.x, curWheelL.y, skidAlpha);
        particleSystem.addSkid(this.prevWheelR.x, this.prevWheelR.y, curWheelR.x, curWheelR.y, skidAlpha);

        // Smoke from rear tires
        if (Math.random() < 0.6) {
          particleSystem.addSmoke(curWheelL.x, curWheelL.y, this.vx * 0.2, this.vy * 0.2);
          particleSystem.addSmoke(curWheelR.x, curWheelR.y, this.vx * 0.2, this.vy * 0.2);
        }

        // Drifting recharges nitro faster!
        this.nitro = Math.min(this.maxNitro, this.nitro + 12 * (dt / 60));
      }
    }

    this.prevWheelL = curWheelL;
    this.prevWheelR = curWheelR;

    // 7. Progress & Checkpoints Logic
    this.updateCheckpoints(track);
  }

  updateCheckpoints(track) {
    this.justCompletedLap = false;
    const numCheckpoints = track.checkpoints.length;
    const targetCheckpoint = track.checkpoints[this.nextCheckpoint];
    if (!targetCheckpoint) return;

    const distToCheckpoint = Math.hypot(this.x - targetCheckpoint.x, this.y - targetCheckpoint.y);

    // Trigger checkpoint if within radius
    if (distToCheckpoint < track.trackWidth * 0.9) {
      if (this.nextCheckpoint === 0) {
        // Crossed finish line! Completed full lap!
        this.lapsCompleted++;
        this.nextCheckpoint = 1;
        this.justCompletedLap = true;

        // Measure lap time
        const now = performance.now();
        if (this.lapStartTime > 0) {
          const lapTime = (now - this.lapStartTime) / 1000;
          this.lapTimes.push(lapTime);
          if (!this.bestLapTime || lapTime < this.bestLapTime) {
            this.bestLapTime = lapTime;
          }
        }
        this.lapStartTime = now;
      } else {
        this.nextCheckpoint++;
        if (this.nextCheckpoint >= numCheckpoints) {
          this.nextCheckpoint = 0; // Next target is the finish line!
        }
      }
    }

    // Cumulative progress distance for real-time race ranking
    const splineDist = track.spline[this.closestSplineIdx] ? track.spline[this.closestSplineIdx].dist : 0;
    this.progressDistance = this.lapsCompleted * track.totalLength + splineDist;
  }

  // Draw Car onto Canvas
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const w = this.width;
    const l = this.length;
    const halfW = w / 2;
    const halfL = l / 2;

    // 1. Soft Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(-halfL - 2, -halfW - 2, l + 4, w + 4, 8);
    ctx.fill();

    // 2. Wheels
    const drawWheel = (wx, wy, steer = 0) => {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(steer);
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(-6, -3, 12, 6);
      // Rim
      ctx.fillStyle = '#666';
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    };

    const frontWheelOffset = halfL * 0.65;
    const rearWheelOffset = -halfL * 0.65;
    const wheelTrack = halfW + 1;

    // Front wheels (turn with steer angle)
    drawWheel(frontWheelOffset, -wheelTrack, this.steerAngle);
    drawWheel(frontWheelOffset, wheelTrack, this.steerAngle);

    // Rear wheels (fixed)
    drawWheel(rearWheelOffset, -wheelTrack, 0);
    drawWheel(rearWheelOffset, wheelTrack, 0);

    // 3. Car Body Shell
    ctx.fillStyle = this.color;
    ctx.beginPath();
    // Rounded aerodynamic sports car contour
    ctx.moveTo(halfL - 6, -halfW + 4);
    ctx.lineTo(halfL, -halfW + 8);
    ctx.lineTo(halfL, halfW - 8);
    ctx.lineTo(halfL - 6, halfW - 4);
    ctx.lineTo(-halfL + 6, halfW);
    ctx.lineTo(-halfL, halfW - 4);
    ctx.lineTo(-halfL, -halfW + 4);
    ctx.lineTo(-halfL + 6, -halfW);
    ctx.closePath();
    ctx.fill();

    // Secondary body stripe / accent
    ctx.fillStyle = this.secondaryColor;
    ctx.fillRect(-halfL * 0.3, -halfW * 0.4, halfL * 0.8, halfW * 0.8);

    // 4. Cockpit / Windshield (Tinted glass)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-halfL * 0.25, -halfW * 0.65, halfL * 0.65, halfW * 1.3, 4);
    ctx.fill();

    // Windshield reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(halfL * 0.35, -halfW * 0.5);
    ctx.lineTo(halfL * 0.35, halfW * 0.5);
    ctx.lineTo(halfL * 0.1, halfW * 0.5);
    ctx.closePath();
    ctx.fill();

    // 5. Rear Spoiler
    ctx.fillStyle = '#111';
    ctx.fillRect(-halfL - 2, -halfW - 2, 4, w + 4);

    // 6. Headlights (Bright White / Yellow)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(halfL - 2, -halfW + 2, 3, 5);
    ctx.fillRect(halfL - 2, halfW - 7, 3, 5);

    // Headlight glow projection forward
    ctx.fillStyle = 'rgba(255, 255, 200, 0.15)';
    ctx.beginPath();
    ctx.moveTo(halfL, -halfW + 4);
    ctx.lineTo(halfL + 40, -halfW - 12);
    ctx.lineTo(halfL + 40, halfW + 12);
    ctx.lineTo(halfL, halfW - 4);
    ctx.closePath();
    ctx.fill();

    // 7. Taillights (Red glow when braking)
    const brakeColor = (this.isBraking || this.speed < 0) ? '#ff0033' : '#880000';
    ctx.fillStyle = brakeColor;
    ctx.shadowColor = (this.isBraking) ? '#ff0033' : 'transparent';
    ctx.shadowBlur = (this.isBraking) ? 12 : 0;
    ctx.fillRect(-halfL, -halfW + 2, 2, 6);
    ctx.fillRect(-halfL, halfW - 8, 2, 6);
    ctx.shadowBlur = 0;

    // 8. Driver Name Tag above car
    if (this.isBot) {
      ctx.save();
      ctx.rotate(-this.angle); // keep text horizontal
      ctx.fillStyle = 'rgba(10, 14, 25, 0.8)';
      ctx.beginPath();
      ctx.roundRect(-28, -halfW - 26, 56, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, 0, -halfW - 14);
      ctx.restore();
    }

    ctx.restore();
  }

  // Check and resolve collision with another car
  checkCarCollision(other, audioManager, particleSystem) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const dist = Math.hypot(dx, dy);
    const minDist = this.radius + other.radius;

    if (dist < minDist && dist > 0) {
      // Overlap normal
      const nx = dx / dist;
      const ny = dy / dist;

      // Separate cars so they don't stick
      const overlap = (minDist - dist) * 0.5;
      this.x -= nx * overlap;
      this.y -= ny * overlap;
      other.x += nx * overlap;
      other.y += ny * overlap;

      // Relative velocity
      const rvx = other.vx - this.vx;
      const rvy = other.vy - this.vy;

      // Velocity along normal
      const velAlongNormal = rvx * nx + rvy * ny;

      // Do not resolve if velocities are separating
      if (velAlongNormal < 0) {
        const restitution = 0.65; // bounce factor
        const impulse = -(1 + restitution) * velAlongNormal * 0.5;

        this.vx -= impulse * nx;
        this.vy -= impulse * ny;
        other.vx += impulse * nx;
        other.vy += impulse * ny;

        // Collision sound & sparks
        const impactSpeed = Math.abs(velAlongNormal);
        if (impactSpeed > 1.5) {
          if (audioManager) audioManager.playCrash(Math.min(1.0, impactSpeed / 8));
          if (particleSystem) {
            const contactX = (this.x + other.x) * 0.5;
            const contactY = (this.y + other.y) * 0.5;
            particleSystem.addSparks(contactX, contactY, Math.min(15, Math.floor(impactSpeed * 2)));
          }
        }
      }
    }
  }
}
