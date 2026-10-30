// Lightweight deterrent: exact host allowlist and foreign-frame blocking.
// Server-side frame-ancestors headers should also be configured on the host.
(() => {
  "use strict";

  const productionHosts = new Set([
    "6fingergames.com",
    "www.6fingergames.com"
  ]);
  const developmentHosts = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]"
  ]);

  const host = location.hostname.toLowerCase();
  const localDevelopment = developmentHosts.has(host);
  let foreignFrame = false;

  if (window.top !== window.self) {
    try {
      const topHost = window.top.location.hostname.toLowerCase();
      const ownProductionFrame = productionHosts.has(topHost);
      const ownDevelopmentFrame = localDevelopment && developmentHosts.has(topHost);
      foreignFrame = !ownProductionFrame && !ownDevelopmentFrame;
    } catch (_) {
      // Cross-origin access being denied means another site owns the top frame.
      foreignFrame = true;
    }
  }

  const granted = (productionHosts.has(host) || localDevelopment) && !foreignFrame;
  Object.defineProperty(window, "__FM_ACCESS_GRANTED__", {
    value: granted,
    writable: false,
    configurable: false
  });

  if (granted) return;

  document.documentElement.style.display = "none";
  window.stop();
  throw new Error("Fruit Merge is available only on 6FingerGames.com.");
})();
