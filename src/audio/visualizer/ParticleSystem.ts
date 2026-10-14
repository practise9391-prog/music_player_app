interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  alpha: number;
  color: string;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles = 150;
  private width = 800;
  private height = 400;

  constructor(maxParticles = 150) {
    this.maxParticles = maxParticles;
    this.initParticles();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.particles.length === 0) {
      this.initParticles();
    }
  }

  public setParticleCount(count: number): void {
    this.maxParticles = Math.max(30, Math.min(400, count));
    if (this.particles.length !== this.maxParticles) {
      this.initParticles();
    }
  }

  private initParticles(): void {
    this.particles = [];
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let i = 0; i < this.maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.min(cx, cy) * 0.9;
      const baseRadius = 1.5 + Math.random() * 2.5;

      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: baseRadius,
        baseRadius,
        alpha: 0.3 + Math.random() * 0.5,
        color: '#00e5ff',
      });
    }
  }

  /**
   * Updates particle positions and radii driven by actual audio metrics.
   */
  public update(
    bassEnergy: number,
    midEnergy: number,
    trebleEnergy: number,
    isBeat: boolean,
    reducedMotion = false
  ): void {
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Audio-driven dynamics
    const speedMult = reducedMotion ? 0.3 : 1.0 + midEnergy * 2.5;
    const sizeMult = reducedMotion ? 1.0 : 1.0 + bassEnergy * 3.0;

    for (const p of this.particles) {
      // Move particle
      p.x += p.vx * speedMult;
      p.y += p.vy * speedMult;

      // Wrap around bounds
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Audio reactive size & alpha
      p.radius = p.baseRadius * sizeMult;
      p.alpha = Math.min(1.0, 0.2 + trebleEnergy * 0.7);

      // On beat, apply slight outward burst from center
      if (isBeat && !reducedMotion) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx += (dx / dist) * 2.0;
        p.vy += (dy / dist) * 2.0;
      } else {
        // Friction / return to gentle drift
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    primaryColor: string,
    secondaryColor: string
  ): void {
    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = i % 2 === 0 ? primaryColor : secondaryColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public reset(): void {
    this.initParticles();
  }
}
