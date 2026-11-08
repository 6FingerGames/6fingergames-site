/* 6 Finger Games - shared rewarded-ads module (draft v1)
 *
 * RULES (hard):
 *  - Ads NEVER start on their own. Only call Ads.reward() from a button the player pressed.
 *  - The reward is granted ONLY when the ad was really watched ({ok:true}).
 *  - If no ad is available we say so honestly ({ok:false, reason:'unavailable'}). Never reward silently.
 *
 * Providers:
 *  'h5'   - Google H5 Games Ads (adBreak type:'reward'). Turn on after H5 approval:  Ads.configure({provider:'h5'})
 *  'test' - dev simulation. Allowed ONLY on localhost. Never on the live site.
 *  'none' - no ads (default on the live site until H5 is approved).
 *
 * Usage:
 *   const r = await Ads.reward('free_egg');   // r = {ok:boolean, reason?:string}
 */
const Ads = (() => {
  const cfg = {
    provider: 'auto',                       // 'auto' | 'h5' | 'test' | 'none'
    publisherId: 'ca-pub-5964766767830645',
    testMode: false,                        // data-adbreak-test="on" for h5 while testing
    onStart: () => {}, onEnd: () => {}      // e.g. mute / unmute game audio
  };
  // The fake test ad is allowed on localhost ONLY. (A URL switch would let any visitor claim rewards without watching.)
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  let h5Loaded = false, busy = false;

  function provider() {
    if (cfg.provider === 'h5') return 'h5';
    if (cfg.provider === 'test') return isLocal ? 'test' : 'none';
    if (cfg.provider === 'none') return 'none';
    return isLocal ? 'test' : 'none';       // auto
  }

  function loadH5() {
    if (h5Loaded) return;
    h5Loaded = true;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.publisherId;
    if (cfg.testMode) s.setAttribute('data-adbreak-test', 'on');
    document.head.appendChild(s);
    window.adConfig({ sound: 'on', preloadAdBreaks: 'on' });
  }

  function rewardH5(name) {
    loadH5();
    return new Promise(resolve => {
      let viewed = false, started = false, done = false;
      const fin = r => { if (done) return; done = true; clearTimeout(to); if (started) cfg.onEnd(); resolve(r); };
      const to = setTimeout(() => fin({ ok: false, reason: 'unavailable' }), 6000);
      window.adBreak({
        type: 'reward',
        name,
        beforeReward: showAd => { clearTimeout(to); showAd(); },
        beforeAd: () => { started = true; cfg.onStart(); },
        adViewed: () => { viewed = true; },
        adDismissed: () => { viewed = false; },
        afterAd: () => {},
        adBreakDone: info => {
          if (viewed) return fin({ ok: true });
          const st = info && info.breakStatus;
          fin({ ok: false, reason: (st === 'dismissed') ? 'dismissed' : 'unavailable' });
        }
      });
    });
  }

  function rewardTest() {
    return new Promise(resolve => {
      cfg.onStart();
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000d;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;font:700 18px system-ui;text-align:center;padding:24px';
      let left = 3;
      o.innerHTML = '<div style="font-size:13px;opacity:.7">DEV TEST AD (simulation, localhost only)</div><div id="adn" style="font-size:56px">3</div><button id="adx" style="padding:10px 18px;border-radius:12px;border:0;font:inherit;opacity:.8">Close (no reward)</button>';
      document.body.appendChild(o);
      const end = r => { clearInterval(t); o.remove(); cfg.onEnd(); resolve(r); };
      const t = setInterval(() => {
        left--; o.querySelector('#adn').textContent = left > 0 ? left : '✓';
        if (left <= 0) setTimeout(() => end({ ok: true }), 350), clearInterval(t);
      }, 1000);
      o.querySelector('#adx').onclick = () => end({ ok: false, reason: 'dismissed' });
    });
  }

  return {
    configure(o) { Object.assign(cfg, o || {}); },
    available() { return provider() !== 'none'; },
    mode() { return provider(); },
    async reward(name) {
      if (busy) return { ok: false, reason: 'busy' };
      const p = provider();
      if (p === 'none') return { ok: false, reason: 'unavailable' };
      busy = true;
      let guard;                                       // never stay "busy" forever if a provider never answers
      const stuck = new Promise(res => { guard = setTimeout(() => res({ ok: false, reason: 'unavailable', stuck: true }), 180000); });
      try {
        const r = await Promise.race([p === 'h5' ? rewardH5(name) : rewardTest(), stuck]);
        if (r.stuck) cfg.onEnd();
        return r;
      }
      catch (e) { return { ok: false, reason: 'unavailable' }; }
      finally { clearTimeout(guard); busy = false; }
    }
  };
})();
