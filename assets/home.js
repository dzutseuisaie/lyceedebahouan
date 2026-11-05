/* Lycée de Bahouan - accueil */
(function(){
const S = window.SITE, $ = id => document.getElementById(id), esc = window.esc;
const img = k => `images/${k}.jpg`;

/* ---------- Chiffres ---------- */
function stats(){
  document.querySelectorAll('[data-stats]').forEach(el => {
    const list = S.stats[el.getAttribute('data-stats')] || [];
    el.innerHTML = list.map(s => `<div><b>${esc(s.n)}</b><span>${esc(s.t)}</span><small>${esc(s.d||'')}</small></div>`).join('');
  });
}
stats();

/* ---------- Vidéo ---------- */
function video(){
  const url = (S.videoUrl||'').trim(), box = $('cadre-video'), sec = $('video');
  if (!url) { sec.hidden = true; return; }
  sec.hidden = false;
  let embed = null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (yt) embed = `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="Vidéo du lycée"></iframe>`;
  else if (vm) embed = `<iframe src="https://player.vimeo.com/video/${vm[1]}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen title="Vidéo du lycée"></iframe>`;
  else embed = `<video controls autoplay playsinline src="${esc(url)}"></video>`;
  box.innerHTML = '<button class="playbtn" aria-label="Lire la vidéo"></button>';
  box.querySelector('.playbtn').onclick = () => { box.innerHTML = embed; box.style.backgroundImage = 'none'; };
}

/* ---------- Valeurs (onglets) ---------- */
const VALEURS = [
  ["Discipline","Le règlement du lycée commence par le respect et la discipline : un cadre clair, connu de tous, qui protège le travail de chacun.","discipline"],
  ["Assiduité","Être là, et à l'heure. La ponctualité et l'assiduité forment le deuxième acte du règlement et la base de toute réussite.","assiduite"],
  ["Respect","La violence et le harcèlement ont leur propre acte dans le règlement : chaque élève doit pouvoir étudier en sécurité.","respect"],
  ["Excellence","Cours et épreuves en ligne, évaluations, club scientifique et club d'orientation : de quoi aller plus loin que le programme.","excellence"],
  ["Communauté","Groupes WhatsApp par classe, parents impliqués, anciens élèves et bourses de la Fondation Fongang pour les élèves méritants.","communaute"],
  ["Culture","Le lycée participe régulièrement au festival Nkaing, symbole de l'identité bamiléké. Apprendre, c'est aussi savoir d'où l'on vient.","culture"]
];
function valeurs(){
  const box = $('valeurs');
  box.innerHTML = `<div class="vtabs" role="tablist">${VALEURS.map((v,i)=>`<button role="tab" id="vt${i}" aria-selected="${i===0}" aria-controls="vp${i}">${v[0]}</button>`).join('')}</div>
  <div>${VALEURS.map((v,i)=>`<div class="vpanel${i===0?' on':''}" role="tabpanel" id="vp${i}" aria-labelledby="vt${i}"><div class="vtxt"><h3>${v[0]}</h3><p>${v[1]}</p><a class="lien" href="valeurs.html">Toutes nos valeurs</a></div></div>`).join('')}</div>`;
  box.querySelectorAll('[role=tab]').forEach((b,i) => b.onclick = () => {
    box.querySelectorAll('[role=tab]').forEach((x,j) => x.setAttribute('aria-selected', j===i));
    box.querySelectorAll('.vpanel').forEach((p,j) => p.classList.toggle('on', j===i));
  });
}
valeurs();

/* ---------- Parcours personnalisé ---------- */
const THEMES = [
  ["academique","Académique","Séries et matières","academique.html"],
  ["orientation","Orientation","Choisir sa voie","orientation.html"],
  ["club","Club scientifique","Projets et cours","club_scientifique.html"],
  ["vie","Vie scolaire","Règlement et clubs","vie-scolaire.html"],
  ["culture","Culture","Festival Nkaing","vie-scolaire.html#culture"],
  ["resultats","Résultats","Examens par SMS ou Ayoba","resultats_examen.html"],
  ["numerique","Espace familles","Notes et présence en ligne","espace-familles.html"],
  ["admissions","Admissions","S'inscrire au lycée","admissions.html"]
];
let choix = [];
try { choix = JSON.parse(localStorage.getItem('bhn_choix')||'[]'); } catch(e){}
function parcours(){
  $('chips').innerHTML = THEMES.map(t => `<button class="chip" data-k="${t[0]}" aria-pressed="${choix.includes(t[0])}"><i data-img="explore-${t[0]}" style="background-image:url('${img('explore-'+t[0])}')"></i>${t[1]}</button>`).join('');
  $('chips').querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const k = b.getAttribute('data-k');
    choix = choix.includes(k) ? choix.filter(x => x!==k) : choix.concat(k);
    try { localStorage.setItem('bhn_choix', JSON.stringify(choix)); } catch(e){}
    b.setAttribute('aria-pressed', choix.includes(k)); tuiles();
  });
  tuiles();
}
function tuiles(){
  const sel = THEMES.filter(t => choix.includes(t[0]));
  $('tuiles').innerHTML = sel.map(t => `<a class="tuile" href="${t[3]}"><div><h3>${t[1]}</h3><span>${t[2]}</span></div></a>`).join('');
  $('tuiles-vide').hidden = sel.length > 0;
  if (window.__imgMap) window.applyImages(window.__imgMap);
}
parcours();

/* ---------- Actualités et événements ---------- */
function carte(a){
  const im = a.image ? window.cld(a.image,800) : img('actualite-defaut');
  return `<a class="carte" href="actualites.html#${a.id}"><div class="im" style="background-image:url('${esc(im)}')"></div><time>${esc(a.dateTxt||'')}</time><h3>${esc(a.titre||'')}</h3><p>${esc(a.resume||'')}</p></a>`;
}
async function actus(){
  const box = $('actus');
  if (!window.DB) { box.innerHTML = '<p style="color:var(--gris)">Les actualités s\'afficheront ici.</p>'; return; }
  try {
    const snap = await window.DB.collection('actualites').orderBy('date','desc').limit(3).get();
    const list = []; snap.forEach(d => { const x = d.data(); x.id = d.id; x.dateTxt = window.fmtDate(x.date); list.push(x); });
    box.innerHTML = list.length ? list.map(carte).join('') : '<p style="color:var(--gris)">Aucune actualité publiée pour le moment. Revenez bientôt.</p>';
  } catch(e){ box.innerHTML = '<p style="color:var(--gris)">Les actualités ne sont pas disponibles pour le moment.</p>'; }
  try {
    const snap = await window.DB.collection('evenements').orderBy('date').get();
    const today = new Date().toISOString().slice(0,10), list = [];
    snap.forEach(d => { const x = d.data(); if ((x.date||'') >= today) list.push(x); });
    if (list.length) {
      const e = $('evts'); e.hidden = false;
      e.innerHTML = '<h3 style="margin-top:34px">À venir</h3>' + list.slice(0,4).map(x => {
        const dt = new Date(x.date+'T12:00:00');
        return `<div class="evt"><div><b>${dt.getDate()}</b><small>${dt.toLocaleDateString(window.LOCALE||'fr-FR',{month:'long',year:'numeric'})}</small></div><div><h3 style="margin:0 0 4px;font-size:1.3rem">${esc(x.titre||'')}</h3><span style="color:var(--gris)">${esc(x.lieu||'')} ${x.lieu&&x.description?'· ':''}${esc(x.description||'')}</span></div></div>`;
      }).join('');
    }
  } catch(e){}
}
actus();

/* ---------- Sous-navigation collante ---------- */
const links = [...document.querySelectorAll('.pills a')];
if ('IntersectionObserver' in window) {
  const mark = id => links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#'+id));
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) mark(en.target.id); }), {rootMargin:'-45% 0px -50% 0px'});
  ['terre','communaute','numerique'].forEach(id => io.observe($(id)));
  const hero = document.querySelector('.hero'); hero.id = 'top-hero';
  const ioHero = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) mark('top'); }), {rootMargin:'-45% 0px -50% 0px'});
  ioHero.observe(hero);
}


/* ---------- Bandeau d'information (annonces publiques de l'administration) ---------- */
(async function(){
  try {
    if (!window.DB) return;
    const s = await window.DB.collection('annonces').where('public', '==', true).limit(10).get(); const l = [];
    s.forEach(d => { const x = d.data(); if (x.texte && x.date) l.push(Object.assign({ id: d.id }, x)); });
    l.sort((a, b) => b.date.localeCompare(a.date)); const a = l[0];
    if (!a || Date.now() - new Date(a.date).getTime() > 30 * 864e5 || sessionStorage.getItem('bhn_al_' + a.id)) return;
    const bar = document.createElement('div'); bar.className = 'alerte'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<div class="wrap"><span><b>' + esc(a.type || 'Information') + ' :</b> ' + esc(a.texte) + '</span><button type="button" aria-label="Fermer ce message">×</button></div>';
    bar.querySelector('button').onclick = () => { sessionStorage.setItem('bhn_al_' + a.id, '1'); bar.remove(); };
    document.body.insertBefore(bar, document.getElementById('site-header'));
  } catch(e){}
})();

/* ---------- Mise à jour après lecture de Firestore ---------- */
window.siteReady.then(() => { stats(); video(); });
video();
})();

/* ---------- Témoignages approuvés ---------- */
(async function(){
  try {
    if (!window.DB) return;
    const s = await window.DB.collection('temoignages').where('approuve', '==', true).limit(30).get(); const tous = s.docs.map(d => d.data());
    /* l'administration choisit lesquels s'affichent sur l'accueil (case « Afficher sur l'accueil ») ; sinon, les premiers approuvés */
    const choisis = tous.filter(x => x.accueil === true), l = choisis.length ? choisis : tous;
    if (!l.length) return;
    document.getElementById('tem-home').innerHTML = l.slice(0, 6).map(x => '<blockquote>« ' + esc(x.texte) + ' »<cite>' + esc(x.nom) + ' · ' + esc(x.role) + '</cite></blockquote>').join('');
    document.getElementById('temoignages-accueil').hidden = false;
  } catch(e){}
})();


/* ---------- Animations d'accueil : diaporama du haut, carrousel de texte ---------- */
(function(){
  const calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* diaporama : une photo après l'autre, en fondu lent */
  const slides = [...document.querySelectorAll('.hero-slide')]; let i = 0;
  if (slides.length > 1 && !calme) setInterval(() => { slides[i].classList.remove('on'); i = (i + 1) % slides.length; slides[i].classList.add('on'); }, 6500);
  /* carrousel de texte des trois idées */
  const th = [...document.querySelectorAll('.theme')], pts = [...document.querySelectorAll('.themes-nav button')]; let k = 0, minuteur = null;
  const aller = n => { k = (n + th.length) % th.length; th.forEach((t, j) => t.classList.toggle('on', j === k)); pts.forEach((p, j) => p.classList.toggle('on', j === k)); };
  const lancer = () => { clearInterval(minuteur); if (!calme) minuteur = setInterval(() => aller(k + 1), 9000); };
  pts.forEach((p, j) => p.onclick = () => { aller(j); lancer(); });
  document.querySelectorAll('.pills a[href^="#"]').forEach(a => a.addEventListener('click', e => { const j = th.findIndex(t => '#' + t.id === a.getAttribute('href')); if (j >= 0) { e.preventDefault(); aller(j); lancer(); document.getElementById('themes').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
  const box = document.getElementById('themes'); if (box) { box.addEventListener('mouseenter', () => clearInterval(minuteur)); box.addEventListener('mouseleave', lancer); lancer(); }
})();
