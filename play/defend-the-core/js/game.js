(() => {
'use strict';

if (typeof Lock === 'undefined' || !Lock.ok()) {
  if (typeof Lock !== 'undefined') Lock.block(); else document.body.textContent = '6fingergames.com';
  return;
}

const W = 540;
let H = 960;
const TAU = Math.PI * 2;
const FONT = '"Cinzel", Georgia, serif';
const INK = '#0b0a24';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const el = (id) => document.getElementById(id);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/* ======================================================================
   Sprites (cut from the generated sheets)
   ====================================================================== */
const SPR = {};
const MIP = new Map();
let scale = 1;
function mip(im, wLog) {
  const devW = Math.max(1, Math.round(wLog * scale));
  if (im.naturalWidth <= devW * 1.5) return im;
  const key = im.src + '|' + devW;
  let c = MIP.get(key);
  if (c) return c;
  let src = im, w = im.naturalWidth, h = im.naturalHeight;
  while (w / 2 >= devW) {
    const t = document.createElement('canvas');
    t.width = Math.ceil(w / 2); t.height = Math.ceil(h / 2);
    const x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, t.width, t.height);
    src = t; w = t.width; h = t.height;
  }
  c = document.createElement('canvas');
  c.width = devW; c.height = Math.max(1, Math.round(devW * im.naturalHeight / im.naturalWidth));
  const x2 = c.getContext('2d'); x2.imageSmoothingQuality = 'high'; x2.drawImage(src, 0, 0, c.width, c.height);
  MIP.set(key, c);
  return c;
}
['kid_l', 'kid_c', 'kid_r', 'kid_smile', 'kid_dim', 'kid_dark', 'arc1', 'arc2', 'arc3', 'arc4', 'orb',
  'wisp', 'wisp_f', 'thief', 'thief_f', 'brute', 'brute_f', 'wailer', 'wailer_f', 'split', 'split_f', 'mini', 'mini_f', 'boss', 'boss_f',
  'puff', 'smokering', 'smoke'].forEach((n) => { const im = new Image(); im.src = 'img/' + n + '.png'; SPR[n] = im; });
const BG = new Image(); BG.src = 'img/bg.jpg';
const UI = {}; ['plate_wave', 'plate_count'].forEach((n) => { const im = new Image(); im.src = 'img/ui/' + n + '.webp'; UI[n] = im; });
const UIM = {"plate_wave":{"w":504,"h":180,"l":0.112,"r":0.114,"t":0.278,"b":0.178,"axis":0.499},"plate_count":{"w":336,"h":158,"l":0.14,"r":0.152,"t":0.304,"b":0.285,"axis":0.494}};
// paints a plate so that the dark middle of the picture covers the box (x, y, w, h)
function plateAt(name, x, y, w, h) {
  const im = UI[name]; if (!ready(im)) return;
  const m = UIM[name], sx = 1 - m.l - m.r, sy = 1 - m.t - m.b, aw = w / sx, ah = h / sy;
  ctx.drawImage(mip(im, aw), x - m.l * aw, y - m.t * ah, aw, ah);
}
const ready = (im) => im && im.complete && im.naturalWidth;

/* ======================================================================
   Tuning
   ====================================================================== */
const CORE_R = 38;                    // radius of the child's body (damage when a shadow gets this close)
const ROUT = 142;                     // outer radius of the shield arc (px)
const SPAWN_R = 620;                  // shadows appear this far from the child
const WAVE_SECS = 20;
const NOVA_EVERY = 18;                // seconds between starbursts (ad-only upgrade)
const SIZE_HALF = [36, 44, 52, 60, 68];                 // shield half-angle (degrees) per size level
const SIZE_COST = [0, 80, 200, 450, 900];               // cost of reaching size level 1..5
const SPIN_SPEED = [8, 10, 12, 14, 16];                 // shield turn speed (rad/s) per level
const SPIN_COST = [0, 60, 160, 360, 720];
const HEART_MAX = [3, 4, 5, 6];
const HEART_COST = [0, 100, 260, 600];

// shadow kinds: speed px/s, hp, drawn height, body radius, essence, damage to the child
const KINDS = {
  wisp:  { spr: 'wisp',  sp: 105, hp: 1,  h: 66,  r: 17, val: 1,  dmg: 1 },
  thief: { spr: 'thief', sp: 230, hp: 1,  h: 96,  r: 14, val: 2,  dmg: 1 },
  wailer:{ spr: 'wailer',sp: 70,  hp: 2,  h: 118, r: 24, val: 3,  dmg: 1 },
  split: { spr: 'split', sp: 78,  hp: 1,  h: 82,  r: 29, val: 3,  dmg: 1 },
  mini:  { spr: 'mini',  sp: 150, hp: 1,  h: 44,  r: 13, val: 1,  dmg: 1 },
  brute: { spr: 'brute', sp: 42,  hp: 4,  h: 140, r: 46, val: 7,  dmg: 2 },
  boss:  { spr: 'boss',  sp: 24,  hp: 18, h: 230, r: 72, val: 50, dmg: 3 }
};

/* ======================================================================
   Save data
   ====================================================================== */
const S = (() => {
  let o = null;
  try { o = JSON.parse(Store.get('save', '')); } catch (e) {}
  if (!o || typeof o !== 'object') o = {};
  o.coins = o.coins | 0; o.best = o.best | 0; o.bestWave = o.bestWave | 0; o.plays = o.plays | 0;
  o.twin = !!o.twin; o.nova = !!o.nova; o.adp = o.adp || {};
  o.size = clamp(o.size | 0 || 1, 1, 5); o.spin = clamp(o.spin | 0 || 1, 1, 5); o.hearts = clamp(o.hearts | 0 || 1, 1, 4);
  return o;
})();
const save = () => Store.set('save', JSON.stringify(S));
const maxHp = () => HEART_MAX[S.hearts - 1];
// every reward goes through here, so a site-wide wallet can be hooked in later
const award = (n) => { G.essRun += n; };

/* ======================================================================
   State
   ====================================================================== */
const G = {
  state: 'menu', t: 0, wave: 1, waveT: 0, spawnT: 1.2, groupT: 9, score: 0, essRun: 0, earned: 0,
  hp: 3, maxHp: 3, shake: 0, flash: 0, hurtT: 0, revived: false, overT: 0, banner: 0, bannerTxt: '', bossAlive: false, pausedFrom: 'play', kills: 0
};
const kid = { cur: 'kid_c', prev: null, t: 1, last: 0 };
const core = { x: W / 2, y: 480 };
const shield = { a: -Math.PI / 2, tgt: -Math.PI / 2, flash: 0 };
let ghosts = [], parts = [], rings = [], texts = [], gems = [];
const HUD_GEM = { x: W - 40, y: 56 };               // where the crystals gather
const keys = { l: 0, r: 0 };
let wt = 0;

/* ======================================================================
   Layout
   ====================================================================== */
const stage = el('stage'), cv = el('c'), ctx = cv.getContext('2d');
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
  core.y = H * 0.5;
  document.documentElement.style.setProperty('--u', (w / W) + 'px');
}

/* ======================================================================
   Shield sprites: the arcs in the art are half circles; they are cut to the current width with soft ends
   ====================================================================== */
const shieldCache = {};
function shieldCanvas() {
  const skin = Math.min(4, S.size), half = SIZE_HALF[S.size - 1] * Math.PI / 180;
  const key = skin + '|' + S.size + '|' + scale;
  if (shieldCache[key]) return shieldCache[key];
  const im = SPR['arc' + skin];
  if (!ready(im)) return null;
  const dpr = scale, k = (ROUT * 2) / im.naturalWidth;
  const cw = Math.ceil(ROUT * 2 * dpr) + 4, ch = Math.ceil((ROUT + 6) * dpr);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
  x.drawImage(mip(im, dw), 2, (ROUT - dh) * dpr + 1, dw * dpr, dh * dpr);      // the dome's centre sits at the bottom middle of the picture
  x.globalCompositeOperation = 'destination-in';
  const soft = 0.12;                                                              // soft ends, radians
  if (x.createConicGradient) {
    const g = x.createConicGradient(-Math.PI / 2 - half - soft, cw / 2, ROUT * dpr);
    const p = (r) => clamp(r / TAU, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(p(soft), 'rgba(0,0,0,1)');
    g.addColorStop(p(soft + 2 * half), 'rgba(0,0,0,1)'); g.addColorStop(p(2 * soft + 2 * half), 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  } else {
    x.beginPath(); x.moveTo(cw / 2, ROUT * dpr); x.arc(cw / 2, ROUT * dpr, ROUT * dpr * 1.2, -Math.PI / 2 - half, -Math.PI / 2 + half); x.closePath(); x.fill();
  }
  shieldCache[key] = c;
  return c;
}

/* ======================================================================
   Effects
   ====================================================================== */
function smoke(x, y, n, big) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(20, big ? 120 : 70);
    parts.push({ k: 'puff', x: x + Math.cos(a) * rand(0, 12), y: y + Math.sin(a) * rand(0, 12), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.5, 0.9), max: 0.9, s: rand(0.5, 1) * (big ? 1.6 : 0.9) * 46, rot: rand(0, TAU), vr: rand(-1.5, 1.5) });
  }
}
function sparks(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(80, 320);
    parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.55), max: 0.55, s: rand(1.5, 3.2), col: col || '#fff3c9' });
  }
}
const ring = (x, y, r, life, col) => rings.push({ x, y, r, life, max: life, col: col || '255,243,201' });
const text = (x, y, txt, col, size) => texts.push({ x, y, txt, col: col || '#fff3c9', size: size || 24, life: 0.9 });

/* ======================================================================
   Spawning
   ====================================================================== */
function kindsFor(w) {
  const list = [['wisp', 10]];
  if (w >= 2) list.push(['thief', 3 + Math.min(4, w)]);
  if (w >= 3) list.push(['wailer', 4]);
  if (w >= 4) list.push(['split', 4]);
  if (w >= 5) list.push(['brute', 2 + Math.min(4, (w - 5))]);
  return list;
}
function pickKind(w) {
  const l = kindsFor(w); let tot = 0; l.forEach((e) => { tot += e[1]; });
  let r = Math.random() * tot;
  for (const e of l) { r -= e[1]; if (r <= 0) return e[0]; }
  return 'wisp';
}
const speedMul = () => Math.min(2.0, 1 + 0.05 * (G.wave - 1));
function spawn(kind, ang, r0, extra) {
  const K = KINDS[kind];
  const g = Object.assign({ kind, a: ang, r: r0 === undefined ? SPAWN_R : r0, hp: K.hp, fl: 0, kb: 0, cool: 0, age: 0, ph: rand(0, TAU), x: 0, y: 0, rot: 0, sp: K.sp * speedMul() * rand(0.92, 1.08), bt: 2 }, extra || {});
  if (kind === 'boss') { g.hp = K.hp + Math.floor(G.wave / 6) * 4; g.maxhp = g.hp; }
  ghosts.push(g);
  return g;
}
function newWave() {
  G.wave++; G.waveT = 0;
  G.banner = 2.2; G.bannerTxt = (G.wave % 6 === 0) ? 'THE DARK GROWS' : 'WAVE ' + G.wave;
  Sound.wave();
  if (G.wave % 2 === 0 && G.hp < G.maxHp) { G.hp++; text(core.x, core.y - 70, 'LIGHT +1', '#6fe3a6', 26); Sound.orb(); ring(core.x, core.y, 60, 0.6, '111,227,166'); }
  if (G.wave % 6 === 0) { spawn('boss', rand(0, TAU)); G.bossAlive = true; Sound.boss(); G.shake = 0.5; }
}
function updateSpawner(dt) {
  G.waveT += dt;
  if (G.waveT >= WAVE_SECS) newWave();
  G.spawnT -= dt;
  const interval = Math.max(0.3, 1.25 * Math.pow(0.93, G.wave - 1)) * (G.bossAlive ? 1.6 : 1);
  if (G.spawnT <= 0) { G.spawnT = interval * rand(0.7, 1.3); spawn(pickKind(G.wave), rand(0, TAU)); }
  if (G.wave >= 2) {
    G.groupT -= dt;
    if (G.groupT <= 0) {                                   // a fan of shadows from one side: a wide shield matters
      G.groupT = rand(9, 14) / (1 + G.wave * 0.04);
      const n = 3 + Math.min(4, G.wave >> 1), a0 = rand(0, TAU), spread = 0.9;
      for (let i = 0; i < n; i++) spawn('wisp', a0 + (i / (n - 1) - 0.5) * spread, SPAWN_R + (i % 2) * 24);
    }
  }
}

/* ======================================================================
   Game flow
   ====================================================================== */
function startRun() {
  ghosts = []; parts = []; rings = []; texts = []; gems = [];
  Object.assign(G, { novaT: 0, essShown: 0, pulse: 0, combo: 0, comboT: 0, state: 'play', t: 0, wave: 1, waveT: 0, spawnT: 1.2, groupT: 9, score: 0, essRun: 0, earned: 0, kills: 0, hp: maxHp(), maxHp: maxHp(), shake: 0, flash: 0, hurtT: 0, revived: false, overT: 0, banner: 2.2, bannerTxt: 'WAVE 1', bossAlive: false });
  setScreens('none');
  Sound.wave();
}

function killGhost(g, byShield) {
  const K = KINDS[g.kind], p = pos(g);
  g.dead = true;
  G.score += K.val; G.kills++;
  award(K.val);
  spawnGems(p.x, p.y, K.val);
  const big = g.kind === 'brute' || g.kind === 'boss';
  smoke(p.x, p.y, big ? 10 : 5, big);
  sparks(p.x, p.y, big ? 24 : 9);
  if (big) { rings.push({ x: p.x, y: p.y, r: g.kind === 'boss' ? 260 : 120, life: 0.6, max: 0.6, col: '255,243,201' }); G.shake = Math.max(G.shake, g.kind === 'boss' ? 0.7 : 0.25); }
  Sound.pop();
  if (g.kind === 'split') {
    Sound.split();
    for (let i = -1; i <= 1; i += 2) spawn('mini', g.a + i * 0.28, g.r, { sp: KINDS.mini.sp * speedMul() });
  }
  if (g.kind === 'boss') { G.bossAlive = false; G.banner = 2.4; G.bannerTxt = 'THE SHADOW BREAKS'; Sound.best(); G.flash = 0.6; }
}

// the crystals of a kill drift out, then float to the counter, leaving a trail of ghostly echoes
function spawnGems(x, y, val) {
  const unit = val >= 20 ? 5 : val >= 5 ? 2 : 1;
  let left = val, i = 0;
  while (left > 0) {
    const v = Math.min(unit, left); left -= v;
    const a = rand(0, TAU), sp = rand(30, 90);
    gems.push({ x, y, v, kind: v >= 5 ? 2 : v >= 2 ? 1 : 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: -(i * 0.06 + rand(0, 0.12)), dur: rand(1.2, 1.7), sx: 0, sy: 0, trail: [], tt: 0, amp: rand(-70, 70), rot: rand(0, TAU) });
    i++;
  }
}
function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const m = gems[i];
    m.t += dt;
    if (m.t < 0) { continue; }
    if (!m.started) { m.started = true; m.sx = m.x; m.sy = m.y; }
    const e = Math.min(1, m.t / m.dur), k = e * e * (3 - 2 * e);                 // smooth, dreamy easing
    const drift = Math.min(1, m.t / 0.35);
    m.sx += m.vx * dt * (1 - drift); m.sy += m.vy * dt * (1 - drift);              // first it floats out a little
    const dx = HUD_GEM.x - m.sx, dy = HUD_GEM.y - m.sy;
    m.x = m.sx + dx * k - dy * 0 + (-dy / (Math.hypot(dx, dy) || 1)) * Math.sin(k * Math.PI) * m.amp;
    m.y = m.sy + dy * k + (dx / (Math.hypot(dx, dy) || 1)) * Math.sin(k * Math.PI) * m.amp;
    m.rot += dt * 2;
    m.tt -= dt;
    if (m.tt <= 0) { m.tt = 0.035; m.trail.push({ x: m.x, y: m.y, a: 1 }); if (m.trail.length > 14) m.trail.shift(); }
    for (const q of m.trail) q.a -= dt * 2.2;
    if (e >= 1) {
      G.essShown += m.v; G.pulse = 1; G.comboT = 0.7;
      ring(HUD_GEM.x, HUD_GEM.y, 46, 0.5, '143,216,255');
      sparks(HUD_GEM.x, HUD_GEM.y, 5, '#bfe9ff');
      Sound.crystal(G.combo++);
      gems.splice(i, 1);
    }
  }
  G.pulse = Math.max(0, G.pulse - dt * 2.6);
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
}

function hurtCore(g) {
  const K = KINDS[g.kind], p = pos(g);
  g.dead = true;
  smoke(p.x, p.y, 6, false);
  G.hp = Math.max(0, G.hp - K.dmg);
  G.shake = 0.5; G.flash = 0.5; G.hurtT = 0.5;
  ring(core.x, core.y, 90, 0.5, '255,120,150');
  Sound.hurt();
  if (g.kind === 'boss') G.bossAlive = false;
  if (G.hp <= 0) lightOut();
}

function lightOut() {
  if (!G.revived && Ads.canReward()) {
    G.state = 'revive'; G.revived = true;
    setScreens('revive');
    return;
  }
  finishRun();
}
function finishRun() {
  G.state = 'dying'; G.overT = 1.4;
  ghosts.forEach((g) => { g.dead = true; smoke(pos(g).x, pos(g).y, 2, false); });
  ring(core.x, core.y, 300, 1.2, '255,243,201');
  Sound.over();
}

function showResult() {
  G.state = 'result';
  const bonus = Math.floor(G.score / 10);
  G.earned = G.essRun + bonus;
  S.coins += G.earned;
  const rec = G.score > S.best;
  if (rec) S.best = G.score;
  S.bestWave = Math.max(S.bestWave, G.wave);
  S.plays++;
  save();
  Ads.runFinished();
  el('resTitle').textContent = G.wave < 3 ? 'THE LIGHT FADES' : G.wave < 7 ? 'THE LIGHT HELD' : 'A BEACON IN THE DARK';
  el('resWave').textContent = G.wave;
  el('resScore').textContent = G.score;
  el('resBest').textContent = S.best;
  el('resNew').classList.toggle('hidden', !rec);
  el('resCoins').textContent = '+' + G.earned;
  el('resBreak').textContent = G.essRun + ' from shadows + ' + bonus + ' bonus';
  el('btnDouble').classList.toggle('hidden', !Ads.canReward() || G.earned < 1);
  el('btnDouble').disabled = false;
  setScreens('result');
  if (rec && G.score > 0) Sound.best();
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.pausedFrom = G.state; G.state = 'paused';
  setScreens('paused');
}
function resumeGame() {
  if (G.state !== 'paused') return;
  G.state = G.pausedFrom; setScreens('none');
}
function toMenu() {
  G.state = 'menu'; ghosts = []; parts = []; rings = []; texts = [];
  setScreens('menu');
}

/* ======================================================================
   Update
   ====================================================================== */
const pos = (g) => ({ x: core.x + Math.cos(g.a) * g.r, y: core.y + Math.sin(g.a) * g.r });

function update(dt) {
  if (G.state === 'paused') return;
  wt += dt;
  updateGems(dt);
  G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt); G.hurtT = Math.max(0, G.hurtT - dt);
  G.banner = Math.max(0, G.banner - dt);
  shield.flash = Math.max(0, shield.flash - dt * 4);

  // shield turns towards the pointer, limited by the spin speed
  if (keys.l || keys.r) shield.tgt += (keys.r - keys.l) * SPIN_SPEED[S.spin - 1] * 0.8 * dt;
  const spd = SPIN_SPEED[S.spin - 1] * (G.state === 'menu' ? 0.4 : 1);
  if (G.state === 'menu') shield.tgt += dt * 0.7;
  const d = angDiff(shield.a, shield.tgt);
  shield.a += clamp(d * 14, -spd, spd) * dt;

  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5; if (p.rot !== undefined) p.rot += p.vr * dt; }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt; t.y -= 38 * dt; if (t.life <= 0) texts.splice(i, 1); }

  if (G.state === 'dying') { G.overT -= dt; if (G.overT <= 0) showResult(); return; }
  if (G.state !== 'play') return;
  G.t += dt;
  updateSpawner(dt);
  if (S.nova) {
    G.novaT += dt;
    if (G.novaT >= NOVA_EVERY) {
      G.novaT = 0;
      ring(core.x, core.y, 330, 0.9, '255,243,201'); ring(core.x, core.y, 220, 0.7, '143,216,255');
      G.flash = 0.45; Sound.revive();
      for (const gh of ghosts) {
        if (gh.dead || gh.r > 340) continue;
        if (gh.kind === 'boss') { gh.hp -= 3; gh.fl = 0.2; gh.kb = 0.35; if (gh.hp <= 0) killGhost(gh, true); } else killGhost(gh, true);
      }
    }
  }

  const half = SIZE_HALF[S.size - 1] * Math.PI / 180;
  for (const g of ghosts) {
    if (g.dead) continue;
    const K = KINDS[g.kind];
    g.age += dt; g.cool = Math.max(0, g.cool - dt); g.fl = Math.max(0, g.fl - dt);
    if (g.kb > 0) { g.kb -= dt; g.r += 260 * dt * (g.kb / 0.35); }
    else {
      let sp = g.sp;
      if (g.kind === 'boss') {
        if (g.r < 190) sp *= 0.3;                           // it hovers close, spits shadows, and keeps pressing
        g.a += Math.sin(g.age * 0.6) * 0.18 * dt;
        g.bt -= dt;
        if (g.bt <= 0) { g.bt = rand(2.2, 3.2); for (let i = -1; i <= 1; i++) spawn('wisp', g.a + i * 0.3, g.r - 20, { sp: 150 }); Sound.split(); }
      }
      g.r -= sp * dt;
    }
    if (g.kind === 'wailer') g.a += Math.cos(g.age * 2 + g.ph) * 0.5 * (g.r / SPAWN_R) * dt;
    const p = pos(g); g.x = p.x; g.y = p.y; g.rot = g.a - Math.PI / 2;

    // blocked by the shield?
    if (g.cool <= 0 && g.r - K.r * 0.8 <= ROUT - 8 && g.r + K.r > ROUT - 50) {
      const spread = half + Math.asin(Math.min(1, K.r * 0.8 / Math.max(g.r, 60)));
      if (Math.min(Math.abs(angDiff(shield.a, g.a)), S.twin ? Math.abs(angDiff(shield.a + Math.PI, g.a)) : 9) <= spread) {
        g.hp--; g.fl = 0.14; g.cool = 0.4; shield.flash = 1;
        sparks(g.x, g.y, 6);
        Sound.block();
        if (g.hp <= 0) killGhost(g, true);
        else { g.kb = 0.35; text(g.x, g.y - 12, g.kind === 'boss' ? '' : '', '#fff', 18); G.shake = Math.max(G.shake, 0.08); }
        continue;
      }
    }
    // reached the child
    if (g.r - K.r * 0.6 <= CORE_R) hurtCore(g);
  }
  ghosts = ghosts.filter((g) => !g.dead);
}

/* ======================================================================
   Drawing
   ====================================================================== */
function glowText(txt, x, y, size, fill, align) {
  ctx.save();
  ctx.font = '800 ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.18; ctx.strokeStyle = INK;
  ctx.shadowColor = 'rgba(243,217,139,.7)'; ctx.shadowBlur = size * 0.5;
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill || '#fff3c9'; ctx.fillText(txt, x, y);
  ctx.restore();
}

function drawBg() {
  if (ready(BG)) {
    const s = Math.max(W / BG.naturalWidth, H / BG.naturalHeight), w = BG.naturalWidth * s, h = BG.naturalHeight * s;
    ctx.drawImage(BG, (W - w) / 2, (H - h) / 2, w, h);
  } else { ctx.fillStyle = '#0b0a24'; ctx.fillRect(0, 0, W, H); }
  // slow dust
  ctx.fillStyle = 'rgba(205,189,243,.5)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 97.3 + wt * (4 + (i % 5))) % W, y = (i * 53.9 + Math.sin(wt * 0.3 + i) * 14 + 40 * i) % H;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(wt * 0.8 + i * 1.7));
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
}

function drawCore() {
  const hpR = G.state === 'menu' ? 1 : G.hp / G.maxHp;
  const pulse = 1 + Math.sin(wt * 2.2) * 0.05, bob = Math.sin(wt * 1.3) * 4;
  // glow
  const out = (G.state === 'dying' ? 0.25 : 1) * (0.45 + 0.55 * hpR);
  const gr = ctx.createRadialGradient(core.x, core.y + bob, 6, core.x, core.y + bob, 190 * pulse * (0.7 + 0.3 * hpR));
  gr.addColorStop(0, 'rgba(255,243,201,' + (0.55 * out) + ')'); gr.addColorStop(0.35, 'rgba(243,217,139,' + (0.22 * out) + ')'); gr.addColorStop(1, 'rgba(122,92,207,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();

  // sprite: the pose is chosen slowly; whenever it changes (hair drifting, light dimming) the new picture fades in over the old one
  const seq = ['kid_c', 'kid_r', 'kid_c', 'kid_l'];
  const want = (hpR <= 0.34 && G.state !== 'menu') ? 'kid_dark' : (hpR <= 0.67 && G.state !== 'menu') ? 'kid_dim' : seq[Math.floor(wt / 9) % 4];
  if (want !== kid.cur) { kid.prev = kid.cur; kid.cur = want; kid.t = 0; }
  kid.t = Math.min(1, kid.t + Math.max(0, wt - kid.last) / 2.6); kid.last = wt;
  const draw = (n, al) => {
    const im = SPR[n]; if (!ready(im)) return;
    const hgt = 104 * pulse, w = hgt * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.globalAlpha = al; ctx.translate(core.x, core.y + bob); ctx.rotate(Math.sin(wt * 0.9) * 0.04);
    ctx.drawImage(mip(im, w), -w / 2, -hgt / 2, w, hgt); ctx.restore();
  };
  if (kid.t < 1 && kid.prev) { const e = kid.t * kid.t * kid.t * (kid.t * (kid.t * 6 - 15) + 10); draw(kid.prev, 1); draw(kid.cur, e); }   // smootherstep: no dip in brightness, no sudden step
  else draw(kid.cur, 1);
  ctx.globalAlpha = 1;
}

function drawShield() {
  const c = shieldCanvas();
  if (!c) return;
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(shield.a + Math.PI / 2);
  // soft halo behind the arc
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 + shield.flash * 0.5;
  ctx.drawImage(c, -ROUT - 2 / scale, -ROUT, c.width / scale, c.height / scale);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(c, -ROUT - 2 / scale, -ROUT, c.width / scale, c.height / scale);
  if (S.twin) { ctx.rotate(Math.PI); ctx.drawImage(c, -ROUT - 2 / scale, -ROUT, c.width / scale, c.height / scale); }
  ctx.restore();
  if (S.nova && G.state === 'play') {
    const f = G.novaT / NOVA_EVERY;
    ctx.save(); ctx.strokeStyle = 'rgba(143,216,255,' + (f > 0.97 ? 0.9 : 0.35) + ')'; ctx.lineWidth = 3; ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(core.x, core.y, 66, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke(); ctx.restore();
  }
}

function drawGhosts() {
  for (const g of ghosts) {
    const K = KINDS[g.kind], im = SPR[K.spr];
    if (!ready(im)) continue;
    const h = K.h, w = h * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot + Math.sin(g.age * 5 + g.ph) * 0.06);
    ctx.globalAlpha = Math.min(1, g.age * 2.5);
    const sw = 1 + Math.sin(g.age * 6 + g.ph) * 0.04;
    ctx.scale(sw, 1 / sw);
    ctx.drawImage(mip(im, w), -w / 2, -h / 2, w, h);
    if (g.fl > 0) { const f = SPR[K.spr + '_f']; if (ready(f)) { ctx.globalAlpha = Math.min(1, g.fl / 0.14); ctx.drawImage(mip(f, w), -w / 2, -h / 2, w, h); } }
    ctx.restore();
    if (g.kind === 'boss') {
      const bw = 120, f = g.hp / g.maxhp;
      ctx.fillStyle = 'rgba(11,10,36,.7)'; ctx.fillRect(g.x - bw / 2 - 2, g.y - K.h / 2 - 22, bw + 4, 10);
      ctx.fillStyle = '#ff7a9a'; ctx.fillRect(g.x - bw / 2, g.y - K.h / 2 - 20, bw * f, 6);
    }
  }
}

const GEM_COL = [['#e9fbff', '#8fd8ff', '#8d74ff'], ['#fff0fb', '#ffb3e6', '#a86bff'], ['#fffbe0', '#ffd77a', '#ff9a5c']];
function drawGem(x, y, s, kind, rot, alpha) {
  const c = GEM_COL[kind || 0];
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(rot) * 0.25); ctx.globalAlpha = alpha;
  ctx.shadowColor = c[1]; ctx.shadowBlur = s * 0.9;
  const gr2 = ctx.createLinearGradient(-s * 0.6, -s, s * 0.6, s);
  gr2.addColorStop(0, c[0]); gr2.addColorStop(0.45, c[1]); gr2.addColorStop(1, c[2]);
  ctx.fillStyle = gr2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, -s * 0.25); ctx.lineTo(s * 0.4, s * 0.85); ctx.lineTo(-s * 0.4, s * 0.85); ctx.lineTo(-s * 0.62, -s * 0.25); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.55)';                                         // facets
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, -s * 0.25); ctx.lineTo(0, -s * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(40,20,120,.18)';
  ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.lineTo(s * 0.62, -s * 0.25); ctx.lineTo(s * 0.4, s * 0.85); ctx.lineTo(0, s * 0.85); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawGems() {
  for (const m of gems) {
    if (m.t < 0) continue;
    const sz = [9, 12, 16][m.kind];
    for (const q of m.trail) if (q.a > 0) drawGem(q.x, q.y, sz * (0.45 + 0.4 * q.a), m.kind, m.rot, q.a * 0.28);     // ghostly echoes
    drawGem(m.x, m.y, sz, m.kind, m.rot, 1);
  }
}

function drawFx() {
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 'puff') {
      const im = SPR.puff; if (!ready(im)) continue;
      const s = p.s * (1.4 - a * 0.6);
      ctx.save(); ctx.globalAlpha = a * 0.8; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(mip(im, s * 2), -s, -s * im.naturalHeight / im.naturalWidth, s * 2, s * 2 * im.naturalHeight / im.naturalWidth); ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.4 + a * 0.6), 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  for (const r of rings) {
    const t = 1 - r.life / r.max;
    ctx.save(); ctx.strokeStyle = 'rgba(' + r.col + ',' + (0.8 * (1 - t)) + ')'; ctx.lineWidth = 6 * (1 - t) + 1; ctx.shadowColor = 'rgba(' + r.col + ',1)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(r.x, r.y, 10 + r.r * t, 0, TAU); ctx.stroke(); ctx.restore();
  }
  for (const t of texts) { ctx.globalAlpha = clamp(t.life / 0.5, 0, 1); glowText(t.txt, t.x, t.y, t.size, t.col); }
  ctx.globalAlpha = 1;
}

function drawHud() {
  plateAt('plate_wave', 14, 28, 138, 34);
  plateAt('plate_count', W - 160, 36, 146, 40);
  glowText('WAVE ' + G.wave, 22, 48, 30, '#fff3c9', 'left');
  glowText(String(G.score), 22, 82, 22, '#cdbdf3', 'left');
  // light: one orb per hit point
  const n = G.maxHp, step = 30, x0 = W / 2 - (n - 1) * step / 2;
  const orb = SPR.orb;
  for (let i = 0; i < n; i++) {
    const on = i < G.hp;
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.22; if (on) { ctx.shadowColor = '#fff3c9'; ctx.shadowBlur = 10; }
    if (ready(orb)) ctx.drawImage(mip(orb, 24), x0 + i * step - 12, 36, 24, 24);
    else { ctx.fillStyle = '#fff3c9'; ctx.beginPath(); ctx.arc(x0 + i * step, 48, 11, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  const pz = 1 + G.pulse * 0.35;
  ctx.save(); ctx.translate(HUD_GEM.x, HUD_GEM.y); ctx.scale(pz, pz);
  if (G.pulse > 0) { ctx.globalAlpha = G.pulse * 0.8; ctx.shadowColor = '#8fd8ff'; ctx.shadowBlur = 30; ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
  drawGem(0, 0, 17, 0, wt * 1.2, 1);
  ctx.restore();
  glowText(String(Math.round(G.essShown)), HUD_GEM.x - 28 * pz, HUD_GEM.y, 32 * (1 + G.pulse * 0.12), '#e9fbff', 'right');
  if (G.banner > 0) {
    const a = clamp(Math.min(G.banner, 2.2 - G.banner + 0.0) * 2, 0, 1);
    ctx.globalAlpha = clamp(G.banner / 0.6, 0, 1) * clamp((2.4 - G.banner) / 0.3 + 0.2, 0, 1);
    glowText(G.bannerTxt, W / 2, H * 0.2, 46, '#fff3c9');
    ctx.globalAlpha = 1;
  }
}
function ctxTextW(t, size) { ctx.save(); ctx.font = '800 ' + size + 'px ' + FONT; const w = ctx.measureText(t).width; ctx.restore(); return w; }

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 14, rand(-1, 1) * G.shake * 14);
  drawBg();
  drawCore();
  drawGhosts();
  if (G.state !== 'dying') drawShield();
  drawFx();
  drawGems();
  ctx.restore();
  if (G.hurtT > 0) { ctx.fillStyle = 'rgba(255,70,110,' + (G.hurtT * 0.35) + ')'; ctx.fillRect(0, 0, W, H); }
  if (G.flash > 0 && G.hurtT <= 0) { ctx.fillStyle = 'rgba(255,243,201,' + (G.flash * 0.4) + ')'; ctx.fillRect(0, 0, W, H); }
  if (G.state === 'play' || G.state === 'dying' || G.state === 'revive' || G.state === 'paused') drawHud();
}

/* ======================================================================
   Upgrades
   ====================================================================== */
function renderShop() {
  el('shopCoins').textContent = S.coins;
  const list = el('shopList');
  list.innerHTML = '';
  const orbHtml = '<i class="orb"></i>';
  const adOK = Ads.canReward();
  const btn = (html, cls, fn, disabled) => {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.innerHTML = html; b.disabled = !!disabled;
    b.addEventListener('click', () => { Sound.unlock(); Sound.click(); fn(); });
    return b;
  };
  const row = (name, desc, lv, max, cost, icon, apply) => {
    const r = document.createElement('div'); r.className = 'row';
    let pips = ''; for (let i = 1; i <= max; i++) pips += '<i class="' + (i <= lv ? 'on' : '') + '"></i>';
    r.innerHTML = '<div class="left"><img class="ic" src="' + icon + '" alt=""><div class="info"><b>' + name + '</b><span>' + desc + '</span><div class="pips">' + pips + '</div></div></div>';
    const a = document.createElement('div'); a.className = 'acts';
    if (lv >= max) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = 'MAX'; a.appendChild(t); }
    else {
      a.appendChild(btn(orbHtml + cost, '', () => { if (S.coins >= cost) { S.coins -= cost; apply(); save(); Sound.buy(); renderShop(); } }, S.coins < cost));
      if (adOK) a.appendChild(btn('AD &middot; FREE', 'green', () => Ads.watch('upgrade-' + name, () => { apply(); save(); Sound.buy(); renderShop(); })));
    }
    r.appendChild(a); list.appendChild(r);
  };
  const adRow = (name, desc, owned, need, key, icon, apply) => {
    const r = document.createElement('div'); r.className = 'row';
    const done = S.adp[key] || 0;
    r.innerHTML = '<div class="left"><img class="ic' + (owned ? '' : ' dim') + '" src="' + icon + '" alt=""><div class="info"><b>' + name + '</b><span>' + (owned ? '' : 'AD ONLY. ') + desc + '</span></div></div>';
    const a = document.createElement('div'); a.className = 'acts';
    if (owned) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = 'UNLOCKED'; a.appendChild(t); }
    else if (adOK) a.appendChild(btn('AD ' + done + '/' + need, 'green', () => Ads.watch('upgrade-' + key, () => {
      S.adp[key] = (S.adp[key] || 0) + 1;
      if (S.adp[key] >= need) { apply(); Sound.buy(); }
      save(); renderShop();
    })));
    else a.appendChild(btn('AD ' + done + '/' + need, 'small', () => {}, true));
    r.appendChild(a); list.appendChild(r);
  };
  row('SHIELD SIZE', 'A wider guard of light. New look at levels 2-4.', S.size, 5, SIZE_COST[S.size] || 0, 'img/arc' + Math.min(4, S.size + 1 > 4 ? 4 : S.size + 1) + '.png', () => { S.size++; });
  row('SPIN SPEED', 'The shield follows your finger faster.', S.spin, 5, SPIN_COST[S.spin] || 0, 'img/arc1.png', () => { S.spin++; });
  row('LIGHT', 'More hit points for the little one.', S.hearts, 4, HEART_COST[S.hearts] || 0, 'img/orb.png', () => { S.hearts++; });
  adRow('TWIN SHIELD', 'A second shield guards the opposite side.', S.twin, 3, 'twin', 'img/arc4.png', () => { S.twin = true; });
  adRow('STARBURST', 'Every 18 s a wave of light clears the shadows nearby.', S.nova, 2, 'nova', 'img/smokering.png', () => { S.nova = true; });
}

/* ======================================================================
   UI plumbing
   ====================================================================== */
function setScreens(mode) {
  const show = (id, on) => el(id).classList.toggle('hidden', !on);
  show('menu', mode === 'menu');
  show('shop', mode === 'shop');
  show('result', mode === 'result');
  show('pause', mode === 'paused');
  show('revive', mode === 'revive');
  setAbout(false);
  if (mode === 'menu') { el('menuCoins').textContent = S.coins; el('menuBest').textContent = S.best; }
}

function setAbout(on) { el('about').classList.toggle('hidden', !on); el('aboutBack').classList.toggle('hidden', !on); }

function fillAbout() {
  const a = DEFEND_CONFIG.about, host = DEFEND_CONFIG.lock.url;
  const set = (id, html) => { const n = el(id); n.innerHTML = html; n.style.display = html ? '' : 'none'; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  set('aboutAuthor', a.author ? 'Created by <b>' + esc(a.author) + '</b>' : '');
  set('aboutStudio', a.studio ? 'Studio: <b>' + esc(a.studio) + '</b>' : '');
  set('aboutEmail', a.email ? 'Contact: <b><a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a></b>' : '');
  set('aboutSite', '<a href="' + esc(host) + '" target="_blank" rel="noopener">' + esc(host.replace('https://', '')) + '</a>');
}
function refreshSoundButtons() {
  const m = Sound.isMuted();
  document.querySelectorAll('.snd-toggle').forEach((b) => { b.textContent = m ? 'SOUND: OFF' : 'SOUND: ON'; });
}
function bind(id, fn) {
  el(id).addEventListener('click', (e) => { Sound.unlock(); Sound.click(); e.currentTarget.blur(); fn(); });
}
bind('btnPlay', () => Ads.beforeRun(startRun));
bind('btnShop', () => { G.state = 'shop'; renderShop(); setScreens('shop'); });
bind('btnShopBack', toMenu);
bind('btnAbout', () => setAbout(true));
bind('btnAboutClose', () => setAbout(false));
bind('btnAgain', () => Ads.beforeRun(startRun));
bind('btnResShop', () => { G.state = 'shop'; renderShop(); setScreens('shop'); });
bind('btnResMenu', toMenu);
bind('btnResume', resumeGame);
bind('btnDouble', () => {
  el('btnDouble').disabled = true;
  Ads.watch('double-essence', () => {
    S.coins += G.earned; save();
    el('resCoins').textContent = '+' + G.earned * 2;
    el('btnDouble').classList.add('hidden');
    Sound.buy();
  }, () => { el('btnDouble').disabled = false; });
});
bind('btnRevive', () => {
  el('btnRevive').disabled = true;
  Ads.watch('revive', () => {
    G.hp = G.maxHp; G.state = 'play'; setScreens('none');
    ring(core.x, core.y, 520, 0.9, '255,243,201'); G.flash = 0.8; Sound.revive();
    ghosts.forEach((g) => { if (g.kind !== 'boss') { g.dead = true; smoke(pos(g).x, pos(g).y, 3, false); } else { g.kb = 0.35; g.r += 80; } });
    el('btnRevive').disabled = false;
  }, () => { el('btnRevive').disabled = false; finishRun(); setScreens('none'); });
});
bind('btnNoRevive', () => { setScreens('none'); finishRun(); });
document.querySelectorAll('.snd-toggle').forEach((b) => b.addEventListener('click', () => { Sound.unlock(); Sound.toggle(); refreshSoundButtons(); b.blur(); }));

/* input: the shield turns to face the pointer */
function aimAt(e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  const dx = x - core.x, dy = y - core.y;
  if (dx * dx + dy * dy > 30 * 30) shield.tgt = Math.atan2(dy, dx);
}
stage.addEventListener('pointerdown', (e) => {
  Sound.unlock();
  if (e.target.closest('button') || e.target.closest('.panel')) return;
  aimAt(e);
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
});
window.addEventListener('pointermove', (e) => {
  if (G.state !== 'play') return;
  if (e.pointerType !== 'mouse' && e.buttons === 0 && e.pressure === 0) return;
  aimAt(e);
});
window.addEventListener('keydown', (e) => {
  Sound.unlock();
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.l = 1; e.preventDefault(); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.r = 1; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'KeyM') { Sound.toggle(); refreshSoundButtons(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'paused') resumeGame(); else pauseGame(); return; }
  if ((e.code === 'Space' || e.code === 'Enter') && G.state === 'menu' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); Ads.beforeRun(startRun); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = 0;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = 0;
});
window.addEventListener('blur', () => { keys.l = keys.r = 0; pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

/* ======================================================================
   Boot
   ====================================================================== */
resize();
refreshSoundButtons();
fillAbout();
setScreens('menu');
Ads.init();

let last = performance.now(), lockT = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  lockT += dt;
  if (lockT > 3) { lockT = 0; if (!Lock.ok()) { Lock.block(); return; } }
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__defend = { G, S, core, shield, spawn, update, render, startRun, get ghosts() { return ghosts; } };
})();
