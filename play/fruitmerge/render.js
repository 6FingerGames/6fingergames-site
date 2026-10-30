// Sprite-based rendering. Fruit bodies rotate; the highlight is a separate
// screen-space layer, always lit from the upper left (never rotates).
const FRUITS = [
  { r:31,  src:"assets/fruit0.png" }, // apple
  { r:42,  src:"assets/fruit1.png" }, // orange
  { r:53,  src:"assets/fruit2.png" }, // lemon
  { r:66,  src:"assets/fruit3.png" }, // plum
  { r:82,  src:"assets/fruit4.png" }, // strawberry
  { r:100, src:"assets/fruit5.png" }, // blueberry
  { r:122, src:"assets/fruit6.png" }  // peach
];
const MERGE_SCORE = [1, 3, 6, 10, 15, 21, 28];
const LAST_LEVEL = FRUITS.length - 1;
const FALLBACK_COLORS = ["#8ac926", "#fb8500", "#ffe066", "#9b5de5", "#f2545b", "#4361ee", "#ffb3c6"];

for (const f of FRUITS) {
  f.img = new Image();
  f.img.src = f.src;
}
const FRAME_IMG = new Image(); FRAME_IMG.src = "assets/frame.png";
const CIRCLE_IMG = new Image(); CIRCLE_IMG.src = "assets/nextcircle.png";
function imgReady(im) { return im.complete && im.naturalWidth > 0; }

// Measured sprite bodies (leaves/stems excluded): bw/bh = body size,
// xc = body center x, yb = body bottom. Drawn so the body never exceeds
// the physics circle in any direction; bottom sits exactly at +r.
const FRUIT_META = [
  { w:191, h:214, bw:185, bh:165, xc:95,   yb:209 },
  { w:191, h:213, bw:183, bh:165, xc:95,   yb:208 },
  { w:167, h:198, bw:160, bh:166, xc:83.5, yb:194 },
  { w:160, h:188, bw:153, bh:137, xc:80,   yb:184 },
  { w:189, h:210, bw:181, bh:167, xc:94,   yb:206 },
  { w:191, h:199, bw:184, bh:152, xc:95.5, yb:195 },
  { w:213, h:208, bw:207, bh:168, xc:106,  yb:204 }
];
function drawFruit(ctx, level, r) {
  const f = FRUITS[level];
  if (imgReady(f.img)) {
    const m = FRUIT_META[level];
    const s = 2 * r / Math.max(m.bw, m.bh) * 0.98;
    ctx.drawImage(f.img, -m.xc * s, r - m.yb * s, m.w * s, m.h * s);
  } else {
    ctx.fillStyle = FALLBACK_COLORS[level];
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
  }
}

// Fixed light: soft sheen + bright dot, upper left. Drawn without rotation.
function drawHighlight(ctx, r) {
  ctx.save();
  ctx.translate(-r * 0.3, -r * 0.36);
  ctx.rotate(-0.55);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.52);
  g.addColorStop(0, "rgba(255,255,255,0.50)");
  g.addColorStop(0.55, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.34, 0, 0, 6.2832); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath(); ctx.ellipse(-r * 0.1, -r * 0.08, r * 0.1, r * 0.06, 0, 0, 6.2832); ctx.fill();
  ctx.restore();
}

const Fx = {
  parts: [], rings: [], texts: [], flyers: [],
  burst(x, y, color, n, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, sp = (0.3 + Math.random() * 0.7) * power;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - power * 0.35,
        life: 0, max: 0.45 + Math.random() * 0.4, size: 2 + Math.random() * 4, color });
    }
  },
  ring(x, y, r, color) { this.rings.push({ x, y, r, life: 0, color }); },
  text(x, y, txt, size, color) { this.texts.push({ x, y, txt, size, color, life: 0 }); },
  flyScore(x, y, gained, size) {
    this.flyers.push({ x, y, txt: "+" + gained, size, life: 0, max: 1.9 });
  },
  update(dt) {
    for (const p of this.parts) {
      p.life += dt; p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter(r => r.life < 0.35);
    for (const t of this.texts) { t.life += dt; t.y -= 60 * dt; }
    this.texts = this.texts.filter(t => t.life < 0.9);
    for (const f of this.flyers) f.life += dt;
    this.flyers = this.flyers.filter(f => f.life < f.max);
  },
  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.life / p.max * 0.5), 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.life / 0.35;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color; ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + k * 55, 0, 6.2832); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const t of this.texts) {
      const k = t.life / 0.9;
      const s = 1 + Math.sin(Math.min(1, t.life / 0.38) * Math.PI) * 0.35;
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(s, s);
      ctx.globalAlpha = 1 - k * k;
      ctx.font = "800 " + t.size + "px 'Segoe UI', sans-serif";
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.shadowColor = t.color; ctx.shadowBlur = 12 * (1 - k);
      ctx.strokeText(t.txt, 0, 0);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, 0, 0);
      ctx.restore();
    }
    for (const f of this.flyers) {
      const k = Math.min(1, f.life / f.max), e = 1 - Math.pow(1 - k, 3);
      const cx = (f.x + 140) / 2, cy = Math.min(f.y, 76) - 120;
      const point = q => {
        const u = 1 - q;
        return { x:u * u * f.x + 2 * u * q * cx + q * q * 140,
                 y:u * u * f.y + 2 * u * q * cy + q * q * 76 };
      };
      for (let i = 3; i >= 1; i--) {
        const p = point(Math.max(0, e - i * 0.045));
        ctx.globalAlpha = (1 - k) * (0.18 + (3 - i) * 0.08);
        ctx.fillStyle = "#ffd23e";
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (3 - i), 0, 6.2832); ctx.fill();
      }
      const p = point(e), s = 1 + Math.sin(k * Math.PI) * 0.35;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
      ctx.globalAlpha = k > 0.84 ? (1 - k) / 0.16 : 1;
      ctx.font = "900 " + f.size + "px 'Segoe UI', sans-serif";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.shadowColor = "#ffb52e"; ctx.shadowBlur = 14;
      ctx.strokeText(f.txt, 0, 0);
      ctx.fillStyle = "#e87524"; ctx.fillText(f.txt, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
  clear() { this.parts = []; this.rings = []; this.texts = []; this.flyers = []; }
};
