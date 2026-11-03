const Store = {
  get(k, d) { try { const v = localStorage.getItem('defend.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('kick.' + k, v); } catch (e) {} }
};

const Sound = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = Store.get('muted', '0') === '1';
  let suspended = false;

  // music: WebAudio buffers so the loop point is sample-accurate (no gap)
  const TRACKS = DEFEND_CONFIG.music || [];
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
        // dreamy echo: a low-passed feedback delay on everything
        const dl = ac.createDelay(1); dl.delayTime.value = 0.29;
        const fb = ac.createGain(); fb.gain.value = 0.42;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        const wet = ac.createGain(); wet.gain.value = 0.38;
        master.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(ac.destination);
        mGain = ac.createGain();
        mGain.gain.value = mTarget();
        mGain.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended' && !suspended) ac.resume();
    if (ac && !amb) startAmbient();
  }

  // a very quiet, slowly breathing pad (A minor), so the dark never feels empty
  let amb = null;
  function startAmbient() {
    amb = ac.createGain();
    amb.gain.value = muted ? 0 : 0.045;
    const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 700;
    amb.connect(lpf); lpf.connect(ac.destination);
    [110, 164.81, 220, 261.63, 329.63].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * (1 + (i % 2 ? 0.002 : -0.002));
      g.gain.value = 0.18;
      l.frequency.value = 0.05 + i * 0.023; lg.gain.value = 0.16;
      l.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(amb);
      o.start(); l.start();
    });
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
      if (amb) amb.gain.value = muted ? 0 : 0.045;
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
    amb: (v) => { if (amb) amb.gain.value = muted ? 0 : v; },
    resumeAudio() { suspended = false; if (ac) ac.resume(); },
    click() { tone(523, 0.08, 'sine', 0.07); },
    block() { tone(1568, 0.28, 'sine', 0.08); tone(2349, 0.22, 'sine', 0.04, null, 0.02); },
    pop() { noise(0.28, 0.1, 2600, 300); tone(392, 0.22, 'sine', 0.07, 196); },
    hurt() { tone(110, 0.55, 'sine', 0.26, 52); tone(220, 0.4, 'triangle', 0.07, 110); noise(0.3, 0.08, 600, 80); },
    thump() { tone(80, 0.25, 'sine', 0.2, 40); },
    split() { tone(880, 0.3, 'sine', 0.06); tone(1175, 0.3, 'sine', 0.05, null, 0.06); },
    wave() { [392, 494, 587, 784].forEach((f, k) => tone(f, 0.5, 'sine', 0.07, null, k * 0.11)); },
    boss() { tone(62, 1.4, 'sine', 0.22, 44); tone(93, 1.2, 'triangle', 0.07, 62); noise(1.0, 0.06, 400, 60); },
    orb() { tone(1175, 0.4, 'sine', 0.07); tone(1568, 0.5, 'sine', 0.06, null, 0.08); },
    crystal(step) {
      const sc = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5], f = sc[Math.min(sc.length - 1, step | 0)];
      tone(f, 0.45, 'sine', 0.075); tone(f * 2, 0.3, 'sine', 0.025);
    },
    revive() { [392, 494, 587, 784, 988, 1175].forEach((f, k) => tone(f, 0.6, 'sine', 0.07, null, k * 0.09)); },
    over() { [523, 440, 392, 294].forEach((f, k) => tone(f, 0.8, 'sine', 0.08, null, k * 0.22)); },
    buy() { [587, 784, 988].forEach((f, k) => tone(f, 0.45, 'sine', 0.08, null, k * 0.08)); },
    best() { [523, 659, 784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.55, 'sine', 0.07, null, k * 0.09)); }
  };
})();
