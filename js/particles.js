/**
 * Particle and Skid Mark System for Turbo Poyga
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.skidMarks = [];
    this.maxSkidMarks = 1200;
  }

  reset() {
    this.particles = [];
    this.skidMarks = [];
  }

  // Add skid mark segment from tire
  addSkid(x1, y1, x2, y2, alpha = 0.5, width = 4) {
    if (this.skidMarks.length >= this.maxSkidMarks) {
      this.skidMarks.shift(); // remove oldest
    }
    this.skidMarks.push({
      x1, y1, x2, y2,
      alpha,
      width,
      life: 1.0 // will decay gradually
    });
  }

  // Add tire smoke (grey/white)
  addSmoke(x, y, vx = 0, vy = 0, color = 'rgba(200, 210, 220, 0.4)') {
    this.particles.push({
      type: 'smoke',
      x, y,
      vx: vx + (Math.random() - 0.5) * 1.5,
      vy: vy + (Math.random() - 0.5) * 1.5,
      size: 5 + Math.random() * 5,
      maxSize: 22 + Math.random() * 8,
      life: 0,
      maxLife: 25 + Math.random() * 15,
      color
    });
  }

  // Add nitro flame exhaust particles (cyan / bright orange)
  addNitroFlames(x, y, angle) {
    const spread = (Math.random() - 0.5) * 0.4;
    const speed = -(5 + Math.random() * 5);
    const vx = Math.cos(angle + spread) * speed;
    const vy = Math.sin(angle + spread) * speed;

    this.particles.push({
      type: 'nitro',
      x, y,
      vx, vy,
      size: 4 + Math.random() * 4,
      maxSize: 1,
      life: 0,
      maxLife: 12 + Math.random() * 6,
      color: Math.random() > 0.3 ? '#00f0ff' : '#ffffff'
    });
  }

  // Add impact sparks when colliding
  addSparks(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        type: 'spark',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2,
        life: 0,
        maxLife: 15 + Math.random() * 10,
        color: Math.random() > 0.5 ? '#ffcc00' : '#ff4400'
      });
    }
  }

  // Confetti burst for victory
  addConfetti(x, y, count = 100) {
    const colors = ['#00f0ff', '#ff0055', '#ffb700', '#00ff88', '#ffffff', '#9b51e0'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 10;
      this.particles.push({
        type: 'confetti',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        life: 0,
        maxLife: 120 + Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  update(dt = 1) {
    // Update skid marks decay
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const s = this.skidMarks[i];
      s.life -= 0.0006 * dt; // persists for a long time
      if (s.life <= 0) {
        this.skidMarks.splice(i, 1);
      }
    }

    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === 'smoke') {
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.size += (p.maxSize - p.size) * 0.08 * dt;
      } else if (p.type === 'spark') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else if (p.type === 'confetti') {
        p.vy += 0.08 * dt; // gravity
        p.vx *= 0.98;
        p.rot += p.rotSpeed * dt;
      }

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  // Draw skid marks on the road surface
  drawSkids(ctx) {
    if (this.skidMarks.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < this.skidMarks.length; i++) {
      const s = this.skidMarks[i];
      const curAlpha = s.alpha * s.life;
      if (curAlpha <= 0.02) continue;

      ctx.strokeStyle = `rgba(20, 20, 25, ${curAlpha})`;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw upper particles (smoke, sparks, nitro, confetti)
  drawParticles(ctx) {
    if (this.particles.length === 0) return;

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const progress = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - progress);

      if (p.type === 'smoke') {
        ctx.fillStyle = `rgba(200, 210, 220, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'nitro') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.8), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
