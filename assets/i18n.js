/* Lycée de Bahouan - choix de la langue (français, anglais, espagnol, allemand)
   Principe : le site est écrit en français. Quand une autre langue est choisie, ce script charge le dictionnaire
   (assets/lang-XX.js) et remplace chaque texte trouvé dans la page, y compris les textes ajoutés ensuite par les
   autres scripts (menus, espaces élève et parent, messages d'erreur, boîtes de dialogue).
   Ajouter l'espagnol ou l'allemand : 1) créer assets/lang-es.js (ou lang-de.js) sur le modèle de lang-en.js,
   2) passer  ok:true  dans la liste LANGS ci-dessous. Rien d'autre à changer. */
(function(){
const LANGS = [
  { c:'fr', n:'Français', ok:true },
  { c:'en', n:'English',  ok:true },
  { c:'es', n:'Español',  ok:true },
  { c:'de', n:'Deutsch',  ok:true }
];
const LS = localStorage, H = document.documentElement;
const dispo = LANGS.filter(l => l.ok);
let lang = 'fr';
try {
  const q = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
  if (q && dispo.some(l => l.c === q)) LS.setItem('bhn_lang', q);
  const s = LS.getItem('bhn_lang'); if (s && dispo.some(l => l.c === s)) lang = s;
} catch(e){}
window.LANG = lang;
H.lang = lang;

const norm = s => String(s).replace(/\u00a0/g, ' ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
let D = null;
const PAT = {
  en: [
    [/^Séquence (\d+)$/, 'Sequence $1'],
    [/^Année (\d{4}\/\d{4})$/, 'Year $1'],
    [/^· ?année (.*)$/i, '· year $1'],
    [/^(\d+) ligne\(s\) lue\(s\)\./, '$1 line(s) read.'],
    [/^Je n'ai pas la réponse précise\. Le secrétariat vous répond au (.+)\.$/, "I don't have a precise answer. The secretariat will reply on $1."],
    [/^Secrétariat : (.+?) \(appel ou WhatsApp\)\. (.+)$/, m => 'Secretariat: ' + m[1] + ' (call or WhatsApp). ' + T(m[2])]
  ]
};

/* Phrases avec parties variables (notifications, présence) : anglais, espagnol, allemand */
const NP = [["^(.+) \\((.+)\\) attend votre validation\\.$", {"en": "$1 ($2) is waiting for your approval.", "es": "$1 ($2) espera su validación.", "de": "$1 ($2) wartet auf Ihre Freigabe."}], ["^(.+) demande un accès enseignant\\.$", {"en": "$1 is requesting teacher access.", "es": "$1 solicita acceso de profesor.", "de": "$1 beantragt einen Lehrerzugang."}], ["^L'inscription de (.+) a été validée\\.$", {"en": "The registration of $1 has been approved.", "es": "La inscripción de $1 ha sido validada.", "de": "Die Anmeldung von $1 wurde bestätigt."}], ["^L'inscription de (.+) n'a pas été acceptée\\. Contactez le secrétariat\\.$", {"en": "The registration of $1 was not accepted. Please contact the secretariat.", "es": "La inscripción de $1 no ha sido aceptada. Contacte con la secretaría.", "de": "Die Anmeldung von $1 wurde nicht angenommen. Bitte wenden Sie sich an das Sekretariat."}], ["^Les notes et la présence de (.+) ont été mises à jour\\.$", {"en": "The grades and attendance of $1 have been updated.", "es": "Las notas y la asistencia de $1 se han actualizado.", "de": "Noten und Anwesenheit von $1 wurden aktualisiert."}], ["^(.+) a été noté\\(e\\) absent\\(e\\) le (.+)\\. Total : (\\d+) absence\\(s\\)\\.$", {"en": "$1 was marked absent on $2. Total: $3 absence(s).", "es": "$1 fue registrado(a) como ausente el $2. Total: $3 ausencia(s).", "de": "$1 wurde am $2 als abwesend eingetragen. Gesamt: $3 Fehlzeit(en)."}], ["^(.+) \\((.+)\\) : (\\d+) absences\\.$", {"en": "$1 ($2): $3 absences.", "es": "$1 ($2): $3 ausencias.", "de": "$1 ($2): $3 Fehlzeiten."}], ["^Exclusion définitive : le seuil de (\\d+) absences est atteint\\.$", {"en": "Permanent exclusion: the threshold of $1 absences has been reached.", "es": "Expulsión definitiva: se ha alcanzado el umbral de $1 ausencias.", "de": "Endgültiger Ausschluss: Die Grenze von $1 Fehlzeiten ist erreicht."}], ["^Avertissement : le seuil de (\\d+) absences est atteint\\. À (\\d+) absences, l'exclusion est définitive\\.$", {"en": "Warning: the threshold of $1 absences has been reached. At $2 absences, the exclusion is permanent.", "es": "Advertencia: se ha alcanzado el umbral de $1 ausencias. A las $2 ausencias, la expulsión es definitiva.", "de": "Verwarnung: Die Grenze von $1 Fehlzeiten ist erreicht. Bei $2 Fehlzeiten ist der Ausschluss endgültig."}], ["^(\\d+) absence\\(s\\) enregistrée\\(s\\)\\. Les familles sont prévenues\\.", {"en": "$1 absence(s) saved. Families have been notified.", "es": "$1 ausencia(s) guardada(s). Se ha avisado a las familias.", "de": "$1 Fehlzeit(en) gespeichert. Die Familien wurden benachrichtigt."}], ["^Seuils : avertissement à (\\d+) absences, exclusion définitive à (\\d+) absences \\(cumul sur l'année\\)\\.$", {"en": "Thresholds: warning at $1 absences, permanent exclusion at $2 absences (cumulative over the year).", "es": "Umbrales: advertencia a las $1 ausencias, expulsión definitiva a las $2 ausencias (acumuladas en el año).", "de": "Grenzen: Verwarnung bei $1 Fehlzeiten, endgültiger Ausschluss bei $2 Fehlzeiten (im Schuljahr summiert)."}]];
NP.forEach(([re, t]) => ['en', 'es', 'de'].forEach(l => (PAT[l] = PAT[l] || []).push([new RegExp(re), t[l]])));

/* ---------- Traduction d'un texte ---------- */
function T(txt){
  if (lang === 'fr' || !D || txt == null) return txt;
  const raw = String(txt), k = norm(raw); if (!k) return raw;
  let v = D[k];
  if (v == null && k.indexOf('· ') === 0) { const r = T(k.slice(2)); if (r !== k.slice(2)) v = '· ' + r; }   /* « · texte » */
  if (v == null) {
    const m = k.match(/^([^:]{2,60}:)\s*(.+)$/);                  /* « Connecté : Marie » */
    if (m && D[m[1]] != null) v = D[m[1]] + ' ' + m[2];
  }
  if (v == null) { for (const [re, r] of (PAT[lang] || [])) { const m = k.match(re); if (m) { v = typeof r === 'function' ? r(m) : k.replace(re, r); break; } } }
  if (v == null) return raw;
  const lead = (raw.match(/^\s*/) || [''])[0], trail = (raw.match(/\s*$/) || [''])[0];
  return lead + v + trail;
}
window.T = T;

const ATTR = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1, CODE:1, PRE:1 };
let busy = false;

function node(n){
  if (n.nodeType === 3) {
    const p = n.parentNode; if (!p || SKIP[p.nodeName] || (p.closest && p.closest('[translate=no],.notranslate'))) return;
    const forc = p.getAttribute && p.getAttribute('data-' + lang);   /* traduction imposée par le balisage (mot ambigu) */
    const t = forc || T(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t;
  } else if (n.nodeType === 1) {
    if (SKIP[n.nodeName] || n.getAttribute('translate') === 'no' || n.classList.contains('notranslate')) return;
    ATTR.forEach(a => { if (n.hasAttribute(a)) { const v = n.getAttribute(a), t = T(v); if (t !== v) n.setAttribute(a, t); } });
    if (n.nodeName === 'INPUT' && /^(submit|button)$/.test(n.type)) { const t = T(n.value); if (t !== n.value) n.value = t; }
    n.childNodes.forEach(node);
  }
}
function tout(){
  busy = true;
  try {
    node(document.body || H);
    const t = T(document.title); if (t !== document.title) document.title = t;
    const md = document.querySelector('meta[name=description]'); if (md) { const c = md.getAttribute('content'), t2 = T(c); if (t2 !== c) md.setAttribute('content', t2); }
  } finally { busy = false; }
}
function observer(){
  new MutationObserver(ms => {
    if (busy) return; busy = true;
    try { ms.forEach(m => { if (m.type === 'childList') m.addedNodes.forEach(node); else if (m.type === 'characterData') node(m.target); }); } finally { busy = false; }
  }).observe(H, { childList:true, subtree:true, characterData:true });
}

/* ---------- Boîtes de dialogue du navigateur ---------- */
['alert', 'confirm', 'prompt'].forEach(f => { const o = window[f].bind(window); window[f] = function(m, d){ return o(T(m), d); }; });

/* ---------- Dates : le nom des mois suit la langue ---------- */
const LOCALE = { fr:'fr-FR', en:'en-GB', es:'es-ES', de:'de-DE' };
window.LOCALE = LOCALE[lang] || 'fr-FR';
if (lang !== 'fr' && typeof window.fmtDate === 'function') {
  window.fmtDate = function(ts){ try { const d = ts && ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString(window.LOCALE, { day:'numeric', month:'long', year:'numeric' }); } catch(e){ return ''; } };
}

/* ---------- Bouton « Choisir votre langue » ---------- */
function etiquettes(){ document.querySelectorAll('.lang-code').forEach(el => el.textContent = lang.toUpperCase()); }
function boite(){
  let m = document.getElementById('m-langue'); if (m) return m;
  m = document.createElement('div'); m.className = 'modal'; m.id = 'm-langue'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'ml-titre');
  m.innerHTML = '<div class="in" style="max-width:420px"><button class="x" type="button" data-fermer-langue aria-label="Fermer">×</button>' +
    '<h2 id="ml-titre">Choisir votre langue</h2><div class="langues">' +
    dispo.map(l => '<button type="button" class="langue' + (l.c === lang ? ' on' : '') + '" data-lang="' + l.c + '" translate="no"' + (l.c === lang ? ' aria-current="true"' : '') + '><b>' + l.n + '</b><span>' + l.c.toUpperCase() + '</span></button>').join('') +
    '</div></div>';
  document.body.appendChild(m); return m;
}
window.choisirLangue = function(c){
  if (!dispo.some(l => l.c === c)) return;
  if (c === lang) { const m = document.getElementById('m-langue'); if (m) m.classList.remove('open'); return; }
  try { LS.setItem('bhn_lang', c); sessionStorage.removeItem('bhn_cms_' + (window.CMS ? CMS.page() : '')); } catch(e){}
  location.reload();   /* tout le site (y compris ce que les scripts dessinent) se redessine dans la nouvelle langue */
};
document.addEventListener('click', e => {
  if (e.target.closest('[data-lang-open]')) { e.preventDefault(); const m = boite(); m.classList.add('open'); busy = false; const b = m.querySelector('.langue.on') || m.querySelector('.langue'); b && b.focus(); return; }
  const b = e.target.closest('[data-lang]'); if (b) { e.preventDefault(); window.choisirLangue(b.getAttribute('data-lang')); return; }
  if (e.target.closest('[data-fermer-langue]') || e.target.id === 'm-langue') { const m = document.getElementById('m-langue'); m && m.classList.remove('open'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.getElementById('m-langue'); m && m.classList.remove('open'); } });
etiquettes();

/* ---------- Démarrage ---------- */
if (lang !== 'fr') {
  const go = () => { D = (window.BHN_LANG || {})[lang]; if (!D) return; tout(); observer(); };
  if ((window.BHN_LANG || {})[lang]) go();
  else {
    const s = document.createElement('script'); s.src = 'assets/lang-' + lang + '.js?v=20'; s.onload = go; document.head.appendChild(s);
  }
}
})();
