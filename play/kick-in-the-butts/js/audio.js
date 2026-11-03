const Store = {
  get(k, d) { try { const v = localStorage.getItem('kick.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('kick.' + k, v); } catch (e) {} }
};

const Sound = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = Store.get('muted', '0') === '1';
  let suspended = false;

  // music: WebAudio buffers so the loop point is sample-accurate (no gap)
  const TRACKS = KICK_CONFIG.music || [];
  const bufs = {};
  let mGain = null, cur = null, curIdx = -1, duckOn = false, musicToken = 0;
  const MVOL = 0.5, MDUCK = 0.2;
  const mTarget = () => (muted ? 0 : duckOn ? MDUCK : MVOL);

  function loadTrack(i) {
    if (bufs[i]) return bufs[i];
    bufs[i] = fetch(TRACKS[i].src)
      .then((r) => r.arrayBuffer())
      .then((d) => new Promise((res, rej) => ac.decodeAudioData(d, res, rej)))
      .catch(() => { bufs[i] = null; return null; });
    return bufs[i];
  }

  function stopCur(fade) {
    if (!cur) return;
    const s = cur; cur = null;
    if (mGain && fade) {
      const t = ac.currentTime;
      mGain.gain.cancelScheduledValues(t);
      mGain.gain.setValueAtTime(mGain.gain.value, t);
      mGain.gain.linearRampToValueAtTime(0, t + fade);
      try { s.stop(t + fade + 0.02); } catch (e) {}
    } else { try { s.stop(); } catch (e) {} }
  }

  function playTrack(idx, fromLoop) {
    if (!ac || !TRACKS.length) return;
    const token = ++musicToken;
    stopCur(0);
    curIdx = idx;
    loadTrack(idx).then((buf) => {
      if (!buf || token !== musicToken) return;
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.loopStart = TRACKS[idx].loop || 0;
      s.loopEnd = buf.duration;
      s.connect(mGain);
      const t = ac.currentTime;
      mGain.gain.cancelScheduledValues(t);
      mGain.gain.setValueAtTime(mTarget(), t);
      s.start(0, fromLoop ? (TRACKS[idx].loop || 0) : 0);
      cur = s;
      loadTrack((idx + 1) % TRACKS.length);
    });
  }

  function unlock() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ac.destination);
        mGain = ac.createGain();
        mGain.gain.value = mTarget();
        mGain.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended' && !suspended) ac.resume();
  }

  function tone(f, dur, type, vol, f2, delay) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, f1, f2) {
    if (!ac || muted) return;
    const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass';
    fl.frequency.setValueAtTime(f1, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.03);
  }

  return {
    unlock,
    isMuted: () => muted,
    toggle() {
      muted = !muted;
      Store.set('muted', muted ? '1' : '0');
      if (mGain) mGain.gain.value = mTarget();
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (!muted) this.click();
      return muted;
    },
    duck(on) { duckOn = on; if (mGain && cur) mGain.gain.value = mTarget(); },
    // starts the next track of the cycle unless music is already playing
    musicStart() {
      if (cur || !TRACKS.length) return;
      const last = parseInt(Store.get('track', '-1'), 10);
      const idx = (isNaN(last) ? 0 : last + 1) % TRACKS.length;
      Store.set('track', String(idx));
      playTrack(idx, false);
    },
    musicStop(fade) { musicToken++; stopCur(fade || 0); },
    suspend() { suspended = true; if (ac) ac.suspend(); },
    resumeAudio() { suspended = false; if (ac) ac.resume(); },
    click() { tone(660, 0.05, 'square', 0.12); },
    swish() { noise(0.32, 0.45, 300, 4200); tone(200, 0.3, 'sawtooth', 0.06, 900); },
    tick() { tone(900, 0.03, 'square', 0.06); },
    whack() { noise(0.35, 0.7, 2400, 120); tone(140, 0.3, 'square', 0.25, 40); },
    scream() { tone(900, 0.9, 'sawtooth', 0.07, 260); tone(1200, 0.9, 'triangle', 0.05, 340, 0.03); },
    coin() { tone(988, 0.06, 'square', 0.09); tone(1319, 0.14, 'square', 0.09, null, 0.06); },
    boing() { tone(220, 0.35, 'sine', 0.25, 900); tone(330, 0.3, 'triangle', 0.1, 1200, 0.03); },
    bonk() { tone(300, 0.15, 'square', 0.18, 90); noise(0.15, 0.3, 1800, 200); },
    pop() { noise(0.12, 0.5, 5000, 800); tone(700, 0.08, 'square', 0.1, 300); },
    rocket() { noise(0.7, 0.35, 600, 3500); tone(120, 0.6, 'sawtooth', 0.12, 500); },
    thud() { noise(0.5, 0.7, 900, 60); tone(90, 0.45, 'sine', 0.35, 35); },
    perfect() { [659, 784, 988, 1319].forEach((f, k) => tone(f, 0.1, 'square', 0.1, null, k * 0.06)); },
    buy() { [523, 659, 784].forEach((f, k) => tone(f, 0.1, 'square', 0.1, null, k * 0.07)); },
    best() { [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => tone(f, 0.14, 'square', 0.11, null, k * 0.08)); }
  };
})();
