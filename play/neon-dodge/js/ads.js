// Google AdSense "H5 Games Ads" (Ad Placement API) wrapper.
// - interstitial: only between runs, rate limited (see NEON_CONFIG.ads)
// - rewarded: optional "revive" button, the player decides
const Ads = (() => {
  const cfg = NEON_CONFIG.ads;
  let id = (cfg.publisherId || '').trim();
  if (/^pub-\d+$/.test(id)) id = 'ca-' + id;
  const enabled = /^ca-pub-\d{8,}$/.test(id);

  let ready = false;
  let lastAdAt = Date.now();
  let runsDone = 0, runsSinceAd = 0;
  let rewardFn = null;

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

    canOfferReward() { return enabled && ready && cfg.rewardedRevive; },

    offerReward(onReady, onGranted) {
      if (!this.canOfferReward()) return;
      rewardFn = null;
      window.adBreak({
        type: 'reward',
        name: 'revive',
        beforeAd: () => Sound.suspend(),
        afterAd: adShown,
        beforeReward: (showAdFn) => { rewardFn = showAdFn; onReady(); },
        adViewed: onGranted,
        adDismissed: () => {},
        adBreakDone: () => { rewardFn = null; }
      });
    },

    showReward() {
      if (rewardFn) { const f = rewardFn; rewardFn = null; f(); }
    },

    cancelReward() { rewardFn = null; }
  };
})();
