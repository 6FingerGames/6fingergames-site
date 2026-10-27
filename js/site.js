/* 6 finger games — small page helpers: screenshot switcher, picture zoom, old #links */
(function(){
  // old links like 6fingergames.com/#online go to the real section page
  var h = location.hash.replace('#', '');
  if(location.pathname === '/' && /^(online|download|soon|contact)$/.test(h)) location.replace('/' + h + '/');

  var view = document.getElementById('view'), lb = document.getElementById('lb');
  var thumbs = document.querySelectorAll('.shots button');
  for(var i = 0; i < thumbs.length; i++) thumbs[i].addEventListener('click', function(){
    for(var j = 0; j < thumbs.length; j++) thumbs[j].classList.remove('on');
    this.classList.add('on');
    if(view) view.src = this.getAttribute('data-pic');
  });
  if(view && lb){
    view.style.cursor = 'zoom-in';
    view.addEventListener('click', function(){ lb.firstChild.src = view.src; lb.classList.add('on'); });
    lb.addEventListener('click', function(){ lb.classList.remove('on'); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') lb.classList.remove('on'); });
  }
})();
