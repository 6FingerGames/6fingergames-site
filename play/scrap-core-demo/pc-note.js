// SCRAP CORE Demo on 6fingergames.com: on a phone or tablet, say once that the game is made for keyboard and mouse.
// The player can still go on (moving with a finger works), or go back to the other games.
(function () {
  try {
    var touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
    if (!touchOnly) return;
    try { if (sessionStorage.getItem('scPcNote')) return; } catch (e) {}
    var ka = /^ka/i.test(navigator.language || '');
    var T = ka
      ? { h: 'ეს თამაში კომპიუტერისთვისაა', p: 'SCRAP CORE კლავიატურით და მაუსით ითამაშება. ტელეფონზეც გაიხსნება და თითით ამოძრავებ, მაგრამ ეკრანზე ღილაკები არ აქვს, ამიტომ ბევრად რთულია.', go: 'მაინც ვითამაშებ', back: 'სხვა თამაშები' }
      : { h: 'Made for a computer', p: 'SCRAP CORE is played with keyboard and mouse. It opens on a phone and you can steer with your finger, but there are no on-screen controls, so it is much harder.', go: 'Play anyway', back: 'Other games' };
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(16,22,31,.82);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif');
    box.innerHTML = '<div style="max-width:380px;background:#f6f0df;color:#1a3a78;border-radius:14px;padding:22px 20px;text-align:center;box-shadow:0 18px 40px rgba(0,0,0,.4)">' +
      '<div data-h style="font-size:20px;font-weight:800;margin-bottom:8px"></div><p data-p style="margin:0 0 18px"></p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<button type="button" data-go style="font:inherit;font-weight:700;border:0;border-radius:10px;padding:11px 18px;background:#d7444b;color:#fff;cursor:pointer"></button>' +
      '<a data-back href="/online/" style="font-weight:700;border-radius:10px;padding:11px 18px;background:#e8ddc6;color:#1a3a78;text-decoration:none"></a></div></div>';
    box.querySelector('[data-h]').textContent = T.h;
    box.querySelector('[data-p]').textContent = T.p;
    box.querySelector('[data-go]').textContent = T.go;
    box.querySelector('[data-back]').textContent = T.back;
    var stop = function (e) { e.stopPropagation(); };
    ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach(function (t) { box.addEventListener(t, stop); });
    box.querySelector('[data-go]').addEventListener('click', function () {
      try { sessionStorage.setItem('scPcNote', '1'); } catch (e) {}
      box.remove();
    });
    (document.body || document.documentElement).appendChild(box);
  } catch (e) {}
})();
