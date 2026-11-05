/* Lycée de Bahouan - notifications
   1) Envoi : Notif.envoyer(cible, titre, texte, lien) écrit une notification dans Firestore.
        cible = { uid }      : une personne (validation d'un compte…)
                { code }     : un élève et ses parents (code de suivi)
                { staff }    : 'admin' (administration) ou 'super' (super administrateur)
                { public }   : 'tous' ou 'classe:Première C'
   2) Réception : une cloche (🔔) avec pastille « non lus », mise à jour en direct. Quand l'application est ouverte
      mais en arrière-plan, une notification du téléphone s'affiche (si l'utilisateur l'a autorisée).
   3) Application fermée : si S.vapidKey est renseignée et les Cloud Functions (dossier functions/) déployées,
      l'appareil enregistre un jeton et reçoit les notifications même téléphone verrouillé. */
(function(){
const S = window.SITE, DB = window.DB, LS = localStorage;
if (!DB) return;
const T = t => (window.T ? window.T(t) : t);
const esc = window.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const N = window.Notif = {};

/* ---------- Envoi (jamais bloquant : hors ligne, l'écriture part au retour du réseau) ---------- */
function ecrire(chemin, doc){
  try { const p = DB.collection(chemin).add(Object.assign({ date: Date.now() }, doc)); if (p && p.catch) p.catch(e => console.warn('Notification non envoyée', e && e.code)); } catch(e){}
}
N.envoyer = (cible, titre, texte, lien) => {
  cible = cible || {};
  const d = { titre: String(titre || '').slice(0, 120), texte: String(texte || '').slice(0, 300), lien: String(lien || '').slice(0, 120) };
  if (!d.titre) return;
  if (cible.uid) ecrire('utilisateurs/' + cible.uid + '/notifs', d);
  else if (cible.code) ecrire('familles/' + cible.code + '/notifs', d);
  else if (cible.staff) ecrire('notifs_staff', Object.assign({ pour: cible.staff }, d));
  else if (cible.public) ecrire('notifs_publiques', Object.assign({ cible: String(cible.public).slice(0, 60) }, d));
};

/* ---------- Réception ---------- */
const PAGES = /(espace-eleve|espace-parent|administration|index)(\.html)?$|\/$/;
const items = new Map(); let vuKey = '', unsubs = [], demarre = false, ouvert = false;
const vu = () => parseInt(LS.getItem(vuKey) || '0', 10) || 0;
const nonLus = () => [...items.values()].filter(x => (x.date || 0) > vu()).length;

function css(){
  if (document.getElementById('notif-css')) return;
  const s = document.createElement('style'); s.id = 'notif-css';
  s.textContent = '#nt-btn{position:fixed;left:14px;bottom:14px;z-index:9000;width:52px;height:52px;border-radius:50%;border:0;background:#0a2a5c;color:#fff;font-size:1.5rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}' +
    '#nt-btn b{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;border-radius:11px;background:#c0392b;color:#fff;font:700 .75rem/22px system-ui;text-align:center;padding:0 5px}' +
    '#nt-pan{position:fixed;left:0;right:0;bottom:0;z-index:9001;max-height:78vh;overflow:auto;background:#fff;color:#111;border-top:4px solid #c9a227;box-shadow:0 -8px 30px rgba(0,0,0,.3);padding:16px 18px 22px}' +
    '@media(min-width:700px){#nt-pan{left:14px;right:auto;width:400px;bottom:76px;border-radius:10px;border:1px solid #c5c9d3;max-height:70vh}}' +
    '#nt-pan h3{margin:0 0 10px;font-size:1.2rem;display:flex;justify-content:space-between;align-items:center}#nt-pan h3 button{border:0;background:none;font-size:1.6rem;cursor:pointer;line-height:1}' +
    '.nt-it{display:block;padding:10px 12px;margin:0 0 8px;border:1px solid #e2e5ec;border-left:4px solid #c5c9d3;background:#fafbfc;text-decoration:none;color:inherit}.nt-it.neuf{border-left-color:#c9a227;background:#fff8e1}' +
    '.nt-it b{display:block}.nt-it small{display:block;color:#666;margin-top:3px}#nt-toast{position:fixed;left:14px;right:14px;top:14px;z-index:9002;background:#0a2a5c;color:#fff;padding:12px 16px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer}@media(min-width:700px){#nt-toast{left:auto;width:380px}}';
  document.head.appendChild(s);
}
function badge(){
  const b = document.getElementById('nt-btn'); if (!b) return;
  const n = nonLus(); b.innerHTML = '🔔' + (n ? '<b>' + (n > 99 ? '99+' : n) + '</b>' : ''); b.setAttribute('aria-label', T('Notifications') + (n ? ' (' + n + ')' : ''));
}
const lienDe = x => { let l = x.lien || ''; if (/^espace-(eleve|parent)\.html$/.test(l)) l = (window.Session && Session.parentDoc) ? 'espace-parent.html' : 'espace-eleve.html'; return l || '#'; };
function liste(){ return [...items.values()].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 40); }
function panneau(){
  let p = document.getElementById('nt-pan');
  if (!ouvert) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement('div'); p.id = 'nt-pan'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', T('Notifications')); document.body.appendChild(p); }
  const seuil = vu(), l = liste(), perm = ('Notification' in window) ? Notification.permission : 'denied';
  p.innerHTML = '<h3><span>' + esc(T('Notifications')) + '</span><button type="button" id="nt-x" aria-label="' + esc(T('Fermer')) + '">×</button></h3>' +
    (perm === 'default' ? '<p><button class="btn dark s" type="button" id="nt-on">' + esc(T('Activer les notifications sur ce téléphone')) + '</button></p>' : '') +
    (perm === 'denied' && 'Notification' in window ? '<p style="font-size:.85rem;color:#666">' + esc(T('Les notifications sont bloquées dans le navigateur. Autorisez-les dans les réglages du site pour les recevoir.')) + '</p>' : '') +
    (l.length ? l.map(x => '<a class="nt-it' + ((x.date || 0) > seuil ? ' neuf' : '') + '" href="' + esc(lienDe(x)) + '"><b>' + esc(T(x.titre)) + '</b>' + (x.texte ? '<span>' + esc(T(x.texte)) + '</span>' : '') + '<small>' + esc(new Date(x.date || 0).toLocaleString(window.LANG || 'fr')) + '</small></a>').join('')
      : '<p style="color:#666">' + esc(T('Aucune notification pour le moment.')) + '</p>');
  p.querySelector('#nt-x').onclick = () => bascule(false);
  const on = p.querySelector('#nt-on'); if (on) on.onclick = async () => { await N.activer(); panneau(); };
}
function bascule(o){
  ouvert = o; panneau();
  if (!o) { LS.setItem(vuKey, String(Date.now())); badge(); }   /* tout est marqué comme lu à la fermeture */
}
function toast(x){
  let t = document.getElementById('nt-toast'); if (t) t.remove();
  t = document.createElement('div'); t.id = 'nt-toast'; t.setAttribute('role', 'status');
  t.innerHTML = '<b>' + esc(T(x.titre)) + '</b>' + (x.texte ? '<div>' + esc(T(x.texte)) + '</div>' : '');
  t.onclick = () => { t.remove(); if (x.lien) location.href = lienDe(x); else bascule(true); };
  document.body.appendChild(t); setTimeout(() => t.remove(), 6000);
}
async function natif(x){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const opt = { body: T(x.texte) || '', icon: 'images/icon-192.png', badge: 'images/icon-192.png', tag: x.cle, data: { lien: x.lien || 'index.html' } };
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(T(x.titre), opt); else new Notification(T(x.titre), opt);
  } catch(e){}
}
function recu(x){
  if (document.visibilityState === 'visible') toast(x); else natif(x);
}

N.activer = async () => {
  if (!('Notification' in window)) return false;
  let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission();
  if (p === 'granted') { await pushInit(); return true; }
  return false;
};

/* jeton d'envoi pour les notifications téléphone fermé (nécessite S.vapidKey + Cloud Functions) */
function charger(src){ return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
async function pushInit(ctx){
  if (!S.vapidKey || !('serviceWorker' in navigator) || !window.AUTH || !AUTH.currentUser) return;
  try {
    if (!(window.firebase && firebase.messaging)) await charger('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');
    const reg = await navigator.serviceWorker.ready, token = await firebase.messaging().getToken({ vapidKey: S.vapidKey, serviceWorkerRegistration: reg });
    if (!token) return;
    const c = ctx || cible();
    await DB.collection('appareils').doc(token).set({ uid: AUTH.currentUser.uid, role: c.role, codes: c.codes.slice(0, 12), classes: c.classes.slice(0, 12), maj: Date.now() });
    LS.setItem('bhn_push_token', token);
  } catch(e){ console.warn('Notifications téléphone fermé indisponibles', e && (e.code || e.message)); }
}
function cible(){
  const Sx = window.Session, codes = [], classes = new Set(), p = Sx.profile || Sx.user;
  if (p) { if (p.code) codes.push(p.code); if (p.classe) classes.add(p.classe); }
  if (Sx.parentDoc) (Sx.parentDoc.enfants || []).forEach(e => { if (e.code) codes.push(e.code); if (e.classe) classes.add(e.classe); });
  return { codes: [...new Set(codes)], classes: [...classes], role: Sx.role || (Sx.parentDoc ? 'parent' : 'eleve') };
}

N.demarrer = async () => {
  if (demarre) return; demarre = true;
  const Sx = window.Session; if (!Sx) return;
  await Sx.ready; const u = Sx.authUser; if (!u || u.isAnonymous) { demarre = false; return; }
  const c = cible(); vuKey = 'bhn_notif_vu_' + u.uid;
  if (!LS.getItem(vuKey)) LS.setItem(vuKey, String(Date.now()));   /* première fois : on ne signale pas tout l'historique */
  css();
  const btn = document.createElement('button'); btn.id = 'nt-btn'; btn.type = 'button'; btn.onclick = () => bascule(!ouvert); document.body.appendChild(btn);
  const sources = [['u', DB.collection('utilisateurs').doc(u.uid).collection('notifs')], ['p', DB.collection('notifs_publiques')]];
  c.codes.forEach(k => sources.push(['f' + k, DB.collection('familles').doc(k).collection('notifs')]));
  if (Sx.admin && Sx.role !== 'enseignant') sources.push(['s', DB.collection('notifs_staff')]);
  sources.forEach(([cle, ref]) => {
    let premier = true;
    unsubs.push(ref.orderBy('date', 'desc').limit(25).onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type !== 'added') return;
        const x = Object.assign({ cle: cle + ch.doc.id }, ch.doc.data());
        if (cle === 'p' && x.cible && x.cible !== 'tous' && !(x.cible.indexOf('classe:') === 0 && c.classes.includes(x.cible.slice(7)))) return;   /* annonce destinée à une autre classe */
        if (cle === 's' && x.pour === 'super' && Sx.role !== 'super') return;
        items.set(x.cle, x);
        if (!premier && (x.date || 0) > vu()) recu(x);
      });
      premier = false; badge(); if (ouvert) panneau();
    }, () => {}));
  });
  badge();
  if ('Notification' in window && Notification.permission === 'granted') pushInit(c);
};
N.arreter = () => { unsubs.forEach(f => { try { f(); } catch(e){} }); unsubs = []; items.clear(); demarre = false; const b = document.getElementById('nt-btn'); if (b) b.remove(); const p = document.getElementById('nt-pan'); if (p) p.remove(); };

if (PAGES.test(location.pathname)) {
  const go = () => { if (window.Session && Session.ready) N.demarrer(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
})();
