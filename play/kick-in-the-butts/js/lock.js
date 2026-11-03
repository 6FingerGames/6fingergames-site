// Domain lock: the game only runs on the allowed hosts, both as a page and when framed.
const Lock = (() => {
  const L = KICK_CONFIG.lock;
  const hostOK = (h) => L.hosts.indexOf(h) !== -1 || (L.allowLocalhost && (h === 'localhost' || h === '127.0.0.1'));

  function framedOK() {
    if (window.top === window.self) return true;
    try { return hostOK(window.top.location.hostname); } catch (e) {}
    try {
      const ao = location.ancestorOrigins;
      if (ao && ao.length) {
        for (let i = 0; i < ao.length; i++) if (!hostOK(new URL(ao[i]).hostname)) return false;
        return true;
      }
    } catch (e) {}
    try { if (document.referrer) return hostOK(new URL(document.referrer).hostname); } catch (e) {}
    return false;
  }

  function ok() { return hostOK(location.hostname) && framedOK(); }

  function block() {
    document.documentElement.innerHTML =
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kick in the Butts</title></head>' +
      '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#04051a;' +
      'color:#d8fbff;font-family:Courier New,monospace;text-align:center;padding:24px;box-sizing:border-box">' +
      '<div><h1 style="color:#ffd23a;text-shadow:0 0 16px #ff8a1a;margin:0 0 18px">KICK IN THE BUTTS</h1>' +
      '<p style="margin:0 0 22px;font-size:18px">This game can only be played on</p>' +
      '<a href="' + L.url + '" target="_top" style="color:#19e6ff;font-size:24px;text-shadow:0 0 12px #19e6ff">' +
      L.url.replace('https://', '') + '</a></div></body>';
  }

  return { ok, block };
})();
