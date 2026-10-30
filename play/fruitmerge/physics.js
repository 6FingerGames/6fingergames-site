// Minimal circle physics: gravity, impulse collisions, walls, floor.
// Logical playfield coordinates; the renderer scales them to the canvas.
class World {
  constructor(left, right, floor) {
    this.left = left; this.right = right; this.floor = floor;
    this.gravity = 2400;
    this.bodies = [];
    this.nextId = 1;
  }
  add(x, y, r, level) {
    const b = { id: this.nextId++, x, y, vx: 0, vy: 0, r, level,
                mass: r * r, alive: true, born: 0, angle: Math.random() * 6.28,
                spin: 0 };
    this.bodies.push(b);
    return b;
  }
  remove(b) { b.alive = false; }
  step(dt) {
    this.mergeHits = [];
    const bs = this.bodies;
    for (const b of bs) {
      b.born += dt;
      b.vy += this.gravity * dt;
      // mild air drag keeps the pile calm
      b.vx *= (1 - 0.12 * dt);
      b.vy *= (1 - 0.02 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      // angular damping: spinning always bleeds off, tiny spins stop dead
      b.spin *= Math.max(0, 1 - 5 * dt);
      if (Math.abs(b.spin) < 0.06) b.spin = 0;
      if (b.spin > 6) b.spin = 6; else if (b.spin < -6) b.spin = -6;
    }
    for (let it = 0; it < 5; it++) this.collide(bs);
    for (const b of bs) this.walls(b);
    this.bodies = bs.filter(b => b.alive);
  }
  collide(bs) {
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (!a.alive) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        if (a.level === b.level) this.mergeHits.push([a, b]);
        const nx = dx / d, ny = dy / d;
        const overlap = rr - d;
        const tm = a.mass + b.mass;
        // positional correction, weighted by mass
        a.x -= nx * overlap * (b.mass / tm) * 0.8;
        a.y -= ny * overlap * (b.mass / tm) * 0.8;
        b.x += nx * overlap * (a.mass / tm) * 0.8;
        b.y += ny * overlap * (a.mass / tm) * 0.8;
        // impulse
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const e = 0.08;
          const jimp = -(1 + e) * vn / (1 / a.mass + 1 / b.mass);
          const ix = jimp * nx, iy = jimp * ny;
          a.vx -= ix / a.mass; a.vy -= iy / a.mass;
          b.vx += ix / b.mass; b.vy += iy / b.mass;
          // tangential friction + rolling spin
          const tx = -ny, ty = nx;
          const vt = rvx * tx + rvy * ty;
          const f = -vt * 0.12 / (1 / a.mass + 1 / b.mass);
          a.vx -= f * tx / a.mass; a.vy -= f * ty / a.mass;
          b.vx += f * tx / b.mass; b.vy += f * ty / b.mass;
        }
      }
    }
  }
  walls(b) {
    if (b.x - b.r < this.left)  { b.x = this.left + b.r;  if (b.vx < 0) b.vx *= -0.25; }
    if (b.x + b.r > this.right) { b.x = this.right - b.r; if (b.vx > 0) b.vx *= -0.25; }
    if (b.y + b.r > this.floor) {
      b.y = this.floor - b.r;
      if (b.vy > 0) b.vy *= -0.12;
      b.vx *= 0.94;
      if (Math.abs(b.vy) < 30) b.vy = 0;
      // rolling without slipping on the floor + rolling resistance
      b.spin += (b.vx / b.r - b.spin) * 0.25;
      b.spin *= 0.9;
      if (Math.abs(b.spin) < 0.06) b.spin = 0;
    }
  }
}
