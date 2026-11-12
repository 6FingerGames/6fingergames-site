'use strict';
(function () {
if (!Lock.ok()) { Lock.block(); return; }

const $ = (id) => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const QS = new URLSearchParams(location.search);
const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const TESTBOT = IS_LOCAL && QS.has('bot');     // test helpers exist on localhost only, never on the live site

/* ====================================================== storage */
const store = {
  get(k, d) { try { const v = localStorage.getItem('opo_' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('opo_' + k, String(v)); } catch (e) {} }
};

/* ====================================================== texts */
const TXT = {
  en: { best: 'Best', blocks: 'Blocks', score: 'Score', newbest: 'New best!', start: 'Start', info: 'Info', resume: 'Resume', menu: 'Menu', back: 'Back',
    paused: 'Paused', gameover: 'Game over', cont: 'Continue (ad)', settings: 'Settings', volume: 'Volume', language: 'Language', again: 'Play again',
    perfect: 'PERFECT!', noad: 'No ad available right now. Try again later.', howTitle: 'How to play',
    how1: 'Tap to drop the sliding block.', how2: 'Anything that hangs over gets sliced off.',
    how3: 'Land it within one pixel for PERFECT. Chain perfects and the block grows back!',
    by: 'Made by', banners: ['Sweet!', 'Yummy!', 'Tasty!', 'Delicious!', 'Legendary!'] },
  ka: { best: 'რეკორდი', blocks: 'ბლოკი', score: 'ქულა', newbest: 'ახალი რეკორდი!', start: 'დაწყება', info: 'ინფო', resume: 'გაგრძელება', menu: 'მენიუ', back: 'უკან',
    paused: 'პაუზა', gameover: 'თამაში დასრულდა', cont: 'გაგრძელება (რეკლამა)', settings: 'პარამეტრები', volume: 'ხმა', language: 'ენა', again: 'თავიდან',
    perfect: 'იდეალურია!', noad: 'რეკლამა ახლა მიუწვდომელია. სცადეთ მოგვიანებით.', howTitle: 'როგორ ვითამაშოთ',
    how1: 'შეეხე ეკრანს და მოძრავი ბლოკი ჩამოვარდება.', how2: 'რაც გადმოსცდება, იჭრება.',
    how3: 'ერთი პიქსელის სიზუსტით დადე და მიიღებ „იდეალურს“. იდეალურების ჯაჭვი ბლოკს ისევ ზრდის!',
    by: 'ავტორი', banners: ['ტკბილია!', 'გემრიელია!', 'მშვენიერია!', 'საოცარია!', 'ლეგენდა!'] },
  ru: { best: 'Рекорд', blocks: 'Блоки', score: 'Очки', newbest: 'Новый рекорд!', start: 'Старт', info: 'Инфо', resume: 'Продолжить', menu: 'Меню', back: 'Назад',
    paused: 'Пауза', gameover: 'Конец игры', cont: 'Продолжить (реклама)', settings: 'Настройки', volume: 'Громкость', language: 'Язык', again: 'Ещё раз',
    perfect: 'ИДЕАЛЬНО!', noad: 'Сейчас нет доступной рекламы. Попробуйте позже.', howTitle: 'Как играть',
    how1: 'Нажми, чтобы уронить движущийся блок.', how2: 'Всё, что выступает, отрезается.',
    how3: 'Попади с точностью до пикселя — ИДЕАЛЬНО! Серия идеальных возвращает блоку размер!',
    by: 'Автор', banners: ['Сладко!', 'Вкусно!', 'Отлично!', 'Круто!', 'Легенда!'] },
  zh: { best: '最高', blocks: '方块', score: '得分', newbest: '新纪录！', start: '开始', info: '说明', resume: '继续', menu: '菜单', back: '返回',
    paused: '已暂停', gameover: '游戏结束', cont: '继续（广告）', settings: '设置', volume: '音量', language: '语言', again: '再来一次',
    perfect: '完美！', noad: '暂时没有可用的广告，请稍后再试。', howTitle: '玩法',
    how1: '点击屏幕，放下移动的方块。', how2: '超出的部分会被切掉。',
    how3: '误差在一像素内即为完美。连续完美会让方块变大！',
    by: '作者', banners: ['甜！', '美味！', '太棒了！', '惊人！', '传奇！'] },
  ja: { best: 'ベスト', blocks: 'ブロック', score: 'スコア', newbest: '新記録！', start: 'スタート', info: '情報', resume: '再開', menu: 'メニュー', back: '戻る',
    paused: '一時停止', gameover: 'ゲームオーバー', cont: '続ける（広告）', settings: '設定', volume: '音量', language: '言語', again: 'もう一度',
    perfect: 'パーフェクト！', noad: '今は広告を表示できません。後でもう一度お試しください。', howTitle: '遊び方',
    how1: 'タップで動くブロックを落とそう。', how2: 'はみ出した部分は切り落とされます。',
    how3: '1ピクセル以内で置けばパーフェクト！連続でブロックが元の大きさに戻るよ！',
    by: '作者', banners: ['あまい！', 'おいしい！', 'すごい！', '最高！', '伝説！'] }
};
const LANG_NAMES = { en: 'English', ka: 'ქართული', ru: 'Русский', zh: '中文', ja: '日本語' };
let lang = store.get('lang', '');
if (!TXT[lang]) { const n = (navigator.language || 'en').slice(0, 2).toLowerCase(); lang = TXT[n] ? n : 'en'; }
const T = (k) => (TXT[lang] && TXT[lang][k]) || TXT.en[k];

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = T(e.dataset.t); });
  const cont = $('btnContinue');
  cont.innerHTML = '<span class="play">&#9654;</span> <span>' + T('cont') + '</span>';
  document.querySelectorAll('#langs button').forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
  const a = CFG.about;
  $('about').innerHTML = T('by') + ' ' + a.studio + (a.author ? ' / ' + a.author : '') +
    '<br><a href="' + a.site + '" target="_blank" rel="noopener">' + a.site.replace('https://', '') + '</a>';
}

/* ====================================================== sound */
const Snd = (() => {
  let ac = null, master = null, muted = store.get('muted', '0') === '1', vol = parseFloat(store.get('vol', '0.8'));
  const bufs = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.connect(ac.destination); apply();
      ['place', 'perfect', 'slice', 'fail', 'tide', 'ui'].forEach((n) =>
        fetch('audio/' + n + '.ogg').then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((d) => { bufs[n] = d; }).catch(() => {}));
    } catch (e) { ac = null; }
  }
  function apply() { if (master) master.gain.value = muted ? 0 : vol; }
  function play(n, rate, gain) {
    if (!ac || !bufs[n]) return;
    const s = ac.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate || 1;
    const g = ac.createGain(); g.gain.value = gain == null ? 1 : gain;
    s.connect(g); g.connect(master); s.start();
  }
  return {
    init, play,
    get muted() { return muted; },
    toggle() { muted = !muted; store.set('muted', muted ? '1' : '0'); apply(); },
    setVol(v) { vol = v; store.set('vol', v); apply(); },
    get vol() { return vol; },
    suspend() { if (ac) ac.suspend(); },
    resume() { if (ac) ac.resume(); }
  };
})();

/* ====================================================== game constants */
const W0 = 100;          // starting block size (world units)
const BH = 20;           // block height
const RANGE = 125;      // how far the moving block swings from the tower centre
const K1 = 0.866;        // iso x factor
const SPRK = ['#ffffff', '#ffe066', '#ff7eb6', '#6fe3ff', '#a6ff9d'];

/* ====================================================== state */
let W = 0, H = 0, DPR = 1, S = 1;
let mode = 'menu';             // menu | play | dying | over | paused
let prevMode = 'menu';
let blocks = [], mover = null, pieces = [], parts = [], rings = [], pops = [];
let score = 0, combo = 0, perfects = 0, revived = false, newBestRun = false;
let best = Math.max(0, parseInt(store.get('best', '0'), 10) || 0), bestAtStart = best;
let bestBlocks = Math.max(0, parseInt(store.get('bestBlocks', '0'), 10) || 0);
let themeHue = Math.random() * 360;
let camX = 0, camZ = 0, camY = 0, camTY = 0, zoom = 1, zoomT = 1, oyF = 0.40, oyFT = 0.40;
let bgHue = 200, shake = 0, sqX = 0, sqV = 0, feverT = 0, tick = 0, dieT = 0, startLock = 0;
let ox = 0, oy = 0, oxF = 0.5, oxFT = 0.5;
const wide = () => W > H * 1.2;      // landscape: the game-over card sits on the right, the tower on the left
let demo = true, demoT = 0, botOn = TESTBOT;
let bgItems = [];

/* ====================================================== helpers */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hsl = (h, s, l, a) => 'hsla(' + (((h % 360) + 360) % 360).toFixed(1) + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
function lerpAngle(a, b, t) { let d = ((b - a + 540) % 360) - 180; return a + d * t; }
const hueFor = (i) => (themeHue + i * 10) % 360;

function mkSpr() {
  const r = [];
  for (let i = 0; i < 7; i++) r.push({ u: rnd(0.12, 0.88), v: rnd(0.12, 0.88), a: rnd(0, Math.PI), c: SPRK[(Math.random() * SPRK.length) | 0] });
  return r;
}

function P(X, Y, Z) {
  return [ox + ((X - camX) - (Z - camZ)) * K1 * S * zoom, oy + ((X - camX) + (Z - camZ)) * 0.5 * S * zoom - (Y - camY) * S * zoom];
}

/* ====================================================== layout */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  S = Math.min(W / 400, H / 560);
  if (mode === 'menu') { oyFT = menuOy(); zoomT = H > W ? 0.62 : 0.8; }
  if (mode === 'dying' || mode === 'over') oxFT = wide() ? 0.3 : 0.5;
  $('over').classList.toggle('side', wide());
  bgItems = [];
  for (let i = 0; i < 26; i++) bgItems.push({ x: Math.random(), y: Math.random(), r: rnd(8, 34), par: rnd(0.15, 0.7), type: i % 4, h: rnd(0, 360), ph: rnd(0, 6.28), sp: rnd(6, 22) });
}
addEventListener('resize', resize);

/* ====================================================== game flow */
function newBlockBase() {
  return { x: 0, z: 0, w: W0, d: W0, y: 0, h: BH, hue: hueFor(0), spr: mkSpr() };
}

function resetTower() {
  blocks = [newBlockBase()];
  pieces = []; parts = []; rings = []; pops = [];
  score = 0; combo = 0; perfects = 0; revived = false; newBestRun = false;
  sqX = 0; sqV = 0; feverT = 0; shake = 0;
  camX = 0; camZ = 0; camY = BH; camTY = BH; zoom = 1; zoomT = 1;
  spawnMover();
}

function spawnMover() {
  const prev = blocks[blocks.length - 1];
  const n = blocks.length;
  const ax = (n % 2 === 1) ? 'x' : 'z';
  const dir = ((n >> 1) % 2 === 0) ? 1 : -1;
  mover = { axis: ax, dir, w: prev.w, d: prev.d, x: prev.x, z: prev.z, y: n * BH, h: BH, hue: hueFor(n), spr: mkSpr(), age: 0,
    botOff: Math.random() < 0.72 ? 0 : rnd(-32, 32), lastD: null };
  mover[ax] = prev[ax] - dir * RANGE;
}

function speed() { return Math.min(105 + blocks.length * 3, 290); }
function tolerance() { return 3.5 + speed() * 0.014; }

function startGame() {
  demo = false; botOn = TESTBOT;
  themeHue = Math.random() * 360;
  resetTower();
  bestAtStart = best;
  mode = 'play'; startLock = 0.18;
  oyFT = 0.62; oxFT = 0.5;
  $('hud').classList.remove('hidden'); $('btnPause').classList.remove('hidden');
  $('score').textContent = '0'; $('comboLbl').textContent = '';
  $('hudBest').textContent = best;
  showScreen(null);
  Snd.play('ui');
}

function menuOy() { return H > W ? 0.37 : 0.52; }
function toMenu() {
  mode = 'menu'; demo = true; botOn = true;
  themeHue = Math.random() * 360;
  resetTower();
  oyFT = menuOy(); oxFT = 0.5; zoomT = H > W ? 0.62 : 0.8;
  $('hud').classList.add('hidden'); $('btnPause').classList.add('hidden');
  $('menuBest').textContent = best; $('menuBlocks').textContent = bestBlocks;
  showScreen('menu');
}

function showScreen(id) {
  ['menu', 'pause', 'over', 'settings', 'info'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
}

function place() {
  if (!mover || (mode !== 'play' && mode !== 'menu')) return;
  const playing = mode === 'play';
  const prev = blocks[blocks.length - 1], m = mover, ax = m.axis, od = ax === 'x' ? 'd' : 'w', sz = ax === 'x' ? 'w' : 'd';
  const c0 = prev[ax], s0 = prev[sz], c = m[ax], s = m[sz];
  const tol = tolerance();
  const delta = c - c0;
  const lo = Math.max(c - s / 2, c0 - s0 / 2), hi = Math.min(c + s / 2, c0 + s0 / 2);
  const overlap = hi - lo;

  if (Math.abs(delta) > tol && overlap <= 0.8) {   // missed completely
    if (!playing) { // demo bot should not really miss; just restart
      resetTower(); return;
    }
    pieces.push({ x: m.x, z: m.z, w: m.w, d: m.d, y: m.y, h: m.h, hue: m.hue, spr: m.spr, vy: 0, vx: ax === 'x' ? m.dir * 40 : 0, vz: ax === 'z' ? m.dir * 40 : 0, rot: 0, vr: rnd(-1.5, 1.5) * 1, a: 1 });
    mover = null; die(); return;
  }

  let perfect = false;
  const nb = { x: m.x, z: m.z, w: m.w, d: m.d, y: m.y, h: BH, hue: m.hue, spr: m.spr };
  if (Math.abs(delta) <= tol) {            // ----- PERFECT: snap to the block below
    perfect = true;
    nb[ax] = c0;
    combo++; perfects++;
    if (combo >= 3) {                       // chain bonus: block grows back
      const grown = Math.min(W0, nb[sz] + 6);
      nb[sz] = grown;
    }
  } else {                                  // ----- slice the overhang
    combo = 0;
    nb[ax] = (lo + hi) / 2; nb[sz] = overlap;
    const pc = { x: m.x, z: m.z, w: m.w, d: m.d, y: m.y, h: BH, hue: m.hue, spr: m.spr, vy: 0, rot: 0, vr: rnd(-1.6, 1.6), a: 1, vx: 0, vz: 0 };
    const cutLen = s - overlap;
    if (delta > 0) { pc[ax] = hi + cutLen / 2; } else { pc[ax] = lo - cutLen / 2; }
    pc[sz] = cutLen;
    const sgn = delta > 0 ? 1 : -1;
    if (ax === 'x') pc.vx = sgn * 36; else pc.vz = sgn * 36;
    pieces.push(pc);
    if (playing) { Snd.play('slice', rnd(0.95, 1.1), 0.9); shake = Math.max(shake, 3); }
  }
  blocks.push(nb);
  mover = null;

  // squash + camera
  sqX = 1; sqV = 0;
  camTY = (blocks.length) * BH;

  if (playing) {
    score += perfect ? 2 + combo : 1;
    const sc = $('score'); sc.textContent = score; sc.classList.add('pop'); setTimeout(() => sc.classList.remove('pop'), 110);
    if (perfect) {
      Snd.play('perfect', 1 + 0.06 * Math.min(combo, 14), 1);
      const top = nb.y + BH;
      rings.push({ x: nb.x, z: nb.z, w: nb.w, d: nb.d, y: top, age: 0 });
      burst(nb.x, top, nb.z, 10 + Math.min(combo, 8) * 3, 70 + combo * 6, nb.hue, nb.w, nb.d);
      pops.push({ txt: T('perfect'), x: nb.x, y: top, z: nb.z, age: 0, size: 26 + Math.min(combo, 6) * 2, c: hsl(nb.hue, 90, 62) });
      if (combo > 1) pops.push({ txt: '×' + combo, x: nb.x, y: top, z: nb.z, age: -0.12, size: 22 + Math.min(combo, 6) * 2, c: '#ffd23f' });
      shake = Math.max(shake, 2 + Math.min(combo, 6) * 0.4);
    } else {
      Snd.play('place', rnd(0.95, 1.05), 0.9);
    }
    $('comboLbl').textContent = combo >= 2 ? '✨ ×' + combo : '';
    if (blocks.length - 1 > 0 && (blocks.length - 1) % 10 === 0) milestone((blocks.length - 1) / 10);
    if (score > best) {
      if (!newBestRun && bestAtStart > 0) toast('★ ' + T('newbest'));
      newBestRun = true;
      best = score; $('hudBest').textContent = best; store.set('best', best);   // saved at once: closing the tab mid-run keeps it
    }
  }
  if (playing && combo >= 5) feverT = 1.2;
  spawnMover();
}

function milestone(n) {
  const list = T('banners');
  const b = $('banner');
  b.textContent = list[Math.min(n - 1, list.length - 1)];
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  Snd.play('tide', 1, 0.9);
  const top = blocks[blocks.length - 1];
  burst(top.x, top.y + BH, top.z, 46, 150, top.hue, 90, 90);
  bgFlash = 1;
}
let bgFlash = 0;

function die() {
  mode = 'dying'; dieT = 0; shake = 7;
  Snd.play('fail', 1, 1);
  combo = 0; $('comboLbl').textContent = ''; $('banner').classList.remove('show');
  // zoom out so the whole tower is visible
  const th = blocks.length * BH;
  const fit = (H * 0.42) / (th * S + 60);
  zoomT = Math.min(1, fit);
  camTY = th / 2 + 10;
  oyFT = wide() ? 0.5 : 0.36;
  oxFT = wide() ? 0.3 : 0.5;
}

function showOver() {
  mode = 'over';
  const blocksN = blocks.length - 1;
  const isNew = newBestRun && score > 0;
  if (score > best) best = score;
  store.set('best', best);
  if (blocksN > bestBlocks) { bestBlocks = blocksN; store.set('bestBlocks', bestBlocks); }
  $('ovScore').textContent = score; $('ovBest').textContent = best; $('ovBlocks').textContent = blocksN; $('ovPerf').textContent = perfects;
  $('ovNew').classList.toggle('hidden', !isNew);
  $('btnContinue').classList.toggle('hidden', !(Ads.available() && !revived && blocksN >= 4));
  $('hud').classList.add('hidden'); $('btnPause').classList.add('hidden');
  showScreen('over');
  Rewards.onRunEnd({ score, blocks: blocksN, perfects, best });
}

function revive() {
  revived = true;
  mode = 'play'; startLock = 0.35;
  zoomT = 1; oyFT = 0.62; oxFT = 0.5; camTY = blocks.length * BH;
  $('hud').classList.remove('hidden'); $('btnPause').classList.remove('hidden');
  combo = 0; $('comboLbl').textContent = '';
  showScreen(null);
  spawnMover();
}

/* ---- the one small place where run results leave the game (HARD STEEL COIN hook, later) ---- */
const Rewards = {
  onRunEnd(info) { /* later: send info.blocks / info.perfects to the site wallet (server-side validated) */ }
};

/* ====================================================== effects */
function burst(x, y, z, n, power, hue, w, d) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = rnd(0.3, 1) * power;
    parts.push({ x: x + rnd(-w / 2, w / 2), y: y + 2, z: z + rnd(-d / 2, d / 2), vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rnd(60, 150) * (power / 90 + 0.4),
      life: rnd(0.8, 1.4), age: 0, rot: rnd(0, 6.28), vr: rnd(-9, 9), c: Math.random() < 0.5 ? SPRK[(Math.random() * SPRK.length) | 0] : hsl(hue + rnd(-40, 40), 90, 62), len: rnd(3, 6.5) });
  }
}

let toastT = 0;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2200); }

/* ====================================================== update */
function update(dt) {
  tick += dt;
  if (mode === 'paused') return;
  if (startLock > 0) startLock -= dt;

  // squash spring
  const acc = -280 * sqX - 13 * sqV; sqV += acc * dt; sqX += sqV * dt;
  // camera
  const topB = blocks[blocks.length - 1];
  const k = 1 - Math.exp(-5 * dt);
  const tx = mode === 'over' || mode === 'dying' ? 0 : topB.x, tz = mode === 'over' || mode === 'dying' ? 0 : topB.z;
  camX += (tx - camX) * k; camZ += (tz - camZ) * k;
  camY += (camTY - camY) * (1 - Math.exp(-(mode === 'dying' || mode === 'over' ? 3 : 6) * dt));
  zoom += (zoomT - zoom) * (1 - Math.exp(-3.2 * dt));
  oyF += (oyFT - oyF) * (1 - Math.exp(-4 * dt));
  oxF += (oxFT - oxF) * (1 - Math.exp(-4 * dt));
  const bh = hueFor(blocks.length) + 170;
  bgHue = lerpAngle(bgHue, bh, 1 - Math.exp(-1.2 * dt));
  shake = Math.max(0, shake - dt * 14);
  feverT = Math.max(0, feverT - dt);
  bgFlash = Math.max(0, bgFlash - dt * 1.6);

  // mover
  if (mover && (mode === 'play' || mode === 'menu')) {
    const m = mover, ax = m.axis, prev = blocks[blocks.length - 1];
    m.age += dt;
    m[ax] += m.dir * speed() * dt;
    if (m[ax] > prev[ax] + RANGE) { m[ax] = prev[ax] + RANGE; m.dir = -1; }
    if (m[ax] < prev[ax] - RANGE) { m[ax] = prev[ax] - RANGE; m.dir = 1; }
    // bot (menu demo + ?bot test)
    if (botOn && m.age > 0.25) {
      const dd = m[ax] - prev[ax] - m.botOff;
      if (m.lastD !== null && (dd === 0 || (dd > 0) !== (m.lastD > 0) || Math.abs(dd) < tolerance() * 0.5)) {
        m.lastD = null; place();
        if (mode === 'menu' && blocks.length > 16) { resetTower(); }
      } else if (mover) mover.lastD = dd;
    }
    if (mode === 'play' && combo >= 5 && Math.random() < 0.6) {
      parts.push({ x: m.x + rnd(-m.w / 2, m.w / 2), y: m.y + BH, z: m.z + rnd(-m.d / 2, m.d / 2), vx: 0, vz: 0, vy: rnd(10, 40), life: 0.5, age: 0, rot: rnd(0, 6), vr: 6, c: SPRK[(Math.random() * 5) | 0], len: 3 });
    }
  }
  // dying -> over
  if (mode === 'dying') { dieT += dt; if (dieT > 1.0) showOver(); }

  // pieces
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i];
    p.vy -= 520 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.y < -260) p.a -= dt * 3;
    if (p.a <= 0 || p.y < (blocks.length * BH) - 900) pieces.splice(i, 1);
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.age += dt;
    p.vy -= 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.age > p.life) parts.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age > 0.55) rings.splice(i, 1); }
  for (let i = pops.length - 1; i >= 0; i--) { pops[i].age += dt; if (pops[i].age > 0.9) pops.splice(i, 1); }
}

/* ====================================================== drawing */
function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, hsl(bgHue, 85, 86)); g.addColorStop(0.55, hsl(bgHue + 25, 85, 90)); g.addColorStop(1, hsl(bgHue + 55, 90, 84));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft glow behind the tower
  const rg = ctx.createRadialGradient(W / 2, H * oyF, 10, W / 2, H * oyF, Math.max(W, H) * 0.6);
  rg.addColorStop(0, 'rgba(255,255,255,' + (0.55 + bgFlash * 0.4) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  // floating candy decorations
  for (const it of bgItems) {
    const span = H + 120;
    let y = (it.y * span - camY * S * zoom * it.par * 0.35 + tick * it.sp * 0.3) % span; if (y < 0) y += span; y -= 60;
    const x = it.x * W + Math.sin(tick * 0.6 + it.ph) * 14;
    const r = it.r * (0.7 + S * 0.3);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(tick * 0.5 + it.ph) * 0.4);
    ctx.globalAlpha = 0.38;
    const c1 = hsl(it.h + bgHue * 0.3, 85, 72), c2 = hsl(it.h + 60, 90, 80);
    if (it.type === 0) { ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-r * .3, -r * .3, r * .25, 0, 6.3); ctx.fill(); }
    else if (it.type === 1) { ctx.strokeStyle = c1; ctx.lineWidth = r * 0.28; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 6.3); ctx.stroke(); }
    else if (it.type === 2) { star(r); ctx.fillStyle = c2; ctx.fill(); }
    else { // wrapped candy
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(r * .7, 0); ctx.lineTo(r * 1.35, -r * .5); ctx.lineTo(r * 1.35, r * .5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * .7, 0); ctx.lineTo(-r * 1.35, -r * .5); ctx.lineTo(-r * 1.35, r * .5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
function star(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
}

function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

function drawBox(b, sq, alpha) {
  let w = b.w, d = b.d, h = b.h;
  if (sq) { w *= 1 + 0.05 * sq; d *= 1 + 0.05 * sq; h *= 1 - 0.28 * sq; }
  const x0 = b.x - w / 2, x1 = b.x + w / 2, z0 = b.z - d / 2, z1 = b.z + d / 2, yb = b.y, yt = b.y + h;
  const a = P(x0, yt, z0), bb = P(x1, yt, z0), c = P(x1, yt, z1), dd = P(x0, yt, z1);
  const b2 = P(x1, yb, z0), c2 = P(x1, yb, z1), d2 = P(x0, yb, z1);
  const hue = b.hue, lw = Math.max(1.5, 4 * S * zoom);
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  // right face (darker)
  let col = hsl(hue, 78, 52); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = lw;
  poly([bb, c, c2, b2]); ctx.fill(); ctx.stroke();
  // left face
  col = hsl(hue, 80, 63); ctx.fillStyle = col; ctx.strokeStyle = col;
  poly([dd, c, c2, d2]); ctx.fill(); ctx.stroke();
  // gloss strip on left face
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  const t1 = 0.12, t2 = 0.24;
  const g1 = [dd[0] + (c[0] - dd[0]) * t1, dd[1] + (c[1] - dd[1]) * t1], g2 = [dd[0] + (c[0] - dd[0]) * t2, dd[1] + (c[1] - dd[1]) * t2];
  const g3 = [d2[0] + (c2[0] - d2[0]) * t2, d2[1] + (c2[1] - d2[1]) * t2], g4 = [d2[0] + (c2[0] - d2[0]) * t1, d2[1] + (c2[1] - d2[1]) * t1];
  const sh = (yt - yb) * 0.18 * S * zoom;
  poly([[g1[0], g1[1] + sh], [g2[0], g2[1] + sh], [g3[0], g3[1] - sh], [g4[0], g4[1] - sh]]); ctx.fill();
  // top face
  const gr = ctx.createLinearGradient(a[0], a[1], c[0], c[1]);
  gr.addColorStop(0, hsl(hue, 90, 82)); gr.addColorStop(1, hsl(hue, 85, 70));
  ctx.fillStyle = gr; ctx.strokeStyle = hsl(hue, 85, 76); ctx.lineWidth = lw;
  poly([a, bb, c, dd]); ctx.fill(); ctx.stroke();
  // candy rim highlight on the front edges
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, 1.6 * S * zoom); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(dd[0], dd[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(bb[0], bb[1]); ctx.stroke();
  // sprinkles
  if (b.spr && zoom > 0.35) {
    ctx.lineWidth = Math.max(1.2, 2.6 * S * zoom);
    for (const s of b.spr) {
      const p = P(x0 + s.u * w, yt, z0 + s.v * d);
      const dx = Math.cos(s.a), dz = Math.sin(s.a), L = 4.2 * S * zoom;
      ctx.strokeStyle = s.c;
      ctx.beginPath(); ctx.moveTo(p[0] - (dx - dz) * K1 * L, p[1] - (dx + dz) * 0.5 * L); ctx.lineTo(p[0] + (dx - dz) * K1 * L, p[1] + (dx + dz) * 0.5 * L); ctx.stroke();
    }
  }
  if (alpha != null) ctx.globalAlpha = 1;
}

function drawPiece(p) {
  const c = P(p.x, p.y + p.h / 2, p.z);
  ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(p.rot); ctx.translate(-c[0], -c[1]);
  drawBox(p, 0, clamp(p.a, 0, 1));
  ctx.restore();
}

function drawPlate() {
  const plate = { x: 0, z: 0, w: 172, d: 172, y: -18, h: 18, hue: 330, spr: null };
  // pale cream plate
  const x0 = -86, x1 = 86, z0 = -86, z1 = 86, yb = -18, yt = 0;
  const a = P(x0, yt, z0), bb = P(x1, yt, z0), c = P(x1, yt, z1), dd = P(x0, yt, z1);
  const b2 = P(x1, yb, z0), c2 = P(x1, yb, z1), d2 = P(x0, yb, z1);
  const lw = Math.max(1.5, 4 * S * zoom); ctx.lineJoin = 'round'; ctx.lineWidth = lw;
  ctx.fillStyle = ctx.strokeStyle = '#d9b59a'; poly([bb, c, c2, b2]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle = '#ecc9ad'; poly([dd, c, c2, d2]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle = '#fff1e3'; poly([a, bb, c, dd]); ctx.fill(); ctx.stroke();
}

function visible(b) {
  const top = P(b.x, b.y + b.h, b.z)[1], bot = P(b.x, b.y, b.z)[1];
  return bot > -80 && top < H + 120 + 90 * S;
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ox = W * oxF; oy = H * oyF;
  if (shake > 0.05) { ox += rnd(-shake, shake); oy += rnd(-shake, shake); }
  drawBg();

  const topB = blocks[blocks.length - 1];
  const towerKey = topB.x + topB.z;
  for (const p of pieces) if (p.x + p.z < towerKey) drawPiece(p);

  drawPlate();
  const n = blocks.length;
  for (let i = 0; i < n; i++) {
    const b = blocks[i];
    if (!visible(b)) continue;
    drawBox(b, i === n - 1 ? sqX : (i === n - 2 ? sqX * 0.3 : 0));
  }

  // landing shadow + moving block
  if (mover && (mode === 'play' || mode === 'menu')) {
    const m = mover, prev = topB, top = prev.y + prev.h;
    const xl = Math.max(m.x - m.w / 2, prev.x - prev.w / 2), xr = Math.min(m.x + m.w / 2, prev.x + prev.w / 2);
    const zl = Math.max(m.z - m.d / 2, prev.z - prev.d / 2), zr = Math.min(m.z + m.d / 2, prev.z + prev.d / 2);
    if (xr > xl && zr > zl) {
      ctx.fillStyle = 'rgba(90,30,80,0.16)';
      poly([P(xl, top, zl), P(xr, top, zl), P(xr, top, zr), P(xl, top, zr)]); ctx.fill();
    }
    // faint outline of the block below: the target
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, 1.8 * S * zoom); ctx.setLineDash([6, 5]);
    poly([P(prev.x - prev.w / 2, top, prev.z - prev.d / 2), P(prev.x + prev.w / 2, top, prev.z - prev.d / 2), P(prev.x + prev.w / 2, top, prev.z + prev.d / 2), P(prev.x - prev.w / 2, top, prev.z + prev.d / 2)]); ctx.stroke();
    ctx.setLineDash([]);
    const grow = clamp(m.age * 7, 0, 1);
    drawBox({ x: m.x, z: m.z, w: m.w, d: m.d, y: m.y + 3 * (1 - grow), h: m.h, hue: m.hue, spr: m.spr }, 0, 0.55 + 0.45 * grow);
  }

  for (const p of pieces) if (p.x + p.z >= towerKey) drawPiece(p);

  // perfect rings
  for (const r of rings) {
    const t = r.age / 0.55, e = 1 + t * 0.35;
    ctx.strokeStyle = 'rgba(255,255,255,' + (1 - t).toFixed(2) + ')'; ctx.lineWidth = Math.max(2, 5 * S * zoom * (1 - t));
    const hw = r.w / 2 * e, hd = r.d / 2 * e;
    poly([P(r.x - hw, r.y, r.z - hd), P(r.x + hw, r.y, r.z - hd), P(r.x + hw, r.y, r.z + hd), P(r.x - hw, r.y, r.z + hd)]); ctx.stroke();
  }
  // sprinkles / confetti
  ctx.lineCap = 'round';
  for (const p of parts) {
    const pp = P(p.x, p.y, p.z), t = 1 - p.age / p.life;
    ctx.globalAlpha = clamp(t * 1.6, 0, 1); ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1.5, 3 * S * zoom);
    const L = p.len * S * zoom;
    ctx.beginPath(); ctx.moveTo(pp[0] - Math.cos(p.rot) * L, pp[1] - Math.sin(p.rot) * L); ctx.lineTo(pp[0] + Math.cos(p.rot) * L, pp[1] + Math.sin(p.rot) * L); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // pops
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const p of pops) {
    if (p.age < 0) continue;
    const pp = P(p.x, p.y, p.z), t = p.age / 0.9;
    const sc = t < 0.15 ? 0.5 + t / 0.15 * 0.7 : 1.2 - (t - 0.15) * 0.25;
    ctx.globalAlpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
    ctx.font = '700 ' + (p.size * sc).toFixed(1) + 'px Fredoka, "Noto Sans Georgian", system-ui, sans-serif';
    const yy = pp[1] - 34 * S - t * 46 + (p.txt.charAt(0) === '×' ? 30 * S : 0);
    ctx.lineWidth = 6; ctx.strokeStyle = '#5b3550'; ctx.strokeText(p.txt, pp[0], yy);
    ctx.fillStyle = p.c; ctx.fillText(p.txt, pp[0], yy);
  }
  ctx.globalAlpha = 1;
  // fever glow at the screen edges
  if (feverT > 0) {
    const a = Math.min(1, feverT) * (0.22 + 0.08 * Math.sin(tick * 12));
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,214,70,0)'); g.addColorStop(1, 'rgba(255,170,40,' + a.toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

/* ====================================================== loop */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}

/* ====================================================== input / UI */
function onTap() {
  Snd.init();
  // ignore taps right after a block spawned: a double tap / duplicate touch event must never cost a life
  if (mode === 'play' && startLock <= 0 && mover && mover.age >= 0.12) place();
}
cv.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') { e.preventDefault(); Snd.init(); if (mode === 'play') onTap(); else if (mode === 'menu') startGame(); }
  else if (e.code === 'KeyP' || e.code === 'Escape') { if (mode === 'play') pauseGame(); else if (mode === 'paused') resumeGame(); }
  else if (e.code === 'KeyM') { Snd.toggle(); setSndIcon(); }
});

function pauseGame() { if (mode !== 'play') return; prevMode = mode; mode = 'paused'; showScreen('pause'); }
function resumeGame() { if (mode !== 'paused') return; mode = 'play'; startLock = 0.3; showScreen(null); }
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

function setSndIcon() {
  $('btnSnd').innerHTML = Snd.muted
    ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
}

function bind(id, fn) { $(id).addEventListener('click', () => { Snd.init(); $(id).blur(); fn(); }); }
bind('btnStart', startGame);
bind('btnAgain', startGame);
bind('btnSettings', () => { Snd.play('ui'); showScreen('settings'); });
bind('btnInfo', () => { Snd.play('ui'); showScreen('info'); });
bind('btnSetBack', () => { Snd.play('ui'); showScreen('menu'); });
bind('btnInfoBack', () => { Snd.play('ui'); showScreen('menu'); });
bind('btnPause', pauseGame);
bind('btnResume', () => { Snd.play('ui'); resumeGame(); });
bind('btnPauseMenu', () => { Snd.play('ui'); toMenu(); });
bind('btnOverMenu', () => { Snd.play('ui'); toMenu(); });
bind('btnSnd', () => { Snd.toggle(); setSndIcon(); });
$('btnContinue').addEventListener('click', async () => {
  Snd.init();
  const btn = $('btnContinue'); btn.disabled = true;
  const r = await Ads.reward('continue');
  btn.disabled = false;
  if (r.ok && mode === 'over' && !revived) revive();
  else if (!r.ok && r.reason !== 'dismissed') btn.classList.add('hidden');   // no ad available (the shared ads core already told the player)
});
$('vol').addEventListener('input', (e) => { Snd.init(); Snd.setVol(e.target.value / 100); });
$('vol').value = Math.round(Snd.vol * 100);

// logo letters
(function () {
  const words = ['ONE', 'PIXEL', 'OFF'], cols = ['#ff6fa5', '#ffb02e', '#43d6c0', '#7aa7ff', '#b98cff', '#ff7a5c', '#5ccf6b', '#ff6fa5'];
  let i = 0; const lg = $('logo');
  words.forEach((w) => {
    const row = document.createElement('span'); row.className = 'w';
    for (const ch of w) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; s.style.setProperty('--c', cols[i % cols.length]); s.style.setProperty('--d', (i * 0.11).toFixed(2) + 's'); row.appendChild(s); i++; }
    lg.appendChild(row);
  });
})();
(function () {
  const box = $('langs');
  Object.keys(LANG_NAMES).forEach((l) => {
    const b = document.createElement('button'); b.textContent = LANG_NAMES[l]; b.dataset.l = l;
    b.addEventListener('click', () => { lang = l; store.set('lang', l); applyLang(); Snd.init(); Snd.play('ui'); });
    box.appendChild(b);
  });
})();

/* ====================================================== ads setup */
Ads.configure({ onStart: () => Snd.suspend(), onEnd: () => Snd.resume() });

/* ====================================================== boot */
if (location.pathname.indexOf('/play/') === 0) $('btnHome').style.display = 'grid';   // on 6fingergames.com: a way back to the game list
resize(); applyLang(); setSndIcon();
$('menuBest').textContent = best; $('menuBlocks').textContent = bestBlocks;
resetTower(); bgHue = hueFor(0) + 170; oyF = oyFT = menuOy();
if (TESTBOT) { startGame(); } else { toMenu(); }
// domain lock is re-checked while the game runs (framing / redirect tricks after load)
setInterval(() => { if (!Lock.ok()) { Lock.block(); } }, 4000);
if (IS_LOCAL) window.__g = {
  sim(frames, dt) { for (let i = 0; i < frames; i++) { update(dt || 1 / 60); if (i % 30 === 0) draw(); } },
  bad() { return blocks.some((b) => !isFinite(b.x + b.z + b.w + b.d + b.y) || b.w <= 0 || b.d <= 0 || b.w > W0 + 0.01 || b.d > W0 + 0.01); },
  counts() { return { pieces: pieces.length, parts: parts.length, rings: rings.length, pops: pops.length }; },
  setBotOff(v) { botOn = v; },
  get mode() { return mode; }, get score() { return score; }, get blocks() { return blocks.length; }, place, get combo() { return combo; }, set bot(v) { botOn = v; }, showOver, revive, startGame };
requestAnimationFrame(frame);
})();
