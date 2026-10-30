// Tiny procedural sound bank (WebAudio, no assets).
const Sfx = (() => {
  let ctx = null;
  let muted = localStorage.getItem("fm_mute") === "1";
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    try {
      const a = ac(), t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable: stay silent */ }
  }
  return {
    drop()   { tone(220, 0.09, "triangle", 0.10, 140); },
    merge(level, combo) {
      const base = 300 * Math.pow(1.059, level * 2 + Math.min(combo, 8));
      tone(base, 0.16, "sine", 0.18, base * 1.6);
      tone(base * 1.5, 0.22, "triangle", 0.07, base * 2);
    },
    big()    { tone(160, 0.5, "sawtooth", 0.12, 60); tone(520, 0.4, "sine", 0.14, 1040); },
    over()   { tone(330, 0.7, "sine", 0.16, 90); },
    click()  { tone(600, 0.05, "square", 0.05); },
    toggle() { muted = !muted; localStorage.setItem("fm_mute", muted ? "1" : "0"); return muted; },
    get muted() { return muted; }
  };
})();
