const Store = {
  get(k, d) { try { const v = localStorage.getItem('neondodge.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('neondodge.' + k, v); } catch (e) {} }
};

const Sound = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = Store.get('muted', '0') === '1';
  let suspended = false;

  // music: WebAudio buffers so the loop point is sample-accurate (no gap)
  const TRACKS = NEON_CONFIG.music;
  const bufs = {};
  let mGain = null, cur = null, curIdx = -1, duckOn = false, musicToken = 0;
  const MVOL = 0.55, MDUCK = 0.22;
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

  // idx: track number; fromLoop: resume at the loop point (after a revive)
  function playTrack(idx, fromLoop) {
    if (!ac) return;
    const token = ++musicToken;
    stopCur(0);
    curIdx = idx;
    loadTrack(idx).then((buf) => {
      if (!buf || token !== musicToken) return;
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.loopStart = TRACKS[idx].loop;
      s.loopEnd = buf.duration;
      s.connect(mGain);
      const t = ac.currentTime;
      mGain.gain.cancelScheduledValues(t);
      mGain.gain.setValueAtTime(mTarget(), t);
      s.start(0, fromLoop ? TRACKS[idx].loop : 0);
      cur = s;
      const nxt = (idx + 1) % TRACKS.length;
      loadTrack(nxt);
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
    // new run: next track in the cycle, from the start
    musicStart() {
      const last = parseInt(Store.get('track', '-1'), 10);
      const idx = (isNaN(last) ? 0 : last + 1) % TRACKS.length;
      Store.set('track', String(idx));
      playTrack(idx, false);
    },
    musicResume() { if (curIdx >= 0) playTrack(curIdx, true); },
    musicStop(fade) { musicToken++; stopCur(fade || 0); },
    suspend() {
      suspended = true;
      if (ac) ac.suspend();
    },
    resumeAudio() {
      suspended = false;
      if (ac) ac.resume();
    },
    click() { tone(660, 0.05, 'square', 0.12); },
    start() { tone(220, 0.35, 'square', 0.14, 880); tone(440, 0.35, 'triangle', 0.12, 1320, 0.05); },
    collect(combo) {
      const base = 880 * Math.pow(1.0595, Math.min(combo, 8) * 2);
      tone(base, 0.07, 'square', 0.14);
      tone(base * 1.5, 0.12, 'square', 0.13, null, 0.07);
    },
    heart() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 'square', 0.13, null, i * 0.07)); },
    hit() { noise(0.35, 0.5, 3200, 160); tone(220, 0.3, 'sawtooth', 0.22, 50); },
    die() { noise(1.0, 0.6, 3600, 80); tone(440, 0.9, 'square', 0.2, 40); tone(330, 0.9, 'sawtooth', 0.15, 30, 0.05); },
    launch() { noise(0.3, 0.25, 500, 3200); tone(180, 0.28, 'sawtooth', 0.12, 720); },
    boom() { noise(0.75, 0.55, 2600, 90); tone(120, 0.5, 'square', 0.2, 35); },
    empty() { tone(200, 0.09, 'square', 0.1, 110); },
    speedUp() { tone(392, 0.09, 'square', 0.12); tone(523, 0.09, 'square', 0.12, null, 0.09); tone(784, 0.16, 'square', 0.12, null, 0.18); }
  };
})();
