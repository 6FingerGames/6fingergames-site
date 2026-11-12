(() => {
'use strict';

if (typeof Lock === 'undefined' || !Lock.ok()) {
  if (typeof Lock !== 'undefined') Lock.block(); else document.body.textContent = '6fingergames.com';
  return;
}

const W = 540;
let H = 960;
const TAU = Math.PI * 2;
const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';
const PXM = 40;                       // pixels per metre
const GRAV = 300;                    // floaty on purpose: long flights
const INK = '#2b1d4a';
const WALL = 56;                      // thickness of the building facades on both sides
const WALL_TOP = 4400;                // facades end at (about) this altitude (px); above it is open sky, then space
const AIR_TOP = 4000;                 // trampolines, ropes, trees, balloons and birds exist only below this; higher up there is only coins and rockets

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const tri = (p) => { const f = p % 2; return f < 1 ? f : 2 - f; };
const el = (id) => document.getElementById(id);

/* character sprites (cut from the generated sheet; the vector guy below is only the fallback while they load) */
const SPR = {};
const MIP = new Map();
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
['stand', 'crouch', 'arrowup', 'arrowdown', 'tuck1', 'tuck2', 'tuck3', 'tuck4', 'ballet1', 'ballet2', 'splat', 'stretch', 'ground', 'dizzy', 'happy', 'scared'].forEach((n) => {
  const im = new Image(); im.src = 'img/guy/' + n + '.png'; SPR[n] = im;
});
['basic', 'spring', 'spiked', 'rocket'].forEach((n) => {
  const im = new Image(); im.src = 'img/leg/impact_' + n + '.png'; SPR['impact_' + n] = im;
});
['sun', 'facadeL', 'facadeR', 'street', 'cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6'].forEach((n) => {
  const im = new Image(); im.src = 'img/env/' + n + '.png'; SPR[n] = im;
});
['tramp', 'springtree', 'balloon', 'bird1', 'bird2', 'rocket', 'coin0', 'coin1', 'coin2', 'coin3', 'coin4', 'burst', 'dust', 'stars', 'shirt', 'sock1', 'sock2', 'gauge', 'needle', 'station', 'god1', 'god2'].forEach((n) => {
  const im = new Image(); im.src = 'img/props/' + n + '.png'; SPR[n] = im;
});
// sky colours sampled from the generated sky picture, top (space) -> bottom (day)
const SKY_LUT = [[11,20,62],[12,21,63],[14,23,67],[14,24,70],[15,26,72],[16,28,77],[16,31,83],[18,32,87],[17,34,91],[19,37,96],[20,39,101],[21,41,105],[22,43,109],[21,45,111],[22,45,114],[23,45,115],[23,46,115],[22,47,117],[23,49,121],[24,53,125],[25,57,131],[25,61,137],[27,66,145],[29,71,153],[29,76,161],[31,82,170],[32,87,177],[34,92,185],[35,97,193],[36,101,199],[37,104,203],[38,106,207],[38,108,210],[38,108,210],[39,109,211],[40,112,212],[43,117,214],[47,122,217],[50,129,219],[55,137,223],[60,144,226],[64,152,230],[69,160,233],[74,169,237],[79,176,240],[83,182,243],[86,188,246],[89,193,248],[91,197,250],[93,198,249],[93,198,249],[91,198,250],[90,197,250],[87,196,251],[83,195,251],[80,193,252],[76,191,253],[72,189,254],[68,187,252],[65,186,254],[62,184,254],[60,183,255],[57,182,255],[57,181,255]];
const SKY_ALT = 7000;                                  // altitude (px) where the sky is fully dark
const STREET = { w: 1055, h: 256, grassTop: 143, dirt: 'rgb(158,73,23)' };
const FAC_K = 0.36;                                    // facade pictures -> logical px
const K_BODY = 0.58;                 // one scale for every pose, so the man never changes size

const stage = el('stage');
const cv = el('c');
const ctx = cv.getContext('2d');
let scale = 1, GS = 800;              // GS = screen y of the ground line while the camera is at the bottom

/* ======================================================================
   Save data, shoes, upgrades
   ====================================================================== */
const SHOES = {
  // how: 'coins' = bought with coins; 'ads' = unlocked only by watching rewarded ads (need = number of ads) and far stronger
  basic:  { name: 'SNEAKERS',     mul: 1.0,  col: '#f2f2f2', how: 'free',  cost: 0,   desc: 'Plain and reliable.' },
  spring: { name: 'SPRING SHOES', mul: 1.12, col: '#35c759', how: 'coins', cost: 250, desc: '+12% power. Bounces once on landing.' },
  spiked: { name: 'SPIKED BOOTS', mul: 1.22, col: '#c9cbe0', how: 'coins', cost: 700, desc: '+22% power. Pops birds for coins.' },
  rocket: { name: 'ROCKET BOOTS', mul: 1.7,  col: '#ff4b3a', how: 'ads',   need: 3,   desc: '+70% power! Extra boost on kick-off.' }
};
const LEGMAX = 15;
const legMul = () => 1 + 0.13 * (S.leg - 1);
const legCost = (l) => Math.round(40 * Math.pow(1.5, l - 1));

const S = (() => {
  let o = null;
  try { o = JSON.parse(Store.get('save', '')); } catch (e) {}
  if (!o || typeof o !== 'object') o = {};
  o.coins = o.coins | 0; o.leg = clamp(o.leg | 0 || 1, 1, LEGMAX); o.best = o.best | 0; o.plays = o.plays | 0;
  o.owned = o.owned || { basic: 1 }; o.owned.basic = 1;
  o.adp = o.adp || {};
  o.shoe = SHOES[o.shoe] && o.owned[o.shoe] ? o.shoe : 'basic';
  return o;
})();
// Saving never takes anything away that another window of the game already saved: what you own, your leg level and the ad progress only ever go up.
// (A second tab that still held the old state used to overwrite a purchase made in the first one.)
function mergeSaved(o) {
  if (!o || typeof o !== 'object') return;
  if (o.owned) for (const k in o.owned) if (o.owned[k] && SHOES[k]) S.owned[k] = 1;
  if ((o.leg | 0) > S.leg) S.leg = clamp(o.leg | 0, 1, LEGMAX);
  if (o.adp) for (const k in o.adp) S.adp[k] = Math.max(S.adp[k] | 0, o.adp[k] | 0);
  S.best = Math.max(S.best | 0, o.best | 0); S.plays = Math.max(S.plays | 0, o.plays | 0);
}
function warnNoSave() {
  if (document.getElementById('noSaveWarn')) return;
  const d = document.createElement('div'); d.id = 'noSaveWarn';
  d.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99998;max-width:90vw;padding:10px 16px;border-radius:12px;background:#b3261e;color:#fff;font:700 14px/1.3 system-ui,Arial,sans-serif;text-align:center';
  d.textContent = 'Your browser is blocking saving (private mode?). Coins and purchases will be lost when you close the game.';
  document.body.appendChild(d); setTimeout(() => d.remove(), 9000);
}
const save = () => {
  try { mergeSaved(JSON.parse(Store.get('save', ''))); } catch (e) { /* nothing saved yet */ }
  Store.set('save', JSON.stringify(S));
  if (Store.failed) warnNoSave();
};
// another tab saved: take over its numbers right away, so this tab never works from an old picture
window.addEventListener('storage', (e) => {
  if (e.key !== 'kick.save' || !e.newValue) return;
  try { const o = JSON.parse(e.newValue); if (o && typeof o === 'object') { S.coins = o.coins | 0; mergeSaved(o); if (SHOES[o.shoe] && S.owned[o.shoe]) S.shoe = o.shoe; if (G.state === 'shop') renderShop(); } } catch (err) { /* ignore a damaged value */ }
});
const shoe = () => SHOES[S.shoe];

/* ======================================================================
   State
   ====================================================================== */
const G = {
  state: 'menu', ts: 1, slowT: 0, shake: 0, flash: 0, ph: 0, power: 0,
  cT: 0, kT: 0, maxAlt: 0, coinsRun: 0, earned: 0, hold: false, stuckT: 0,
  pausedFrom: 'aim', trick: 0, trickKind: 'tuck', bn: 0, kickX: 0, kickY: 0, legT: -1, hit: false, trickSpin: 1, bounces: 0
};
// y is negative upwards (altitude = -y); the ground is y = 0
const P = { x: W / 2, y: -80, vx: 0, vy: 0, rot: 0, tgt: W / 2 };
const cam = { y: 0 };
// grandpa sprites: the pupils are painted out of the pictures and drawn in code so they can follow the man (eye centres in sprite pixels, white radius, pupil radius)
const GOD_EYES = { god1: { eyes: [[186, 198], [263, 198]], er: 17, pr: 6 }, god2: { eyes: [[184, 195], [268, 195]], er: 23, pr: 4.5 } };
// grandpa sits just above the player's record (at least 1070 m), so he is always the next goal; once met he stays where he was found
const HEAVEN_MIN_M = 1070;
const heavenAlt = () => (S.metHeaven && S.heavenM ? S.heavenM : Math.max(HEAVEN_MIN_M, Math.round(S.best * 1.03))) * PXM;
const STATION_ALT = 15000;        // px above the ground (~375 m)
let items = [], parts = [], texts = [], rings = [], fx = [], genY = 500;
let wt = 0;
const clouds = [];
for (let i = 0; i < 40; i++) clouds.push({ x: rand(0, W), alt: rand(250, 3200), s: rand(0.7, 1.4), im: 1 + ((Math.random() * 6) | 0) });
const stars = [];
for (let i = 0; i < 70; i++) stars.push({ x: rand(0, W), alt: rand(3500, 12000), r: rand(0.8, 2.2) });
const keys = { l: 0, r: 0 };
const mouse = { live: false, ox: 0, oy: 0, x: 0 };
const touch = { active: false, sx: 0, bx: 0, lx: 0 };

/* ======================================================================
   Layout
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
  GS = H - 130;
  document.documentElement.style.setProperty('--u', (w / W) + 'px');
}

/* ======================================================================
   World generation (by altitude)
   ====================================================================== */
function coinTrail(x0, alt, n, step, amp, phase) {
  for (let k = 0; k < n; k++) items.push({ t: 'coin', x: clamp(x0 + Math.sin(k * 0.6 + (phase || 0)) * amp, WALL + 24, W - WALL - 24), y: -(alt + k * step), r: 16, got: false });
}

function genAhead() {
  while (genY < G.maxAlt + 8000) {
    const alt = genY, x = rand(WALL + 70, W - WALL - 70);
    let r = Math.random();
    if (alt > AIR_TOP) r = r < 0.8 ? r * 0.725 : 0.8 + (r - 0.8) * 0.25;      // thin air and space: only coins and rockets
    if (r < 0.58) {
      const kind = Math.random();
      if (kind < 0.4) { const n = 8 + ((Math.random() * 8) | 0); coinTrail(x, alt, n, 50, 55, rand(0, TAU)); genY += n * 50; }
      else if (kind < 0.75) {
        const n = 7 + ((Math.random() * 5) | 0), x0 = rand(WALL + 100, W - WALL - 100), sg = Math.random() < 0.5 ? 1 : -1;
        for (let k = 0; k < n; k++) items.push({ t: 'coin', x: x0 + Math.sin(k / (n - 1) * Math.PI) * 80 * sg, y: -(alt + k * 44), r: 16, got: false });
        genY += n * 44;
      } else {
        const n = 9, d = Math.random() < 0.5;
        for (let k = 0; k < n; k++) items.push({ t: 'coin', x: lerp(WALL + 50, W - WALL - 50, d ? k / (n - 1) : 1 - k / (n - 1)), y: -(alt + k * 42), r: 16, got: false });
        genY += n * 42;
      }
    } else if (r < 0.67) {
      items.push({ t: 'balloon', x, y: -alt, r: 28, hit: false, col: ['#ff4b6e', '#4ba8ff', '#ffd23a', '#5be07a'][(Math.random() * 4) | 0] });
      coinTrail(x, alt + 140, 12, 100, 50, rand(0, TAU));
      genY += rand(500, 800);
    } else if (r < 0.80) items.push({ t: 'bird', x, y: -alt, r: 24, vx: Math.random() < 0.5 ? -90 : 90, ph: rand(0, TAU), hit: false, rot: 0, vy: 0 });
    else if (r < 0.85) {
      items.push({ t: 'rocket', x, y: -alt, r: 26, got: false });
      coinTrail(x, alt + 200, 24, 120, 60, rand(0, TAU));
      genY += rand(800, 1200);
    } else if (r < 0.90) {
      items.push({ t: 'tramp', x, y: -alt, w: 130, squash: 0 });
      coinTrail(x, alt + 260, 26, 120, 70, rand(0, TAU));       // the reward for bouncing: a long column of coins above it
      genY += rand(800, 1300);
    } else if (r < 0.95) {
      items.push({ t: 'tree', x, y: -alt, w: 120, squash: 0 });
      coinTrail(x, alt + 280, 28, 120, 80, rand(0, TAU));
      genY += rand(800, 1300);
    } else {
      items.push({ t: 'rope', x: W / 2, y: -alt, w: W - WALL * 2 - 30, squash: 0 });
      coinTrail(W / 2, alt + 260, 26, 120, 130, rand(0, TAU));
      genY += rand(800, 1300);
    }
    genY += rand(220, 460);
  }
}

/* ======================================================================
   Effects
   ====================================================================== */
function burst(x, y, cols, n, spd, size, grav) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1), max: 1, size: rand(size * 0.6, size), col: cols[(Math.random() * cols.length) | 0], g: grav === undefined ? 600 : grav });
  }
}
function fxAdd(name, x, y, w, life, rise) { fx.push({ name, x, y, w, life, max: life, rise: rise || 0 }); }
function ring(x, y, r, life) { rings.push({ x, y, r, life, max: life }); }
function text(x, y, txt, col, size) { texts.push({ x, y, txt, col: col || '#fff', size: size || 40, life: 1.1 }); }

/* ======================================================================
   Game flow
   ====================================================================== */
function startAim() {
  G.state = 'aim'; G.ph = 0; G.power = 0;
  G.cT = 0; G.kT = 0; G.maxAlt = 0; G.coinsRun = 0; G.ts = 1; G.slowT = 0; G.hold = false; G.stuckT = 0; G.trick = 0; G.bounces = 0; G.bn = 0; G.relaunched = false;
  P.x = W / 2; P.y = -80; P.vx = P.vy = 0; P.rot = 0; P.tgt = P.x;
  items = []; parts = []; texts = []; rings = []; fx = []; genY = 500; G.legT = -1; G.hit = false;
  items.push({ t: 'heaven', x: W / 2, y: -heavenAlt(), r: 120, got: false });                 // a grandpa sitting on a cloud, very surprised to see you
  items.push({ t: 'station', x: W / 2, y: -STATION_ALT, r: 80, vx: 38, got: false });      // the far goal: only a really great flight gets up here
  cam.y = 0;
  genAhead();
  setScreens('play');
}

// one tap: stop the needle
function act() {
  if (G.state !== 'aim') return;
  G.power = tri(G.ph);
  G.state = 'crouch'; G.cT = 0;
  Sound.swish();
}

function launch() {
  const v = (1700 + 1900 * Math.pow(G.power, 1.3)) * legMul() * shoe().mul;
  P.vy = -v;
  P.vx = 0;
  if (S.shoe === 'rocket') P.vy -= 300;
  P.tgt = P.x; mouse.live = false;
  if (touch.active) { touch.sx = touch.lx; touch.bx = P.x; }
  G.state = 'fly';
  G.slowT = 0.45; G.kT = 0;
  Sound.scream();
}

// the moment the shoe lands: shock rings, burst, shake, the man is squashed (drawn in drawMan)
function impact() {
  Sound.whack();
  G.shake = 30; G.flash = 0.5;
  ring(G.kickX, G.kickY + 8, 240, 0.38); ring(G.kickX, G.kickY + 8, 150, 0.26);
  burst(G.kickX, G.kickY + 8, ['#fff', '#ffd23a', '#ff8a1a'], 36, 640, 11, 200);
  const perfect = G.power > 0.92;
  text(G.kickX, G.kickY - 140, perfect ? 'PERFECT!' : ['WHAP!', 'THWACK!', 'KABOOM!'][(Math.random() * 3) | 0], perfect ? '#8dff5a' : '#ffd23a', 60);
  if (perfect) Sound.perfect();
}

function trick(txt, col, kind) {
  G.trick = 0.75; G.trickKind = kind || 'tuck'; G.trickSpin = Math.random() < 0.5 ? 1 : -1;
  text(P.x, P.y - 60, txt, col || '#fff', 40);
}

function land() {
  if (S.shoe === 'spring' && G.bounces < 1 && P.vy > 250) {
    G.bounces++; P.y = -82; P.vy = -P.vy * 0.6;
    trick('BOING!', '#35c759');
    burst(P.x, 0, ['#8a5a3a', '#5ac85a'], 12, 260, 7);
    Sound.boing();
    return;
  }
  G.state = 'stuck'; G.stuckT = 0; G.shake = 18;
  P.y = -22; P.vx = P.vy = 0; G.trick = 0;
  burst(P.x, -4, ['#8a5a3a', '#6b4128', '#5ac85a', '#a36f48'], 36, 440, 9);
  fxAdd('dust', P.x - 60, -24, 120, 0.8, 30); fxAdd('dust', P.x + 60, -24, 120, 0.8, 30); fxAdd('dust', P.x, -36, 150, 0.9, 40);
  text(P.x, -130, 'THUD!', '#fff', 54);
  Sound.thud();
}

// every bounce, balloon or rocket in one flight is weaker than the last, so the flight always ends
function bounceFade() { const f = Math.pow(0.78, G.bn); G.bn++; return f; }

function updateFly(dt) {
  const falling = P.vy > 0;
  const dive = G.hold && falling;
  const prevY = P.y;
  P.vy += GRAV * (dive ? 2.0 : 1) * dt;
  P.vy = Math.min(P.vy, 2600);
  P.y += P.vy * dt;
  // steering
  if (keys.l || keys.r) P.tgt = P.x + (keys.r - keys.l) * 200;
  P.vx = clamp((P.tgt - P.x) * 9, -620, 620);
  P.x += P.vx * dt;
  const lim = -P.y < wallTop() ? WALL + 26 : 24;
  if (P.x < lim) { P.x = lim; P.tgt = Math.max(P.tgt, lim); if (-P.y < wallTop() && P.vx < -80) wallHit(1); }
  if (P.x > W - lim) { P.x = W - lim; P.tgt = Math.min(P.tgt, W - lim); if (-P.y < wallTop() && P.vx > 80) wallHit(-1); }
  if (G.trick > 0) { G.trick -= dt; P.rot += G.trickSpin * 13 * dt; } else P.rot += (0 - ((P.rot + Math.PI) % TAU - Math.PI)) * Math.min(1, dt * 12);
  G.maxAlt = Math.max(G.maxAlt, -P.y);
  G.kT += dt;

  for (const it of items) {
    if (it.t === 'tramp' || it.t === 'rope' || it.t === 'tree') {
      it.squash = Math.max(0, it.squash - dt * 3);
      // bounce only when falling onto it from above
      if (!it.spent && P.vy > 0 && prevY <= it.y + 2 && P.y >= it.y - 4 && Math.abs(P.x - it.x) < it.w / 2 + 28) {
        it.spent = true;          // each bouncer works once, so the man cannot bounce on it forever
        const mul = S.shoe === 'spring' ? 1.15 : 1;
        // stronger pads (they felt too weak), and a pad bounce is never faded below 62% by the earlier bounces of the same flight
        P.vy = -Math.max(it.t === 'tramp' ? 2000 : it.t === 'tree' ? 2200 : 1700, Math.abs(P.vy) * 0.9) * mul * Math.max(bounceFade(), 0.62);
        it.squash = 1; P.y = it.y - 6;
        if (it.t === 'rope') trick('TWANG!', '#ffd23a', 'hop'); else trick(it.t === 'tree' ? 'SPROING!' : ['SALTO!', 'TA-DA!'][(Math.random() * 2) | 0], it.t === 'tree' ? '#35c759' : '#4ba8ff', Math.random() < 0.5 ? 'tuck' : 'ballet');
        fxAdd('burst', P.x, it.y, 90, 0.25);
        burst(P.x, it.y, ['#fff', '#4ba8ff', '#ffd23a'], 10, 260, 7);
        Sound.boing();
      }
      continue;
    }
    if (it.t === 'heaven' && !it.got && P.y > it.y && P.y - it.y < 2600) it.x += (clamp(P.x, 130, W - 130) - it.x) * Math.min(1, dt * 1.2);      // the cloud drifts over to meet the man, so he can't miss it
    if (it.t === 'station') {
      it.x += it.vx * dt;
      if (it.x < WALL + 110) it.vx = Math.abs(it.vx); else if (it.x > W - WALL - 110) it.vx = -Math.abs(it.vx);
    }
    if (it.t === 'bird') {
      if (it.hit) { it.x += it.vx * dt; it.y += it.vy * dt; it.vy += GRAV * 0.5 * dt; it.rot += 9 * dt; continue; }
      it.x += it.vx * dt;
      if (it.x < WALL + 20) it.vx = Math.abs(it.vx); else if (it.x > W - WALL - 20) it.vx = -Math.abs(it.vx);
    }
    if (it.got || (it.hit && it.t !== 'bird')) continue;
    const dx = P.x - it.x, dy = P.y - it.y, rr = it.r + 32;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (it.t === 'coin') {
      it.got = true; G.coinsRun++;
      burst(it.x, it.y, ['#ffd23a', '#fff4a8'], 7, 260, 6, 0);
      Sound.coin();
    } else if (it.t === 'balloon') {
      it.hit = true;
      P.vy = -Math.max(1000, Math.abs(P.vy) * 0.55 + 450) * bounceFade();   // never adds energy at speed, so chains of balloons die out
      trick('BOING!', '#fff');
      burst(it.x, it.y, [it.col, '#fff'], 16, 380, 8, 200);
      Sound.boing();
    } else if (it.t === 'bird') {
      it.hit = true; it.vx = it.vx > 0 ? 260 : -260; it.vy = -220;
      if (S.shoe === 'spiked') {
        G.coinsRun += 3;
        text(it.x, it.y - 40, 'POP! +3', '#ffd23a', 42);
        burst(it.x, it.y, ['#fff', '#ff8a1a', '#ffd23a'], 14, 320, 6, 300);
        fxAdd('burst', it.x, it.y, 120, 0.3);
        Sound.pop(); Sound.coin();
      } else {
        P.vy = P.vy < 0 ? P.vy * 0.55 : P.vy * 0.4 + 80;
        G.trick = 0.5; G.trickKind = 'stretch';
        text(it.x, it.y - 40, 'BONK!', '#ff8a1a', 42);
        burst(it.x, it.y, ['#fff', '#cfd6e6'], 14, 300, 6, 300);
        fxAdd('burst', it.x, it.y, 130, 0.35);
        Sound.bonk();
      }
    } else if (it.t === 'heaven') {
      it.got = true; G.coinsRun += 500;
      S.metHeaven = true; S.heavenM = Math.round(-it.y / PXM);
      P.vy = 300; G.trick = 0.6; G.trickKind = 'stretch';
      text(it.x, it.y - 150, 'GRANDPA?!', '#fff', 56);
      text(it.x, it.y - 210, '+500', '#ffd23a', 46);
      burst(it.x, it.y, ['#fff', '#fff4a8', '#ffd23a'], 40, 520, 8, 0);
      fxAdd('burst', it.x, it.y, 300, 0.45);
      G.flash = 1; Sound.perfect(); Sound.best();
    } else if (it.t === 'station') {
      it.got = true; G.coinsRun += 100;
      P.vy = Math.min(P.vy, -1500 * bounceFade());
      text(it.x, it.y - 90, 'SPACE STATION! +100', '#8dff5a', 44);
      trick('HOUSTON!', '#8dff5a');
      burst(it.x, it.y, ['#ffd23a', '#fff4a8', '#8dff5a', '#4ba8ff'], 40, 520, 8, 0);
      fxAdd('burst', it.x, it.y, 260, 0.4);
      Sound.perfect(); Sound.coin();
    } else if (it.t === 'rocket') {
      it.got = true;
      P.vy = Math.min(P.vy, -1700 * bounceFade());
      text(it.x, it.y - 50, 'ZOOM!', '#ff4b3a', 46);
      burst(it.x, it.y, ['#ff4b3a', '#ffd23a', '#fff'], 22, 460, 8, 100);
      Sound.rocket();
    }
  }
  if (P.y >= -80) { P.y = -80; land(); }
  if (G.state === 'fly' && Math.abs(P.vy) > 1300) for (let i = 0; i < 2; i++) parts.push({ x: rand(WALL + 10, W - WALL - 10), y: P.y + rand(-520, 520), vx: 0, vy: 0, life: 0.22, max: 0.22, size: 3, ln: rand(90, 200), col: 'rgba(255,255,255,.55)', g: 0 });
}

function wallHit(dir) {
  if (G.trick > 0.4) return;
  trick(['BONK!', 'SPLAT!', 'OOF!'][(Math.random() * 3) | 0], '#fff', 'splat');
  P.tgt = P.x + dir * 120;
  burst(P.x - dir * 20, P.y, ['#fff', '#d7c3a0'], 10, 240, 6, 300);
  fxAdd('burst', P.x - dir * 34, P.y, 110, 0.3);
  Sound.bonk();
}

function update(dt) {
  if (G.state === 'paused' || G.freeze) return;      // G.freeze is a debug switch for screenshots
  wt += dt;
  if (G.legT >= 0) G.legT += dt;
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }
  const tsT = G.slowT > 0 ? 0.2 : 1;
  if (G.slowT > 0) G.slowT -= dt;
  G.ts += (tsT - G.ts) * Math.min(1, dt * 14);
  const d = dt * G.ts;

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= d; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * d; p.x += p.vx * d; p.y += p.vy * d;
  }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt; t.y -= 40 * dt; if (t.life <= 0) texts.splice(i, 1); }
  G.shake = Math.max(0, G.shake - dt * 50);
  G.flash = Math.max(0, G.flash - dt * 2.2);

  switch (G.state) {
    case 'aim': G.ph += dt * 1.15; break;
    case 'crouch':
      G.cT += dt;
      if (G.cT >= 0.30) { G.state = 'kick'; G.legT = 0; G.hit = false; G.kickX = P.x; G.kickY = P.y; }
      break;
    case 'kick':
      if (!G.hit && G.legT >= 0.10) { G.hit = true; impact(); }
      if (G.legT >= 0.26) launch();       // a short freeze on the hit, then the man goes
      break;
    case 'fly':
      updateFly(d);
      genAhead();
      break;
    case 'stuck':
      G.stuckT += dt;
      if (G.stuckT > 1.4) {
        // far flight and the player chose nothing yet: OFFER (never force) a rocket relaunch for a rewarded ad
        if (!G.relaunched && G.maxAlt / PXM >= 40 && Ads.canReward()) { G.stuckT = -1e9; setScreens('cont'); }
        else showResult();
      }
      break;
  }

  // camera follows the man (rising and falling)
  const ty = Math.min(0, P.y + GS - H * (P.vy > 0 ? 0.42 : 0.64));
  cam.y += (ty - cam.y) * Math.min(1, dt * (G.state === 'fly' ? 11 : 3));
}

/* ======================================================================
   Drawing
   ====================================================================== */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function cartoonText(txt, x, y, size, fill, align, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.font = '400 ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = INK;
  ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = fill || '#fff';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

const altNow = () => Math.max(0, -cam.y);

function skyAt(alt) {
  const f = clamp(alt / SKY_ALT, 0, 1), p = (1 - f) * (SKY_LUT.length - 1), i = Math.floor(p), t = p - i;
  const a = SKY_LUT[i], b = SKY_LUT[Math.min(i + 1, SKY_LUT.length - 1)];
  return 'rgb(' + [0, 1, 2].map((k) => Math.round(lerp(a[k], b[k], t))).join(',') + ')';
}

function drawSky() {
  const a = clamp(altNow() / SKY_ALT, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (let k = 0; k <= 8; k++) g.addColorStop(k / 8, skyAt(GS + altNow() - k / 8 * H));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // twinkling sparkles in the dark part
  for (const s of stars) {
    const y = GS - (s.alt - altNow() * 0.35);
    if (y < -8 || y > H + 8) continue;
    const al = clamp((a - 0.3) * 2, 0, 1) * (0.5 + 0.5 * Math.sin(wt * 2 + s.x));
    if (al <= 0.02) continue;
    ctx.fillStyle = 'rgba(255,255,255,' + al.toFixed(2) + ')';
    const r = s.r * 2.4;
    ctx.beginPath(); ctx.moveTo(s.x, y - r); ctx.lineTo(s.x + r * 0.28, y - r * 0.28); ctx.lineTo(s.x + r, y); ctx.lineTo(s.x + r * 0.28, y + r * 0.28);
    ctx.lineTo(s.x, y + r); ctx.lineTo(s.x - r * 0.28, y + r * 0.28); ctx.lineTo(s.x - r, y); ctx.lineTo(s.x - r * 0.28, y - r * 0.28); ctx.closePath(); ctx.fill();
  }
  // sun and moon live in the sky, not on the glass: they slide down as the man climbs (parallax)
  const sunY = 125 + altNow() * 0.3, moonY = GS - (2400 - altNow() * 0.2);
  if (sunY < H + 90) {
    const sun = SPR.sun;
    if (sun && sun.complete && sun.naturalWidth) {       // the sun from the Diver game
      const sw = sun.naturalWidth * 0.62, sh = sun.naturalHeight * 0.62;
      ctx.drawImage(mip(sun, sw), W - 135 - sw / 2, sunY - sh / 2, sw, sh);
    } else {
      ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(W - 90, sunY, 48, 0, TAU); ctx.fill();
    }
  }
  if (moonY > -90 && moonY < H + 90) {
    ctx.fillStyle = '#f4f1e6'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W - 120, moonY, 46, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9d4c2';
    for (const [cx, cy, r] of [[-14, -9, 10], [11, 7, 13], [-5, 21, 7]]) { ctx.beginPath(); ctx.arc(W - 120 + cx, moonY + cy, r, 0, TAU); ctx.fill(); }
  }
  // clouds drift down as the man rises (parallax)
  for (const c of clouds) {
    const im = SPR['cloud' + c.im];
    if (!im || !im.complete || !im.naturalWidth) continue;
    const w = im.naturalWidth * 0.3 * c.s, h = im.naturalHeight * 0.3 * c.s;
    const x = ((c.x + wt * 6 * c.s) % (W + 300)) - 150;
    const y = GS - (c.alt - altNow() * 0.6);
    if (y < -h || y > H + h) continue;
    ctx.globalAlpha = 0.95 - a * 0.35;
    ctx.drawImage(mip(im, w), x, y - h / 2, w, h);
  }
  ctx.globalAlpha = 1;
}

function limb(x0, y0, ang, len, w, col, endCol) {
  const x1 = x0 + Math.sin(ang) * len, y1 = y0 + Math.cos(ang) * len;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 5;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (endCol) {
    ctx.fillStyle = endCol; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x1 + Math.sin(ang) * 3, y1 + Math.cos(ang) * 3, 8, 6, -ang, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

// pose: 'stand' | 'crouch' | 'arrow' | 'tuck'. back = seen from behind (no face).
function drawGuy(x, y, rot, pose, back, sc, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  const skin = '#f5b58a', shirt = '#ffffff', pants = '#3b5bdb', sc2 = shoe().col;
  ctx.lineJoin = 'round';
  if (pose === 'tuck') {
    ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pants; ctx.beginPath(); ctx.arc(0, 0, 24, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-6, -14, 11, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sc2; ctx.beginPath(); ctx.ellipse(12, 20, 9, 6, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }
  const arrow = pose === 'arrow', crouch = pose === 'crouch';
  if (crouch) { ctx.translate(0, 8); ctx.scale(1.1, 0.82); }
  const wob = pose === 'stand' ? Math.sin(t * 9) * 0.06 : 0;
  // legs
  limb(-5, 14, arrow ? 0.03 : 0.1 + wob, 30, 8, pants, sc2);
  limb(5, 14, arrow ? -0.03 : -0.1 - wob, 30, 8, pants, sc2);
  // arms
  if (arrow) { limb(-7, -14, Math.PI - 0.1, 28, 6, skin, skin); limb(7, -14, Math.PI + 0.1, 28, 6, skin, skin); }
  else if (crouch) { limb(-9, -8, 0.7, 22, 6, skin, skin); limb(9, -8, -0.7, 22, 6, skin, skin); }
  else { limb(-9, -10, 0.25 + wob, 24, 6, skin, skin); limb(9, -10, -0.25 - wob, 24, 6, skin, skin); }
  // torso
  ctx.fillStyle = shirt; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  rr(-10, -16, 20, 34, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pants; rr(-10, 8, 20, 10, 5); ctx.fill(); ctx.stroke();
  // head
  const hy = arrow ? -30 : -34;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, 17, 0, TAU); ctx.fill(); ctx.stroke();
  if (back) {
    ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.arc(0, hy, 15.5, Math.PI * 0.95, TAU * 1.02); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-3, hy - 16); ctx.quadraticCurveTo(-6, hy - 28, -1, hy - 27); ctx.moveTo(3, hy - 16); ctx.quadraticCurveTo(7, hy - 30, 9, hy - 25); ctx.stroke();
  } else {
    ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(-3, hy - 16); ctx.quadraticCurveTo(-6, hy - 28, -1, hy - 27);
    ctx.moveTo(2, hy - 16); ctx.quadraticCurveTo(6, hy - 30, 9, hy - 25);
    ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5;
    const er = arrow ? 8 : 6;
    for (const ex of [-7, 7]) { ctx.beginPath(); ctx.arc(ex, hy - 4, er, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = INK;
    for (const ex of [-7, 7]) { ctx.beginPath(); ctx.arc(ex, hy - 4, arrow ? 2 : 3, 0, TAU); ctx.fill(); }
    if (arrow) { ctx.fillStyle = '#7a1d2c'; ctx.beginPath(); ctx.ellipse(0, hy + 9, 6, 8 + Math.sin(t * 25) * 1.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    else { ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, hy + 9); ctx.quadraticCurveTo(0, hy + 5, 6, hy + 9); ctx.stroke(); }
  }
  ctx.restore();
}

// the leg shows up only for the kick: it slides in, lands (hit-stop) and fades while the man flies off
function drawKickLeg() {
  const t = G.legT;
  if (t < 0 || t >= 0.85 || (G.state !== 'kick' && G.state !== 'fly')) return;
  const im = SPR['impact_' + S.shoe];
  if (!(im && im.complete && im.naturalWidth)) return;
  const s = clamp(t / 0.10, 0, 1), e = 1 - Math.pow(1 - s, 3);
  const pop = t < 0.10 ? 0.9 : 1.15 - Math.min(t - 0.10, 0.4) * 0.3;
  const al = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.35;
  const w = im.naturalWidth * 0.64 * pop, h = im.naturalHeight * 0.64 * pop;
  ctx.save();
  ctx.globalAlpha = clamp(al, 0, 1);
  ctx.translate(G.kickX - 22, G.kickY + 12);
  ctx.rotate(-Math.PI / 2 + 0.6);              // comes from the lower left, toe points up at the butt
  ctx.translate(-(1 - e) * 260, -(1 - e) * 260);   // slides in along the leg
  ctx.drawImage(mip(im, im.naturalWidth * 0.64 * 1.15), -w * 0.62, -h * 0.5, w, h);
  ctx.restore();
}

// centred sprite with a logical width (height follows the picture unless given)
function propAt(name, x, y, w, h, sx, mipW) {
  const im = SPR[name];
  if (!im || !im.complete || !im.naturalWidth) return false;
  const hh = h || w * im.naturalHeight / im.naturalWidth, ww = w * (sx || 1);
  ctx.drawImage(mip(im, mipW || w), x - ww / 2, y - hh / 2, ww, hh);
  return true;
}

function drawItems() {
  const top = cam.y - GS - 160, bot = cam.y - GS + H + 160;
  for (const it of items) {
    if (it.y < top || it.y > bot) continue;
    if (it.t === 'coin') {
      if (it.got) continue;
      const ph = ((wt * 1.5 + it.y * 0.0045) % 1 + 1) % 1, fi = Math.floor(ph * 8), fr = fi < 5 ? fi : 8 - fi, im = SPR['coin' + fr];
      if (im && im.complete && im.naturalWidth) {
        const k = 40 / 310, w = im.naturalWidth * k, h = im.naturalHeight * k;
        ctx.save(); ctx.translate(it.x, it.y); if (fi >= 5) ctx.scale(-1, 1);
        ctx.drawImage(mip(im, w), -w / 2, -h / 2, w, h);
        ctx.restore();
        const gl = Math.sin(wt * 2.2 + it.y * 0.011 + it.x * 0.3);                         // a glint sweeps over the coin now and then
        if (gl > 0.93 && fr < 3) {
          const a = (gl - 0.93) / 0.07, r = 4 + 8 * a;
          ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.translate(it.x - 8, it.y - 10); ctx.rotate(wt);
          ctx.beginPath(); for (let q = 0; q < 8; q++) { const rr2 = q % 2 ? r * 0.25 : r, an = q * Math.PI / 4; ctx.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); } ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = '#ffc928'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(it.x, it.y, 15, 0, TAU); ctx.fill(); ctx.stroke();
      }
    } else if (it.t === 'balloon') {
      if (it.hit) continue;
      const by = it.y + Math.sin(wt * 2 + it.x) * 6;
      if (!propAt('balloon', it.x, by + 14, 58)) { ctx.fillStyle = it.col; ctx.beginPath(); ctx.arc(it.x, by, 26, 0, TAU); ctx.fill(); }
    } else if (it.t === 'bird') {
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0);
      if (it.vx < 0 && !it.hit) ctx.scale(-1, 1);
      if (!propAt((Math.floor(wt * 8 + it.ph) % 2) ? 'bird1' : 'bird2', 0, 0, 84)) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    } else if (it.t === 'heaven') {
      const bob = Math.sin(wt * 1.1) * 7;
      const cl = SPR.cloud1, g = it.got ? (SPR.god2 || SPR.god1) : SPR.god1;
      if (cl && cl.complete && cl.naturalWidth) { const cw = 380, ch = cw * cl.naturalHeight / cl.naturalWidth; ctx.drawImage(mip(cl, cw), it.x - cw / 2, it.y + 30 + bob - ch / 2, cw, ch); }
      if (g && g.complete && g.naturalWidth) {
        const gw = 250, gh = gw * g.naturalHeight / g.naturalWidth, gx = it.x - gw / 2, gy = it.y + 70 + bob - gh;
        ctx.drawImage(mip(g, gw), gx, gy, gw, gh);
        const E = GOD_EYES[g === SPR.god2 ? 'god2' : 'god1'], sc = gw / g.naturalWidth, shock = it.got;
        E.eyes.forEach((e, n) => {
          const ex = gx + e[0] * sc, ey = gy + e[1] * sc, dx = P.x - ex, dy = P.y - ey, d = Math.hypot(dx, dy) || 1;
          const reach = (E.er - E.pr - 4) * sc * Math.min(1, d / 260);
          const tx = dx / d * reach + (shock ? Math.sin(wt * 38 + n) * 2.5 : Math.sin(wt * 1.7 + n) * 0.8), ty = dy / d * reach + (shock ? Math.cos(wt * 33 + n) * 2.5 : 0);
          it.pu = it.pu === undefined ? [0, 0] : it.pu;
          it.pu[n * 2] = lerp(it.pu[n * 2] || 0, tx, 0.18); it.pu[n * 2 + 1] = lerp(it.pu[n * 2 + 1] || 0, ty, 0.18);
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + it.pu[n * 2], ey + it.pu[n * 2 + 1], E.pr * sc * (shock ? 0.75 : 1), 0, TAU); ctx.fill();
        });
      }
      else cartoonText('?!', it.x, it.y - 30 + bob, 80, '#fff');
    } else if (it.t === 'station') {
      const im = SPR.station;
      if (!(im && im.complete && im.naturalWidth)) continue;
      const w = 240, h = w * im.naturalHeight / im.naturalWidth;
      ctx.save(); ctx.translate(it.x, it.y + Math.sin(wt * 1.2) * 6); ctx.rotate(Math.sin(wt * 0.6) * 0.05 + (it.got ? wt * 0.4 : 0));
      ctx.drawImage(mip(im, w), -w / 2, -h / 2, w, h);
      ctx.restore();
    } else if (it.t === 'rocket') {
      if (it.got) continue;
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.sin(wt * 3 + it.x) * 0.1);
      if (!propAt('rocket', 0, 0, 56)) { ctx.fillStyle = '#ff4b3a'; rr(-14, -30, 28, 60, 12); ctx.fill(); }
      ctx.restore();
    } else if (it.t === 'tramp' || it.t === 'tree') {
      const im = SPR[it.t === 'tramp' ? 'tramp' : 'springtree'];
      if (!(im && im.complete && im.naturalWidth)) continue;
      const w = it.w, h = w * im.naturalHeight / im.naturalWidth;
      const sq = 1 - it.squash * (it.t === 'tree' ? 0.2 : 0.14);
      const topY = it.y - (it.t === 'tree' ? 0.04 : 0.18) * h, botY = topY + h;
      ctx.globalAlpha = it.spent ? 0.5 : 1;
      ctx.drawImage(mip(im, w), it.x - w / 2, botY - h * sq, w, h * sq);
      ctx.globalAlpha = 1;
    } else if (it.t === 'rope') {
      ctx.globalAlpha = it.spent ? 0.45 : 1;
      const sag = 16 + it.squash * 26;
      const x0 = it.x - it.w / 2, x1 = it.x + it.w / 2;
      // clothes cut out of the generated balcony picture, hung on the rope; the rope is drawn over their clips
      const hang = [['shirt', -120, 62], ['sock1', -40, 28], ['shirt', 40, 56], ['sock2', 120, 26], ['sock1', 175, 26]];
      hang.forEach(([name, dx, w], k) => {
        const im = SPR[name];
        if (!(im && im.complete && im.naturalWidth)) return;
        const u = dx / (it.w / 2), ty = it.y + (sag / 2) * (1 - u * u) - 4, h = w * im.naturalHeight / im.naturalWidth;
        ctx.save(); ctx.translate(it.x + dx, ty); ctx.rotate(Math.sin(wt * 2 + k * 1.7) * 0.06 + it.squash * 0.2 * (k % 2 ? 1 : -1));
        ctx.drawImage(mip(im, w), -w / 2, 0, w, h);
        ctx.restore();
      });
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x0, it.y); ctx.quadraticCurveTo(it.x, it.y + sag, x1, it.y); ctx.stroke();
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, it.y); ctx.quadraticCurveTo(it.x, it.y + sag, x1, it.y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function wallTop() {
  const L = SPR.facadeL;
  if (!(L && L.complete && L.naturalWidth)) return WALL_TOP;
  const th = L.naturalHeight * FAC_K;
  return Math.floor(WALL_TOP / th) * th;
}

function drawBuildings() {
  const wTop = wallTop(), topAlt = Math.min(wTop, altNow() + H + 300), bot = Math.max(0, altNow() - 300);
  if (bot > wTop + 40) return;
  const L = SPR.facadeL, R = SPR.facadeR;
  if (L && L.complete && L.naturalWidth && R && R.complete && R.naturalWidth) {
    const th = L.naturalHeight * FAC_K;
    for (let i = Math.floor(bot / th); i * th < topAlt; i++) {
      const y = -(i + 1) * th;
      ctx.drawImage(mip(L, L.naturalWidth * FAC_K), 0, y, L.naturalWidth * FAC_K, th + 1);
      ctx.drawImage(mip(R, R.naturalWidth * FAC_K), W - R.naturalWidth * FAC_K, y, R.naturalWidth * FAC_K, th + 1);
    }
  } else {
    ctx.fillStyle = '#e0a458'; ctx.fillRect(0, -wTop, WALL, wTop);
    ctx.fillStyle = '#d2796a'; ctx.fillRect(W - WALL, -wTop, WALL, wTop);
  }
  // rooflines: the buildings end with a cornice instead of being cut off
  if (topAlt >= wTop - 1) {
    ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.fillStyle = '#b5683a'; rr(-6, -wTop - 22, WALL + 14, 24, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a8453c'; rr(W - WALL - 8, -wTop - 22, WALL + 14, 24, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a3f24'; rr(-6, -wTop - 36, WALL - 6, 16, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a2e2a'; rr(W - WALL + 4, -wTop - 36, WALL - 6, 16, 4); ctx.fill(); ctx.stroke();
  }
  // height plaques
  for (let m = Math.floor(bot / PXM / 20) * 20; m * PXM < topAlt; m += 20) {
    if (m <= 0) continue;
    ctx.fillStyle = '#fff7dc'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    rr(WALL + 12, -m * PXM - 15, 52, 30, 6); ctx.fill(); ctx.stroke();
    ctx.font = '400 20px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    ctx.fillText(m + 'M', WALL + 38, -m * PXM + 1);
  }
}

// the street is a backdrop behind the man (fence, bushes, bench); the dirt below it is a plain fill
function drawStreet() {
  const k = W / STREET.w, im = SPR.street;
  const ok = im && im.complete && im.naturalWidth;
  const top = -STREET.grassTop * k, bottom = top + STREET.h * k;
  if (ok) ctx.drawImage(mip(im, W), 0, top, W, STREET.h * k + 1);
  else { ctx.fillStyle = '#5ac85a'; ctx.fillRect(-20, 0, W + 40, 20); }
  ctx.fillStyle = STREET.dirt;
  ctx.fillRect(-20, ok ? bottom - 1 : 20, W + 40, H * 3);
}

function drawGauge() {
  const cx = W / 2, cy = H * 0.36, k = 0.56;
  const m = tri(G.ph);
  const g = SPR.gauge, nd = SPR.needle;
  if (g && g.complete && g.naturalWidth && nd && nd.complete && nd.naturalWidth) {
    const gw = g.naturalWidth * k;
    ctx.drawImage(mip(g, gw), cx - gw / 2, cy - gw / 2, gw, gw);
    const nw = nd.naturalWidth * k, nh = nd.naturalHeight * k;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(lerp(-Math.PI * 0.75, Math.PI * 0.75, m));
    ctx.drawImage(mip(nd, nw), -nw / 2, -nh / 2, nw, nh);
    ctx.restore();
    cartoonText('POWER', cx, cy + 78, 34, '#ffd23a');
    cartoonText(Math.round(m * 100) + '', cx, cy + 124, 40, m > 0.92 ? '#ff6b6b' : '#fff');
    cartoonText('TAP IN THE RED!', cx, cy - gw / 2 - 28, 40, '#fff');
  }
}

function drawHUD() {
  cartoonText(Math.floor(G.maxAlt / PXM) + ' M', 24, 62, 62, '#fff', 'left');
  const cx = W - 24;
  const val = String(G.state === 'menu' || G.state === 'aim' || G.state === 'crouch' ? S.coins : S.coins + G.coinsRun);
  cartoonText(val, cx - 46, 56, 40, '#ffd23a', 'right');
  ctx.fillStyle = '#ffc928'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx - 20, 56, 17, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff4a8'; ctx.beginPath(); ctx.arc(cx - 24, 52, 7, 0, TAU); ctx.fill();
  if (G.state === 'fly' && S.plays < 3) cartoonText(P.vy > 0 ? 'HOLD TO DIVE!' : 'STEER LEFT / RIGHT', W / 2, H - 60, 34, '#fff');
}

function guyPose() {
  const close = G.state === 'aim' || G.state === 'crouch' || G.state === 'kick' || G.state === 'menu';
  if (G.state === 'stuck') return { pose: 'arrow', back: false, rot: Math.PI, sc: 1.1 };
  if (close) return { pose: G.state === 'crouch' ? 'crouch' : 'stand', back: true, rot: 0, sc: 1.8 };
  if (G.trick > 0) return { pose: 'tuck', back: true, rot: P.rot, sc: 1.15 };
  if (P.vy < 0) return { pose: 'arrow', back: true, rot: P.rot * 0, sc: 1.1 };
  return { pose: 'arrow', back: false, rot: Math.PI, sc: 1.1 };
}

// draws a sprite; anchor 'feet' = bottom centre at (x, y), otherwise centred. Returns false while the image is not ready.
function spriteAt(name, x, y, k, rot, feet, sx, sy) {
  const im = SPR[name];
  if (!im || !im.complete || !im.naturalWidth) return false;
  const w = im.naturalWidth * k, h = im.naturalHeight * k;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx || sy) ctx.scale(sx || 1, sy || 1);
  ctx.drawImage(mip(im, w), -w / 2, feet ? -h : -h / 2, w, h);
  ctx.restore();
  return true;
}

function trickSprite() {
  const kind = G.trickKind, age = 0.75 - G.trick;
  if (kind === 'splat' && age < 0.34) return { n: 'splat', rot: 0 };
  if (kind === 'hop') return { n: 'ballet2', rot: Math.sin(wt * 9) * 0.08 };      // pushed off the rope with a foot
  if (kind === 'stretch') return { n: 'stretch', rot: 0 };
  if (kind === 'ballet') return { n: (Math.floor(wt * 8) % 2) ? 'ballet1' : 'ballet2', rot: Math.sin(wt * 9) * 0.12 };
  const a = ((P.rot % TAU) + TAU) % TAU, q = Math.PI / 2;
  const f = Math.floor(a / q);
  return { n: 'tuck' + ((f % 4) + 1), rot: a - f * q - q / 2 };      // frame for the quadrant + smooth turn inside it
}

function drawMan() {
  const st = G.state, K = K_BODY;
  if (st === 'aim' || st === 'menu') return spriteAt('stand', P.x, 4, K, st === 'aim' ? Math.sin(wt * 3) * 0.012 : 0, true);
  if (st === 'crouch') return spriteAt('crouch', P.x, 4, K, 0, true);
  if (st === 'kick') { const hit = G.legT >= 0.10; return spriteAt('crouch', P.x + (hit ? rand(-3, 3) : 0), 4, K, 0, true, hit ? 1.2 : 1, hit ? 0.8 : 1); }
  if (st === 'stuck') return spriteAt('ground', P.x, 8, K, 0, true);
  if (G.trick > 0) { const t = trickSprite(); return spriteAt(t.n, P.x, P.y, K, t.rot, false); }
  if (P.vy < 0) return spriteAt('arrowup', P.x, P.y, K, clamp(P.vx * 0.0004, -0.25, 0.25), false);
  return spriteAt('arrowdown', P.x, P.y, K, clamp(-P.vx * 0.0004, -0.25, 0.25), false);
}

function drawWorld() {
  ctx.save();
  const sx = G.shake ? rand(-G.shake, G.shake) * 0.5 : 0, sy = G.shake ? rand(-G.shake, G.shake) * 0.5 : 0;
  ctx.translate(sx, GS - cam.y + sy);
  drawBuildings();
  drawStreet();
  drawItems();
  const gp = guyPose();
  // stuck: the head is buried, so the ground is painted over it
  const gy = G.state === 'aim' || G.state === 'crouch' || G.state === 'menu' ? -80 + (G.state === 'crouch' ? 10 : 0) : P.y;
  if (!drawMan()) drawGuy(P.x, gy, gp.rot, gp.pose, gp.back, gp.sc, wt);
  if (G.state === 'fly' && G.trick > 0 && G.trickKind === 'stretch') {            // dizzy stars after a bird hit
    ctx.save(); ctx.translate(P.x, P.y - 105); ctx.rotate(wt * 5); propAt('stars', 0, 0, 95); ctx.restore();
  }
  drawKickLeg();                 // in front of the ground: the leg is closer to the camera
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    if (p.ln) { ctx.strokeStyle = p.col; ctx.lineWidth = p.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.ln * (P.vy < 0 ? 1 : -1)); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const f of fx) {
    const k = 1 - f.life / f.max, w = f.w * (0.55 + 0.7 * k);
    ctx.globalAlpha = clamp(1.6 - k * 1.6, 0, 1);
    propAt(f.name, f.x, f.y - f.rise * k, w, 0, 1, f.w * 1.25);
  }
  ctx.globalAlpha = 1;
  for (const rg of rings) {
    const k = 1 - rg.life / rg.max;
    ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 12 * (1 - k) + 2;
    ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r * (0.25 + 0.75 * k), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life * 2, 0, 1);
    cartoonText(t.txt, t.x, t.y, t.size, t.col, 'center', -0.06);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  drawSky();
  drawWorld();
  if (G.state === 'aim') drawGauge();
  if (G.state !== 'menu' && G.state !== 'shop') drawHUD();
  if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 0.6).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ======================================================================
   Screens / UI
   ====================================================================== */
function setScreens(mode) {
  const show = (id, on) => el(id).classList.toggle('hidden', !on);
  show('menu', mode === 'menu');
  show('shop', mode === 'shop');
  show('result', mode === 'result');
  show('cont', mode === 'cont');
  show('pause', mode === 'paused');
  el('about').classList.add('hidden');
  if (mode === 'menu') { el('menuCoins').textContent = S.coins; el('menuBest').textContent = S.best; }
}

function toMenu() {
  G.state = 'menu';
  P.x = W / 2; P.y = -80; P.rot = 0; P.vy = 0; G.trick = 0;
  items = []; parts = []; texts = []; fx = []; G.maxAlt = 0;
  cam.y = 0;
  Sound.musicStop(0.4);
  setScreens('menu');
}

function showResult() {
  G.state = 'result';
  const height = Math.floor(G.maxAlt / PXM);
  const bonus = Math.floor(height / 4);
  G.earned = G.coinsRun + bonus;
  S.coins += G.earned;
  const rec = height > S.best;
  if (rec) S.best = height;
  S.plays++;
  save();
  Ads.runFinished();
  el('resGuy').src = 'img/guy/' + (rec || height >= 60 ? 'happy' : 'dizzy') + '.png';
  el('resTitle').textContent = height < 15 ? 'OUCH!' : height < 40 ? 'NICE KICK!' : height < 90 ? 'WHAM!' : 'TO THE MOON!';
  el('resDist').textContent = height;
  el('resBest').textContent = S.best;
  el('resNew').classList.toggle('hidden', !rec);
  el('resCoins').textContent = '+' + G.earned;
  el('resBreak').textContent = G.coinsRun + ' collected + ' + bonus + ' height bonus' + (items.some((i) => i.t === 'heaven' && i.got) ? ' · YOU MET GRANDPA!' : '');
  el('btnDouble').classList.toggle('hidden', !Ads.canReward() || G.earned < 1);
  el('btnDouble').disabled = false;
  setScreens('result');
  if (rec && height > 0) Sound.best();
}

function pauseGame() {
  if (G.state !== 'aim' && G.state !== 'fly') return;
  G.pausedFrom = G.state; G.state = 'paused';
  setScreens('paused');
}
function resumeGame() {
  if (G.state !== 'paused') return;
  G.state = G.pausedFrom;
  mouse.live = false; P.tgt = P.x;
  if (touch.active) { touch.sx = touch.lx; touch.bx = P.x; }
  setScreens('play');
}

function renderShop() {
  el('shopCoins').textContent = S.coins;
  const list = el('shopList');
  list.innerHTML = '';
  const coinHtml = '<i class="coin"></i>';
  const adOK = Ads.canReward();
  const row = (name, desc, acts, icon, dim) => {
    const r = document.createElement('div');
    r.className = 'row';
    r.innerHTML = '<div class="left"><img class="ic' + (dim ? ' dim' : '') + '" src="' + icon + '" alt=""><div class="info"><b>' + name + '</b><span>' + desc + '</span></div></div>';
    const a = document.createElement('div'); a.className = 'acts';
    acts.forEach((x) => a.appendChild(x));
    r.appendChild(a);
    list.appendChild(r);
  };
  const btn = (html, cls, fn, disabled) => {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.innerHTML = html;
    b.disabled = !!disabled;
    b.addEventListener('click', () => { Sound.unlock(); Sound.click(); fn(); });
    return b;
  };

  const lacts = [];
  if (S.leg >= LEGMAX) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = 'MAX LEVEL'; lacts.push(t); }
  else {
    const c = legCost(S.leg);
    lacts.push(btn(coinHtml + c, 'blue', () => { if (S.coins >= c) { S.coins -= c; S.leg++; save(); Sound.buy(); renderShop(); } }, S.coins < c));
    if (adOK) lacts.push(btn('AD &middot; FREE', 'green', () => Ads.watch('leg-upgrade', () => { S.leg++; save(); Sound.buy(); renderShop(); })));
  }
  row('LEG POWER ' + S.leg, '+13% kick power per level', lacts, 'img/leg/leg2.png', false);

  Object.keys(SHOES).forEach((id) => {
    const sh = SHOES[id];
    const acts = [];
    if (S.owned[id]) {
      if (S.shoe === id) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = 'EQUIPPED'; acts.push(t); }
      else acts.push(btn('EQUIP', 'blue', () => { S.shoe = id; save(); renderShop(); }));
    } else {
      if (sh.how === 'ads') {
        const done = S.adp[id] || 0;
        if (adOK) acts.push(btn('WATCH AD ' + done + '/' + sh.need, 'green', () => Ads.watch('shoe-' + id, () => {
          S.adp[id] = (S.adp[id] || 0) + 1;
          if (S.adp[id] >= sh.need) { S.owned[id] = 1; S.shoe = id; Sound.buy(); }
          save(); renderShop();
        })));
        else acts.push(btn('NO AD NOW ' + done + '/' + sh.need, 'small', () => { const m = 'No ad is available right now. ' + sh.name + ' unlock by watching ' + sh.need + ' ads. Please try again later.'; if (typeof FGAds !== 'undefined' && FGAds.toast) FGAds.toast(m); else alert(m); }, false));
      } else {
        acts.push(btn(coinHtml + sh.cost, 'blue', () => { if (S.coins >= sh.cost) { S.coins -= sh.cost; S.owned[id] = 1; S.shoe = id; save(); Sound.buy(); renderShop(); } }, S.coins < sh.cost));
      }
    }
    row(sh.name, (sh.how === 'ads' && !S.owned[id] ? 'AD ONLY: watch ' + sh.need + ' ads to unlock.' + (adOK ? ' ' : ' No ad is available right now, try again later. ') : '') + sh.desc, acts, 'img/leg/impact_' + id + '.png', !S.owned[id]);
  });
}

function fillAbout() {
  const a = KICK_CONFIG.about, host = KICK_CONFIG.lock.url;
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
  el(id).addEventListener('click', (e) => {
    Sound.unlock();
    Sound.click();
    e.currentTarget.blur();
    fn();
  });
}
bind('btnPlay', startAim);
bind('btnShop', () => { G.state = 'shop'; renderShop(); setScreens('shop'); });
bind('btnShopBack', toMenu);
bind('btnAbout', () => el('about').classList.remove('hidden'));
bind('btnAboutClose', () => el('about').classList.add('hidden'));
bind('btnAgain', () => Ads.beforeRun(startAim));
bind('btnResShop', () => { G.state = 'shop'; renderShop(); setScreens('shop'); });
bind('btnResMenu', toMenu);
bind('btnResume', resumeGame);
// reward offer after a far flight: watch an ad -> rocket relaunch from the ground, the run goes on
bind('btnCont', () => {
  el('btnCont').disabled = true;
  Ads.watch('rocket-relaunch', () => {
    G.relaunched = true; G.stuckT = 0; G.bn = 0; G.hold = false;
    P.y = -60; P.vy = -3400; P.vx = 0; P.tgt = P.x; G.state = 'fly'; G.slowT = 0;
    G.shake = 20; Sound.rocket(); setScreens('play');
    el('btnCont').disabled = false;
  }, () => { el('btnCont').disabled = false; });
});
bind('btnContNo', () => showResult());
bind('btnDouble', () => {
  el('btnDouble').disabled = true;
  Ads.watch('double-coins', () => {
    S.coins += G.earned; save();
    el('resCoins').textContent = '+' + G.earned * 2;
    el('btnDouble').classList.add('hidden');
    Sound.buy();
  }, () => { el('btnDouble').disabled = false; });
});
document.querySelectorAll('.snd-toggle').forEach((b) => b.addEventListener('click', () => {
  Sound.unlock(); Sound.toggle(); refreshSoundButtons(); b.blur();
}));

/* input */
function toStageX(e) {
  const r = cv.getBoundingClientRect();
  return (e.clientX - r.left) / r.width * W;
}
stage.addEventListener('pointerdown', (e) => {
  Sound.unlock();
  if (e.target.closest('button') || e.target.closest('.panel')) return;
  if (G.state === 'aim') { act(); return; }
  if (G.state === 'fly') G.hold = true;
  if (e.pointerType !== 'mouse') {
    const x = toStageX(e);
    touch.active = true; touch.sx = touch.lx = x; touch.bx = P.x;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  }
});
// mouse: whole window, offset kept so a parked cursor never throws the man sideways; the offset fades with travel
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const x = toStageX(e);
  if (G.state === 'fly') {
    if (!mouse.live) { mouse.live = true; mouse.ox = P.x - x; }
    else mouse.ox *= Math.max(0, 1 - Math.abs(x - mouse.x) * 0.003);
    P.tgt = x + mouse.ox;
  }
  mouse.x = x;
});
stage.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  const x = toStageX(e);
  touch.lx = x;
  if (touch.active && G.state === 'fly') P.tgt = touch.bx + (x - touch.sx) * 1.3;
});
const release = () => { G.hold = false; touch.active = false; };
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

window.addEventListener('keydown', (e) => {
  Sound.unlock();
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.l = 1; e.preventDefault(); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.r = 1; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'KeyM') { Sound.toggle(); refreshSoundButtons(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'paused') resumeGame(); else pauseGame(); return; }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
    if (e.target && e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (G.state === 'fly') G.hold = true;
    else if (G.state === 'menu') startAim();
    else act();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = 0;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = 0;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') G.hold = false;
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

window.__kick = { G, P, S, cam, startAim, act, update, render, get items() { return items; } };
})();
