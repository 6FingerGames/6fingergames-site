// Game logic, input and main loop.
if (!window.__FM_ACCESS_GRANTED__) throw new Error("Fruit Merge access denied.");
const W = 574, H = 1133;
const LEFT = 42, RIGHT = 532, FLOOR = 1024, DANGER = 202, DROP_Y = 175;
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
const $ = id => document.getElementById(id);
let world = new World(LEFT, RIGHT, FLOOR);
let state = "menu";
let score = 0, shownScore = 0, best = +(localStorage.getItem("fm_best") || 0), newBest = false;
let cur = 0, nxt = 1, aimX = W / 2, cooldown = 0;
let combo = 0, comboTimer = 0, danger = 0, shake = 0, time = 0;
let heat = 0; // each popped peach permanently raises drop difficulty
let startBest = 0; // record when this run began, for new-best detection
let runTime = 0, reviveUsed = false, reviveGrace = 0;
let lastReviveOffer = -300000;

function rndLevel() {
  // gradual pressure: easy small fruits at first, big awkward ones later.
  // Popped peaches add permanent heat, so clearing space never gets free.
  const s = score + heat * 700;
  const w = s < 200  ? [60, 40]                           // apples & oranges
          : s < 600  ? [35, 30, 20, 15]                   // + lemons & plums
          : s < 1500 ? [25, 25, 20, 20, 10]               // + strawberries
          : s < 3000 ? [15, 15, 20, 20, 20, 10]           // + blueberries
          :            [10, 10, 15, 20, 25, 20];          // mostly big fruit
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return 0;
}
function reset() {
  world = new World(LEFT, RIGHT, FLOOR);
  Fx.clear();
  score = 0; shownScore = 0; newBest = false; combo = 0; comboTimer = 0; danger = 0; shake = 0; heat = 0;
  runTime = 0; reviveUsed = false; reviveGrace = 0;
  $("score").textContent = "0";
  startBest = best;
  cur = rndLevel(); nxt = rndLevel(); cooldown = 0; aimX = W / 2;
}
function setState(s) {
  state = s;
  $("menu").classList.toggle("hidden", s !== "menu");
  $("over").classList.toggle("hidden", s !== "over");
  $("paused").classList.toggle("hidden", s !== "paused");
  $("revive").classList.toggle("hidden", s !== "revive");
  $("ad").classList.toggle("hidden", s !== "ad");
  $("pause").textContent = s === "paused" ? "▶" : "II";
}
function start() { reset(); setState("play"); Sfx.click(); }

function drop() {
  if (state !== "play" || cooldown > 0) return;
  const r = FRUITS[cur].r;
  const x = Math.max(LEFT + r, Math.min(RIGHT - r, aimX));
  // no room to be born: the pile reached the drop point -> game over
  for (const b of world.bodies) {
    const dx = b.x - x, dy = b.y - DROP_Y, rr = b.r + r - 2;
    if (dx * dx + dy * dy < rr * rr) { gameOver(); return; }
  }
  const b = world.add(x, DROP_Y, r, cur);
  b.vy = 60;
  Sfx.drop();
  cur = nxt; nxt = rndLevel(); cooldown = 0.4;
}

function mergeStep(dt) {
  const bs = world.bodies;
  comboTimer -= dt;
  if (comboTimer <= 0) combo = 0;
  // real contacts from the physics solver + near-touching pairs
  // (resting piles can keep a few px gap even when fruits look touching)
  const pairs = world.mergeHits || [];
  world.mergeHits = [];
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i]; if (!a.alive) continue;
    for (let j = i + 1; j < bs.length; j++) {
      const b = bs[j];
      if (!b.alive || b.level !== a.level) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r + 4;
      if (dx * dx + dy * dy <= rr * rr) pairs.push([a, b]);
    }
  }
  for (const pair of pairs) {
    const a = pair[0], b = pair[1];
    if (!a.alive || !b.alive) continue;
    {
      const lvl = a.level;
      world.remove(a); world.remove(b);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      combo = Math.min(combo + 1, 8); comboTimer = 1.2;
      const gained = (lvl === LAST_LEVEL ? 150 : MERGE_SCORE[lvl]) * combo;
      const oldScore = score;
      score += gained;
      if (score > best) { best = score; localStorage.setItem("fm_best", best); }
      const scoreEl = $("score"), plaque = scoreEl.parentElement;
      scoreEl.classList.remove("score-pop"); plaque.classList.remove("score-pop");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("score-pop"); plaque.classList.add("score-pop");
      if (Math.floor(score / 500) > Math.floor(oldScore / 500)) {
        Fx.text(W / 2, 310, Math.floor(score / 500) * 500 + "!", 52, "#e87524");
        Fx.burst(140, 76, "#ffd23e", 34, 330);
      }
      const col = FALLBACK_COLORS[Math.min(lvl + 1, LAST_LEVEL)];
      Fx.burst(mx, my, col, 12 + lvl * 3, 240 + lvl * 32);
      Fx.burst(mx, my, "#ffffff", 6, 200);
      Fx.ring(mx, my, a.r, col);
      Fx.flyScore(mx, my - a.r - 8, gained, 27 + lvl * 2);
      if (combo >= 2) Fx.text(mx, my - a.r - 40, T("combo") + " x" + combo, 28, "#d6336c");
      if (lvl < LAST_LEVEL) {
        const nb = world.add(mx, my, FRUITS[lvl + 1].r, lvl + 1);
        nb.vx = (a.vx + b.vx) / 2; nb.vy = (a.vy + b.vy) / 2 - 140;
        nb.spin = (Math.random() - 0.5) * 4;
        Sfx.merge(lvl, combo);
      } else {
        heat++;
        // A pop leaves mixed fruit behind instead of emptying the bin for free.
        // More heat means more remnants, so peach farming builds real pressure.
        const remnants = Math.min(4, 1 + Math.floor((heat - 1) / 2));
        for (let i = 0; i < remnants; i++) {
          const lvl = 2 + (i + heat) % 3;
          const a = i * 2.4 + heat;
          const nb = world.add(mx + Math.cos(a) * 24, my + Math.sin(a) * 24, FRUITS[lvl].r, lvl);
          nb.vx = Math.cos(a) * 180;
          nb.vy = Math.sin(a) * 180 - 120;
        }
        Fx.burst(mx, my, "#ffd23e", 60, 520);
        Sfx.big();
      }
      shake = Math.min(shake + (lvl >= 5 ? 2 + lvl * 0.7 : lvl * 0.35), 9);
    }
  }
}

function dangerStep(dt) {
  let hot = false;
  for (const b of world.bodies) {
    if (b.born > 1.1 && b.y - b.r < DANGER && Math.abs(b.vy) < 120) { hot = true; break; }
  }
  danger = hot ? danger + dt : Math.max(0, danger - dt * 2);
  if (danger > 1.6) gameOver();
}
function canRevive() {
  if (reviveUsed || runTime < 45 || Date.now() - lastReviveOffer < 300000) return false;
  const alive = world.bodies.filter(b => b.alive);
  const remaining = alive.filter(b => b.level < 4);
  if (remaining.length === alive.length) return false;
  // The reward must genuinely save the run: no small fruit may remain in the
  // danger zone, and at least one safe birth lane must exist for the drop.
  for (const b of remaining) if (b.y - b.r < DANGER) return false;
  const r = FRUITS[cur].r;
  for (let lane = 0; lane < 9; lane++) {
    const x = LEFT + r + (RIGHT - LEFT - 2 * r) * lane / 8;
    let clear = true;
    for (const b of remaining) {
      const dx = b.x - x, dy = b.y - DROP_Y, rr = b.r + r - 2;
      if (dx * dx + dy * dy < rr * rr) { clear = false; break; }
    }
    if (clear) return true;
  }
  return false;
}
function finishGameOver() {
  newBest = score > startBest;
  if (newBest) { best = score; localStorage.setItem("fm_best", best); }
  $("overScore").textContent = T("score") + ": " + score;
  $("overBest").textContent = newBest ? T("newBest") : T("best") + ": " + best;
  setState("over"); Sfx.over();
  if (newBest) for (let i = 0; i < 5; i++)
    Fx.burst(80 + i * 80, 200, ["#ffd23e", "#f2545b", "#9b5de5"][i % 3], 22, 420);
}
function gameOver() {
  if (state !== "play") return;
  if (canRevive()) {
    lastReviveOffer = Date.now();
    setState("revive");
  } else finishGameOver();
}
function reviveRun() {
  reviveUsed = true;
  Fx.clear();
  for (const b of world.bodies) {
    if (!b.alive || b.level < 4) continue;
    Fx.burst(b.x, b.y, "#ffd23e", 22, 360);
    Fx.ring(b.x, b.y, b.r, "#ffffff");
    world.remove(b);
  }
  world.bodies = world.bodies.filter(b => b.alive);
  danger = 0; reviveGrace = 3; cooldown = 0.6; combo = 0; comboTimer = 0;
  setState("play");
}

// ---------- rendering ----------
function easeOutBack(k) { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // golden frame (John's art), interior included
  if (imgReady(FRAME_IMG)) ctx.drawImage(FRAME_IMG, 0, 0, W, 1133);
  else { ctx.fillStyle = "#fbefd1"; ctx.fillRect(0, 0, W, 1133); }

  // warning line only when the pile stays too high (frame has its own faint line)
  const warn = Math.min(1, danger / 1.6);
  if (warn > 0) {
    ctx.strokeStyle = `rgba(214,51,108,${0.35 + 0.65 * warn * (0.6 + 0.4 * Math.sin(time * 18))})`;
    ctx.lineWidth = 2 + warn * 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(LEFT, DANGER); ctx.lineTo(RIGHT, DANGER); ctx.stroke();
    ctx.setLineDash([]);
  }

  // aim guide + current fruit
  if (state === "play") {
    const r = FRUITS[cur].r;
    const x = Math.max(LEFT + r, Math.min(RIGHT - r, aimX));
    ctx.strokeStyle = "rgba(160,110,70,0.3)"; ctx.lineWidth = 3;
    ctx.setLineDash([4, 10]);
    ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, FLOOR); ctx.stroke();
    ctx.setLineDash([]);
    ctx.save(); ctx.translate(x, DROP_Y);
    drawFruit(ctx, cur, r); drawHighlight(ctx, r);
    ctx.restore();
  }

  // bodies: sprite rotates, highlight stays fixed (upper-left light)
  for (const b of world.bodies) {
    ctx.save(); ctx.translate(b.x, b.y);
    const s = b.born < 0.2 ? Math.max(0.1, easeOutBack(b.born / 0.2)) : 1;
    ctx.scale(s, s);
    ctx.save(); ctx.rotate(b.angle);
    drawFruit(ctx, b.level, b.r);
    ctx.restore();
    drawHighlight(ctx, b.r);
    ctx.restore();
  }
  Fx.draw(ctx);

  // next preview in John's golden circle
  if (state === "play" || state === "paused") {
    ctx.save(); ctx.translate(484, 166);
    if (imgReady(CIRCLE_IMG)) ctx.drawImage(CIRCLE_IMG, -34, -36, 68, 72);
    const nr = Math.min(26, FRUITS[nxt].r * 0.55);
    drawFruit(ctx, nxt, nr); drawHighlight(ctx, nr);
    ctx.restore();
  }
  ctx.restore();
}
let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  time += dt;
  if (state === "play") {
    runTime += dt;
    cooldown = Math.max(0, cooldown - dt);
    acc += dt;
    const h = 1 / 120;
    while (acc >= h) { world.step(h); acc -= h; }
    mergeStep(dt);
    if (reviveGrace > 0) {
      reviveGrace = Math.max(0, reviveGrace - dt);
      danger = Math.max(0, danger - dt * 2);
    } else dangerStep(dt);
    shake = Math.max(0, shake - dt * 26);
    if (shownScore !== score) {
      const diff = score - shownScore;
      shownScore += Math.min(diff, Math.max(1, Math.ceil(diff * dt * 10)));
      $("score").textContent = shownScore;
    }
    $("best").textContent = T("best") + ": " + best;
  }
  if (state !== "paused") Fx.update(dt);
  draw();
}

// ---------- input ----------
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return (e.clientX - r.left) / r.width * W;
}
cv.addEventListener("pointermove", e => { aimX = toLogical(e); });
cv.addEventListener("pointerdown", e => { aimX = toLogical(e); });
cv.addEventListener("pointerup", e => { aimX = toLogical(e); drop(); });
window.addEventListener("keydown", e => {
  // a focused button must not also fire on Space/arrows meant for the game
  if (e.target.tagName === "BUTTON" && e.code !== "Enter") e.target.blur();
  if (e.code === "Space") { e.preventDefault(); if (state === "menu") start(); else drop(); }
  if (e.code === "ArrowLeft") aimX -= 22;
  if (e.code === "ArrowRight") aimX += 22;
  if (e.code === "KeyP" || e.code === "Escape") {
    if (state === "play") setState("paused");
    else if (state === "paused") setState("play");
  }
  if (e.code === "KeyR" && state === "over") start();
  if (e.code === "Enter" && state === "menu") start();
});
$("play").onclick = start;
$("retry").onclick = start;
$("resume").onclick = () => setState("play");
function playRewardedAd() {
  // Local, clearly labelled test ad. A real network can replace this Promise.
  return new Promise((resolve, reject) => {
    let left = 3;
    $("adCountdown").textContent = left;
    const timer = setInterval(() => {
      if (state !== "ad") { clearInterval(timer); reject(new Error("Ad closed")); return; }
      left--;
      if (left <= 0) { clearInterval(timer); resolve(); return; }
      $("adCountdown").textContent = left;
    }, 1000);
  });
}
$("watchAd").onclick = async () => {
  if (state !== "revive") return;
  setState("ad");
  try { await playRewardedAd(); reviveRun(); }
  catch { if (state === "ad") setState("revive"); }
};
$("declineRevive").onclick = () => { if (state === "revive") finishGameOver(); };
$("pause").onclick = () => { if (state === "play") setState("paused"); else if (state === "paused") setState("play"); };
$("mute").onclick = () => { $("mute").textContent = Sfx.toggle() ? "✕" : "♪"; };
$("fs").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
};
$("mute").textContent = Sfx.muted ? "✕" : "♪";

function applyLang() {
  document.title = T("title");
  $("overTitle").textContent = T("gameOver");
  $("pauseTitle").textContent = T("paused");
  $("reviveTitle").textContent = T("continue");
  $("reviveText").textContent = T("reviveText");
  $("watchAd").textContent = T("watchAd");
  $("declineRevive").textContent = T("endRun");
  $("adLabel").textContent = T("testAd");
  $("rights").textContent = T("rights");
  $("play").textContent = "▶";
  $("retry").textContent = "↻";
  $("resume").textContent = "▶";
  $("best").textContent = T("best") + ": " + best;
  $("lang").textContent = { en:"EN", ka:"ქა", ru:"РУ", zh:"中", ja:"日" }[LANG];
  for (const b of document.querySelectorAll("#langMenu button"))
    b.classList.toggle("active", b.dataset.l === LANG);
}
$("lang").onclick = e => { e.stopPropagation(); $("langMenu").classList.toggle("hidden"); };
for (const b of document.querySelectorAll("#langMenu button")) {
  b.onclick = e => {
    e.stopPropagation();
    LANG = b.dataset.l; localStorage.setItem("fm_lang", LANG);
    applyLang(); $("langMenu").classList.add("hidden");
  };
}
document.addEventListener("click", () => $("langMenu").classList.add("hidden"));

function fit() {
  const s = Math.min((window.innerHeight - 12) / H, (window.innerWidth - 12) / W);
  cv.style.width = W * s + "px"; cv.style.height = H * s + "px";
  $("wrap").style.width = W * s + "px"; $("wrap").style.height = H * s + "px";
}
window.addEventListener("resize", fit);
fit(); applyLang(); setState("menu");
requestAnimationFrame(frame);

// test handle, only with ?debug=1 — never exposed on the live page
if (location.search.includes("debug")) {
  window.__game = {
    get state() { return state; }, get score() { return score; },
    get bodies() { return world.bodies; }, get combo() { return combo; },
    start, drop, setAim(x) { aimX = x; },
    spawn(x, y, lvl) { return world.add(x, y, FRUITS[lvl].r, lvl); },
    setCur(l) { cur = l; }, setCooldown(v) { cooldown = v; }
  };
}
