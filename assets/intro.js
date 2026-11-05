/* Animation 3D d'ouverture : cube de formules mathématiques, logo blanc au centre, éléments en orbite.
   Affichée une fois par session. Ajouter ?intro=1 à l'adresse pour la revoir. Aucune bibliothèque : CSS 3D + canvas. */
(function(){
  var root = document.getElementById('intro');
  if (!root) { document.documentElement.classList.remove('intro-on'); return; }
  try { sessionStorage.setItem('bhn_intro', '1'); } catch(e){}

  var T_TITRE = 2.3, T_PRET = 3.6, T_AUTO = 9;
  var P = 900;                                   /* perspective commune (CSS + orbites) */
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  var faces = [
    ['f', 'Algèbre', 'x = (−b ± √Δ) / 2a', 'Δ = b² − 4ac', 1],
    ['r', 'Physique', 'E = mc²', 'F = m · a', 0],
    ['b', 'Analyse', '∫ f(x) dx', 'lim  h→0', 0],
    ['l', 'Géométrie', 'a² + b² = c²', 'A = πr²', 0],
    ['t', 'Chimie', 'n = m / M', 'pH = −log[H⁺]', 0],
    ['d', 'Trigonométrie', 'sin²θ + cos²θ = 1', 'e^(iπ) + 1 = 0', 1]
  ];
  var cubeHtml = faces.map(function(f){ return '<div class="cf cf-' + f[0] + '"><div class="hd"><small>' + f[1] + '</small><b' + (f[4] ? ' class="l"' : '') + '>' + f[2] + '</b></div><em>' + f[3] + '</em></div>'; }).join('');
  root.innerHTML =
    '<canvas id="intro-cv-back"></canvas><div id="intro-halo"></div><div id="intro-pulse"></div><div id="intro-tokens"></div>' +
    '<div id="intro-world"><div id="intro-cube">' + cubeHtml + '</div></div><img id="intro-logo" src="images/logo-blanc.png" alt="" decoding="async">' +
    '<canvas id="intro-cv-front"></canvas>' +
    '<div id="intro-text"><h1 id="intro-title" aria-label="Lycée de Bahouan"></h1><div id="intro-trait"></div><p id="intro-devise">Détermination · Réussite · Excellence</p></div>' +
    '<button id="intro-skip" type="button">Passer l\'intro</button><button id="intro-enter" type="button">Entrer sur le site</button><div id="intro-bar"></div>';

  var th = document.getElementById('intro-title'), idx = 0;
  'LYCÉE DE BAHOUAN'.split(' ').forEach(function(mot){ var w = document.createElement('span'); w.className = 'mot'; w.setAttribute('aria-hidden', 'true');
    mot.split('').forEach(function(c){ var s = document.createElement('span'); s.style.setProperty('--i', idx++); s.textContent = c; w.appendChild(s); }); th.appendChild(w); });

  var cvB = document.getElementById('intro-cv-back'), cvF = document.getElementById('intro-cv-front'), xB = cvB.getContext('2d'), xF = cvF.getContext('2d');
  var world = document.getElementById('intro-world'), cube = document.getElementById('intro-cube'), logo = document.getElementById('intro-logo');
  var halo = document.getElementById('intro-halo'), pulse = document.getElementById('intro-pulse'), txt = document.getElementById('intro-text'), bar = document.getElementById('intro-bar');
  var W = 0, H = 0, S = 200, CX = 0, CY = 0;

  /* ----- orbites : anneau (rayon, inclinaison, roulis, vitesse) + éléments ----- */
  var rad = Math.PI / 180;
  var orbites = [
    { r: 1.18, phi: 64 * rad, psi: -16 * rad, v: .55, ring: .5, items: ['π', '∑', '√', '∞', 'Δ'] },
    { r: 1.62, phi: 74 * rad, psi: 34 * rad,  v: -.36, ring: .32, items: ['θ', '∫', 'λ', 'Ω', 'mini', 'mini'] },
    { r: .86,  phi: 24 * rad, psi: 62 * rad,  v: .9,  ring: .18, items: ['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot'] }
  ];
  var tk = document.getElementById('intro-tokens'); tk.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  var elems = [];
  orbites.forEach(function(o, oi){ o.items.forEach(function(it, k){
    var e = document.createElement('div'); e.className = 'tk' + (it === 'dot' ? ' dot' : it === 'mini' ? ' mc' : '');
    if (it === 'mini') e.innerHTML = '<span class="mini"><u><i></i><i></i><i></i><i></i><i></i><i></i></u></span>'; else if (it !== 'dot') e.textContent = it;
    tk.appendChild(e); elems.push({ el: e, o: o, ph: k / o.items.length * 6.2832 + oi, born: 1.1 + (elems.length * .09) });
  }); });

  /* ----- poussière lumineuse en fond ----- */
  var dust = []; for (var i = 0; i < 70; i++) dust.push({ x: Math.random(), y: Math.random(), z: Math.random(), v: .004 + Math.random() * .01 });

  function resize(){
    W = innerWidth; H = innerHeight;
    S = Math.round(Math.max(130, Math.min(W * .36, H * .27, 250))); CX = W / 2; CY = Math.round(H * (W < 600 ? .31 : .335));
    root.style.setProperty('--s', S + 'px'); root.style.setProperty('--s2', (S * 3.6) + 'px');
    [cvB, cvF].forEach(function(c){ c.width = Math.floor(W * DPR); c.height = Math.floor(H * DPR); });
    world.style.left = halo.style.left = pulse.style.left = logo.style.left = CX + 'px'; world.style.top = halo.style.top = pulse.style.top = logo.style.top = CY + 'px';
    txt.style.top = Math.round(CY + S * (W < 600 ? 1.5 : 1.38)) + 'px';
  }
  resize(); addEventListener('resize', resize);

  var tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', function(e){ tilt.ty = (e.clientX / innerWidth - .5) * 28; tilt.tx = -(e.clientY / innerHeight - .5) * 20; });
  var ease = function(x){ x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
  var t0 = performance.now(), last = t0, shown = false, titled = false, ready = false, done = false, raf = 0;

  /* point d'orbite → écran */
  function pos(o, th){
    var x = o.r * S * Math.cos(th), z = o.r * S * Math.sin(th), y = 0;
    var y1 = y * Math.cos(o.phi) - z * Math.sin(o.phi), z1 = y * Math.sin(o.phi) + z * Math.cos(o.phi);
    var x2 = x * Math.cos(o.psi) - y1 * Math.sin(o.psi), y2 = x * Math.sin(o.psi) + y1 * Math.cos(o.psi);
    var k = P / (P - z1); return { x: CX + x2 * k, y: CY + y2 * k, z: z1, k: k };
  }

  function frame(now){
    if (done) return;
    var t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!shown) { shown = true; root.classList.add('show'); }
    var a = ease(t / 1.6);                                           /* entrée du cube */
    var ry = 40 + t * 34 + (1 - a) * 300, rx = -20 + Math.sin(t * .7) * 9 + (1 - a) * 40;
    tilt.x += (tilt.tx - tilt.x) * .06; tilt.y += (tilt.ty - tilt.y) * .06;
    var RX = rx + tilt.x, RY = ry + tilt.y, sc = .35 + a * .65;
    cube.style.transform = 'scale(' + sc.toFixed(3) + ') rotateX(' + RX.toFixed(2) + 'deg) rotateY(' + RY.toFixed(2) + 'deg)';
    logo.style.transform = 'translate(-50%,-50%) scale(' + (1 + Math.sin(t * 1.6) * .015).toFixed(4) + ')';

    xB.setTransform(DPR, 0, 0, DPR, 0, 0); xB.clearRect(0, 0, W, H); xF.setTransform(DPR, 0, 0, DPR, 0, 0); xF.clearRect(0, 0, W, H);
    /* poussière */
    dust.forEach(function(d){ d.y -= d.v * dt * (.4 + d.z); if (d.y < -.02) { d.y = 1.02; d.x = Math.random(); }
      xB.fillStyle = 'rgba(150,200,255,' + (.12 + d.z * .35) + ')'; xB.beginPath(); xB.arc(d.x * W, d.y * H, .6 + d.z * 1.4, 0, 6.2832); xB.fill(); });
    /* anneaux (moitié arrière derrière le cube, moitié avant devant) */
    orbites.forEach(function(o){
      var vis = ease((t - .9) / 1.2) * o.ring; if (vis <= 0) return; var N = 96, prev = null;
      for (var i = 0; i <= N; i++) { var p = pos(o, i / N * 6.2832);
        if (prev) { var front = (p.z + prev.z) > 0, c = front ? xF : xB; c.strokeStyle = 'rgba(255,210,119,' + (front ? vis : vis * .55) + ')'; c.lineWidth = front ? 1.2 : .9; c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke(); }
        prev = p; }
    });
    /* éléments en orbite */
    elems.forEach(function(e){
      var o = e.o, th = e.ph + t * o.v, p = pos(o, th), vis = ease((t - e.born) / .9), depth = (p.z / (o.r * S) + 1) / 2;
      e.el.style.zIndex = p.z > 0 ? 4 : 2; e.el.style.opacity = (vis * (.4 + depth * .6)).toFixed(3);
      e.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + (p.k * (e.el.classList.contains('dot') ? 1 : .95)).toFixed(3) + ')';
    });
    pulse.style.opacity = pulse.style.opacity;    /* (animation CSS) */

    if (!titled && t >= T_TITRE) { titled = true; root.classList.add('titre'); }
    if (!ready && t >= T_PRET) { ready = true; root.classList.add('pret'); }
    if (t > .9) root.classList.add('skipok');
    bar.style.width = Math.min(100, t / T_AUTO * 100) + '%';
    if (t >= T_AUTO) return fermer();
    raf = requestAnimationFrame(frame);
  }

  function fermer(){
    if (done) return; done = true; cancelAnimationFrame(raf);
    root.classList.add('out');
    setTimeout(function(){ if (root.parentNode) root.parentNode.removeChild(root); document.documentElement.classList.remove('intro-on'); removeEventListener('resize', resize); }, 950);
  }
  document.getElementById('intro-skip').onclick = fermer;
  document.getElementById('intro-enter').onclick = fermer;
  addEventListener('keydown', function(e){ if (e.key === 'Escape' || (ready && (e.key === 'Enter' || e.key === ' '))) fermer(); });
  raf = requestAnimationFrame(function(n){ t0 = last = n; frame(n); });
})();
