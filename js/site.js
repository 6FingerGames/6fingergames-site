/* 6 finger games — small page helpers: gallery (pictures + videos), picture zoom, old #links */
(function(){
  // old links like 6fingergames.com/#online go to the real section page
  var h = location.hash.replace('#', '');
  if(location.pathname === '/' && /^(online|download|soon|contact)$/.test(h)) location.replace('/' + h + '/');

  var view = document.getElementById('view'), lb = document.getElementById('lb'), vbox = document.getElementById('vbox');
  var thumbs = document.querySelectorAll('.shots button');

  // a video loads from YouTube / Vimeo / TikTok only after it is pressed
  function playVideo(el){
    if(!vbox) return;
    var f = document.createElement('iframe');
    f.src = el.getAttribute('data-embed');
    f.title = el.getAttribute('data-label') || 'Video';
    f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    f.className = el.getAttribute('data-vertical') ? 'vertical' : '';
    vbox.innerHTML = '';
    vbox.appendChild(f);
  }
  function showPoster(el){
    if(!vbox) return;
    var a = document.createElement('a');
    a.className = 'vposter'; a.href = '#';
    a.style.backgroundImage = "url('" + el.getAttribute('data-poster') + "')";
    a.innerHTML = '<span class="vplay"></span><span class="vlabel"></span>';
    a.lastChild.textContent = el.getAttribute('data-label') || '';
    a.addEventListener('click', function(e){ e.preventDefault(); playVideo(el); });
    vbox.innerHTML = ''; vbox.appendChild(a);
  }
  function select(btn, autoplay){
    for(var j = 0; j < thumbs.length; j++) thumbs[j].classList.remove('on');
    btn.classList.add('on');
    if(btn.hasAttribute('data-embed')){
      if(view) view.hidden = true;
      vbox.hidden = false;
      autoplay ? playVideo(btn) : showPoster(btn);
    } else {
      if(vbox){ vbox.innerHTML = ''; vbox.hidden = true; } // stops a playing video
      if(view){ view.hidden = false; view.onload = function(){ view.classList.toggle('portrait', view.naturalHeight > view.naturalWidth * 1.05); }; view.src = btn.getAttribute('data-pic'); }
    }
  }
  for(var i = 0; i < thumbs.length; i++) thumbs[i].addEventListener('click', function(){ select(this, true); });

  // YouTube's sharp 1280x720 poster is missing on some videos (it then sends a 120x90 grey picture): use the smaller one
  function sharpOrLow(el, apply){
    var low = el.getAttribute('data-low'); if(!low) return;
    var im = new Image();
    im.onload = function(){ if(im.naturalWidth <= 120) apply(low); };
    im.onerror = function(){ apply(low); };
    im.src = el.getAttribute('data-poster') || el.getAttribute('src');
  }
  var lows = document.querySelectorAll('[data-low]');
  for(var q = 0; q < lows.length; q++) (function(el){
    sharpOrLow(el, function(low){
      el.setAttribute('data-poster', low);
      if(el.tagName === 'IMG') el.src = low;
      else if(el.classList.contains('vposter')) el.style.backgroundImage = "url('" + low + "')";
    });
  })(lows[q]);

  if(vbox){
    var first = vbox.querySelector('.vposter');
    if(first) first.addEventListener('click', function(e){ e.preventDefault(); playVideo(first); });
  }
  var vthumbs = document.querySelectorAll('.shots .vthumb');
  var pb = document.querySelectorAll('[data-playvideo]');
  for(var k = 0; k < pb.length; k++) pb[k].addEventListener('click', function(e){
    var n = +this.getAttribute('data-playvideo'), t = vthumbs[n];
    e.preventDefault();
    if(t) select(t, true); else if(vbox && vbox.firstChild) playVideo(vbox.firstChild);
    document.getElementById('stage').scrollIntoView({ behavior:'smooth', block:'center' });
  });

  if(view && lb){
    view.style.cursor = 'zoom-in';
    view.addEventListener('click', function(){ lb.firstChild.src = view.currentSrc || view.src; lb.classList.add('on'); });
    lb.addEventListener('click', function(){ lb.classList.remove('on'); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') lb.classList.remove('on'); });
  }
})();

/* ===== accounts: registration window + ID card =====
   No server yet (the site is static), so the profile lives in this browser (localStorage).
   FG_SAVE_PROFILE is the ONE place to connect a real backend later (and the HS coin wallet: FG_HS_BALANCE). */
(function(){
  var KEY = 'fg_user';
  var GAMES = window.FG_GAMES || [];
  var AGES = [['u13','Under 13'], ['13-17','13–17'], ['18-24','18–24'], ['25-34','25–34'], ['35+','35 and over']];
  var DEVICES = [['pc','PC'], ['phone','Phone'], ['both','Both']];
  var LANGS = 'en ka ru uk tr de fr es pt it pl ar fa hi zh ja ko id vi th nl cs ro hu el he az hy kk'.split(' ');
  var TYPES = [['casual','Casual'], ['regular','Regular player'], ['hardcore','Hardcore'], ['payer','Payer']];
  var GENDERS = [['male','Male'], ['female','Female'], ['other','Other'], ['none','Prefer not to say']];
  var CODES = 'AF AL DZ AR AM AU AT AZ BH BD BY BE BR BG CA CL CN CO HR CY CZ DK EG EE FI FR GE DE GR HK HU IS IN ID IR IQ IE IL IT JP JO KZ KE KW LV LB LT LU MY MX MD ME MA NL NZ NG NO PK PS PE PH PL PT QA RO RU SA RS SG SK SI ZA KR ES LK SE CH SY TW TH TR UA AE GB US UY UZ VE VN'.split(' ');
  var names = null; try{ names = new Intl.DisplayNames(['en'], {type:'region'}); }catch(e){}
  function lname(c){ try{ return new Intl.DisplayNames(['en'], {type:'language'}).of(c); }catch(e){ return c; } }
  function cname(c){ try{ return names ? names.of(c) : c; }catch(e){ return c; } }
  function lab(list, v){ for(var i=0;i<list.length;i++) if(list[i][0]===v) return list[i][1]; return v || ''; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch(e){ return null; } }
  function save(u){ try{ localStorage.setItem(KEY, JSON.stringify(u)); }catch(e){} }
  // --- connect a backend here later ---
  function FG_SAVE_PROFILE(u){ save(u); if(!u.synced) sync(); }
  /* Sends ONLY the anonymous audience answers (no nickname, no email, no password) to our database.
     Setup: see _tools/supabase.sql. Fill url + key below (the key is the public 'anon' key, safe to show). */
  var FG_BACKEND = { url:'https://utahrvverfexwnoostyo.supabase.co', key:'sb_publishable_tNqXOuGI2orD92iBk0Y9Vw_5RiSdcCD' };
  var syncing = false;
  function sync(){
    var u = load();
    if(!u || u.synced || syncing || !FG_BACKEND.url || !FG_BACKEND.key || !window.fetch) return;
    syncing = true;
    fetch(FG_BACKEND.url + '/rest/v1/profiles', { method:'POST',
      headers:{ 'apikey':FG_BACKEND.key, 'Authorization':'Bearer ' + FG_BACKEND.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
      body:JSON.stringify({ country:u.country, gender:u.gender, age:u.age, lang:u.lang, device:u.device, ptype:u.type, games:u.games }) })
    .then(function(r){ if(r.ok){ u.synced = true; save(u); } syncing = false; })
    .catch(function(){ syncing = false; });
  }
  function FG_HS_BALANCE(){ var n = 0; try{ n = parseInt(localStorage.getItem('fg_hs'), 10) || 0; }catch(e){} return n; }

  var btn = document.getElementById('regBtn');
  if(!btn) return;
  var modal = document.createElement('div');
  modal.className = 'modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
  document.body.appendChild(modal);

  function open(html){ modal.innerHTML = '<div class="mbox"><button class="mclose" type="button" aria-label="Close">&times;</button>' + html + '</div>'; modal.classList.add('on'); document.documentElement.style.overflow = 'hidden'; modal.querySelector('.mclose').onclick = close; }
  function close(){ modal.classList.remove('on'); modal.innerHTML = ''; document.documentElement.style.overflow = ''; }
  modal.addEventListener('mousedown', function(e){ if(e.target === modal) close(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && modal.classList.contains('on')) close(); });

  function refreshBtn(){
    var u = load();
    if(u){ btn.className = 'regbtn in'; btn.innerHTML = esc(u.nick) + ' <span class="hsmini">' + FG_HS_BALANCE() + ' HS</span>'; }
    else { btn.className = 'regbtn'; btn.textContent = 'Register'; }
  }
  btn.addEventListener('click', function(){ load() ? showCard() : showForm(); });

  function opts(list, sel){ return list.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===sel?' selected':'')+'>'+esc(o[1])+'</option>'; }).join(''); }

  function showForm(){
    var cs = CODES.map(function(c){ return [c, cname(c)]; }).sort(function(a,b){ return a[1].localeCompare(b[1]); });
    var ls = LANGS.map(function(c){ return [c, lname(c)]; }).sort(function(a,b){ return a[1].localeCompare(b[1]); });
    function chips(name, list, checkFirst){ return '<div class="chips">' + list.map(function(t,i){ return '<label class="chip"><input type="radio" name="'+name+'" value="'+t[0]+'"'+(checkFirst && i===0?' checked':'')+'><span>'+t[1]+'</span></label>'; }).join('') + '</div>'; }
    open('<h2>Join 6 finger games</h2><p class="msub">Takes 20 seconds. Play, earn HS, keep your profile.</p>' +
      '<form id="rf" novalidate>' +
      '<label class="fld"><span>Nickname</span><input name="nick" maxlength="20" autocomplete="nickname" required></label>' +
      '<div class="row2"><label class="fld"><span>Country</span><select name="country"><option value="">Choose…</option>' + opts(cs) + '</select></label>' +
      '<label class="fld"><span>Gender</span><select name="gender"><option value="">Choose…</option>' + opts(GENDERS) + '</select></label></div>' +
      '<div class="row2"><label class="fld"><span>Age</span><select name="age"><option value="">Choose…</option>' + opts(AGES) + '</select></label>' +
      '<label class="fld"><span>Preferred language</span><select name="lang"><option value="">Choose…</option>' + opts(ls) + '</select></label></div>' +
      '<div class="fldlabel">You play on</div>' + chips('device', DEVICES, true) +
      '<div class="fldlabel">Games you like</div><div class="chips">' + GAMES.map(function(g){ return '<label class="chip"><input type="checkbox" name="games" value="'+esc(g.id)+'"><span>'+esc(g.title)+'</span></label>'; }).join('') + '</div>' +
      '<div class="fldlabel">Player type</div>' + chips('type', TYPES, true) +
      '<div class="row2 soonrow"><label class="fld"><span>Password <em>soon</em></span><input type="password" disabled placeholder="Not needed yet"></label>' +
      '<label class="fld"><span>Email <em>soon</em></span><input type="email" disabled placeholder="Not needed yet"></label></div>' +
      '<div class="msg" id="rmsg" aria-live="polite"></div>' +
      '<button class="btn primary" type="submit">Create profile</button></form>' +
      '<div class="social"><button type="button" id="gbtn" class="gbtn">Continue with Google</button><button type="button" disabled>GitHub<small>soon</small></button><button type="button" disabled>X<small>soon</small></button></div>' +
      '<div class="promise"><b>Our promise</b><p>We do not collect this to sell it or give it to anyone. Never. It has one purpose only: to learn who we should make games for (girls, boys or anyone else) and which countries need their own language in our games.</p><p>We do not care about your real name or surname, your email, or anything private. All we want is that when you visit this site, it fits what you need. That is all.</p></div>');
    var f = document.getElementById('rf'), msg = document.getElementById('rmsg');
    f.nick.focus();
    document.getElementById('gbtn').onclick = function(){ msg.style.color = 'var(--amber)'; msg.textContent = 'Google sign-in is almost ready. For now, create a profile with the form.'; };
    f.age.addEventListener('change', function(){ msg.style.color = ''; msg.textContent = f.age.value === 'u13' ? 'Sorry, profiles are for players aged 13 and over. You can still play every game!' : ''; });
    f.addEventListener('submit', function(e){
      e.preventDefault();
      msg.style.color = '';
      var nick = f.nick.value.trim();
      if(nick.length < 2) return msg.textContent = 'Nickname: at least 2 characters.';
      if(!f.country.value) return msg.textContent = 'Please choose your country.';
      if(!f.gender.value) return msg.textContent = 'Please choose a gender (or "Prefer not to say").';
      if(!f.age.value) return msg.textContent = 'Please choose your age group.';
      if(f.age.value === 'u13') return msg.textContent = 'Sorry, profiles are for players aged 13 and over. You can still play every game!';
      if(!f.lang.value) return msg.textContent = 'Please choose your preferred language.';
      var games = [].map.call(f.querySelectorAll('input[name=games]:checked'), function(i){ return i.value; });
      var pick = function(n){ return f.querySelector('input[name='+n+']:checked').value; };
      FG_SAVE_PROFILE({ nick:nick, country:f.country.value, gender:f.gender.value, age:f.age.value, lang:f.lang.value, device:pick('device'), games:games, type:pick('type'), created:new Date().toISOString(), synced:false });
      refreshBtn(); showCard(true);
    });
  }

  // any picture, any size -> centred square crop, shrunk to AV x AV (stays on this device, never sent to the server)
  var AV = 92;
  function squareAvatar(file, done){
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function(){
      try{
        var side = Math.min(im.naturalWidth, im.naturalHeight), sx = (im.naturalWidth - side) / 2, sy = (im.naturalHeight - side) / 2;
        var c = document.createElement('canvas'); c.width = c.height = AV;
        var x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
        x.drawImage(im, sx, sy, side, side, 0, 0, AV, AV);
        URL.revokeObjectURL(url);
        done(c.toDataURL('image/jpeg', 0.85));
      }catch(e){ URL.revokeObjectURL(url); done(null); }
    };
    im.onerror = function(){ URL.revokeObjectURL(url); done(null); };
    im.src = url;
  }
  var USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.6-4 3.7-6 7.5-6s6.9 2 7.5 6"/></svg>';
  function showCard(fresh){
    var u = load(); if(!u) return showForm();
    var rows = [['nick','Nickname',esc(u.nick),true], ['country','Country',esc(cname(u.country)),false], ['gender','Gender',esc(lab(GENDERS,u.gender)),true], ['age','Age',esc(lab(AGES,u.age)),false], ['lang','Language',esc(lname(u.lang)),false], ['mail','Mail','<span style=\"color:var(--dim)\">soon</span>',false]];
    open('<h2>' + (fresh ? 'Welcome, ' + esc(u.nick) + '!' : 'Your ID card') + '</h2><p class="msub">' + (fresh ? 'Your account is ready.' : 'Player ID') + '</p>' +
      '<div class="idcard"><div class="avatarwrap"><button type="button" class="avatar" id="av" title="Change photo">' + (u.avatar ? '<img alt="" src="' + u.avatar + '">' : USER) + '<span class="avedit">Change</span></button><input type="file" id="avf" accept="image/png,image/jpeg,image/webp,image/gif" hidden><div class="avmsg" id="avm"></div></div><div class="idrows">' +
      rows.map(function(r){ return '<div class="idrow" data-k="'+r[0]+'"><span class="k">'+r[1]+'</span><span class="v">'+r[2]+'</span>' + (r[3] ? '<button type="button" class="ed">edit</button>' : (r[0]==='country' ? '<span class="ed off" title="Country cannot be changed">edit</span>' : '')) + '</div>'; }).join('') +
      '</div></div>' +
      '<div class="earned"><span class="lbl">Earned</span><span class="hscoin">HS</span><span class="amt">' + FG_HS_BALANCE() + '</span></div>' +
      '<div class="idactions"><button type="button" class="mlink" id="lo">Log out</button><button type="button" class="mlink" id="ok">Close</button></div>');
    document.getElementById('ok').onclick = close;
    var avf = document.getElementById('avf'), avm = document.getElementById('avm');
    document.getElementById('av').onclick = function(){ avf.click(); };
    avf.onchange = function(){
      var file = avf.files && avf.files[0]; if(!file) return;
      if(!(file.type && ['image/png','image/jpeg','image/webp','image/gif'].indexOf(file.type) >= 0)){ avm.textContent = 'Please choose a PNG, JPG, WEBP or GIF picture.'; return; }
      avm.textContent = '';
      squareAvatar(file, function(data){
        if(!data){ avm.textContent = 'Could not read this picture. Try another one.'; return; }
        var cur = load(); if(!cur) return; cur.avatar = data; save(cur); showCard();
      });
    };
    document.getElementById('lo').onclick = function(){ try{ localStorage.removeItem(KEY); }catch(e){} refreshBtn(); close(); };
    [].forEach.call(modal.querySelectorAll('.idrow .ed:not(.off)'), function(b){
      b.onclick = function(){
        var row = b.parentNode, k = row.getAttribute('data-k'), v = row.querySelector('.v'), cur = load();
        var inp = k === 'gender' ? document.createElement('select') : document.createElement('input');
        if(k === 'gender') inp.innerHTML = opts(GENDERS, cur.gender); else { inp.value = cur[k]; inp.maxLength = k === 'nick' ? 20 : 80; if(k==='mail') inp.type = 'email'; }
        row.replaceChild(inp, v); b.textContent = 'save'; inp.focus();
        function done(){
          var val = inp.value.trim();
          if(k === 'nick' && val.length < 2) return inp.focus();
          if(k === 'mail' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) return inp.focus();
          cur[k] = val; FG_SAVE_PROFILE(cur); refreshBtn(); showCard();
        }
        b.onclick = done; inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') done(); });
      };
    });
  }
  refreshBtn(); sync();
})();
