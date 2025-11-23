export class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
        this.gravity = 0.1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    isDead() {
        return this.life <= 0;
    }
}

export default class ParticleRenderer {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, options = {}) {
        const {
            color = '#ff6600',
            size = 3,
            life = 30,
            spread = 2
        } = options;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * spread;

            this.particles.push(new Particle(
                x,
                y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 1, // Upward bias
                life + Math.random() * 10,
                color,
                size + Math.random() * 2
            ));
        }
    }

    update() {
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => !p.isDead());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    // Presets
    bloodSplatter(x, y) {
        this.emit(x, y, 10, { color: '#ff0000', size: 2, life: 20, spread: 3 });
    }

    swordHit(x, y) {
        this.emit(x, y, 5, { color: '#ffff00', size: 3, life: 15, spread: 2 });
    }

    buildingDust(x, y) {
        this.emit(x, y, 15, { color: '#8B4513', size: 4, life: 40, spread: 1.5 });
    }

    goldSparkle(x, y) {
        this.emit(x, y, 3, { color: '#ffd700', size: 2, life: 25, spread: 1 });
    }
}
