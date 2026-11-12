// Domain lock: the game only runs on the allowed hosts, both as a page and when framed.
const Lock = (() => {
  const L = CFG.lock;
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
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + CFG.title + '</title></head>' +
      '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#ffe3ef;' +
      'color:#5b3550;font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box">' +
      '<div><h1 style="margin:0 0 18px">' + CFG.title + '</h1>' +
      '<p style="margin:0 0 22px;font-size:18px">This game can only be played on</p>' +
      '<a href="' + L.url + '" target="_top" style="color:#e0407f;font-size:24px;font-weight:700">' +
      L.url.replace('https://', '') + '</a></div></body>';
  }

  return { ok, block };
})();
