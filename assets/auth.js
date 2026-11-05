/* Lycée de Bahouan - session sécurisée
   - Administrateur : compte Firebase Authentication + document admins/{uid} (vérifié aussi par les règles Firestore)
   - Élève : compte Firebase Authentication (session conservée sur l'appareil)
   - Parent : vrai compte Firebase (e-mail + mot de passe, ou Google) ; document parents/{uid} qui garde les codes de suivi de ses enfants */
(function(){
const S = window.SITE, DB = window.DB, esc = window.esc;
const LS = localStorage, SS = sessionStorage;
const AUTH = (window.firebase && firebase.auth) ? firebase.auth() : null;
window.AUTH = AUTH;
const INACTIVITE_ADMIN = 30 * 60 * 1000;   /* déconnexion automatique de l'administrateur après 30 min sans activité */

const fullName = p => p ? ((p.nom||'') + ' ' + (p.prenom||'')).trim() : '';
const lire = (k, d) => { try { const v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch(e){ return d; } };

/* Code de suivi : 12 caractères tirés avec le générateur sécurisé du navigateur (alphabet sans caractères ambigus) */
function nouveauCode(){
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', buf = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  const s = Array.from(buf, b => alpha[b % alpha.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
}
const normCode = c => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 12 ? s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8) : s; };

const Session = window.Session = {
  user: null,          /* élève connecté (jamais un administrateur) */
  ancien: false,       /* session anonyme d'un ancien élève (groupes WhatsApp des anciens) */
  authUser: null,      /* utilisateur Firebase quel que soit son rôle */
  admin: false,
  role: '',            /* 'super' | 'admin' | 'enseignant' (vide si pas du personnel) */
  ens: null,           /* fiche de l'enseignant validé : matières et classes autorisées */
  ensAttente: null,    /* fiche d'un enseignant inscrit mais pas encore validé (ou refusé) */
  profile: null,
  parentDoc: null,     /* fiche du parent connecté : { uid, nom, email, enfants:[{code, nom, classe}] } */
  fullName, nouveauCode, normCode,
  isAdmin: () => Session.admin,
  isSuper: () => Session.role === 'super',
  isEns: () => Session.role === 'enseignant',
  isEleve: () => !!Session.user,
  isParent: () => !!Session.parentDoc,
  vue: () => SS.getItem('bhn_vue') || (Session.admin ? 'admin' : ''),
  setVue(v){ SS.setItem('bhn_vue', v); },

  /* ----- Administrateur ----- */
  async chargerRole(user){
    Session.admin = false; Session.role = ''; Session.ens = null; Session.ensAttente = null;
    const a = await DB.collection('admins').doc(user.uid).get();
    if (a.exists) { Session.admin = true; Session.role = (a.data() || {}).role === 'super' ? 'super' : 'admin'; return; }
    const e = await DB.collection('enseignants').doc(user.uid).get();
    if (e.exists) {
      const d = e.data() || {};
      if (d.statut === 'valide') { Session.admin = true; Session.role = 'enseignant'; Session.ens = d; }
      else Session.ensAttente = d;
    }
  },
  async loginAdmin(email, pw, rester){
    if (!AUTH) throw new Error('Authentification indisponible.');
    rester = rester !== false;   /* par défaut : on reste connecté sur l'appareil (super administrateur, administrateur, enseignant) */
    await AUTH.setPersistence(rester ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
    if (rester) LS.setItem('bhn_rester', '1'); else LS.removeItem('bhn_rester');
    LS.setItem('bhn_email_admin', String(email).trim());
    const cred = await AUTH.signInWithEmailAndPassword(String(email).trim(), pw);
    await Session.chargerRole(cred.user);
    if (!Session.admin && !Session.ensAttente) { await AUTH.signOut(); const e = new Error("Ce compte n'est pas autorisé pour l'administration. Les enseignants doivent d'abord demander l'accès."); e.code = 'bhn/pas-admin'; throw e; }
    Session.authUser = cred.user; Session.user = null; Session.profile = null;
    SS.setItem('bhn_vue', 'admin'); LS.setItem('bhn_hint', 'admin');
    if (Session.admin) { try { await DB.collection('journal').add({ uid: cred.user.uid, email: cred.user.email || '', action: 'Connexion ' + Session.role, date: Date.now() }); } catch(e){} }
    return cred.user;
  },

  /* ----- Parent : vrai compte (e-mail + mot de passe, ou Google). Les codes de suivi de ses enfants sont enregistrés dans parents/{uid},
     il les retrouve donc sur tous ses appareils. ----- */
  enfants: () => (Session.parentDoc && Array.isArray(Session.parentDoc.enfants)) ? Session.parentDoc.enfants : [],
  enfant(){ const l = Session.enfants(), c = LS.getItem('bhn_enfant_code'); return l.find(x => x.code === c) || l[0] || null; },
  /* Charge la fiche parent ; creer = true : la crée si elle n'existe pas (inscription), sinon refuse (connexion). */
  async assurerParent(user, nom, creer){
    const ref = DB.collection('parents').doc(user.uid), snap = await ref.get();
    if (snap.exists) Session.parentDoc = snap.data();
    else {
      if (!creer) { const e = new Error("Aucun compte parent avec cette adresse. Créez d'abord votre compte parent."); e.code = 'bhn/pas-parent'; throw e; }
      let el = { exists: false };   /* lire une fiche élève inexistante est refusé par les règles : on l'interprète comme « pas un élève » */
      try { el = await DB.collection('eleves').doc(user.uid).get(); } catch(x){}
      if (el.exists) { const e = new Error("Ce compte est un compte élève. Utilisez l'espace élève."); e.code = 'bhn/compte-eleve'; throw e; }
      const d = { uid: user.uid, nom: String(nom || user.displayName || '').slice(0, 80), email: user.email || '', enfants: [], createdAt: Date.now() };
      await ref.set(d); Session.parentDoc = d;
    }
    Session.authUser = user; Session.user = null; Session.profile = null; LS.setItem('bhn_hint', 'parent'); LS.removeItem('bhn_nouveau_parent');
  },
  async _enregistrerEnfants(l){
    const pd = Session.parentDoc; if (!pd) throw new Error('Non connecté');
    const doc = Object.assign({}, pd, { enfants: l });
    if (!pd.local) await DB.collection('parents').doc(pd.uid).set(doc);   /* local = aperçu administrateur : rien n'est enregistré */
    Session.parentDoc = doc;
  },
  /* Code parent à usage unique (généré par le super administrateur dans codes_parent/{code}).
     Un lot atomique marque le code « utilisé » ET ajoute l'enfant au compte du parent ; les règles Firestore vérifient les deux ensemble. */
  async utiliserCodeParent(brut){
    const c = normCode(brut); if (c.length !== 14) throw new Error('Le code parent comporte 12 caractères (XXXX-XXXX-XXXX).');
    const pd = Session.parentDoc; if (!pd || pd.local) throw new Error('Non connecté.');
    let snap; try { snap = await DB.collection('codes_parent').doc(c).get(); } catch(e){ throw new Error('Service momentanément indisponible. Vérifiez votre connexion et réessayez.'); }
    const d = snap.exists ? snap.data() : null;
    if (!d) throw new Error('Code inconnu. Vérifiez-le ou demandez-en un nouveau à l\'administration.');
    if (d.utilise && d.par !== pd.uid) throw new Error('Ce code a déjà été utilisé. Demandez-en un nouveau à l\'administration.');
    if (!d.utilise && d.exp && Date.now() > d.exp) throw new Error('Ce code a expiré. Demandez-en un nouveau à l\'administration.');
    if (Session.enfants().some(x => x.code === d.suivi)) throw new Error('Cet enfant est déjà dans votre compte : aucun code n\'est nécessaire.');
    const l = Session.enfants().slice(); if (l.length >= 12) throw new Error('Vous ne pouvez pas ajouter plus de 12 enfants.');
    l.push({ code: d.suivi, nom: String(d.nom || '').slice(0, 120), classe: String(d.classe || '').slice(0, 30) });
    const doc = Object.assign({}, pd, { enfants: l, jeton: c });
    /* étape 1 : consommer le code (déjà fait si un essai précédent de ce même compte a été interrompu) */
    if (!(d.utilise && d.par === pd.uid)) {
      try { await DB.collection('codes_parent').doc(c).update({ utilise: true, par: pd.uid, utiliseLe: Date.now() }); }
      catch(e){ throw new Error('Étape 1 refusée (' + ((e && e.code) || 'erreur') + '). Demandez un nouveau code à l\'administration.'); }
    }
    /* étape 2 : enregistrer l'enfant dans le compte du parent */
    try { await DB.collection('parents').doc(pd.uid).set(doc); }
    catch(e){ throw new Error('Étape 2 refusée (' + ((e && e.code) || 'erreur') + '). Votre code est conservé : réessayez, sinon prévenez l\'administration.'); }
    Session.parentDoc = doc; LS.setItem('bhn_enfant_code', d.suivi);
    return { code: d.suivi, nom: d.nom, classe: d.classe };
  },
  choisirEnfant(code){ LS.setItem('bhn_enfant_code', code); },
  async retirerEnfant(code){ await Session._enregistrerEnfants(Session.enfants().filter(x => x.code !== code)); if (LS.getItem('bhn_enfant_code') === code) LS.removeItem('bhn_enfant_code'); },
  logoutParent(){ ['bhn_enfant_code', 'bhn_nouveau_parent'].forEach(k => LS.removeItem(k)); Session.parentDoc = null; if (LS.getItem('bhn_hint') === 'parent') LS.removeItem('bhn_hint'); },

  /* ----- Élève ----- */
  async logoutEleve(){ if (AUTH) await AUTH.signOut(); Session.parentDoc = null; Session.user = null; Session.profile = null; Session.authUser = null; Session.admin = false; Session.role = ''; Session.ens = null; Session.ensAttente = null; },
  valide: p => { p = p || Session.profile; return !!p && (p.statut === undefined || p.statut === 'valide'); },
  profilComplet(p){ p = p || Session.profile; return !!(p && p.nom && p.classe && p.annee); },
  /* Compte provisoire (nom retrouvé dans la liste, sans e-mail) : l'élève y ajoute sa vraie adresse et son mot de passe. */
  emailFictif(){ const u = Session.authUser; return !!(u && /@eleves\.invalid$/i.test(u.email || '')); },
  async definirEmail(email, pwd){
    const u = AUTH.currentUser; if (!u) throw new Error('Non connecté.');
    email = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || /@eleves\.invalid$/.test(email)) throw new Error('Adresse e-mail invalide.');
    if (String(pwd || '').length < 6) throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
    let cred = null; try { cred = JSON.parse(LS.getItem('bhn_el_cred') || 'null'); } catch(e){}
    if (cred && cred.p) { try { await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, cred.p)); } catch(e){} }
    let verif = false;
    try { await u.updateEmail(email); }
    catch(e){
      if (e && e.code === 'auth/operation-not-allowed') { await u.verifyBeforeUpdateEmail(email); verif = true; }   /* projet qui exige la confirmation par e-mail */
      else if (e && e.code === 'auth/email-already-in-use') throw new Error('Cette adresse est déjà utilisée par un autre compte.');
      else if (e && e.code === 'auth/requires-recent-login') throw new Error('Pour votre sécurité, reconnectez-vous puis recommencez.');
      else throw e;
    }
    await u.updatePassword(pwd);
    if (verif) { if (cred) LS.setItem('bhn_el_cred', JSON.stringify({ e: cred.e, p: pwd })); return { verif: true }; }
    LS.removeItem('bhn_el_cred');
    try { const id = (Session.profile && Session.profile.id) || u.uid; await DB.collection('eleves').doc(id).update({ email }); } catch(e){}
    return { verif: false };
  },

  async saveProfile(data){
    if (!Session.user) throw new Error('Non connecté');
    const id = (Session.profile && Session.profile.id) || Session.user.uid;
    const code = (Session.profile && Session.profile.code) || nouveauCode();
    const doc = Object.assign({ uid: Session.user.uid, email: (/@eleves\.invalid$/i.test(Session.user.email || '') ? '' : Session.user.email) || (Session.profile && Session.profile.email) || '', code }, data);
    if (Session.profile && Session.profile._nouveau) { doc.statut = 'attente'; doc.dateInscription = new Date().toLocaleString(); }   /* l'administrateur valide chaque nouvel élève */
    await DB.collection('eleves').doc(id).set(doc, { merge: true });
    /* identité visible par les parents qui ont le code (l'élève n'écrit jamais de note) */
    const ident = { eleveId: id, nom: doc.nom || '', prenom: doc.prenom || '', classe: doc.classe || '', annee: doc.annee || '', updated: Date.now() };
    try { await DB.collection('suivi').doc(code).set(ident, { merge: true }); } catch(e){ console.warn('Suivi non initialisé', e); }
    Session.profile = Object.assign({}, Session.profile, doc, { id, _nouveau: false });
  },

  /* ----- Fiche pré-enregistrée par l'administration (fiche de classe lue par OCR ou ajout manuel) -----
     L'élève donne son nom, sa classe et l'année : si la liste d'inscription (roster) le contient, son compte est relié à sa fiche
     (notes, absences, matricule déjà saisis). Renvoie { etat: 'ok' | 'absent' | 'prise' | 'indisponible' }. */
  async reclamerFiche(user, d){
    let r;
    try { r = await DB.collection('roster').doc(await window.L.roster.cle(d.nom, d.prenom, d.classe, d.annee)).get(); } catch(e){ return { etat: 'indisponible', code: (e && e.code) || '', msg: (e && e.message) || '', ou: 'lecture de la liste' }; }
    if (!r.exists) return { etat: 'absent' };
    const f = r.data() || {}; if (!f.eleveId) return { etat: 'absent' };
    const maj = { uid: user.uid }, em = String(user.email || d.email || '').trim().toLowerCase().slice(0, 120);
    if (em && !/@eleves\.invalid$/.test(em)) maj.email = em;   /* adresse provisoire (@eleves.invalid) : jamais enregistrée dans la fiche */
    if (d.age) maj.age = String(d.age).slice(0, 3);
    try { await DB.collection('eleves').doc(f.eleveId).update(maj); }
    catch(e){ return { etat: (e && e.code === 'permission-denied') ? 'prise' : 'indisponible', code: (e && e.code) || '', msg: (e && e.message) || '', ou: 'liaison de la fiche' }; }   /* refusé : la fiche est déjà reliée à un autre compte */
    if (window.Notif) { try { Notif.envoyer({ staff: 'admin' }, 'Élève relié à sa fiche', (f.nom + ' ' + (f.prenom || '')).trim() + ' (' + f.classe + ') vient de créer son compte.', 'administration.html'); } catch(e){} }
    return { etat: 'ok', fiche: f };
  },

  /* ----- Garde d'accès (les règles Firestore font foi : ceci évite seulement d'afficher une page vide) ----- */
  require(role){
    const retour = encodeURIComponent(location.pathname.split('/').pop() + location.hash);
    const go = r => { location.replace('connexion.html?role=' + r + '&retour=' + retour); return false; };
    if (role === 'admin') return Session.admin || !!Session.ensAttente || go('admin');
    if (Session.admin) return true;
    if (role === 'eleve') return Session.isEleve() || go('eleve');
    if (role === 'parent') return Session.isParent() || go('parent');
    return true;
  },
  async logoutAll(){
    Session.logoutParent(); LS.removeItem('bhn_hint'); LS.removeItem('bhn_rester'); SS.removeItem('bhn_vue'); SS.removeItem('bhn_apercu');
    try { await Session.logoutEleve(); } catch(e){}
    location.href = 'index.html';
  }
};

/* ---------- Chargement du rôle ---------- */
let pret = false;
Session.ready = new Promise(resolve => {
  if (!AUTH || !DB) { pret = true; return resolve(); }
  let fini = false;
  AUTH.onAuthStateChanged(async user => {
    Session.authUser = user || null; Session.user = null; Session.profile = null; Session.parentDoc = null; Session.admin = false; Session.ancien = false;
    if (user && user.isAnonymous) {   /* ancien élève (session anonyme) : accès seulement aux groupes WhatsApp des anciens */
      Session.ancien = true;
      if (LS.getItem('bhn_hint') === 'admin' || LS.getItem('bhn_hint') === 'eleve') LS.removeItem('bhn_hint');
    } else if (user) {
      try { await Session.chargerRole(user); } catch(e){}
      if (Session.admin) { LS.setItem('bhn_hint', 'admin'); surveillerInactivite(); }
      else if (Session.ensAttente) { LS.setItem('bhn_hint', 'admin'); surveillerInactivite(); }
      if (!Session.admin && !Session.ensAttente) {   /* compte parent ? (fiche parents/{uid}, ou compte en cours de création) */
        let pd = null;
        try { const p = await DB.collection('parents').doc(user.uid).get(); if (p.exists) pd = p.data(); } catch(e){}
        if (!pd && LS.getItem('bhn_nouveau_parent') === '1') pd = { uid: user.uid, nom: user.displayName || '', email: user.email || '', enfants: [], createdAt: Date.now() };
        if (pd) { Session.parentDoc = pd; LS.setItem('bhn_hint', 'parent'); }
      }
      if (!Session.admin && !Session.ensAttente && !Session.parentDoc) {
        Session.user = user; LS.setItem('bhn_hint', 'eleve');
        try {
          /* 1) fiche à son identifiant ; 2) fiche déjà liée à son compte ; 3) fiche créée par l'administration avec son adresse Google (elle est alors reprise : champ uid ajouté) */
          let doc = null;
          try { const d1 = await DB.collection('eleves').doc(user.uid).get(); if (d1.exists) doc = d1; } catch(e){}
          if (!doc) { try { const q = await DB.collection('eleves').where('uid', '==', user.uid).limit(1).get(); if (!q.empty) doc = q.docs[0]; } catch(e){} }
          if (!doc && user.email) {
            try {
              const q = await DB.collection('eleves').where('email', '==', String(user.email).toLowerCase()).limit(5).get();
              const d3 = q.docs.find(x => !x.data().uid || x.data().uid === user.uid);
              if (d3) { if (!d3.data().uid) await d3.ref.update({ uid: user.uid }); doc = d3; }
            } catch(e){ console.warn('Fiche élève par e-mail introuvable', e); }
          }
          if (doc) {
            Session.profile = Object.assign({ id: doc.id }, doc.data());
            if (!Session.profile.code) {   /* compte plus ancien : on lui attribue un code de suivi */
              const code = nouveauCode();
              try { await DB.collection('eleves').doc(doc.id).set({ code }, { merge: true }); Session.profile.code = code; } catch(e){}
            }
            /* le parent ne peut entrer que si suivi/{code} existe : on le crée ou on le complète à chaque connexion de l'élève */
            const pc = Session.profile;
            if (pc.code && pc.nom && pc.classe && pc.annee) {
              try { const sv = await DB.collection('suivi').doc(pc.code).get();
                if (!sv.exists) await DB.collection('suivi').doc(pc.code).set({ eleveId: doc.id, nom: pc.nom || '', prenom: pc.prenom || '', classe: pc.classe || '', annee: pc.annee || '', updated: Date.now() });
              } catch(e){ console.warn('Suivi parent non créé', e); }
            }
          } else Session.profile = { id: user.uid, uid: user.uid, email: user.email || '', nom: user.displayName || '', prenom: '', age: '', classe: '', annee: '', matricule: '', code: '', _nouveau: true };
        } catch(e){ console.warn('Profil élève indisponible', e); Session.profile = { id: user.uid, uid: user.uid, email: user.email || '', nom: user.displayName || '', prenom: '', age: '', classe: '', annee: '', matricule: '', code: '', _nouveau: true }; }
      }
    } else if (['admin', 'eleve', 'parent'].indexOf(LS.getItem('bhn_hint')) > -1) LS.removeItem('bhn_hint');
    pret = true;
    if (!fini) { fini = true; resolve(); }
    updateHeader(); adminBar();
  });
  setTimeout(() => { if (!fini) { fini = true; pret = true; resolve(); } }, 7000);
});

/* les pages attendent aussi les réglages du site (liste des classes, numéro…) avant de dessiner leurs listes */
if (window.siteReady) Session.ready = Promise.all([Session.ready, window.siteReady]).then(() => {});

/* ---------- Déconnexion automatique de l'administrateur ---------- */
let minuteur = null, surveille = false;
function surveillerInactivite(){
  if (LS.getItem('bhn_rester') === '1') return;   /* « Rester connecté » : pas de déconnexion automatique */
  const reset = () => { clearTimeout(minuteur); minuteur = setTimeout(async () => { try { await AUTH.signOut(); } catch(e){} location.replace('connexion.html?role=admin&expire=1'); }, INACTIVITE_ADMIN); };
  if (!surveille) { surveille = true; ['click', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, reset, { passive: true })); }
  reset();
}

/* ---------- En-tête ---------- */
function updateHeader(){
  const slot = document.getElementById('auth-slot'), slotM = document.getElementById('auth-slot-m');
  if (!slot) return;
  const hint = LS.getItem('bhn_hint');
  let role = Session.admin ? 'admin' : Session.user ? 'eleve' : '';
  if (!role && !pret && (hint === 'admin' || hint === 'eleve' || hint === 'parent')) role = hint;      /* affichage immédiat avant la fin du chargement */
  if (!role && Session.isParent()) role = 'parent';
  let h, hm;
  if (role === 'admin') { h = '<a class="btn small" href="administration.html">Administration</a><a class="lien-s" href="#" data-sortir>Quitter</a>'; hm = '<a class="simple" href="administration.html">Administration</a><a class="simple" href="#" data-sortir>Se déconnecter</a>'; }
  else if (role === 'eleve') { const n = (Session.profile && (Session.profile.prenom || Session.profile.nom)) || 'Mon espace'; h = '<span class="who">' + esc(n) + '</span><a class="btn small" href="espace-eleve.html">Mon espace</a><a class="lien-s" href="#" data-sortir>Quitter</a>'; hm = '<a class="simple" href="espace-eleve.html">Mon espace</a><a class="simple" href="#" data-sortir>Se déconnecter</a>'; }
  else if (role === 'parent') { h = '<a class="btn small" href="espace-parent.html">Espace parent</a><a class="lien-s" href="#" data-sortir>Quitter</a>'; hm = '<a class="simple" href="espace-parent.html">Espace parent</a><a class="simple" href="#" data-sortir>Se déconnecter</a>'; }
  else { h = '<a class="btn small" id="btn-conn" href="connexion.html">Se connecter</a>'; hm = '<a class="simple" href="connexion.html">Se connecter</a>'; }
  slot.innerHTML = h; if (slotM) slotM.innerHTML = hm;
  document.querySelectorAll('.acces-conn').forEach(q => { const cible = role === 'admin' ? ['administration.html', 'Administration'] : role === 'eleve' ? ['espace-eleve.html', 'Mon espace'] : role === 'parent' ? ['espace-parent.html', 'Espace parent'] : ['connexion.html', 'Se connecter']; q.href = cible[0]; const t = q.querySelector('.t'); if (t) t.textContent = cible[1]; });
}
document.addEventListener('click', e => { if (e.target.closest('[data-sortir]')) { e.preventDefault(); Session.logoutAll(); } });
updateHeader();

/* ---------- Barre « Voir le site comme… » (administrateur) ---------- */
function adminBar(){
  if (!Session.admin || document.getElementById('adminbar')) return;
  const page = location.pathname.split('/').pop() || 'index.html';
  const vue = ['administration.html', 'espace-eleve.html', 'espace-parent.html'].includes(page) ? page : 'index.html';
  const bar = document.createElement('div'); bar.id = 'adminbar'; bar.className = 'adminbar';
  bar.innerHTML = '<div class="wrap"><b>Mode administrateur</b><label>Voir le site comme : <select id="vue-sel">' +
    [['administration.html', 'Administration'], ['espace-eleve.html', 'Élève'], ['espace-parent.html', 'Parent'], ['index.html', 'Visiteur (site public)']]
      .map(o => '<option value="' + o[0] + '"' + (o[0] === vue ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
    '</select></label><a href="administration.html">Retour à l\'administration</a></div>';
  document.body.insertBefore(bar, document.body.firstChild);
  document.getElementById('vue-sel').onchange = e => { location.href = e.target.value; };
}

/* ---------- Installation de l'application (PWA) ----------
   Tout bouton portant data-installer lance l'installation. Si le navigateur ne propose pas l'installation
   directe (iPhone, Firefox…), une fenêtre explique les deux gestes à faire. Le bouton se cache quand le site
   est déjà ouvert comme une application. */
let evInstall = null;
const dejaInstalle = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function majInstall(){
  document.querySelectorAll('[data-installer]').forEach(b => { b.hidden = dejaInstalle(); });
  const b = document.getElementById('btn-installer'); if (b) b.hidden = !evInstall || dejaInstalle();
  const a = document.getElementById('inst-aide'); if (a && dejaInstalle()) a.hidden = true;
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evInstall = e; majInstall(); });
window.addEventListener('appinstalled', () => { evInstall = null; majInstall(); });
function aideInstall(){
  let m = document.getElementById('m-install');
  if (!m) {
    const ua = navigator.userAgent || '', ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), android = /android/i.test(ua);
    const etapes = ios
      ? ['Touchez le bouton « Partager » du navigateur (le carré avec une flèche).', 'Choisissez « Sur l\'écran d\'accueil », puis « Ajouter ».']
      : android
        ? ['Touchez le menu du navigateur (les trois points en haut à droite).', 'Choisissez « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».']
        : ['Dans la barre d\'adresse du navigateur, cliquez sur l\'icône « Installer ».', 'Si elle n\'apparaît pas, ouvrez le menu du navigateur et choisissez « Installer l\'application ».'];
    m = document.createElement('div'); m.className = 'modal'; m.id = 'm-install'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'mi-titre');
    m.innerHTML = '<div class="in" style="max-width:460px"><button class="x" type="button" data-fermer-install aria-label="Fermer">×</button><h2 id="mi-titre">Télécharger l\'application</h2>' +
      '<p>Le Lycée de Bahouan s\'installe sur votre écran d\'accueil comme une application, sans passer par un magasin d\'applications.</p><ol class="etapes-install">' + etapes.map(x => '<li>' + x + '</li>').join('') + '</ol></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-fermer-install]')) m.classList.remove('open'); });
  }
  m.classList.add('open');
}
window.installerApp = async () => {
  if (evInstall) { try { evInstall.prompt(); await evInstall.userChoice; } catch(e){} evInstall = null; majInstall(); return; }
  aideInstall();
};
document.addEventListener('click', e => { if (e.target.closest('[data-installer]')) { e.preventDefault(); window.installerApp(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.getElementById('m-install'); m && m.classList.remove('open'); } });
majInstall();
})();
