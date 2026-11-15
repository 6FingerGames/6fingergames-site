/* HARD STEEL COIN (HS) client (2026-11-15): the ONE place where the site and the games talk to the HS wallet.
   The wallet lives on our server (Supabase, see _tools/hs/hs-wallet.sql); this file only asks it. The server decides how
   much is really paid (per-minute and daily limits), so nothing in this file or in localStorage can add HS.

   For games (all calls are safe: they never throw, and do nothing while the game does not pay HS):
     FGHS.start()        a run begins (the paid clock starts)
     FGHS.earn(n)        the run earned n HS (at the end of a wave / level / run) -> Promise {paid, balance}
     FGHS.ad()           a rewarded ad was watched to the end (fgads-core.js calls this by itself) -> {paid, balance}
     FGHS.buy(item)      spend HS on an item (real accounts only) -> {balance, key} or {error}
     FGHS.balance()      -> Promise<number>;  FGHS.cached() -> the last known number at once
   The game id is taken from the address (/play/<game>/); pass it as the last argument to override.
   Every balance change fires window event 'fghs:balance' (detail = the new number).

   A visitor gets a wallet only when a game that pays HS starts: then they are signed in anonymously, behind a
   Cloudflare Turnstile check that is invisible for almost everyone. Browsing the site creates nothing. */
(function(){
  if(window.FGHS) return;
  var API = 'https://utahrvverfexwnoostyo.supabase.co';
  var KEY = 'sb_publishable_tNqXOuGI2orD92iBk0Y9Vw_5RiSdcCD';   // public key, safe to show
  var SITEKEY = '0x4AAAAAAGBtgHQ2blDS1nDH';                        // Turnstile public site key
  var S_KEY = 'fg_hs_session', B_KEY = 'fg_hs_balance';

  function get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
  function put(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function gameId(g){ if(g) return g; var m = /^\/play\/([a-z0-9-]+)\//.exec(location.pathname); return m ? m[1] : ''; }

  var last = parseInt(get(B_KEY), 10) || 0;
  function setBalance(n){
    n = Math.max(0, parseInt(n, 10) || 0);
    if(n !== last){ last = n; put(B_KEY, n); }
    try{ window.dispatchEvent(new CustomEvent('fghs:balance', { detail:n })); }catch(e){}
    return n;
  }

  function call(path, opt, token){
    opt = opt || {};
    var h = { 'apikey':KEY, 'Authorization':'Bearer ' + (token || KEY), 'Content-Type':'application/json' };
    return fetch(API + path, { method:opt.method || 'GET', headers:h, body:opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function(r){ return r.text().then(function(t){ var d = null; try{ d = t ? JSON.parse(t) : null; }catch(e){}
        if(!r.ok){ var err = new Error((d && (d.msg || d.message || d.error_description)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
        return d; }); });
  }

  // ---- Cloudflare Turnstile: its script is loaded only when a wallet is first made ----
  var tsScript = null;
  function captcha(){
    tsScript = tsScript || new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
      s.onload = res; s.onerror = function(){ tsScript = null; rej(new Error('captcha script')); };
      document.head.appendChild(s);
    });
    return tsScript.then(function(){ return new Promise(function(res, rej){
      // almost always invisible; if Cloudflare wants a click, the small box shows in the corner
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000';
      document.body.appendChild(box);
      var id, over = false, errors = 0;
      function end(){ if(over) return false; over = true; clearTimeout(t); try{ window.turnstile.remove(id); }catch(e){} box.remove(); return true; }
      var t = setTimeout(function(){ if(end()) rej(new Error('captcha timeout')); }, 120000);
      // Turnstile retries by itself after an error; give up only after a few in a row (or the timeout above)
      id = window.turnstile.render(box, { sitekey:SITEKEY, appearance:'interaction-only', action:'hs-wallet',
        callback:function(tok){ if(end()) res(tok); },
        'error-callback':function(code){ if(++errors >= 4 && end()) rej(new Error('captcha ' + code)); return true; },
        'expired-callback':function(){ if(end()) rej(new Error('captcha expired')); } });
    }); });
  }

  // ---- the session (shared by every tab and every game on this site) ----
  function keep(d){
    var s = { access:d.access_token, refresh:d.refresh_token, exp:d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)),
              uid:d.user && d.user.id, anon:!!(d.user && d.user.is_anonymous) };
    put(S_KEY, s); return s;
  }
  var busy = null;
  function session(make){
    if(busy) return busy;
    var s = get(S_KEY);
    if(s && s.exp * 1000 > Date.now() + 60000) return Promise.resolve(s);
    if(!s && !make) return Promise.resolve(null);
    busy = (s ? call('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token:s.refresh } }).then(keep)
                  .catch(function(e){
                    var now = get(S_KEY);                       // another tab may have refreshed it meanwhile
                    if(now && now.exp * 1000 > Date.now() + 60000) return now;
                    if(e.status === 400 || e.status === 401){ put(S_KEY, null); return make ? signIn() : null; }
                    throw e;
                  })
              : signIn());
    return busy.then(function(v){ busy = null; return v; }, function(e){ busy = null; throw e; });
  }
  function signIn(){
    return captcha().then(function(tok){
      return call('/auth/v1/signup', { method:'POST', body:{ data:{}, gotrue_meta_security:{ captcha_token:tok } } });
    }).then(keep);
  }
  function rpc(name, args){
    return session(true).then(function(s){ return call('/rest/v1/rpc/' + name, { method:'POST', body:args }, s.access); });
  }

  // ---- which games pay HS (public list, read without signing in) ----
  var paying = {};
  function pays(g){
    if(!g) return Promise.resolve(false);
    if(paying[g] && paying[g].t > Date.now() - 600000) return Promise.resolve(paying[g].on);
    return call('/rest/v1/hs_games?select=game&game=eq.' + encodeURIComponent(g))
      .then(function(rows){ var on = !!(rows && rows.length); paying[g] = { on:on, t:Date.now() }; return on; })
      .catch(function(){ return false; });
  }
  var started = {};
  function quiet(p){ return p.catch(function(e){ return { paid:0, error:String(e && e.message || e) }; }); }
  function paid(r){ var row = Array.isArray(r) ? r[0] : r; return { paid:(row && row.paid) || 0, balance:setBalance(row && row.balance) }; }

  var FGHS = {
    cached:function(){ return last; },
    balance:function(){
      return session(false).then(function(s){
        if(!s) return setBalance(0);
        return call('/rest/v1/hs_wallets?select=balance', {}, s.access).then(function(rows){ return setBalance(rows && rows[0] ? rows[0].balance : 0); });
      }).catch(function(){ return last; });
    },
    start:function(game){
      var g = gameId(game);
      return quiet(pays(g).then(function(on){
        if(!on) return { active:false };
        return rpc('hs_start', { p_game:g }).then(function(){ started[g] = true; return { active:true }; });
      }));
    },
    earn:function(amount, game){
      var g = gameId(game);
      if(!started[g] || !(amount > 0)) return Promise.resolve({ paid:0, balance:last });
      return quiet(rpc('hs_earn', { p_game:g, p_amount:Math.floor(amount) }).then(paid));
    },
    ad:function(game){
      var g = gameId(game);
      return quiet(pays(g).then(function(on){ if(!on) return { paid:0, balance:last }; return rpc('hs_ad', { p_game:g }).then(paid); }));
    },
    buy:function(item){
      return rpc('hs_buy', { p_item:item }).then(function(r){ var row = Array.isArray(r) ? r[0] : r;
        return { balance:setBalance(row && row.balance), key:(row && row.key_code) || null }; })
        .catch(function(e){ return { error:String(e && e.message || e) }; });
    },
    signedIn:function(){ return !!get(S_KEY); }
  };
  window.FGHS = FGHS;

  // rewarded ads from fgads-core.js: a watched ad pays HS (keeps any hook that was there before)
  var before = window.FG_AD_EVENT;
  window.FG_AD_EVENT = function(kind, name, totals){
    try{ if(typeof before === 'function') before(kind, name, totals); }catch(e){}
    if(kind === 'watched') FGHS.ad();
  };
  // another tab changed the balance
  window.addEventListener('storage', function(e){ if(e.key === B_KEY){ last = parseInt(get(B_KEY), 10) || 0; setBalance(last); } });
})();
