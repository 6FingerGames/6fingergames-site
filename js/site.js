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
  var TYPES = [['casual','Casual'], ['regular','Regular player'], ['hardcore','Hardcore'], ['payer','Payer']];
  var GENDERS = [['male','Male'], ['female','Female'], ['other','Other'], ['none','Prefer not to say']];
  var CODES = 'AF AL DZ AR AM AU AT AZ BH BD BY BE BR BG CA CL CN CO HR CY CZ DK EG EE FI FR GE DE GR HK HU IS IN ID IR IQ IE IL IT JP JO KZ KE KW LV LB LT LU MY MX MD ME MA NL NZ NG NO PK PS PE PH PL PT QA RO RU SA RS SG SK SI ZA KR ES LK SE CH SY TW TH TR UA AE GB US UY UZ VE VN'.split(' ');
  var names = null; try{ names = new Intl.DisplayNames(['en'], {type:'region'}); }catch(e){}
  function cname(c){ try{ return names ? names.of(c) : c; }catch(e){ return c; } }
  function lab(list, v){ for(var i=0;i<list.length;i++) if(list[i][0]===v) return list[i][1]; return v || ''; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)); }catch(e){ return null; } }
  function save(u){ try{ localStorage.setItem(KEY, JSON.stringify(u)); }catch(e){} }
  // --- connect a backend here later ---
  function FG_SAVE_PROFILE(u){ save(u); }
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
    open('<h2>Join 6 finger games</h2><p class="msub">Takes 20 seconds. Play, earn HS, keep your profile.</p>' +
      '<form id="rf" novalidate>' +
      '<label class="fld"><span>Nickname</span><input name="nick" maxlength="20" autocomplete="nickname" required></label>' +
      '<div class="row2"><label class="fld"><span>Country</span><select name="country"><option value="">Choose…</option>' + opts(cs) + '</select></label>' +
      '<label class="fld"><span>Gender</span><select name="gender"><option value="">Choose…</option>' + opts(GENDERS) + '</select></label></div>' +
      '<div class="fldlabel">Games you like</div><div class="chips">' + GAMES.map(function(g){ return '<label class="chip"><input type="checkbox" name="games" value="'+esc(g.id)+'"><span>'+esc(g.title)+'</span></label>'; }).join('') + '</div>' +
      '<div class="fldlabel">Player type</div><div class="chips">' + TYPES.map(function(t,i){ return '<label class="chip"><input type="radio" name="type" value="'+t[0]+'"'+(i===0?' checked':'')+'><span>'+t[1]+'</span></label>'; }).join('') + '</div>' +
      '<div class="row2"><label class="fld"><span>Password</span><input name="pass" type="password" autocomplete="new-password" minlength="6"></label>' +
      '<label class="fld"><span>Email</span><input name="mail" type="email" autocomplete="email"></label></div>' +
      '<div class="msg" id="rmsg" aria-live="polite"></div>' +
      '<button class="btn primary" type="submit">Create account</button></form>' +
      '<div class="social"><button type="button" disabled>Google<small>soon</small></button><button type="button" disabled>GitHub<small>soon</small></button><button type="button" disabled>X<small>soon</small></button></div>' +
      '<p class="mnote">We only use this to learn which games and languages our players want. We never sell it.</p>');
    var f = document.getElementById('rf'), msg = document.getElementById('rmsg');
    f.nick.focus();
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var nick = f.nick.value.trim(), mail = f.mail.value.trim(), pass = f.pass.value;
      if(nick.length < 2) return msg.textContent = 'Nickname: at least 2 characters.';
      if(!f.country.value) return msg.textContent = 'Please choose your country.';
      if(!f.gender.value) return msg.textContent = 'Please choose a gender (or "Prefer not to say").';
      if(pass.length < 6) return msg.textContent = 'Password: at least 6 characters.';
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return msg.textContent = 'Please enter a valid email.';
      var games = [].map.call(f.querySelectorAll('input[name=games]:checked'), function(i){ return i.value; });
      var type = f.querySelector('input[name=type]:checked').value;
      hash(pass).then(function(h){
        FG_SAVE_PROFILE({ nick:nick, country:f.country.value, gender:f.gender.value, games:games, type:type, mail:mail, pass:h, created:new Date().toISOString() });
        refreshBtn(); showCard(true);
      });
    });
  }
  function hash(s){
    try{
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode('6fg:' + s)).then(function(b){ return [].map.call(new Uint8Array(b), function(x){ return ('0'+x.toString(16)).slice(-2); }).join(''); });
    }catch(e){ return Promise.resolve(''); }
  }

  var USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.6-4 3.7-6 7.5-6s6.9 2 7.5 6"/></svg>';
  function showCard(fresh){
    var u = load(); if(!u) return showForm();
    var rows = [['nick','Nickname',esc(u.nick),true], ['country','Country',esc(cname(u.country)),false], ['gender','Gender',esc(lab(GENDERS,u.gender)),true], ['mail','Mail',esc(u.mail),true]];
    open('<h2>' + (fresh ? 'Welcome, ' + esc(u.nick) + '!' : 'Your ID card') + '</h2><p class="msub">' + (fresh ? 'Your account is ready.' : 'Player ID') + '</p>' +
      '<div class="idcard"><div class="avatar">' + USER + '</div><div class="idrows">' +
      rows.map(function(r){ return '<div class="idrow" data-k="'+r[0]+'"><span class="k">'+r[1]+'</span><span class="v">'+r[2]+'</span>' + (r[3] ? '<button type="button" class="ed">edit</button>' : '<span class="ed off" title="Country cannot be changed">edit</span>') + '</div>'; }).join('') +
      '</div></div>' +
      '<div class="earned"><span class="lbl">Earned</span><span class="hscoin">HS</span><span class="amt">' + FG_HS_BALANCE() + '</span></div>' +
      '<div class="idactions"><button type="button" class="mlink" id="lo">Log out</button><button type="button" class="mlink" id="ok">Close</button></div>');
    document.getElementById('ok').onclick = close;
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
  refreshBtn();
})();
