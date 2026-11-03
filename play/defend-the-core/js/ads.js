// Google AdSense "H5 Games Ads" (Ad Placement API) wrapper.
// - interstitial: only between runs, rate limited (see DEFEND_CONFIG.ads)
// - rewarded: only when the player presses a "watch ad" button (coins x2, free upgrade, shoes)
const Ads = (() => {
  const cfg = DEFEND_CONFIG.ads;
  let id = (cfg.publisherId || '').trim();
  if (/^pub-\d+$/.test(id)) id = 'ca-' + id;
  const enabled = /^ca-pub-\d{8,}$/.test(id);

  let ready = false;
  let lastAdAt = Date.now();
  let runsDone = 0, runsSinceAd = 0;

  function init() {
    if (!enabled) return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + id;
    s.setAttribute('data-ad-frequency-hint', cfg.minSecondsBetween + 's');
    if (cfg.testMode) s.setAttribute('data-adbreak-test', 'on');
    s.onerror = () => { ready = false; };
    document.head.appendChild(s);
    window.adConfig({ sound: 'on', preloadAdBreaks: 'on', onReady: () => { ready = true; } });
  }

  function shouldShowInterstitial() {
    return enabled && ready &&
      runsDone >= cfg.minRuns &&
      runsSinceAd >= cfg.everyNthRun &&
      Date.now() - lastAdAt >= cfg.minSecondsBetween * 1000;
  }

  function adShown() {
    Sound.resumeAudio();
    lastAdAt = Date.now();
    runsSinceAd = 0;
  }

  // stand-in for a rewarded ad on local machines, where no real ad can be served
  function fakeAd(done) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.85);color:#fff;display:flex;align-items:center;justify-content:center;font:700 26px Arial,sans-serif';
    let n = 2;
    const tick = () => {
      d.textContent = 'TEST AD ' + n + '...';
      if (n-- <= 0) { d.remove(); done(); } else setTimeout(tick, 700);
    };
    document.body.appendChild(d);
    tick();
  }

  return {
    enabled,
    init,
    runFinished() { runsDone++; runsSinceAd++; },

    // calls done() when the next run may start; shows an ad first only if the limits allow it
    beforeRun(done) {
      if (!shouldShowInterstitial()) { done(); return; }
      let finished = false, showing = false;
      const fin = () => { if (finished) return; finished = true; clearTimeout(to); done(); };
      const to = setTimeout(() => { if (!showing) fin(); }, 3000);
      window.adBreak({
        type: 'next',
        name: 'next-run',
        beforeAd: () => { showing = true; Sound.suspend(); },
        afterAd: adShown,
        adBreakDone: fin
      });
    },

    // can a rewarded ad be shown right now? (the UI hides the "watch ad" buttons when not)
    canReward() { return (enabled && ready) || (cfg.testMode && !(enabled && ready)); },

    // plays a rewarded ad and calls onGranted only if the player watched it to the end
    watch(name, onGranted, onFail) {
      if (!this.canReward()) { if (onFail) onFail(); return; }
      if (!(enabled && ready)) { fakeAd(onGranted); return; }
      let granted = false, over = false;
      const fail = () => { if (over || granted) return; over = true; if (onFail) onFail(); };
      window.adBreak({
        type: 'reward',
        name,
        beforeAd: () => Sound.suspend(),
        afterAd: adShown,
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: () => { granted = true; onGranted(); },
        adDismissed: fail,
        adBreakDone: fail
      });
    }
  };
})();
