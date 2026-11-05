(function(){ document.querySelectorAll('[data-annee-slot]').forEach(function(s){ s.outerHTML = L.anneeField({ name: 'annee', value: L.anneeCourante() }); }); })();
/* Lycée de Bahouan - page de connexion */
(function(){
const S = window.SITE, $ = id => document.getElementById(id), esc = window.esc;
const params = new URLSearchParams(location.search);
const roleDemande = params.get('role');
let retour = params.get('retour') ? decodeURIComponent(params.get('retour')) : '';
if (!/^[\w\-]+\.html(#[\w\-]+)?$/.test(retour)) retour = '';
const ACCUEIL = { eleve:'espace-eleve.html', parent:'espace-parent.html', admin:'administration.html' };
const aller = r => { location.replace(retour && roleDemande === r ? retour : ACCUEIL[r]); };   /* replace : « Retour » ne ramène pas sur le formulaire déjà rempli */

/* Les vues (choix, élève, administration) font partie de l'historique : « Retour » ramène à la vue précédente, pas plus loin. */
function vue(v, sansHistorique){
  ['v-choix','v-eleve','v-parent','v-admin'].forEach(id => $(id).hidden = id !== 'v-' + v);
  if (!sansHistorique && (history.state && history.state.v) !== v) history.pushState({ v }, '', location.pathname + location.search);
}
window.addEventListener('popstate', e => { vue((e.state && e.state.v) || 'choix', true); });
history.replaceState({ v: 'choix' }, '', location.pathname + location.search);
(window.siteReady || Promise.resolve()).then(() => { const opts = '<option value="">Choisir…</option>' + S.classes.map(c => '<option>' + esc(c) + '</option>').join(''); $('ins-classe').innerHTML = opts; $('ver-classe').innerHTML = opts; });

function erreurAuth(e){
  const m = { 'auth/email-already-in-use':"Cette adresse e-mail est déjà inscrite. Choisissez « J'ai déjà un compte ».",
    'auth/weak-password':'Mot de passe trop court : 6 caractères minimum.', 'auth/invalid-email':"Adresse e-mail non valide.",
    'auth/user-not-found':'Aucun compte avec cette adresse. Inscrivez-vous à la première visite.', 'auth/wrong-password':'Mot de passe incorrect.',
    'auth/invalid-credential':'E-mail ou mot de passe incorrect.', 'auth/too-many-requests':'Trop de tentatives. Patientez quelques minutes.',
    'auth/network-request-failed':'Pas de connexion internet. Réessayez.', 'auth/unauthorized-domain':"Ce site n'est pas encore autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés).",
    'auth/operation-not-allowed':"Ce mode de connexion n'est pas activé dans Firebase (Authentication > Sign-in method)." };
  return m[e.code] || ('Erreur : ' + (e.message || e.code));
}
const say = (el, ok, t) => { el.className = 'msg ' + (ok ? 'ok' : 'err'); el.textContent = t; };

/* ----- Choix du rôle ----- */
document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
  const r = b.dataset.role;
  if (r === 'parent') { if (Session.isParent()) aller('parent'); else vue('parent'); }
  else if (r === 'admin') { vue('admin'); initAdmin(); }
  else { if (Session.user) aller('eleve'); else vue('eleve'); }
});
document.querySelectorAll('[data-retour]').forEach(b => b.onclick = () => { if (history.state && history.state.v && history.state.v !== 'choix') history.back(); else vue('choix'); });

/* ----- Élève : inscription / connexion ----- */
const ti = $('t-ins'), tc = $('t-con');
function onglet(ins){ ti.setAttribute('aria-selected', ins); tc.setAttribute('aria-selected', !ins); $('f-ver').hidden = !ins; if (!ins) $('f-ins').hidden = true; $('f-con').hidden = ins; }
ti.onclick = () => onglet(true); tc.onclick = () => onglet(false);


/* ----- Élève : vérification du nom dans la liste de l'administration -----
   Nom trouvé → l'élève entre directement dans son espace (compte provisoire, sans e-mail : il l'ajoutera dans son profil).
   Nom absent → le compte provisoire est supprimé et le formulaire d'inscription complet s'affiche (validation par l'administration). */
const FICTIF = '@eleves.invalid', CRED = 'bhn_el_cred';
const mdpAlea = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 24) + 'Aa1'; };
const lireCred = e => { try { const c = JSON.parse(localStorage.getItem(CRED) || 'null'); return c && c.e === e ? c.p : ''; } catch(x){ return ''; } };
$('f-ver').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]'), d = Object.fromEntries(new FormData(f).entries());
  btn.disabled = true; say(m, true, 'Vérification de votre nom…');
  if (!L.anneeOk(d.annee)) { btn.disabled = false; return say(m, false, L.MSG_ANNEE); }
  const annees = [d.annee];   /* l'année choisie par l'élève : la fiche est cherchée avec nom + classe + année */
  const pseudo = 'e' + (await L.roster.cle(d.nom, d.prenom, d.classe, 'x')).slice(0, 30) + FICTIF;
  const fin = async (txt, montrerInscription) => {
    try { if (AUTH.currentUser) await AUTH.currentUser.delete(); } catch(x){ try { await AUTH.signOut(); } catch(y2){} }
    localStorage.removeItem(CRED); localStorage.removeItem('bhn_hint');
    btn.disabled = false;
    if (montrerInscription) {
      const fi = $('f-ins'); fi.hidden = false; fi.nom.value = d.nom.trim(); fi.prenom.value = d.prenom.trim(); fi.classe.value = d.classe; const sel = fi.querySelector('.annee-sel'), hid = fi.querySelector('input[name=annee]'); if (sel && [...sel.options].some(o => o.value === d.annee || o.text === d.annee)) sel.value = d.annee; if (hid) hid.value = d.annee;
      say(m, false, 'Votre nom ne se trouve pas dans la base de données pour cette classe et cette année. Vérifiez-les, ou inscrivez-vous ci-dessous.'); fi.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else say(m, false, txt);
  };
  try {
    await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    /* retour sur le même appareil : le compte provisoire est déjà là */
    const pw = lireCred(pseudo);
    if (pw) { try { await AUTH.signInWithEmailAndPassword(pseudo, pw); say(m, true, 'Bon retour ! Ouverture de votre espace…'); setTimeout(() => aller('eleve'), 500); return; } catch(x){ localStorage.removeItem(CRED); } }
    const mdp = mdpAlea(); let user;
    try { user = (await AUTH.createUserWithEmailAndPassword(pseudo, mdp)).user; }
    catch(err){
      if (err && err.code === 'auth/email-already-in-use') { btn.disabled = false; return say(m, false, 'Cette fiche a déjà été ouverte sur un autre appareil. Utilisez l\'onglet « J\'ai déjà un compte » avec votre e-mail, ou demandez à l\'administration de la rouvrir.'); }
      throw err;
    }
    localStorage.setItem(CRED, JSON.stringify({ e: pseudo, p: mdp }));
    let rec = { etat: 'absent' };
    for (const an of annees) { rec = await Session.reclamerFiche(user, { nom: d.nom, prenom: d.prenom, classe: d.classe, annee: an, email: '' }); if (rec.etat !== 'absent') break; }
    if (rec.etat === 'ok') { say(m, true, 'Vérification terminée : votre nom se trouve dans la base de données. Ouverture de votre espace…'); setTimeout(() => location.replace('espace-eleve.html'), 900); return; }
    if (rec.etat === 'prise') return fin('Cette fiche est déjà reliée à un compte. Utilisez l\'onglet « J\'ai déjà un compte », ou contactez l\'administration.', false);
    if (rec.etat === 'indisponible') return fin('Vérification impossible pour le moment (' + (rec.code || 'erreur') + '). Réessayez, ou prévenez l\'administration.', false);
    return fin('', true);
  } catch(err){ btn.disabled = false; say(m, false, erreurAuth(err)); }
});

$('f-ins').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), d = Object.fromEntries(new FormData(f).entries());
  if (!L.anneeOk(d.annee)) return say(m, false, L.MSG_ANNEE);
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true; say(m, true, 'Création du compte…');
  try {
    await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const cred = await AUTH.createUserWithEmailAndPassword(d.email.trim(), d.password);
    /* 1) le nom est-il dans la liste d'inscription de cette classe et de cette année ? Alors le compte est relié à la fiche de l'administration. */
    const rec = await Session.reclamerFiche(cred.user, { nom: d.nom, prenom: d.prenom, classe: d.classe, annee: d.annee, email: d.email, age: d.age });
    if (rec.etat === 'ok') { say(m, true, 'Votre nom a été retrouvé. Complétez maintenant votre profil…'); setTimeout(() => location.replace('espace-eleve.html#profil'), 700); return; }
    if (rec.etat === 'prise') { say(m, false, "Votre nom est dans la liste, mais la fiche n'a pas pu être reliée à ce compte [" + (rec.code || 'refusé') + "]. Soit elle est déjà reliée à un autre compte, soit les règles Firestore de la v19 ne sont pas publiées. Contactez l'administration."); btn.disabled = false; return; }
    if (rec.etat === 'indisponible') console.warn('Liste d\'inscription indisponible', rec);
    /* 2) nom absent de la liste : inscription normale, validée ensuite par l'administration */
    const uid = cred.user.uid, code = Session.nouveauCode();
    const fiche = { nom:d.nom.trim().slice(0, 80), prenom:d.prenom.trim().slice(0, 80), age:String(d.age).slice(0, 3), classe:d.classe, annee:d.annee, matricule:d.matricule.trim().slice(0, 40), email:d.email.trim(), uid, code, statut:'attente', dateInscription:new Date().toLocaleString() };
    await DB.collection('eleves').doc(uid).set(fiche);
    if (window.Notif) Notif.envoyer({ staff: 'admin' }, 'Nouvelle inscription élève', (fiche.nom + ' ' + fiche.prenom).trim() + ' (' + fiche.classe + ') attend votre validation.', 'administration.html');
    try { await DB.collection('suivi').doc(code).set({ eleveId: uid, nom: fiche.nom, prenom: fiche.prenom, classe: fiche.classe, annee: fiche.annee, updated: Date.now() }); } catch(e){ console.warn(e); }
    say(m, true, 'Inscription enregistrée : votre nom n\'est pas dans la liste de la classe, l\'administration doit la valider. Ouverture de votre espace…');
    setTimeout(() => aller('eleve'), 700);
  } catch(err){ say(m, false, erreurAuth(err)); btn.disabled = false; }
});
$('f-con').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]'); btn.disabled = true; say(m, true, 'Connexion…');
  try { await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL); await AUTH.signInWithEmailAndPassword(f.email.value.trim(), f.password.value); say(m, true, 'Connexion réussie.'); setTimeout(() => aller('eleve'), 400); }
  catch(err){ say(m, false, erreurAuth(err)); btn.disabled = false; }
});
$('oubli').onclick = async () => {
  const m = $('f-con').querySelector('.msg'), mail = $('f-con').email.value.trim();
  if (!mail) return say(m, false, "Écrivez d'abord votre adresse e-mail ci-dessus.");
  try { await AUTH.sendPasswordResetEmail(mail); say(m, true, 'Un e-mail de réinitialisation vient de vous être envoyé.'); } catch(err){ say(m, false, erreurAuth(err)); }
};
$('bt-google').onclick = async () => {
  const m = $('g-msg');
  try { await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL); await AUTH.signInWithPopup(new firebase.auth.GoogleAuthProvider()); aller('eleve'); }
  catch(err){ if (err.code !== 'auth/popup-closed-by-user') say(m, false, erreurAuth(err)); }
};

/* ----- Administration (compte Firebase + document admins/{uid}) ----- */
let essais = 0, bloqueJusqua = 0;
$('f-adm').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg');
  if (Date.now() < bloqueJusqua) return say(m, false, 'Trop de tentatives. Patientez ' + Math.ceil((bloqueJusqua - Date.now()) / 1000) + ' secondes.');
  say(m, true, 'Vérification…'); const btn = $('adm-btn'); btn.disabled = true;
  try { await Session.loginAdmin(f.email.value, f.password.value, f.rester ? f.rester.checked : true); essais = 0; aller('admin'); }
  catch(err){
    essais++; if (essais >= 4) { bloqueJusqua = Date.now() + 30000 * essais; }
    say(m, false, err.code === 'bhn/pas-admin' ? err.message : (err.code ? erreurAuth(err) : err.message));
    f.password.value = ''; btn.disabled = false;
  }
});
$('adm-oubli').onclick = async () => {
  const f = $('f-adm'), m = f.querySelector('.msg'), mail = f.email.value.trim();
  if (!mail) return say(m, false, "Écrivez d'abord votre adresse e-mail ci-dessus.");
  try { await AUTH.sendPasswordResetEmail(mail); } catch(err){}
  say(m, true, 'Si ce compte existe, un e-mail de réinitialisation vient d\'être envoyé.');
};
/* ----- Enseignant : demande d'accès (validée par le super administrateur) ----- */
const tA = $('t-adm'), tE = $('t-ens');
function ongletAdm(ens){ tA.setAttribute('aria-selected', !ens); tE.setAttribute('aria-selected', ens); $('f-adm').hidden = ens; $('f-ens').hidden = !ens; }
tA.onclick = () => ongletAdm(false); tE.onclick = () => ongletAdm(true);
$('ens-mat').innerHTML = S.matieres.map(m => '<label class="case"><input type="checkbox" name="mat" value="' + esc(m.k) + '"> ' + esc(m.l) + '</label>').join('');
(window.siteReady || Promise.resolve()).then(() => { $('ens-cl').innerHTML = S.classes.map(c => '<label class="case"><input type="checkbox" name="cl" value="' + esc(c) + '"> ' + esc(c) + '</label>').join(''); });
$('f-ens').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]');
  const mats = [...f.querySelectorAll('[name=mat]:checked')].map(i => i.value), cls = [...f.querySelectorAll('[name=cl]:checked')].map(i => i.value);
  if (!mats.length || !cls.length) return say(m, false, 'Choisissez au moins une matière et une salle de classe.');
  const niv = new Set(cls.map(c => /^term/i.test(c) ? 2 : 1));
  const matiereIds = [], matiereNoms = [], notesNoms = [];
  mats.forEach(k => { const mm = S.matieres.find(x => x.k === k); niv.forEach(n => matiereIds.push(k + n)); matiereNoms.push(mm.l); (mm.n || []).forEach(x => { if (!notesNoms.includes(x)) notesNoms.push(x); }); });
  btn.disabled = true; say(m, true, 'Création de la demande…');
  try {
    await AUTH.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const cred = await AUTH.createUserWithEmailAndPassword(f.email.value.trim(), f.password.value);
    await DB.collection('enseignants').doc(cred.user.uid).set({ uid: cred.user.uid, nom: f.nom.value.trim().slice(0, 80), civilite: f.civilite ? f.civilite.value : '', email: f.email.value.trim(), matieres: mats, matiereIds, matiereNoms, notesNoms, classes: cls, statut: 'attente', createdAt: Date.now() });
    if (window.Notif) Notif.envoyer({ staff: 'super' }, 'Nouvelle demande d\'enseignant', f.nom.value.trim() + ' demande un accès enseignant.', 'administration.html');
    say(m, true, 'Demande envoyée. Le super administrateur doit la valider avant que vous puissiez publier. Vous pouvez vous reconnecter plus tard avec cette adresse.');
    await AUTH.signOut(); f.reset(); setTimeout(() => ongletAdm(false), 2500);
  } catch(err){ say(m, false, erreurAuth(err)); btn.disabled = false; }
});
/* ----- Parent : création de compte / connexion ----- */
(function(){
  const tpi = $('tp-ins'), tpc = $('tp-con');
  function ongletP(ins){ tpi.setAttribute('aria-selected', ins); tpc.setAttribute('aria-selected', !ins); $('fp-ins').hidden = !ins; $('fp-con').hidden = ins; }
  tpi.onclick = () => ongletP(true); tpc.onclick = () => ongletP(false);
  const erreurParent = e => e && (e.code === 'bhn/pas-parent' || e.code === 'bhn/compte-eleve') ? e.message : erreurAuth(e);
  $('fp-ins').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]'); btn.disabled = true; say(m, true, 'Création du compte…');
    try {
      localStorage.setItem('bhn_nouveau_parent', '1');
      await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred = await AUTH.createUserWithEmailAndPassword(f.email.value.trim(), f.password.value);
      await Session.assurerParent(cred.user, f.nom.value.trim(), true);
      say(m, true, 'Compte créé. Ouverture de votre espace…'); setTimeout(() => aller('parent'), 600);
    } catch(err){ localStorage.removeItem('bhn_nouveau_parent'); say(m, false, erreurParent(err)); btn.disabled = false; }
  });
  $('fp-con').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), btn = f.querySelector('button[type=submit]'); btn.disabled = true; say(m, true, 'Connexion…');
    try {
      await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred = await AUTH.signInWithEmailAndPassword(f.email.value.trim(), f.password.value);
      try { await Session.assurerParent(cred.user, '', false); } catch(err){ try { await AUTH.signOut(); } catch(x){} throw err; }
      say(m, true, 'Connexion réussie.'); setTimeout(() => aller('parent'), 400);
    } catch(err){ say(m, false, erreurParent(err)); btn.disabled = false; }
  });
  $('pp-oubli').onclick = async () => {
    const m = $('fp-con').querySelector('.msg'), mail = $('fp-con').email.value.trim();
    if (!mail) return say(m, false, "Écrivez d'abord votre adresse e-mail ci-dessus.");
    try { await AUTH.sendPasswordResetEmail(mail); say(m, true, 'Un e-mail de réinitialisation vient de vous être envoyé.'); } catch(err){ say(m, false, erreurAuth(err)); }
  };
  $('bp-google').onclick = async () => {
    const m = $('pg-msg');
    try {
      localStorage.setItem('bhn_nouveau_parent', '1');
      await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred = await AUTH.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await Session.assurerParent(cred.user, cred.user.displayName || '', true); aller('parent');
    } catch(err){ localStorage.removeItem('bhn_nouveau_parent'); if (err.code !== 'auth/popup-closed-by-user') say(m, false, erreurParent(err)); }
  };
})();

function initAdmin(){ try { const mail = localStorage.getItem('bhn_email_admin'); if (mail && $('f-adm').email && !$('f-adm').email.value) $('f-adm').email.value = mail; } catch(e){}
   const p = new URLSearchParams(location.search); if (p.get('expire')) say($('f-adm').querySelector('.msg'), false, 'Votre session a expiré après 30 minutes d\'inactivité. Reconnectez-vous.'); }

/* ----- Session déjà ouverte : accès direct ----- */
Session.ready.then(() => {
  const l = [];
  if (Session.admin) l.push(['Administration', 'administration.html', 'Vous êtes connecté en tant qu\'administrateur']);
  if (Session.user) l.push(['Mon espace élève', 'espace-eleve.html', 'Connecté : ' + esc((Session.profile && Session.fullName(Session.profile)) || Session.user.email || '')]);
  if (Session.isParent()) l.push(['Espace parent', 'espace-parent.html', 'Connecté : ' + esc(Session.parentDoc.email || Session.parentDoc.nom || '')]);
  if (roleDemande === 'eleve' && Session.user) return aller('eleve');
  if (roleDemande === 'parent' && Session.isParent()) return aller('parent');
  if (roleDemande === 'admin' && Session.admin) return aller('admin');
  if (l.length) {
    const v = $('v-session'); v.hidden = false;
    v.innerHTML = '<h3>Vous êtes déjà connecté</h3>' + l.map(x => '<p style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:8px 0"><a class="btn dark s" href="' + x[1] + '">' + x[0] + '</a><span style="color:var(--gris)">' + x[2] + '</span></p>').join('') +
      '<p style="margin:14px 0 0"><button class="petit-lien" type="button" id="bt-quit">Me déconnecter</button></p>';
    $('bt-quit').onclick = () => Session.logoutAll();
  }
  if (roleDemande === 'eleve') vue('eleve', true); else if (roleDemande === 'admin') { vue('admin', true); initAdmin(); }
  else if (roleDemande === 'parent') vue('parent', true);
});
})();
