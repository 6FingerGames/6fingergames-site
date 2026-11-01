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
      if(view){ view.hidden = false; view.src = btn.getAttribute('data-pic'); }
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
    view.addEventListener('click', function(){ lb.firstChild.src = view.src; lb.classList.add('on'); });
    lb.addEventListener('click', function(){ lb.classList.remove('on'); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') lb.classList.remove('on'); });
  }
})();
