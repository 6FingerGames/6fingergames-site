(() => {
'use strict';

if (typeof Lock === 'undefined' || !Lock.ok()) {
  if (typeof Lock !== 'undefined') Lock.block(); else document.body.textContent = '6fingergames.com';
  return;
}

const W = 540;
let H = 960;
const S = 2.5;                       // sprite supersampling
const TAU = Math.PI * 2;
const FONT = 'Silkscreen, "Press Start 2P", "Courier New", monospace';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const COL = {
  cyan:    { main: '#19e6ff', core: '#e2fcff', rgb: '25,230,255' },
  orange:  { main: '#ff7a1a', core: '#ffd9a8', rgb: '255,122,26' },
  magenta: { main: '#ff2bd6', core: '#ffc2f6', rgb: '255,43,214' },
  purple:  { main: '#8f4dff', core: '#d9c6ff', rgb: '143,77,255' },
  lime:    { main: '#b6ff1a', core: '#f6ffc4', rgb: '182,255,26' }
};

const stage = document.getElementById('stage');
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let scale = 1, bgCanvas = null;

/* ======================================================================
   Sprites (neon glow is baked once, then just blitted)
   ====================================================================== */
const SPR = {};

function makeSprite(R, pad, draw) {
  const size = (R + pad) * 2;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * S);
  const g = c.getContext('2d');
  g.scale(S, S);
  g.translate(size / 2, size / 2);
  draw(g);
  return { c, half: size / 2, R };
}

function neon(g, path, col, o) {
  o = o || {};
  const lw = o.lw || 3.4;
  if (o.fill) { path(g); g.fillStyle = o.fill; g.fill(); }
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.shadowColor = col.main;
  const passes = o.soft ? [[14, 0.7, lw]] : [[38, 0.5, lw + 2.5], [20, 0.8, lw + 1], [9, 1, lw]];
  for (const [b, a, w] of passes) {
    g.shadowBlur = b * S;
    g.globalAlpha = a;
    g.strokeStyle = col.main;
    g.lineWidth = w;
    path(g);
    g.stroke();
  }
  g.shadowBlur = 4 * S;
  g.globalAlpha = 1;
  g.strokeStyle = col.core;
  g.lineWidth = lw * 0.5;
  path(g);
  g.stroke();
  g.shadowBlur = 0;
}

const polyPath = (pts) => (g) => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
};
const regular = (n, R, a0) => {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([Math.cos(a0 + i * TAU / n) * R, Math.sin(a0 + i * TAU / n) * R]);
  return pts;
};

function heartPath(R) {
  return (g) => {
    g.beginPath();
    g.moveTo(0, R * 0.95);
    g.bezierCurveTo(-R * 1.5, -R * 0.05, -R * 0.75, -R * 1.05, 0, -R * 0.38);
    g.bezierCurveTo(R * 0.75, -R * 1.05, R * 1.5, -R * 0.05, 0, R * 0.95);
    g.closePath();
  };
}

function buildSprites() {
  SPR.sq = makeSprite(48, 46, (g) => neon(g, polyPath(regular(4, 48, Math.PI / 4)), COL.orange, { fill: 'rgba(255,100,10,.2)' }));
  SPR.tri = makeSprite(48, 46, (g) => neon(g, polyPath(regular(3, 48, -Math.PI / 2)), COL.magenta, { fill: 'rgba(255,43,214,.08)' }));
  SPR.hex = makeSprite(48, 46, (g) => neon(g, polyPath(regular(6, 48, 0)), COL.purple, { fill: 'rgba(143,77,255,.14)' }));

  SPR.crystal = makeSprite(27, 40, (g) => {
    const T = [0, -27], R = [15.5, 0], B = [0, 27], L = [-15.5, 0], C = [0, 0];
    const tri = (a, b, c, fill) => { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fillStyle = fill; g.fill(); };
    g.shadowColor = COL.lime.main; g.shadowBlur = 26 * S;
    tri(T, L, C, '#a4ee08'); tri(T, R, C, '#dcff45'); tri(B, L, C, '#76c200'); tri(B, R, C, '#b0ea16');
    g.shadowBlur = 0;
    neon(g, polyPath([T, R, B, L]), COL.lime, { lw: 2.6 });
    g.strokeStyle = 'rgba(246,255,196,.8)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(...T); g.lineTo(...B); g.moveTo(...L); g.lineTo(...R); g.stroke();
  });

  SPR.heart = makeSprite(18, 36, (g) => {
    const p = heartPath(18);
    g.shadowColor = COL.cyan.main; g.shadowBlur = 22 * S;
    const gr = g.createLinearGradient(0, -18, 0, 18);
    gr.addColorStop(0, '#7ff3ff'); gr.addColorStop(1, '#0ec6ea');
    p(g); g.fillStyle = gr; g.fill();
    g.shadowBlur = 0;
    neon(g, p, COL.cyan, { lw: 2, soft: true });
  });
  SPR.heartEmpty = makeSprite(18, 12, (g) => {
    heartPath(18)(g);
    g.fillStyle = 'rgba(25,60,110,.25)'; g.fill();
    g.strokeStyle = 'rgba(60,120,170,.7)'; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke();
  });

  SPR.rocket = makeSprite(26, 40, (g) => {
    const pts = [[0, -26], [6, -12], [6, 8], [14, 20], [6, 17], [0, 21], [-6, 17], [-14, 20], [-6, 8], [-6, -12]];
    neon(g, polyPath(pts), COL.orange, { fill: 'rgba(255,120,20,.3)', lw: 2.6 });
    g.fillStyle = 'rgba(255,235,190,.9)';
    g.fillRect(-1.5, -9, 3, 14);
  });

  SPR.ship = makeSprite(56, 52, (g) => {
    const right = [[0, -54], [8, -28], [12, -10], [50, 22], [44, 30], [15, 14], [9, 30]];
    const hull = (gg) => {
      gg.beginPath();
      gg.moveTo(0, -54);
      for (let i = 1; i < right.length; i++) gg.lineTo(right[i][0], right[i][1]);
      gg.lineTo(0, 26);
      for (let i = right.length - 1; i >= 1; i--) gg.lineTo(-right[i][0], right[i][1]);
      gg.closePath();
    };
    neon(g, hull, COL.cyan, { fill: 'rgba(20,140,200,.18)', lw: 3.2 });
    const detail = (gg) => {
      gg.beginPath();
      gg.moveTo(0, -34); gg.lineTo(6, -2); gg.lineTo(0, 20); gg.lineTo(-6, -2); gg.closePath();
      gg.moveTo(12, -4); gg.lineTo(40, 22);
      gg.moveTo(-12, -4); gg.lineTo(-40, 22);
    };
    neon(g, detail, COL.cyan, { lw: 1.8, soft: true });
    g.fillStyle = 'rgba(25,230,255,.55)';
    g.shadowColor = COL.cyan.main; g.shadowBlur = 8 * S;
    g.fillRect(-5, 26, 10, 5);
    g.shadowBlur = 0;
  });
}

/* obstacle trail strips: bright at the object, fading out to the top */
function makeStrip(c1, c2, c3) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 128;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 128, 0, 0);
  v.addColorStop(0, c1); v.addColorStop(0.3, c2); v.addColorStop(1, c3);
  g.fillStyle = v; g.fillRect(0, 0, 16, 128);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 16, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, '#000'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, 16, 128);
  return c;
}
const STRIPS = {};
function buildStrips() {
  STRIPS.sq  = makeStrip('rgba(255,210,110,.95)', 'rgba(255,95,12,.55)', 'rgba(255,60,0,0)');
  STRIPS.tri = makeStrip('rgba(255,160,242,.95)', 'rgba(255,43,214,.55)', 'rgba(140,40,255,0)');
  STRIPS.hex = makeStrip('rgba(210,180,255,.95)', 'rgba(143,77,255,.55)', 'rgba(80,40,255,0)');
}
const KIND_COL = { sq: COL.orange, tri: COL.magenta, hex: COL.purple };

function spr(s, x, y, r, rot, sx) {
  const k = r / s.R, d = s.half * 2 * k;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  const w = d * (sx || 1);
  ctx.drawImage(s.c, -w / 2, -d / 2, w, d);
  ctx.restore();
}

/* ======================================================================
   State
   ====================================================================== */
const game = {
  state: 'menu', time: 0, score: 0, shownScore: 0, lives: 3, invuln: 0,
  combo: 0, comboTimer: 0, crystals: 0, best: parseInt(Store.get('best', '0'), 10) || 0,
  spawnT: 0, crystalT: 2, heartT: 25, ambT: 0.3, nextTier: 20,
  shake: 0, flash: 0, flashCol: '255,30,80', ts: 1, dyingT: 0, cd: 0,
  scroll: 1, reviveUsed: false, newBest: false, lastSpawnX: -1, lastSpawnAt: 0,
  rockets: 1, rocketT: 45, hint: 0
};
const MAX_ROCKETS = 3;
const ship = { x: W / 2, y: 0, tx: W / 2, ty: 0, vx: 0, bank: 0, visible: true };
let obs = [], pickups = [], parts = [], rings = [], texts = [], stars = [], missiles = [];
let lastTap = 0, touchInput = false;
let wt = 0;                         // always-running animation clock (frozen while paused)
const keys = { l: 0, r: 0, u: 0, d: 0 };
let lastMouse = null;

const diff = () => clamp(game.time / 110, 0, 1);

/* ======================================================================
   Resize / background
   ====================================================================== */
function resize() {
  const aw = window.innerWidth, ah = window.innerHeight;
  if (!(aw > 0 && ah > 0)) return;
  const a = clamp(aw / ah, 9 / 19.5, 9 / 16);
  const w = Math.min(aw, ah * a), h = w / a;
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  scale = cv.width / W;
  H = W / a;
  TR.c.width = TR.m.width = Math.ceil(TW * scale);
  TR.c.height = TR.m.height = Math.ceil(TH * scale);
  document.documentElement.style.setProperty('--u', (w / W) + 'px');
  buildBackground();
  if (!stars.length) initStars();
  ship.ty = clamp(ship.ty, H * 0.32, H - 70);
}

function buildBackground() {
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = cv.width; bgCanvas.height = cv.height;
  const g = bgCanvas.getContext('2d');
  g.scale(scale, scale);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#04051a'); gr.addColorStop(0.5, '#070b33'); gr.addColorStop(1, '#050822');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, H * 0.7);
  rg.addColorStop(0, 'rgba(30,60,210,.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,12,.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

function initStars() {
  const cols = ['#ffffff', '#9fd8ff', '#9fd8ff', '#7a8cff', '#ff7af0', '#ff9a3d', '#19e6ff'];
  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * 1200,
      size: rand(0.8, 2.2), sp: rand(22, 130), ph: rand(0, 7), tw: rand(1.5, 4),
      col: cols[(Math.random() * cols.length) | 0]
    });
  }
}

/* ======================================================================
   Spawning
   ====================================================================== */
function freeGapOK(x, r) {
  const iv = [[x - r, x + r]];
  for (const o of obs) if (o.y > -140 && o.y < 300) iv.push([o.x - o.r, o.x + o.r]);
  iv.sort((a, b) => a[0] - b[0]);
  let reach = 0, best = 0;
  for (const [a, b] of iv) {
    best = Math.max(best, a - reach);
    reach = Math.max(reach, b);
  }
  best = Math.max(best, W - reach);
  return best >= 118;
}

function makeFibers() {
  const f = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() + Math.random() - 1);
    f.push({
      ox, len: (0.9 + Math.random() * 2.7) * (1 - Math.abs(ox) * 0.45),
      w: 2 + Math.random() * 5, ph: Math.random() * 7, sp: 5 + Math.random() * 11, a: 0.45 + Math.random() * 0.55
    });
  }
  return f;
}

function pickKind(ambient) {
  const t = game.time, d = diff();
  if (ambient) return ['sq', 'tri', 'hex'][(Math.random() * 3) | 0];
  const w = { sq: 1, tri: t > 6 ? 0.8 + d * 0.6 : 0, hex: t > 18 ? 0.5 + d * 0.7 : 0 };
  let roll = Math.random() * (w.sq + w.tri + w.hex);
  if ((roll -= w.sq) < 0) return 'sq';
  if ((roll -= w.tri) < 0) return 'tri';
  return 'hex';
}

function spawnObstacle(kind, ambient) {
  const d = ambient ? 0.25 : diff();
  const extra = ambient ? 0 : Math.max(0, (game.time - 110) / 220);
  const sp = 1 + d * 0.85 + extra;
  let r, vy, vx = 0, vr, amp = 0, freq = 0;
  if (kind === 'sq')  { r = rand(28, 50); vy = rand(135, 200) * sp; vr = rand(-1.2, 1.2); }
  if (kind === 'tri') { r = rand(24, 38); vy = rand(250, 330) * sp * 0.92; vr = rand(-2.6, 2.6); }
  if (kind === 'hex') { r = rand(28, 42); vy = rand(170, 220) * sp; vr = rand(-1.6, 1.6); amp = rand(40, 95); freq = rand(1.2, 2.3); }

  let x = -1;
  for (let i = 0; i < 6; i++) {
    const cx = kind === 'hex' ? rand(amp + r + 6, W - amp - r - 6) : rand(r + 8, W - r - 8);
    if (ambient || freeGapOK(kind === 'hex' ? cx : cx, r + (kind === 'hex' ? amp : 0))) { x = cx; break; }
  }
  if (x < 0) return false;

  const o = {
    kind, x, bx: x, y: -r - 30, r, vy, vx, vr, rot: rand(0, TAU), t: Math.random() * 6,
    amp, freq, ph: rand(0, TAU),
    cr: r * (kind === 'sq' ? 0.8 : kind === 'tri' ? 0.62 : 0.86),
    fibers: makeFibers()
  };
  if (kind === 'tri' && !ambient) {
    const tt = Math.max(0.4, (ship.y + 40) / vy);
    o.vx = clamp((ship.x - x) / tt, -90, 90) * (0.3 + d * 0.3);
  }
  obs.push(o);
  return true;
}

function spawnCrystals() {
  const trio = Math.random() < 0.32;
  let x = -1;
  for (let i = 0; i < 8; i++) {
    const cx = rand(46, W - 46);
    let ok = true;
    for (const o of obs) {
      if (o.y < 260 && Math.abs(o.x - cx) < o.r + (o.kind === 'hex' ? o.amp : 0) + 38) { ok = false; break; }
    }
    if (ok) { x = cx; break; }
  }
  if (x < 0) return false;
  const vy = rand(175, 215) * (1 + diff() * 0.5);
  const n = trio ? 3 : 1;
  for (let i = 0; i < n; i++) {
    pickups.push({ type: 'crystal', x, y: -40 - i * 78, vy, t: Math.random() * 6 });
  }
  return true;
}

function spawnHeart() {
  pickups.push({ type: 'heart', x: rand(60, W - 60), y: -40, vy: 150, t: 0 });
}

/* ======================================================================
   Particles / fx
   ====================================================================== */
function burst(x, y, col, n, speed, size) {
  if (parts.length > 650) n = Math.min(n, 6);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.25, 1) * speed;
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.2, g: 0,
      life: rand(0.35, 0.95), max: 0.95, size: rand(1.5, 4.5) * (size || 1), col
    });
  }
}
function ring(x, y, col, maxR, life) { rings.push({ x, y, col, maxR, life, max: life }); }
function floatText(x, y, str, col, size) { texts.push({ x, y, str, col, size: size || 28, life: 1.1, max: 1.1 }); }

function emitThruster(dt) {
  if (parts.length > 700) return;
  const power = clamp((game.scroll - 1) / 1.6, 0, 1);
  let n = (110 + power * 70) * dt;
  if (Math.random() < n - Math.floor(n)) n++;
  const ca = Math.cos(ship.bank), sa = Math.sin(ship.bank);
  for (let i = 0; i < n; i++) {
    const lx = rand(-6, 6), ly = 34;
    const px = ship.x + lx * ca - ly * sa, py = ship.y + lx * sa + ly * ca;
    const fast = Math.random() < 0.35;
    parts.push({
      x: px, y: py,
      vx: rand(-34, 34) - ship.vx * 0.25 + sa * -60,
      vy: rand(180, 380) + (fast ? 120 : 0),
      drag: 0.9, g: 0,
      life: rand(0.35, 0.95), max: 0.95,
      size: fast ? rand(1.2, 2.4) : rand(2.2, 4.6),
      col: fast ? '#e2fcff' : (Math.random() < 0.5 ? '#19e6ff' : '#2a8bff')
    });
  }
}

/* ======================================================================
   Game flow
   ====================================================================== */
function startRun() {
  obs = []; pickups = []; parts = []; rings = []; texts = []; missiles = [];
  const hints = parseInt(Store.get('rocketHints', '0'), 10) || 0;
  Store.set('rocketHints', String(hints + 1));
  Object.assign(game, {
    state: 'playing', time: 0, score: 0, shownScore: 0, lives: 3, invuln: 0, combo: 0, comboTimer: 0,
    crystals: 0, spawnT: 1.4, crystalT: 2.2, heartT: 28, nextTier: 20, shake: 0, flash: 0, ts: 1,
    dyingT: 0, reviveUsed: false, newBest: false, rockets: 1, rocketT: rand(40, 55), hint: hints < 3 ? 8 : 0
  });
  ship.x = W / 2; ship.y = H + 90; ship.vx = 0; ship.bank = 0; ship.visible = true;
  if (lastMouse) { ship.tx = clamp(lastMouse.x, 34, W - 34); ship.ty = clamp(lastMouse.y, H * 0.32, H - 70); }
  else { ship.tx = W / 2; ship.ty = H * 0.78; }
  setScreens('playing');
  Sound.duck(false);
  Sound.musicStart();
  Sound.start();
}

function startWithAds() {
  Ads.cancelReward();
  Ads.beforeRun(startRun);
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  setScreens('paused');
  Sound.duck(true);
}
function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = 'countdown';
  game.cd = 3;
  setScreens('playing');
  Sound.duck(false);
}
function toMenu() {
  Ads.cancelReward();
  game.state = 'menu';
  obs = []; pickups = []; parts = []; texts = []; rings = []; missiles = [];
  ship.visible = true; ship.x = W / 2; ship.y = H * 0.74; ship.tx = W / 2; ship.ty = H * 0.74;
  game.ts = 1; game.scroll = 1;
  setScreens('menu');
  Sound.musicStop(0.4);
  Sound.duck(false);
}

function fireRocket() {
  if (game.state !== 'playing' || !ship.visible) return;
  if (game.rockets <= 0) {
    Sound.empty();
    floatText(ship.x, ship.y - 70, 'NO ROCKETS', '#ff6a6a', 22);
    return;
  }
  game.rockets--;
  game.hint = 0;
  game.invuln = Math.max(game.invuln, 0.5);
  missiles.push({ x: ship.x, y: ship.y - 44, ty: ship.y - 340 });
  Sound.launch();
}

function explodeRocket(x, y) {
  const R = 215;
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    if (Math.hypot(o.x - x, o.y - y) < R + o.r * 0.4) {
      burst(o.x, o.y, KIND_COL[o.kind].main, 20, 320, 1.1);
      ring(o.x, o.y, KIND_COL[o.kind].main, o.r * 1.8, 0.4);
      obs.splice(i, 1);
    }
  }
  burst(x, y, '#ffd9a8', 46, 520, 1.4);
  burst(x, y, '#ff7a1a', 30, 380, 1.3);
  ring(x, y, '#ffd9a8', R, 0.55);
  ring(x, y, '#ff7a1a', R * 0.7, 0.4);
  game.shake = Math.max(game.shake, 14);
  game.flash = 0.35;
  game.flashCol = '255,190,110';
  Sound.boom();
}

function hitShip(o) {
  game.lives--;
  game.combo = 0;
  game.invuln = 1.9;
  game.shake = 15;
  game.flash = 0.55;
  game.flashCol = '255,30,80';
  burst(o.x, o.y, KIND_COL[o.kind].main, 24, 340, 1.2);
  ring(o.x, o.y, KIND_COL[o.kind].main, o.r * 2, 0.45);
  obs.splice(obs.indexOf(o), 1);
  if (game.lives <= 0) { die(); return; }
  Sound.hit();
}

function die() {
  game.state = 'dying';
  game.dyingT = 0;
  game.ts = 0.3;
  game.shake = 28;
  game.flash = 0.8;
  game.flashCol = '255,30,80';
  missiles = [];
  ship.visible = false;
  const cols = ['#19e6ff', '#e2fcff', '#2a8bff', '#ff2bd6'];
  for (let i = 0; i < 80; i++) {
    const a = rand(0, TAU), s = rand(60, 520);
    parts.push({
      x: ship.x, y: ship.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 1.6, g: 0,
      life: rand(0.5, 1.4), max: 1.4, size: rand(2, 6), col: cols[(Math.random() * cols.length) | 0]
    });
  }
  ring(ship.x, ship.y, '#19e6ff', 150, 0.8);
  ring(ship.x, ship.y, '#e2fcff', 90, 0.5);
  Sound.die();
  Sound.musicStop(1.2);
  Sound.duck(true);
}

function gameOver() {
  game.state = 'over';
  game.ts = 1;
  const sc = Math.floor(game.score);
  game.newBest = sc > game.best;
  if (game.newBest) { game.best = sc; Store.set('best', String(sc)); }
  Ads.runFinished();
  document.getElementById('ovScore').textContent = sc.toLocaleString('en-US');
  document.getElementById('ovBest').textContent = game.best.toLocaleString('en-US');
  document.getElementById('ovCrystals').textContent = game.crystals;
  document.getElementById('ovTime').textContent = Math.floor(game.time) + 's';
  document.getElementById('ovNew').classList.toggle('hidden', !game.newBest);
  document.getElementById('menuBest').textContent = game.best.toLocaleString('en-US');
  const rv = document.getElementById('btnRevive');
  rv.classList.add('hidden');
  if (!game.reviveUsed) {
    Ads.offerReward(() => { if (game.state === 'over') rv.classList.remove('hidden'); }, revive);
  }
  setScreens('over');
}

function revive() {
  if (game.state !== 'over') return;
  game.reviveUsed = true;
  game.state = 'countdown';
  game.cd = 3;
  game.lives = 1;
  game.invuln = 3;
  game.combo = 0;
  obs = obs.filter((o) => o.y < ship.y - 400 || o.y > H);
  ship.visible = true; ship.x = W / 2; ship.y = H + 90; ship.tx = W / 2; ship.ty = H * 0.78;
  document.getElementById('btnRevive').classList.add('hidden');
  Sound.duck(false);
  Sound.musicResume();
  setScreens('playing');
}

/* ======================================================================
   Update
   ====================================================================== */
function updateShip(dt, controlled) {
  const st = game.state;
  if (st === 'menu') {
    ship.tx = W / 2 + Math.sin(wt * 0.8) * 70;
    ship.ty = H * 0.74 + Math.sin(wt * 1.7) * 10;
  } else if (controlled) {
    if (touch.active) {
      touch.gy += (touch.gyT - touch.gy) * (1 - Math.exp(-dt * 10));
      ship.tx = touch.fx + touch.gx; ship.ty = touch.fy + touch.gy;
    }
    const kx = keys.r - keys.l, ky = keys.d - keys.u;
    if (kx || ky) { ship.tx += kx * 540 * dt; ship.ty += ky * 540 * dt; }
    ship.tx = clamp(ship.tx, 34, W - 34);
    ship.ty = clamp(ship.ty, H * 0.32, H - 70);
  }
  const k = 1 - Math.exp(-dt * 15);
  const nx = ship.x + (ship.tx - ship.x) * k;
  const ny = ship.y + (ship.ty - ship.y) * k;
  ship.vx = dt > 0 ? (nx - ship.x) / dt : 0;
  ship.x = nx; ship.y = ny;
  ship.bank = lerp(ship.bank, clamp(ship.vx * 0.0011, -0.38, 0.38), 1 - Math.exp(-dt * 12));
}

function update(rdt) {
  const st = game.state;
  if (st === 'paused') return;

  game.ts = lerp(game.ts, st === 'dying' ? 0.3 : 1, 1 - Math.exp(-rdt * 6));
  const dt = rdt * game.ts;
  wt += dt;

  const d = st === 'playing' ? diff() : 0.15;
  game.scroll = lerp(game.scroll, 1 + d * 1.6 + Math.max(0, (game.time - 110) / 220), 1 - Math.exp(-rdt * 2));

  for (const s of stars) {
    s.y += s.sp * game.scroll * dt;
    if (s.y > H + 10) { s.y -= H + 20; s.x = Math.random() * W; }
  }

  const worldRuns = st !== 'countdown';
  if (worldRuns) {
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      o.t += dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (o.kind === 'hex') {
        const a = o.t * o.freq + o.ph;
        o.x = clamp(o.bx + Math.sin(a) * o.amp, o.r, W - o.r);
        o.vx = Math.cos(a) * o.amp * o.freq;
      } else {
        o.x += o.vx * dt;
      }
      if (Math.random() < dt * 9 && parts.length < 650) {
        parts.push({
          x: o.x + rand(-o.r, o.r) * 0.7, y: o.y - o.r * 0.3, vx: rand(-14, 14), vy: o.vy * rand(0.25, 0.65),
          drag: 0, g: 0, life: rand(0.5, 1), max: 1, size: rand(1.4, 3.2), col: KIND_COL[o.kind].main
        });
      }
      if (o.y > H + o.r + 60) obs.splice(i, 1);
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt; p.y += p.vy * dt;
      if (st === 'playing' && ship.visible) {
        const dx = ship.x - p.x, dy = ship.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < 95 && dist > 1) { p.x += dx / dist * 240 * dt; p.y += dy / dist * 240 * dt; }
      }
      if (p.y > H + 50) pickups.splice(i, 1);
    }
  }

  if (st === 'menu' || st === 'over') {
    game.ambT -= dt;
    if (game.ambT <= 0 && obs.length < 9) { spawnObstacle(pickKind(true), true); game.ambT = rand(0.55, 1); }
  }

  if (st === 'playing' || st === 'countdown' || st === 'menu') updateShip(rdt, st !== 'menu');
  if ((st === 'playing' || st === 'countdown' || st === 'menu') && ship.visible) emitThruster(dt);

  if (st === 'countdown') {
    game.cd -= rdt;
    if (game.cd <= 0) game.state = 'playing';
  }

  if (st === 'playing') {
    game.time += dt;
    game.score += dt * (8 + d * 14);
    game.invuln = Math.max(0, game.invuln - dt);
    if (game.hint > 0) game.hint -= dt;

    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.y -= 1500 * dt;
      if (parts.length < 700) {
        parts.push({
          x: m.x + rand(-3, 3), y: m.y + 24, vx: rand(-20, 20), vy: rand(60, 200), drag: 1.5, g: 0,
          life: rand(0.25, 0.5), max: 0.5, size: rand(2, 4.5), col: Math.random() < 0.5 ? '#ffb347' : '#ff7a1a'
        });
      }
      let hit = m.y <= m.ty;
      if (!hit) for (const o of obs) if (Math.abs(o.x - m.x) < o.r + 14 && Math.abs(o.y - m.y) < o.r + 22) { hit = true; break; }
      if (hit) { missiles.splice(i, 1); explodeRocket(m.x, m.y); }
    }

    if (game.rockets < MAX_ROCKETS && game.time > 12) {
      game.rocketT -= dt;
      if (game.rocketT <= 0) {
        pickups.push({ type: 'rocket', x: rand(60, W - 60), y: -40, vy: 160, t: 0 });
        game.rocketT = rand(40, 60);
      }
    }

    game.spawnT -= dt;
    if (game.time > 1.2 && game.spawnT <= 0 && obs.length < 22) {
      if (spawnObstacle(pickKind(false), false)) {
        game.spawnT = lerp(0.95, 0.34, Math.pow(d, 0.85)) * rand(0.8, 1.25);
      } else {
        game.spawnT = 0.08;
      }
    }
    game.crystalT -= dt;
    if (game.crystalT <= 0) { if (spawnCrystals()) game.crystalT = rand(2.2, 3.8); else game.crystalT = 0.3; }
    if (game.lives < 3) {
      game.heartT -= dt;
      if (game.heartT <= 0) { spawnHeart(); game.heartT = rand(30, 42); }
    }
    if (game.combo > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 0; }

    if (game.time >= game.nextTier) {
      game.nextTier += 20;
      floatText(W / 2, H * 0.3, 'SPEED UP!', COL.magenta.main, 40);
      Sound.speedUp();
    }

    // collisions
    if (game.invuln <= 0) {
      for (const o of obs) {
        if (Math.hypot(o.x - ship.x, o.y - ship.y) < o.cr + 13) { hitShip(o); break; }
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Math.hypot(p.x - ship.x, p.y - ship.y) < 44) {
        pickups.splice(i, 1);
        if (p.type === 'crystal') {
          game.combo++; game.comboTimer = 5; game.crystals++;
          const mult = Math.min(5, game.combo), pts = 100 * mult;
          game.score += pts;
          floatText(p.x, p.y - 20, '+' + pts + (mult > 1 ? ' x' + mult : ''), COL.lime.main, 26 + mult * 2);
          burst(p.x, p.y, COL.lime.main, 14, 260, 1);
          ring(p.x, p.y, COL.lime.main, 54, 0.35);
          Sound.collect(game.combo);
        } else if (p.type === 'heart') {
          if (game.lives < 3) game.lives++;
          floatText(p.x, p.y - 20, '+1 HEART', COL.cyan.main, 28);
          burst(p.x, p.y, COL.cyan.main, 22, 300, 1.1);
          ring(p.x, p.y, COL.cyan.main, 80, 0.5);
          Sound.heart();
        } else {
          if (game.rockets < MAX_ROCKETS) game.rockets++;
          floatText(p.x, p.y - 20, '+1 ROCKET', COL.orange.main, 26);
          burst(p.x, p.y, COL.orange.main, 22, 300, 1.1);
          ring(p.x, p.y, COL.orange.main, 80, 0.5);
          Sound.heart();
        }
      }
    }
  }

  if (st === 'dying') {
    game.dyingT += rdt;
    if (game.dyingT > 1.25) gameOver();
  }

  // fx
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy *= dr; p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt; t.y -= 46 * dt; if (t.life <= 0) texts.splice(i, 1); }
  game.shake = Math.max(0, game.shake - rdt * 42);
  game.flash = Math.max(0, game.flash - rdt * 1.6);
  game.shownScore = lerp(game.shownScore, game.score, 1 - Math.exp(-rdt * 9));
}

/* ======================================================================
   Render
   ====================================================================== */
function txt(s, x, y, size, color, align, glow) {
  ctx.font = size + 'px ' + FONT;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow * scale; }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}

function drawGrid() {
  const vy = -H * 0.38, n = 22;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(80,120,255,.17)';
  ctx.beginPath();
  for (let i = -9; i <= 9; i++) {
    ctx.moveTo(W / 2, vy);
    ctx.lineTo(W / 2 + i * 82, H);
  }
  ctx.stroke();
  const sc = (wt * 1.7 * game.scroll) % 1;
  for (let k = 0; k < n; k++) {
    const p = (k + sc) / n;
    const y = vy + (H - vy) * Math.pow(p, 2.2);
    if (y < 0) continue;
    ctx.strokeStyle = 'rgba(80,120,255,' + (0.05 + 0.17 * p).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawStars() {
  for (const s of stars) {
    if (s.y > H) continue;
    ctx.globalAlpha = 0.4 + 0.5 * Math.sin(wt * s.tw + s.ph);
    ctx.fillStyle = s.col;
    ctx.fillRect(s.x, s.y, s.size, s.size + s.sp * game.scroll * 0.03);
  }
  ctx.globalAlpha = 1;
}

/* Trails are drawn on a scratch canvas, limited to the shape's silhouette swept upwards,
   and the shape's own interior is cut out, so the beams grow out of the outline. */
const TW = 360, TH = 540, TCX = 180, TCY = 470;
const TR = { c: document.createElement('canvas'), m: document.createElement('canvas') };
TR.g = TR.c.getContext('2d');
TR.mg = TR.m.getContext('2d');

function shapePts(o) {
  const n = o.kind === 'sq' ? 4 : o.kind === 'tri' ? 3 : 6;
  const a0 = (o.kind === 'sq' ? Math.PI / 4 : o.kind === 'tri' ? -Math.PI / 2 : 0) + o.rot;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([Math.cos(a0 + i * TAU / n) * o.r, Math.sin(a0 + i * TAU / n) * o.r]);
  return pts;
}

function drawTrail(o) {
  const g = TR.g, m = TR.mg, strip = STRIPS[o.kind];
  const sf = clamp(o.vy / 200, 0.8, 2.3);
  const c = clamp(o.vx * 0.0035, -0.25, 0.25);
  const top = -o.r;

  const Ls = [];
  const auraL = Math.min(380, o.r * 2.3 * sf);
  let maxL = auraL;
  for (const f of o.fibers) {
    const L = Math.min(380, f.len * o.r * sf * (0.72 + 0.28 * Math.sin(o.t * f.sp + f.ph)));
    Ls.push(L);
    if (L > maxL) maxL = L;
  }
  const lean = Math.abs(c) * (maxL + o.r) + 6;
  const lx = -(o.r + lean), lw = 2 * (o.r + lean), ly = -(o.r + maxL + 8), lh = 2 * o.r + maxL + 14;
  let sx = Math.floor((TCX + lx) * scale), sy = Math.floor((TCY + ly) * scale);
  let sw = Math.ceil(lw * scale) + 2, sh = Math.ceil(lh * scale) + 2;
  sx = Math.max(0, sx); sy = Math.max(0, sy);
  sw = Math.min(sw, TR.c.width - sx); sh = Math.min(sh, TR.c.height - sy);
  if (sw <= 0 || sh <= 0) return;

  const origin = [scale, 0, 0, scale, TCX * scale, TCY * scale];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(sx, sy, sw, sh);
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.clearRect(sx, sy, sw, sh);

  // fibers (start deep inside the shape so the outline always has beam behind it)
  g.setTransform(...origin);
  g.translate(0, top);
  g.transform(1, 0, c, 1, 0, 0);
  g.globalAlpha = 0.34;
  g.drawImage(strip, -o.r * 0.95, -auraL, o.r * 1.9, auraL + o.r * 2);
  const ws = o.r / 40;
  for (let i = 0; i < o.fibers.length; i++) {
    const f = o.fibers[i], w = f.w * ws;
    g.globalAlpha = f.a;
    g.drawImage(strip, f.ox * o.r * 0.95 - w / 2, -Ls[i], w, Ls[i] + o.r * 2);
  }

  // mask = shape silhouette extruded upwards
  const P = shapePts(o), Hq = maxL + o.r + 20;
  const sk = (y) => c * (y - top);
  m.setTransform(...origin);
  m.fillStyle = '#fff';
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    m.beginPath();
    m.moveTo(a[0], a[1]); m.lineTo(b[0], b[1]);
    m.lineTo(b[0] + sk(b[1] - Hq), b[1] - Hq);
    m.lineTo(a[0] + sk(a[1] - Hq), a[1] - Hq);
    m.closePath(); m.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(TR.m, sx, sy, sw, sh, sx, sy, sw, sh);

  // cut out whatever lies inside the shape
  g.setTransform(...origin);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.beginPath();
  P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';

  ctx.drawImage(TR.c, sx, sy, sw, sh, o.x + sx / scale - TCX, o.y + sy / scale - TCY, sw / scale, sh / scale);
}

function drawFlame(power) {
  const t = wt, g = ctx;
  const flick = 0.82 + 0.18 * Math.sin(t * 38) + Math.random() * 0.1;
  const len = (58 + 42 * power) * flick;
  g.globalCompositeOperation = 'lighter';
  const rg = g.createRadialGradient(0, 33, 0, 0, 33, 30);
  rg.addColorStop(0, 'rgba(150,240,255,.75)'); rg.addColorStop(1, 'rgba(25,120,255,0)');
  g.fillStyle = rg; g.fillRect(-32, 0, 64, 70);
  const layer = (hw, lm, c0, c1) => {
    const gr = g.createLinearGradient(0, 30, 0, 30 + len * lm);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-hw, 30);
    g.quadraticCurveTo(-hw * 1.25, 30 + len * lm * 0.45, 0, 30 + len * lm);
    g.quadraticCurveTo(hw * 1.25, 30 + len * lm * 0.45, hw, 30);
    g.closePath(); g.fill();
  };
  layer(12, 1.45, 'rgba(40,140,255,.6)', 'rgba(0,70,255,0)');
  layer(8, 1.1, 'rgba(90,225,255,.95)', 'rgba(0,150,255,0)');
  layer(4, 0.62, 'rgba(255,255,255,1)', 'rgba(140,245,255,0)');
  g.globalCompositeOperation = 'source-over';
}

function drawTouchCue() {
  if (!touch.active || !touchInput || game.state !== 'playing') return;
  const fx = clamp(touch.fx, 0, W), fy = clamp(touch.fy, 0, H);
  ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = '#9fefff'; ctx.lineWidth = 2;
  ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(ship.x, ship.y + 28); ctx.lineTo(fx, fy - 30); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(fx, fy, 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

function drawShip() {
  if (!ship.visible) return;
  drawTouchCue();
  const power = clamp((game.scroll - 1) / 1.6, 0, 1);
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.bank);
  const blink = game.invuln > 0 && Math.floor(wt * 16) % 2 === 0;
  ctx.globalAlpha = blink ? 0.3 : 1;
  drawFlame(power);
  ctx.globalCompositeOperation = 'lighter';
  const d = SPR.ship.half * 2;
  ctx.drawImage(SPR.ship.c, -d / 2, -d / 2, d, d);
  ctx.restore();
}

function drawHUD() {
  const hy = 10;
  txt('SCORE', 22, hy + 26, 18, '#7fe9ff', 'left', 6);
  txt(Math.floor(game.shownScore).toLocaleString('en-US'), 22, hy + 74, 46, '#d8fbff', 'left', 14);
  txt('BEST', W - 22, hy + 26, 18, '#7fe9ff', 'right', 6);
  txt(Math.max(game.best, Math.floor(game.score)).toLocaleString('en-US'), W - 22, hy + 74, 46, '#d8fbff', 'right', 14);

  for (let i = 0; i < 3; i++) {
    const x = W / 2 + (i - 1) * 50, y = hy + 38;
    const full = i < game.lives;
    const s = full ? SPR.heart : SPR.heartEmpty;
    const pulse = full && game.lives === 1 ? 1 + 0.12 * Math.sin(wt * 9) : 1;
    ctx.globalCompositeOperation = full ? 'lighter' : 'source-over';
    spr(s, x, y, 18 * pulse * (full ? 1 : 0.95));
  }
  ctx.globalCompositeOperation = 'source-over';

  for (let i = 0; i < MAX_ROCKETS; i++) {
    const on = i < game.rockets;
    ctx.globalAlpha = on ? 1 : 0.28;
    ctx.globalCompositeOperation = on ? 'lighter' : 'source-over';
    spr(SPR.rocket, 30 + i * 28, H - 36, 17);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (game.hint > 0 && game.rockets > 0 && game.state === 'playing') {
    ctx.globalAlpha = clamp(game.hint, 0, 1) * (0.6 + 0.4 * Math.sin(wt * 6));
    txt(touchInput ? 'DOUBLE TAP = ROCKET' : 'DOUBLE CLICK = ROCKET', W / 2, H - 24, 18, COL.orange.main, 'center', 10);
    ctx.globalAlpha = 1;
  }

  if (game.combo > 0) {
    const mult = Math.min(5, game.combo);
    const a = clamp(game.comboTimer / 5, 0, 1);
    txt('COMBO x' + mult, 22, hy + 108, 20, COL.lime.main, 'left', 10);
    ctx.fillStyle = 'rgba(182,255,26,.18)'; ctx.fillRect(22, hy + 116, 120, 5);
    ctx.fillStyle = COL.lime.main; ctx.fillRect(22, hy + 116, 120 * a, 5);
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.save();
  if (game.shake > 0.2) ctx.translate(rand(-1, 1) * game.shake, rand(-1, 1) * game.shake);

  drawGrid();
  drawStars();

  ctx.globalCompositeOperation = 'lighter';
  for (const o of obs) drawTrail(o);
  ctx.globalAlpha = 1;

  for (const p of pickups) {
    if (p.type === 'crystal') {
      const sx = 0.55 + 0.45 * Math.abs(Math.cos(p.t * 2.6));
      spr(SPR.crystal, p.x, p.y, 27, 0, sx);
    } else if (p.type === 'heart') {
      spr(SPR.heart, p.x, p.y + Math.sin(p.t * 5) * 3, 22 + Math.sin(p.t * 6) * 1.5);
    } else {
      spr(SPR.rocket, p.x, p.y + Math.sin(p.t * 5) * 3, 30 + Math.sin(p.t * 6) * 1.5);
    }
  }
  for (const m of missiles) {
    ctx.fillStyle = 'rgba(255,190,90,.85)';
    ctx.beginPath();
    ctx.moveTo(m.x - 6, m.y + 20); ctx.lineTo(m.x, m.y + 56 + rand(0, 14)); ctx.lineTo(m.x + 6, m.y + 20);
    ctx.closePath(); ctx.fill();
    spr(SPR.rocket, m.x, m.y, 30);
  }
  for (const o of obs) spr(SPR[o.kind], o.x, o.y, o.r, o.rot);

  // particles
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / (p.max * 0.8), 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'source-over';
  drawShip();

  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    const k = 1 - r.life / r.max;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.col; ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.maxR * (0.15 + 0.85 * k), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life / (t.max * 0.5), 0, 1);
    txt(t.str, t.x, t.y, t.size, t.col, 'center', 14);
  }
  ctx.globalAlpha = 1;

  if (game.flash > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(' + game.flashCol + ',0)');
    g.addColorStop(1, 'rgba(' + game.flashCol + ',' + game.flash.toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  const st = game.state;
  if (st === 'playing' || st === 'paused' || st === 'countdown' || st === 'dying') drawHUD();
  if (st === 'countdown') {
    const n = Math.ceil(game.cd), f = game.cd - Math.floor(game.cd);
    ctx.globalAlpha = 0.4 + 0.6 * f;
    txt(String(n), W / 2, H * 0.42, 150 + (1 - f) * -30 + f * 30, '#e2fcff', 'center', 40);
    ctx.globalAlpha = 1;
  }
}

/* ======================================================================
   UI wiring
   ====================================================================== */
const el = (id) => document.getElementById(id);
const screens = { menu: el('menu'), pause: el('pause'), over: el('over') };

function setScreens(mode) {
  screens.menu.classList.toggle('hidden', mode !== 'menu');
  screens.pause.classList.toggle('hidden', mode !== 'paused');
  screens.over.classList.toggle('hidden', mode !== 'over');
  el('hudBtns').classList.toggle('hidden', mode !== 'playing');
  stage.classList.toggle('playing', mode === 'playing');
  el('how').classList.add('hidden');
  el('about').classList.add('hidden');
}

function fillAbout() {
  const a = NEON_CONFIG.about, host = NEON_CONFIG.lock.url;
  const set = (id, html) => { const n = el(id); n.innerHTML = html; n.style.display = html ? '' : 'none'; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  set('aboutAuthor', a.author ? 'Created by <b>' + esc(a.author) + '</b>' : '');
  set('aboutStudio', a.studio ? 'Studio: <b>' + esc(a.studio) + '</b>' : '');
  set('aboutEmail', a.email ? 'Contact: <b><a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a></b>' : '');
  set('aboutSite', '<a href="' + esc(host) + '" target="_blank" rel="noopener">' + esc(host.replace('https://', '')) + '</a>');
}

const SND_ON = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9H3z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function refreshSoundButtons() {
  const m = Sound.isMuted();
  document.querySelectorAll('.snd-toggle').forEach((b) => {
    b.dataset.muted = m ? '1' : '0';
    if (b.classList.contains('icon-btn')) b.innerHTML = m ? SND_OFF : SND_ON;
    else b.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
  });
}

function bind(id, fn) {
  el(id).addEventListener('click', (e) => {
    Sound.unlock();
    Sound.click();
    e.currentTarget.blur();
    fn();
  });
}
bind('btnPlay', startWithAds);
bind('btnRetry', startWithAds);
bind('btnHow', () => el('how').classList.remove('hidden'));
bind('btnHowClose', () => el('how').classList.add('hidden'));
bind('btnAbout', () => el('about').classList.remove('hidden'));
bind('btnAboutClose', () => el('about').classList.add('hidden'));
bind('btnPause', pauseGame);
bind('btnResume', resumeGame);
bind('btnRestart', startWithAds);
bind('btnPauseMenu', toMenu);
bind('btnOverMenu', toMenu);
bind('btnRevive', () => { Ads.showReward(); });
document.querySelectorAll('.snd-toggle').forEach((b) => b.addEventListener('click', () => {
  Sound.unlock();
  Sound.toggle();
  refreshSoundButtons();
  b.blur();
}));

/* input */
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
// Touch: the ship rides ABOVE the finger, so the finger never covers it. The control stays free (relative): wherever you touch,
// the ship keeps its distance to the finger and follows every move 1:1. If the finger lands closer than TOUCH_LIFT below the ship,
// the ship eases up to that distance; if it lands further away, that distance is kept.
const TOUCH_LIFT = 125;
const touch = { active: false, fx: 0, fy: 0, gx: 0, gy: 0, gyT: 0 };
const controlling = () => game.state === 'playing' || game.state === 'countdown';

stage.addEventListener('pointerdown', (e) => {
  Sound.unlock();
  touchInput = e.pointerType !== 'mouse';
  if (game.state === 'playing' && e.button === 0 && !e.target.closest('button')) {
    const now = performance.now();
    if (now - lastTap < 320) { lastTap = 0; fireRocket(); } else lastTap = now;
  }
  if (e.pointerType === 'mouse' || e.target.closest('button')) return;
  const p = toLogical(e);
  touch.active = true; touch.fx = p.x; touch.fy = p.y; touch.gx = ship.tx - p.x; touch.gy = ship.ty - p.y; touch.gyT = Math.min(touch.gy, -TOUCH_LIFT);
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
});
stage.addEventListener('pointermove', (e) => {
  const p = toLogical(e);
  if (e.pointerType === 'mouse') {
    lastMouse = p;
    if (controlling()) { ship.tx = p.x; ship.ty = p.y; }
  } else if (touch.active && controlling()) {
    touch.fx = p.x; touch.fy = p.y;
  }
});
const endTouch = () => { touch.active = false; };
stage.addEventListener('pointerup', endTouch);
stage.addEventListener('pointercancel', endTouch);

const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
window.addEventListener('keydown', (e) => {
  Sound.unlock();
  const k = KEYMAP[e.code];
  if (k) { keys[k] = 1; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'KeyM') { Sound.toggle(); refreshSoundButtons(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.state === 'playing') pauseGame(); else if (game.state === 'paused') resumeGame();
    return;
  }
  if ((e.code === 'Enter' || e.code === 'Space') && !(e.target && e.target.tagName === 'BUTTON')) {
    e.preventDefault();
    if (game.state === 'playing') {
      if (e.code === 'Space') {
        const now = performance.now();
        if (now - lastTap < 320) { lastTap = 0; fireRocket(); } else lastTap = now;
      }
    } else if (game.state === 'menu' || game.state === 'over') startWithAds();
    else if (game.state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = 0; });
window.addEventListener('blur', () => { keys.l = keys.r = keys.u = keys.d = 0; pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);

/* ======================================================================
   Boot
   ====================================================================== */
buildSprites();
buildStrips();
resize();
ship.x = W / 2; ship.y = H * 0.74; ship.tx = ship.x; ship.ty = ship.y;
el('menuBest').textContent = game.best.toLocaleString('en-US');
refreshSoundButtons();
fillAbout();
setScreens('menu');
Ads.init();
stage.addEventListener('contextmenu', (e) => e.preventDefault());

let last = performance.now(), lockT = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  lockT += dt;
  if (lockT > 3) {
    lockT = 0;
    if (!Lock.ok()) { Lock.block(); return; }
  }
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__neon = { game, ship, get obs() { return obs; }, startRun };
})();
