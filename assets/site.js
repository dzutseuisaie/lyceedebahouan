/* Lycée de Bahouan - script commun (menu, pied de page, Firebase, images) */
(function(){
const S = window.SITE;

/* ---------- Firebase ---------- */
window.DB = null;
if (window.firebase && S && S.firebase) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(S.firebase);
    window.DB = firebase.firestore();
    /* Mode hors ligne : Firestore garde une copie locale de ce qui a été consulté et met les écritures en attente
       jusqu'au retour du réseau. Doit être appelé avant toute autre utilisation de la base. */
    try { window.DB.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true }); window.DB.enablePersistence({ synchronizeTabs: true }).catch(e => console.info('Copie locale indisponible :', e && e.code)); } catch (e2) {}
  } catch (e) { console.warn("Firebase indisponible", e); }
}

/* ---------- Menu (défini une seule fois ici) ---------- */
const MENU = [
  { t:"Le lycée", h:"le-lycee.html", s:[
    ["Mot de bienvenue et mission","le-lycee.html#mission"],
    ["Notre histoire","le-lycee.html#histoire"],
    ["Administration","le-lycee.html#administration"],
    ["Infrastructures","le-lycee.html#infrastructures"],
    ["Équipe pédagogique","equipe.html"],
    ["Galerie photos","galerie.html"],
    ["Nos valeurs","valeurs.html"] ]},
  { t:"Admissions", h:"admissions.html", s:[
    ["Bienvenue au lycée","admissions.html#bienvenue"],
    ["Documents à fournir","admissions.html#documents"],
    ["Comment s'inscrire","admissions.html#inscription"],
    ["Frais et bourses","admissions.html#frais"],
    ["Planifier une visite","visite.html"],
    ["Questions fréquentes","faq.html"] ]},
  { t:"Académique", h:"academique.html", s:[
    ["Séries et matières","academique.html#series"],
    ["Cours et épreuves","espace-eleve.html#cours"],
    ["Orientation","orientation.html"],
    ["Club scientifique","club_scientifique.html"],
    ["Examens et résultats","resultats_examen.html"],
    ["Réussite et tableau d'honneur","reussite.html"],
    ["Emploi du temps","emploi.html"] ]},
  { t:"Vie scolaire", h:"vie-scolaire.html", s:[
    ["Règlement du lycée","vie-scolaire.html#reglement"],
    ["Clubs et activités","vie-scolaire.html#clubs"],
    ["Sport et services","vie-scolaire.html#services"],
    ["Culture et festival Nkaing","vie-scolaire.html#culture"],
    ["Calendrier","calendrier.html"] ]},
  { t:"Familles", h:"espace-familles.html", s:[
    ["Espace parent","espace-parent.html"],
    ["Notes et présence","espace-parent.html#notes"],
    ["Résultats d'examens","resultats_examen.html"],
    ["Écrire à l'école","espace-parent.html#messagerie"],
    ["Groupes WhatsApp","espace-familles.html#whatsapp"] ]},
  { t:"Anciens", h:"anciens.html", s:[
    ["Rester en contact","anciens.html"],
    ["Soutenir le lycée","anciens.html#soutenir"] ]},
  { t:"Actualités", h:"actualites.html" }
];
const PIED = [
  ["Le lycée","le-lycee.html"],["Admissions","admissions.html"],["Académique","academique.html"],
  ["Vie scolaire","vie-scolaire.html"],["Actualités","actualites.html"],["Calendrier","calendrier.html"],["Contact","contact.html"]
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IC = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.300 6.300-3.900 9c-2.600-2.700-3.900-5.700-3.900-9S9.400 5.700 12 3z"/></svg>'
};

function header(){
  const nav = MENU.map(m => `<li><a href="${m.h}">${esc(m.t)}</a>${m.s?`<ul class="sub">${m.s.map(x=>`<li><a href="${x[1]}">${esc(x[0])}</a></li>`).join('')}</ul>`:''}</li>`).join('');
  const drawer = MENU.map(m => m.s
    ? `<details><summary>${esc(m.t)}</summary>${m.s.map(x=>`<a href="${x[1]}">${esc(x[0])}</a>`).join('')}</details>`
    : `<a class="simple" href="${m.h}">${esc(m.t)}</a>`).join('');
  return `
  <div class="utility"><div class="wrap">
    <a class="tel hide-m" href="tel:${S.telephone}" data-tel>${esc(S.telephoneAffiche)}</a>
    <a href="#" data-demande="information">Demande d'information</a>
    <a href="calendrier.html" class="hide-m">Calendrier</a>
    <a href="anciens.html">Anciens</a>
    <a href="espace-familles.html">Familles</a>
    <button type="button" class="lang-btn" data-lang-open aria-label="Choisir votre langue">${IC.globe}<span class="lang-code" translate="no">FR</span></button>
  </div></div>
  <header class="site-header"><div class="wrap">
    <a class="marque" href="index.html"><img src="images/logo.jpg" data-img="logo" alt="Logo du Lycée de Bahouan" width="54" height="54"><span><b>Lycée de Bahouan</b><small>Bamendjou, Cameroun</small></span></a>
    <ul class="nav">${nav}</ul>
    <button class="icon-btn" id="bt-search" aria-label="Rechercher">${IC.search}</button>
    <span id="auth-slot" class="auth-slot"><a class="btn small" id="btn-conn" href="connexion.html">Se connecter</a></span>
    <button class="icon-btn burger" id="bt-menu" aria-label="Ouvrir le menu">${IC.menu}</button>
  </div></header>
  <div class="drawer" id="drawer"><div class="top"><b style="font:500 1.4rem var(--serif)">Lycée de Bahouan</b><span><button class="icon-btn" id="bt-search-m" aria-label="Rechercher">${IC.search}</button><button class="icon-btn" id="bt-close" aria-label="Fermer le menu">${IC.close}</button></span></div>${drawer}
    <a class="simple" href="contact.html">Contact</a><a class="simple" href="#" data-lang-open>${IC.globe} Choisir votre langue</a><div id="auth-slot-m"><a class="simple" href="connexion.html">Se connecter</a></div></div>
  <div class="search" id="search"><button class="icon-btn close" id="bt-sclose" aria-label="Fermer la recherche">${IC.close}</button>
    <div class="box"><input id="q" type="search" placeholder="Rechercher sur le site" aria-label="Rechercher"><ul id="res"></ul></div></div>`;
}

function footer(){
  return `<footer class="foot"><div class="wrap"><div class="g">
    <div><a class="marque" href="index.html"><img src="images/logo.jpg" data-img="logo" alt="" width="54" height="54"><span><b>Lycée de Bahouan</b><small>Lycée général bilingue</small></span></a>
      <p>${esc(S.adresse)}</p>
      <p><a href="tel:${S.telephone}" data-tel>${esc(S.telephoneAffiche)}</a><br><a href="mailto:${S.email}">${esc(S.email)}</a></p></div>
    <div><h4>Explorer</h4><ul>${PIED.map(x=>`<li><a href="${x[1]}">${x[0]}</a></li>`).join('')}</ul></div>
    <div><h4>Liens utiles</h4><ul>
      <li><a href="connexion.html">Se connecter</a></li><li><a href="#" data-installer>Télécharger l'application</a></li><li><a href="#" data-lang-open>Choisir votre langue</a></li><li><a href="resultats_examen.html">Résultats d'examens</a></li>
      <li><a href="emploi.html">Emploi du temps</a></li><li><a href="faq.html">Questions fréquentes</a></li>
      <li><a href="politique-confidentialite.html">Politique de confidentialité</a></li></ul></div>
    <div><h4>Suivez-nous</h4><ul>
      <li><a href="${S.facebook}" target="_blank" rel="noopener">Facebook</a></li>
      <li><a href="${S.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li></ul>
      <h4 style="margin-top:22px">Horaires</h4><p style="font-size:.95rem">${esc(S.horaires)}</p>
      <h4 style="margin-top:22px">Les nouvelles du lycée</h4>
      <form class="newsl" id="f-news" style="flex-wrap:wrap"><input type="email" name="email" placeholder="Votre e-mail" required maxlength="120" aria-label="Votre adresse e-mail"><button class="btn small" type="submit">OK</button><div class="msg" role="status" style="width:100%"></div></form></div>
  </div>
  <div class="bas"><span>© ${new Date().getFullYear()} Lycée de Bahouan</span><span><a href="a-propos-du-site.html">Site conçu par FEUKO Dzutseu Isaïe Ange</a></span></div></div></footer>
  <div class="modal" id="m-demande" role="dialog" aria-modal="true" aria-labelledby="md-titre"><div class="in">
    <button class="x" data-fermer aria-label="Fermer">×</button>
    <h2 id="md-titre">Demande d'information</h2>
    <p>Laissez vos coordonnées : le secrétariat vous rappelle.</p>
    <form class="form" id="f-demande">
      <input type="hidden" name="type" value="information">
      <label>Nom et prénom<input name="nom" required autocomplete="name"></label>
      <label>Téléphone (WhatsApp si possible)<input name="telephone" type="tel" required autocomplete="tel"></label>
      <label>Adresse e-mail (facultatif)<input name="email" type="email" autocomplete="email"></label>
      <label>Niveau concerné<select name="niveau"><option>Seconde</option><option>Première</option><option>Terminale</option><option>Je ne sais pas encore</option></select></label>
      <label>Votre message<textarea name="message"></textarea></label>
      <button class="btn dark" type="submit">Envoyer ma demande</button>
      <div class="msg" role="status"></div>
    </form></div></div>`;
}

const h = document.getElementById('site-header'); if (h) h.innerHTML = header();
const f = document.getElementById('site-footer'); if (f) f.innerHTML = footer();

/* ---------- Menu mobile + recherche ---------- */
const $ = id => document.getElementById(id);
const toggle = (el,on) => el && el.classList.toggle('open',on);
$('bt-menu') && ($('bt-menu').onclick = () => toggle($('drawer'),true));
$('bt-close') && ($('bt-close').onclick = () => toggle($('drawer'),false));
$('drawer') && $('drawer').addEventListener('click', e => { if (e.target.tagName==='A') toggle($('drawer'),false); });
const INDEX = []; MENU.forEach(m => { INDEX.push([m.t,m.h,'']); (m.s||[]).forEach(x => INDEX.push([x[0],x[1],m.t])); });
$('bt-search') && ($('bt-search').onclick = () => { toggle($('search'),true); setTimeout(()=>$('q').focus(),50); });
$('bt-search-m') && ($('bt-search-m').onclick = () => { toggle($('drawer'),false); toggle($('search'),true); setTimeout(()=>$('q').focus(),50); });
$('bt-sclose') && ($('bt-sclose').onclick = () => toggle($('search'),false));
$('q') && $('q').addEventListener('input', e => {
  const v = e.target.value.trim().toLowerCase();
  const r = v.length<2 ? [] : INDEX.filter(x => x[0].toLowerCase().includes(v));
  $('res').innerHTML = r.length ? r.map(x=>`<li><a href="${x[1]}">${esc(x[0])}<small>${esc(x[2])}</small></a></li>`).join('')
    : (v.length>=2 ? '<li style="color:#cfd8ea;padding:12px 0">Aucun résultat. Essayez « admissions » ou « résultats ».</li>' : '');
});
document.addEventListener('keydown', e => { if (e.key==='Escape'){ toggle($('search'),false); toggle($('drawer'),false); toggle($('m-demande'),false);} });

/* ---------- Formulaire « demande d'information » ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-demande]');
  if (b) { e.preventDefault(); openDemande(b.getAttribute('data-demande')); }
  if (e.target.closest('[data-fermer]') || e.target.id==='m-demande') toggle($('m-demande'),false);
});
window.openDemande = function(type){
  const m = $('m-demande'); if (!m) return;
  m.querySelector('[name=type]').value = type || 'information';
  $('md-titre').textContent = type==='visite' ? 'Planifier une visite' : 'Demande d\'information';
  toggle(m,true);
};
window.bindForm = function(form, collection, okText){
  if (!form) return;
  /* champ piège invisible : les robots le remplissent, pas les humains */
  const hp = document.createElement('input'); hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.setAttribute('aria-hidden', 'true');
  hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0'; form.appendChild(hp);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = form.querySelector('.msg'); const btn = form.querySelector('button[type=submit]');
    msg.className='msg';
    if (hp.value) { form.reset(); msg.className='msg ok'; msg.textContent = okText || "Merci, votre demande est bien envoyée."; return; }
    const cle = 'bhn_cd_' + collection;
    if (Date.now() - (+localStorage.getItem(cle) || 0) < 45000) { msg.className='msg err'; msg.textContent = "Merci de patienter une minute avant de renvoyer un formulaire."; return; }
    if (!window.DB) { msg.className='msg err'; msg.textContent="Connexion impossible pour l'instant. Appelez le secrétariat : "+S.telephoneAffiche+"."; return; }
    const data = Object.fromEntries(new FormData(form).entries()); delete data.website;
    Object.keys(data).forEach(k => { data[k] = String(data[k]).trim().slice(0, 2000); });
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.page = (location.pathname.split('/').pop() || 'index.html').slice(0, 60);
    btn.disabled = true;
    try {
      await window.DB.collection(collection).add(data);
      localStorage.setItem(cle, String(Date.now()));
      const envoye = Object.assign({}, data);
      form.reset(); msg.className='msg ok'; msg.textContent = okText || "Merci, votre demande est bien envoyée. Le secrétariat vous répondra.";
      form.dispatchEvent(new CustomEvent('envoye', { detail: { collection: collection, data: envoye } }));
    } catch (err) {
      console.error(err); msg.className='msg err';
      msg.textContent = "L'envoi a échoué. Vérifiez votre connexion ou appelez le "+S.telephoneAffiche+".";
    }
    btn.disabled = false;
  });
};
bindForm($('f-demande'),'demandes');

/* ---------- Images : remplacement via Cloudinary (admin-site.html) ---------- */
window.cld = function(url, w){
  if (!url || url.indexOf('res.cloudinary.com')<0 || url.indexOf('/upload/')<0) return url;
  return url.replace('/upload/','/upload/f_auto,q_auto'+(w?',w_'+w:'')+'/');
};
function applyImages(map){
  document.querySelectorAll('[data-img]').forEach(el => {
    const u = map[el.getAttribute('data-img')]; if (!u) return;
    const url = cld(u, el.tagName==='IMG' ? 1600 : 1920);
    if (el.tagName==='IMG') el.src = url; else el.style.backgroundImage = 'url("'+url+'")';
  });
}
window.applyImages = applyImages;
async function loadImages(){
  if (!window.DB) return;
  let map = null;
  try { const c = JSON.parse(sessionStorage.getItem('bhn_imgs')||'null'); if (c && Date.now()-c.t < 600000) map = c.m; } catch(e){}
  if (!map) {
    try {
      const snap = await window.DB.collection('site_images').get();
      map = {}; snap.forEach(d => { if (d.data().url) map[d.id] = d.data().url; });
      sessionStorage.setItem('bhn_imgs', JSON.stringify({t:Date.now(), m:map}));
    } catch(e){ return; }
  }
  window.__imgMap = map;
  applyImages(map);
}

/* ---------- Informations générales (Firestore) ---------- */
function applyGeneral(){
  document.querySelectorAll('[data-tel]').forEach(a => { a.href = 'tel:'+S.telephone; if (a.hasAttribute('data-tel-texte')||a.closest('.utility,.foot')) a.textContent = S.telephoneAffiche; });
  document.querySelectorAll('[data-annee]:not(.annee)').forEach(el => el.textContent = S.anneeScolaire ? ' ' + S.anneeScolaire : '');
}
window.siteReady = (async function(){
  if (!window.DB) return;
  try {
    const col = window.DB.collection('informations_site');
    const [g, a] = await Promise.all([col.doc('general').get(), col.doc('admissions').get()]);
    if (g.exists) { const d = g.data();
      ['videoUrl','anneeScolaire','horaires','email','adresse','facebook','whatsapp'].forEach(k => { if (d[k]) S[k] = d[k]; });
      ['terre','communaute','numerique'].forEach(k => { try { if (d[k]) S.stats[k] = JSON.parse(d[k]); } catch(e){} });
      try { const c = d.classes ? JSON.parse(d.classes) : null; if (Array.isArray(c) && c.length) S.classes.splice(0, S.classes.length, ...c.map(x => String(x))); } catch(e){}
    }
    if (a.exists && a.data().numero) {
      const n = String(a.data().numero).replace(/\s+/g,'');
      S.telephone = n; S.telephoneAffiche = a.data().numero;
    }
  } catch(e){ console.warn('Infos générales indisponibles', e); }
  applyGeneral();
})();

/* ---------- Textes modifiables par le super administrateur (contenu_site/textes_<page>) ----------
   Chaque titre, paragraphe ou ligne de liste portant data-cms="clé" peut être remplacé depuis l'administration.
   Seules les balises de mise en forme simples sont conservées (em, b, strong, i, u, br). */
const CMS_OK = { EM:1, B:1, STRONG:1, I:1, U:1, BR:1 };
window.CMS = {
  page: () => ((location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '')) || 'index',
  docId: p => 'textes_' + p,
  clean(html){
    const t = document.createElement('template'); t.innerHTML = String(html == null ? '' : html); const out = document.createElement('div');
    (function walk(src, dst){ src.childNodes.forEach(n => {
      if (n.nodeType === 3) dst.appendChild(document.createTextNode(n.textContent));
      else if (n.nodeType === 1) { if (CMS_OK[n.tagName]) { const c = document.createElement(n.tagName.toLowerCase()); if (n.tagName !== 'BR') walk(n, c); dst.appendChild(c); } else walk(n, dst); }
    }); })(t.content, out);
    return out.innerHTML;
  },
  oublier(){ try { Object.keys(sessionStorage).filter(k => k.indexOf('bhn_cms_') === 0).forEach(k => sessionStorage.removeItem(k)); } catch(e){} }
};
async function applyCms(){
  const els = [...document.querySelectorAll('[data-cms]')]; if (!els.length || !window.DB) return;
  const p = CMS.page(), cle = 'bhn_cms_' + p; let m = null;
  try { const c = JSON.parse(sessionStorage.getItem(cle) || 'null'); if (c && Date.now() - c.t < 120000) m = c.m; } catch(e){}
  if (!m) { try { const d = await window.DB.collection('contenu_site').doc(CMS.docId(p)).get(); m = d.exists ? d.data() : {}; sessionStorage.setItem(cle, JSON.stringify({ t: Date.now(), m })); } catch(e){ return; } }
  els.forEach(el => { const v = m[el.getAttribute('data-cms')]; if (typeof v === 'string' && v.trim()) el.innerHTML = CMS.clean(v); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyCms()); else applyCms();

window.fmtDate = function(ts){
  try { const d = ts && ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString(window.LOCALE||'fr-FR',{day:'numeric',month:'long',year:'numeric'}); } catch(e){ return ''; }
};
window.esc = esc;

/* ---------- Cloudinary : envoi d'une image ---------- */
window.uploadToCloudinary = async function(file){
  const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', S.cloudinary.uploadPreset);
  const type = (/^image\//.test(file.type) || file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) ? 'image' : 'raw';   /* images et PDF : « image » (miniature de la 1re page possible) ; autres documents : « raw » */
  const r = await fetch('https://api.cloudinary.com/v1_1/'+S.cloudinary.cloudName+'/'+type+'/upload', {method:'POST', body:fd});
  const d = await r.json();
  if (!d.secure_url) throw new Error((d.error && d.error.message) || 'Cloudinary a refusé le fichier');
  return d.secure_url;
};

loadImages();
if ('serviceWorker' in navigator && location.protocol.indexOf('http')===0) navigator.serviceWorker.register('sw.js').catch(()=>{});

/* ---------- Choix de classe en deux temps : « Première A » / « Terminale A » → Espagnol ou Allemand ----------
   Toute liste déroulante qui contient « Première A Espagnol », « Première A Allemand », etc. est transformée :
   une seule entrée « Première A » (ou « Terminale A »), puis un second choix (Espagnol / Allemand) qui apparaît.
   La valeur de la liste reste le nom complet de la classe (vide tant que la section n'est pas choisie). */
(function(){
  const RE = /^(Première|Terminale)\s+A\s+(Espagnol|Allemand)$/i;
  function enhance(sel){
    const opts = [...sel.options], groupes = {};
    opts.forEach(o => { const m = (o.textContent || '').trim().match(RE); if (m) { const g = m[1] + ' A'; (groupes[g] = groupes[g] || { premiere: o, sections: {} }).sections[m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()] = o.value || o.textContent.trim(); } });
    const noms = Object.keys(groupes); if (!noms.length) return;
    const cur = sel.value;
    if (sel._sec) { sel._sec.remove(); sel._sec = null; }
    const comp = document.createElement('select'); comp.className = sel.className + " sec-a"; comp.setAttribute('aria-label', 'Section de la série A'); comp.style.display = 'none'; comp.style.marginTop = '8px';
    sel.insertAdjacentElement('afterend', comp); sel._sec = comp;
    noms.forEach(g => { const gr = groupes[g]; Object.keys(gr.sections).length; });
    /* une seule entrée par série A */
    noms.forEach(g => { const gr = groupes[g];
      opts.forEach(o => { const m = (o.textContent || '').trim().match(RE); if (m && (m[1] + ' A') === g && o !== gr.premiere) o.remove(); });
      gr.premiere.textContent = g; gr.premiere.dataset.a = g; gr.premiere.value = ''; });
    const aff = () => {
      const o = sel.selectedOptions[0], g = o && o.dataset.a;
      if (!g) { comp.style.display = 'none'; comp.innerHTML = ''; return; }
      const secs = groupes[g].sections;
      if (comp.dataset.g !== g) { comp.dataset.g = g; comp.innerHTML = '<option value="">Section : Espagnol ou Allemand…</option>' + Object.keys(secs).map(k => '<option value="' + k + '">' + k + '</option>').join(''); }
      const full = o.value, suf = Object.keys(secs).find(k => secs[k] === full); comp.value = suf || '';
      comp.style.display = '';
    };
    comp.addEventListener('change', () => { const o = sel.selectedOptions[0], g = o && o.dataset.a; if (!g) return; o.value = comp.value ? groupes[g].sections[comp.value] : ''; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    sel.addEventListener('change', () => { const o = sel.selectedOptions[0]; if (o && o.dataset.a && comp.dataset.g !== o.dataset.a) { o.value = ''; } aff(); });
    /* valeur de départ (classe déjà enregistrée) */
    if (cur) { const g = noms.find(n => Object.values(groupes[n].sections).includes(cur)); if (g) { groupes[g].premiere.value = cur; groupes[g].premiere.selected = true; } }
    aff();
  }
  const scan = root => { if (!root || root.nodeType !== 1) return; const l = root.tagName === 'SELECT' ? [root] : root.querySelectorAll ? [...root.querySelectorAll('select')] : [];
    l.forEach(s => { if (s.classList.contains('sec-a')) return; enhance(s); }); };
  const obs = new MutationObserver(ms => ms.forEach(m => { if (m.target && m.target.tagName === 'SELECT') scan(m.target); m.addedNodes.forEach(scan); }));
  const go = () => { scan(document.body); obs.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();

/* ---------- Bandeau « hors ligne » ---------- */
(function(){
  const T = t => (window.T ? window.T(t) : t);
  function maj(){
    let b = document.getElementById('hors-ligne');
    if (navigator.onLine) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement('div'); b.id = 'hors-ligne'; b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:8000;background:#222;color:#fff;font:14px system-ui;padding:8px 14px;text-align:center';
    b.textContent = T('Mode hors ligne : vos données déjà chargées restent disponibles. Les modifications seront envoyées au retour de la connexion.');
    document.body.appendChild(b);
  }
  window.addEventListener('online', maj); window.addEventListener('offline', maj);
  if (document.body) maj(); else document.addEventListener('DOMContentLoaded', maj);
})();
})();
