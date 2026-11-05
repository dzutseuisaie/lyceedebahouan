/* Lycée de Bahouan - administration (partie 1) */
(function(){
const S = window.SITE, esc = window.esc;
const A = window.ADM = { mods: {}, cleanup: null };
const $ = (s, r) => (r || document).querySelector(s);

/* ---------- Rôles : super administrateur, administrateur, enseignant (limité à ses matières et ses salles) ---------- */
A.estEns = () => Session.role === 'enseignant';
A.matPerm = () => A.estEns() ? S.matieres.filter(m => (Session.ens.matieres || []).includes(m.k)) : S.matieres;
A.classesPerm = () => A.estEns() ? S.classes.filter(c => (Session.ens.classes || []).includes(c)) : S.classes;
A.cols = (c) => { const base = c ? L.notesDe(c) : S.notesMatieres; return A.estEns() ? base.filter(([m]) => (Session.ens.notesNoms || []).includes(m)) : base; };   /* c = classe : colonnes de sa série */

/* ---------- Outils communs ---------- */
A.dlg = function(titre, champs, onSubmit, bouton){
  const m = document.createElement('div'); m.className = 'modal open';
  m.innerHTML = '<div class="in"><button class="x" type="button" aria-label="Fermer">×</button><h2>' + titre + '</h2><form class="form" style="max-width:none">' + champs + '<div class="msg" role="status"></div><button class="btn dark" type="submit">' + (bouton || 'Enregistrer') + '</button></form></div>';
  document.body.appendChild(m);
  const close = () => m.remove(); m.querySelector('.x').onclick = close; m.addEventListener('click', e => { if (e.target === m) close(); });
  const f = m.querySelector('form');
  f.onsubmit = async e => { e.preventDefault(); const b = f.querySelector('button[type=submit]'); b.disabled = true;
    try { await onSubmit(Object.fromEntries(new FormData(f).entries()), f); close(); } catch(err){ L.say(f.querySelector('.msg'), false, err.message || 'Échec.'); b.disabled = false; } };
  return m;
};
A.publierCodeParent = async function(x){   /* crée un code parent à usage unique et le dépose dans l'espace privé de l'élève */
  const c = Session.nouveauCode(), t0 = Date.now(), exp = t0 + 7 * 864e5, uidE = x.uid || '';
  const priv = uidE ? DB.collection('utilisateurs').doc(uidE).collection('code_parent').doc('actuel') : null;
  if (priv) { try { const o = await priv.get(); if (o.exists && o.data().code) { const t = await DB.collection('codes_parent').doc(o.data().code).get(); if (t.exists && !t.data().utilise) await t.ref.delete(); } } catch(e){} }   /* l'ancien code non utilisé est annulé */
  await DB.collection('codes_parent').doc(c).set({ suivi: x.code, nom: L.fullName(x), classe: x.classe || '', cree: t0, exp, utilise: false, par: '' });
  if (priv) { await priv.set({ code: c, cree: t0, exp }); if (window.Notif) Notif.envoyer({ uid: uidE }, 'Code parent disponible', 'Votre code parent est prêt. Donnez-le à votre parent (valable 7 jours).', 'espace-eleve.html#codeparent'); }
  return { code: c, envoye: !!priv };
};
A.confirmerMot = (msg, mot) => (prompt(msg + '\n\nPour confirmer, tapez : ' + mot) || '').trim().toUpperCase() === mot;
A.lots = async function(refs, fn){   /* écritures par lots de 400 */
  for (let i = 0; i < refs.length; i += 400) { const b = DB.batch(); refs.slice(i, i + 400).forEach(r => fn(b, r)); await b.commit(); }
};
A.def = function(k, t, render){ A.mods[k] = { k, t, render: async el => { if (A.cleanup) { A.cleanup(); A.cleanup = null; } el.innerHTML = ''; const box = document.createElement('div'); el.appendChild(box); await render(box); } }; };
A.filtreCA = (extra) => '<div class="filtres"><label>Classe<select id="f-c">' + L.options(A.classesPerm(), '', 'Choisir…') + '</select></label><label>Année académique' + L.anneeField({ id: 'f-a', value: L.anneeCourante() }) + '</label>' + (extra || '') + '</div>';
A.valCA = () => ({ c: $('#f-c').value, a: $('#f-a').value.trim() });
A.okCA = (m) => { const v = A.valCA(); if (!v.c || !L.anneeOk(v.a)) { alert(!v.c ? 'Choisissez la classe.' : L.MSG_ANNEE); return null; } return v; };

/* ---------- Journal d'audit ---------- */
A.log = async function(action, detail){
  try { const u = Session.authUser; await DB.collection('journal').add({ uid: u ? u.uid : '', email: u ? (u.email || '') : '', action, detail: String(detail || '').slice(0, 300), date: Date.now() }); } catch(e){}
};

/* ---------- Suppression d'un contenu ----------
   Le document est supprimé de la base de données (Firestore). Les images et PDF envoyés restent sur Cloudinary
   (Cloudinary n'autorise la suppression qu'avec une clé secrète, ce qui demanderait un serveur : inutile ici).
   Ils ne sont plus affichés nulle part ; pour libérer de la place : Cloudinary > Media Library. */
A.supprimerFichiersCloud = async function(){ return { ok: true, n: 0, msg: '' }; };
A.supprimerDoc = async function(col, id){
  await DB.collection(col).doc(id).delete();
  A.log('Suppression : ' + col, id);
  return { ok: true, n: 0 };
};
/* Fichier remplacé : l'ancien est supprimé de Cloudinary pour ne pas s'accumuler. */
A.nettoyerCloud = async function(urls, ou){
  const r = await A.supprimerFichiersCloud(urls); if (r.n) A.log('Ancien fichier Cloudinary supprimé', ou || '');
  return r;
};

/* ---------- Synchronisation du suivi (ce que voient l'élève et le parent) ----------
   Les collections notes et absences restent réservées à l'administration. Les familles lisent uniquement
   le document suivi/{code} de leur enfant, reconstruit ici à chaque modification. */
A.syncClasse = async function(c, a, periode){
  let coefs = null; try { const cd = await DB.collection('classements').doc(L.classementId(c, a)).get(); if (cd.exists && cd.data().coefs) coefs = cd.data().coefs; } catch(e){}   /* coefficients enregistrés par l'administration */
  const avecC = o => { const m = Object.assign({}, o); Object.defineProperty(m, '__coefs', { value: coefs, enumerable: false }); return m; };
  const nk = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ');   /* même élève malgré accents, majuscules ou ordre nom/prénom */
  const tous = await L.eleves(c, a), eleves = tous.filter(x => (x.statut || 'valide') === 'valide');   /* jamais de notes pour un élève non validé */
  const [ns, as] = await Promise.all([DB.collection('notes').where('classe', '==', c).where('annee', '==', a).get(), DB.collection('absences').where('classe', '==', c).where('annee', '==', a).get()]);
  const notes = {}, abs = {}, seqs = {};
  ns.forEach(d => { const x = d.data(), k = nk(x.eleve), s = +x.seq || 0; if (s >= 1 && s <= 6) { const q = (seqs[k] = seqs[k] || {}); (q[x.matiere] = q[x.matiere] || [null, null, null, null, null, null])[s - 1] = x.note; } else (notes[k] = notes[k] || {})[x.matiere] = x.note; });
  /* quand des notes par séquence existent, la note annuelle de la matière = moyenne de ses séquences */
  Object.keys(seqs).forEach(k => Object.keys(seqs[k]).forEach(m => { const v = seqs[k][m].filter(n => n != null && !isNaN(+n)).map(Number); if (v.length) (notes[k] = notes[k] || {})[m] = Math.round(v.reduce((x, y) => x + y, 0) / v.length * 100) / 100; }));
  as.forEach(d => { const x = d.data(); (abs[nk(x.nom)] = abs[nk(x.nom)] || []).push({ date: x.date || '', heure: x.heure || '', statut: x.statut || '', sanction: x.sanction || '', matiere: x.matiere || '', debut: x.debut || '', fin: x.fin || '', prof: x.prof || '' }); });
  let wa = ''; try { wa = await L.whatsapp(c); } catch(e){}
  const smo = {}, srg = {}, kn = e => nk(L.fullName(e));   /* moyenne et rang de chaque séquence, enregistrés pour chaque élève */
  eleves.forEach(e => { smo[kn(e)] = [0, 1, 2, 3, 4, 5].map(i => { const v = L.moySeq(avecC(notes[kn(e)] || {}), seqs[kn(e)], [i]); return v == null ? null : Math.round(v * 100) / 100; }); });
  eleves.forEach(e => { srg[kn(e)] = smo[kn(e)].map((v, i) => v == null ? null : 1 + eleves.filter(x => smo[kn(x)][i] != null && smo[kn(x)][i] > v + 1e-9).length); });
  await A.lots(eleves, (b, e) => {
    let code = e.code; if (!code) { if (A.estEns()) return; code = Session.nouveauCode(); b.set(DB.collection('eleves').doc(e.id), { code }, { merge: true }); }
    const nom = L.fullName(e), ref = DB.collection('suivi').doc(code);
    b.set(ref, { eleveId: e.id, nom: e.nom || '', prenom: e.prenom || '', classe: c, annee: a, whatsapp: wa, updated: Date.now() }, { merge: true });
    const maj = { ['annees.' + L.anneeKey(a) + '.notes']: notes[nk(nom)] || {}, ['annees.' + L.anneeKey(a) + '.absences']: abs[nk(nom)] || [], ['annees.' + L.anneeKey(a) + '.seqs']: seqs[nk(nom)] || {}, ['annees.' + L.anneeKey(a) + '.seqMoy']: smo[nk(nom)] || [], ['annees.' + L.anneeKey(a) + '.seqRang']: srg[nk(nom)] || [] }; if (periode) maj['annees.' + L.anneeKey(a) + '.periode'] = periode; if (coefs) maj['annees.' + L.anneeKey(a) + '.coefs'] = coefs; b.update(ref, maj);
  });
  try {   /* classement anonyme : seulement des moyennes, jamais de noms */
    const moy = eleves.map(e => L.moyenne(avecC(notes[nk(L.fullName(e))] || {}))).filter(m => m != null).sort((x, y) => y - x);
    const cl = { classe: c, annee: a, effectif: eleves.length, moyennes: moy, updated: Date.now() }; if (periode) cl.periode = periode;
    const ms = {}, mt = {}, pm = idx => eleves.map(e => { const k = nk(L.fullName(e)); return L.moySeq(avecC(notes[k] || {}), seqs[k], idx); }).filter(m => m != null).sort((x, y) => y - x);   /* moyennes anonymes par séquence et par trimestre (rangs du bulletin) */
    let profs = null; try { const es = await DB.collection('enseignants').get(); profs = {}; es.forEach(d => { const x = d.data(); if (x.statut !== 'valide' || !(x.classes || []).includes(c)) return; const nm = L.profCourt(x); (x.notesNoms || []).forEach(m => { if (!profs[m]) profs[m] = nm; }); }); } catch(e){}   /* professeur de chaque matière dans cette classe */
    for (let i = 0; i < 6; i++) ms[i + 1] = pm([i]); for (let i = 0; i < 3; i++) mt[i + 1] = pm([2 * i, 2 * i + 1]); cl.moySeq = ms; cl.moyTrim = mt; if (profs) cl.profs = profs;
    await DB.collection('classements').doc(L.classementId(c, a)).set(cl, { merge: true }); A.classementOk = true;
  } catch(e){ A.classementOk = false; console.warn('Classement non publié (réservé à l\'administrateur)', e); }
  return eleves.length;
};

/* Noms des professeurs pour le bulletin : lus dans la base des enseignants validés (matière + salle choisies à l'inscription),
   publiés par classe dans profs_classes/{classe}. Un seul nom par matière (civilité + nom). */
A.publierProfs = async function(){
  const es = await DB.collection('enseignants').get(), par = {};
  es.forEach(d => { const x = d.data(); if (x.statut !== 'valide') return; const nm = L.profCourt(x); if (!nm) return;
    /* clés : colonnes de notes, libellés des matières (même pour une fiche ancienne sans notesNoms), noms enregistrés */
    const cles = new Set(x.notesNoms || []); (x.matiereNoms || []).forEach(k => cles.add(k));
    (x.matieres || []).forEach(k => { const m0 = S.matieres.find(y => y.k === k); if (m0) { cles.add(m0.l); (m0.n || []).forEach(v => cles.add(v)); } });
    (x.classes || []).forEach(c => { const m = par[c] || (par[c] = {}); cles.forEach(k => { if (!m[k]) m[k] = nm; }); }); });
  const b = DB.batch(); S.classes.forEach(c => b.set(DB.collection('profs_classes').doc(L.profId(c)), { classe: c, profs: par[c] || {}, maj: Date.now() }));
  await b.commit(); return par;
};

/* ---------- Tableau de bord ---------- */
A.def('dash', 'Tableau de bord', async el => {
  el.innerHTML = '<h1>Tableau de bord</h1><p class="sous">Vue d\'ensemble du lycée.</p><div class="kpis" id="kp"></div><div class="carte-app"><h3>Actions rapides</h3><p style="display:flex;gap:10px;flex-wrap:wrap;margin:0"><a class="btn dark s" href="#annonces">Publier une annonce</a><a class="btn dark s" href="#eleves">Gérer les élèves</a><a class="btn dark s" href="#notes">Importer des notes</a><a class="btn dark s" href="#actualites">Publier une actualité</a><a class="btn gris s" href="index.html">Voir le site</a></p></div>';
  const all = await DB.collection('eleves').get(); const par = {}; all.forEach(d => { const c = d.data().classe || 'Sans classe'; par[c] = (par[c] || 0) + 1; });
  let nonLus = 0; try { const s = await DB.collection('conversations').get(); s.forEach(d => { nonLus += d.data().nonLus || 0; }); } catch(e){}
  let dem = 0, anc = 0, pre = 0; try { dem = (await DB.collection('demandes').get()).size; anc = (await DB.collection('anciens').get()).size; pre = (await DB.collection('preinscriptions').get()).size; } catch(e){}
  const max = Math.max(1, ...Object.values(par));
  el.insertAdjacentHTML('beforeend', '<div class="carte-app"><h3>Élèves par classe</h3>' + (Object.keys(par).sort().map(c => '<div style="display:flex;align-items:center;gap:12px;margin:8px 0"><span style="width:130px;font-size:.92rem">' + esc(c) + '</span><div style="flex:1;background:var(--ivoire);height:18px"><div style="width:' + Math.round(par[c] / max * 100) + '%;height:100%;background:var(--nuit)"></div></div><b>' + par[c] + '</b></div>').join('') || '<div class="vide-app">Aucun élève.</div>') + '</div>');
  $('#kp').innerHTML = '<div class="kpi"><b>' + all.size + '</b><span>Élèves inscrits</span></div>' + Object.keys(par).sort().map(c => '<div class="kpi"><b>' + par[c] + '</b><span>' + esc(c) + '</span></div>').join('') +
    '<div class="kpi"><b>' + nonLus + '</b><span>Messages non lus</span></div><div class="kpi"><b>' + pre + '</b><span>Pré-inscriptions</span></div><div class="kpi"><b>' + dem + '</b><span>Demandes reçues</span></div><div class="kpi"><b>' + anc + '</b><span>Anciens inscrits</span></div>';
});

/* ---------- Liste d'inscription (roster) : permet à un élève de créer son compte avec son seul nom ---------- */
A.rosterSet = async f => { try { const k = await L.roster.cle(f.nom, f.prenom, f.classe, f.annee); await DB.collection('roster').doc(k).set(await L.roster.doc(f)); } catch(err){ console.warn('Liste d\'inscription', err); } };
A.rosterSup = async f => { try { const k = await L.roster.cle(f.nom, f.prenom, f.classe, f.annee); await DB.collection('roster').doc(k).delete(); } catch(err){ console.warn(err); } };
A.rosterLot = async (liste, _) => { for (let i = 0; i < liste.length; i += 300) { const b = DB.batch(); for (const f of liste.slice(i, i + 300)) b.set(DB.collection('roster').doc(await L.roster.cle(f.nom, f.prenom, f.classe, f.annee)), await L.roster.doc(f)); await b.commit(); } };

/* Fiche de classe lue par OCR : l'administrateur contrôle la liste, puis chaque nom devient un élève de la classe (validé, avec son code de suivi)
   et un nom retrouvable à l'inscription. Les noms déjà présents dans la classe sont ignorés. */
A.importerFiche = async (v, texte, apres) => {
  const lues = L.roster.analyserListe(texte), deja = new Set((await L.eleves(v.c, v.a)).map(x => L.roster.jetons(L.fullName(x))));
  const m = document.createElement('div'); m.className = 'modal open';
  const ligne = (r, i) => '<tr data-i="' + i + '"' + (deja.has(L.roster.jetons(r.nom + ' ' + r.prenom)) ? ' style="background:#fff6d6" title="Déjà dans la classe : sera ignoré"' : '') + '><td>' + (i + 1) + '</td><td><input class="fi-n" style="width:100%;min-width:200px" value="' + esc(r.nom) + '"></td><td><input class="fi-p" style="width:100%;min-width:130px" value="' + esc(r.prenom) + '"></td><td><button class="btn rouge s fi-x" type="button" aria-label="Retirer">✕</button></td></tr>';
  m.innerHTML = '<div class="in" style="max-width:980px"><button class="x" type="button" aria-label="Fermer">×</button><h2>Fiche de classe · ' + esc(v.c) + ' (' + esc(v.a) + ')</h2>' +
    '<p class="sous" style="margin-top:0">' + lues.length + ' ligne(s) lue(s). Seules les lignes « numéro + nom » sont lues. Corrigez les noms comme sur la fiche si besoin, puis enregistrez : le prénom est facultatif, et le sexe, la date de naissance et le matricule se complètent plus tard (matricules par OCR, le reste par l\'élève dans son profil). Les lignes en jaune existent déjà dans la classe et seront ignorées.</p>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Nom (comme sur la fiche)</th><th>Prénom</th><th></th></tr></thead><tbody>' + lues.map(ligne).join('') + '</tbody></table></div>' +
    '<div class="msg" role="status"></div><p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn gris s" id="fi-add" type="button">+ Ajouter une ligne</button><button class="btn dark" id="fi-ok" type="button">Enregistrer les élèves</button><button class="btn gris" id="fi-non" type="button">Annuler</button></p></div>';
  document.body.appendChild(m); document.body.classList.add('modal-ouverte');
  const tb = m.querySelector('tbody'), msg = m.querySelector('.msg'), fermer = () => { m.remove(); document.body.classList.remove('modal-ouverte'); };
  const renum = () => [...tb.rows].forEach((tr, i) => tr.cells[0].textContent = i + 1);
  m.querySelector('.x').onclick = m.querySelector('#fi-non').onclick = fermer;
  tb.addEventListener('click', e => { if (e.target.closest('.fi-x')) { e.target.closest('tr').remove(); renum(); } });
  m.querySelector('#fi-add').onclick = () => { tb.insertAdjacentHTML('beforeend', ligne({ nom: '', prenom: '', naissance: '', matricule: '', sexe: '' }, tb.rows.length)); tb.lastElementChild.querySelector('.fi-n').focus(); };
  m.querySelector('#fi-ok').onclick = async () => {
    const vus = new Set(), rows = []; let ignores = 0;
    for (const tr of tb.rows) {
      const nom = tr.querySelector('.fi-n').value.trim().replace(/\s+/g, ' ').slice(0, 80), prenom = tr.querySelector('.fi-p').value.trim().replace(/\s+/g, ' ').slice(0, 80); if (!nom) continue;
      const cle = L.roster.jetons(nom + ' ' + prenom); if (cle.length < 3) return L.say(msg, false, 'Ligne ' + tr.cells[0].textContent + ' : nom trop court.');
      if (vus.has(cle)) return L.say(msg, false, '« ' + nom + ' ' + prenom + ' » apparaît deux fois : retirez une ligne (ou ajoutez le prénom pour distinguer deux élèves).'); vus.add(cle);
      if (deja.has(cle)) { ignores++; continue; }
      rows.push({ nom, prenom });
    }
    if (!rows.length) return L.say(msg, false, ignores ? 'Tous ces élèves sont déjà dans la classe.' : 'Rien à enregistrer.');
    const b0 = m.querySelector('#fi-ok'); b0.disabled = true; L.say(msg, true, 'Enregistrement de ' + rows.length + ' élève(s)…');
    let etape = 'élèves';
    try {
      const faits = []; let rosterErr = null;
      for (let i = 0; i < rows.length; i += 100) {
        const b = DB.batch(), lot = [];
        etape = 'élèves';
        for (const r of rows.slice(i, i + 100)) {
          const ref = DB.collection('eleves').doc(), code = Session.nouveauCode(), d = { nom: r.nom, prenom: r.prenom, classe: v.c, annee: v.a, code, statut: 'valide', dateInscription: new Date().toLocaleString() };
          b.set(ref, d); b.set(DB.collection('suivi').doc(code), { eleveId: ref.id, nom: r.nom, prenom: r.prenom, classe: v.c, annee: v.a, updated: Date.now() });
          lot.push({ id: ref.id, nom: r.nom, prenom: r.prenom, classe: v.c, annee: v.a });
        }
        await b.commit(); faits.push(...lot);
        if (!rosterErr) { etape = 'liste d\'inscription (roster)'; try { await A.rosterLot(lot, true); } catch(err){ rosterErr = err; } }
      }
      try { A.log('Fiche de classe importée (OCR)', v.c + ' ' + v.a + ' (' + faits.length + ' élèves)'); } catch(err){}
      fermer(); alert(faits.length + ' élève(s) enregistré(s)' + (ignores ? ' · ' + ignores + ' déjà présent(s) ignoré(s)' : '') + '.' + (rosterErr ? '\n\nATTENTION : la liste d\'inscription (collection roster) a été refusée [' + (rosterErr.code || '') + '] : les élèves existent mais ne pourront pas encore s\'inscrire par leur nom. Republiez firestore.rules (version 19) dans Firebase, puis cliquez sur « Publier la liste d\'inscription » dans Élèves.' : '')); apres && apres();
    } catch(err){ L.say(msg, false, 'Échec de l\'enregistrement (' + etape + ') : ' + (err.code ? '[' + err.code + '] ' : '') + (err.message || err)); b0.disabled = false; }
  };
};

/* ---------- Élèves ---------- */
const champsEleve = (e) => {
  e = e || {};
  return '<div class="form" style="grid-template-columns:1fr 1fr;max-width:none"><label>Nom<input name="nom" required value="' + esc(e.nom || '') + '"></label><label>Prénom<input name="prenom" value="' + esc(e.prenom || '') + '"></label>' +
    '<label>Âge<input name="age" type="number" value="' + esc(e.age || '') + '"></label><label>Classe<select name="classe" required>' + L.options(S.classes, e.classe, 'Choisir…') + '</select></label>' +
    '<label>Année académique' + L.anneeField({ name: 'annee', value: e.annee || '' }) + '</label><label>Matricule<input name="matricule" value="' + esc(e.matricule || '') + '"></label><label>Date de naissance<input name="naissance" placeholder="JJ/MM/AAAA" value="' + esc(e.naissance || '') + '"></label><label>Sexe<select name="sexe"><option value="">—</option><option' + (e.sexe === 'M' ? ' selected' : '') + '>M</option><option' + (e.sexe === 'F' ? ' selected' : '') + '>F</option></select></label></div>' +
    '<label>E-mail Google de l\'élève (il retrouve ainsi sa fiche à la première connexion)<input name="email" type="email" value="' + esc(e.email || '') + '"></label>';
};
A.def('eleves', 'Élèves', async el => {
  el.innerHTML = '<h1>Élèves</h1>' + A.filtreCA('<button class="btn dark s" id="e-go" type="button">Afficher</button><button class="btn s" id="e-add" type="button">Ajouter un élève</button>' + (Session.isSuper() ? '<button class="btn s" id="e-ocr" type="button">📷 Importer la fiche de classe</button>' : '') + '<button class="btn s" id="e-att" type="button">Inscriptions en attente</button>') + '<div id="e-res"></div>';
  let liste = [];
  const rendre = () => {
    $('#e-res').innerHTML = liste.length ? '<p style="display:flex;gap:10px;flex-wrap:wrap"><label style="display:flex;flex-direction:column;font-size:.8rem">Période publiée<select id="e-per"><option>Annuelle</option>' + [1,2,3,4,5,6].map(n => '<option>Séquence ' + n + '</option>').join('') + '<option>Premier trimestre</option><option>Deuxième trimestre</option><option>Troisième trimestre</option></select></label><button class="btn dark s" id="e-sync" type="button">Générer les codes et publier le suivi</button>' + (liste.some(x => !x.matricule) ? '<button class="btn s" id="e-mat" type="button">📷 Remplir les matricules manquants (' + liste.filter(x => !x.matricule).length + ')</button>' : '') + (liste.some(x => !x.sexe || !x.age) ? '<button class="btn s" id="e-sa" type="button">📷 Remplir sexe et âge (' + liste.filter(x => !x.sexe || !x.age).length + ')</button>' : '') + '' + (Session.isSuper() ? '<button class="btn dark s" id="e-cpall" type="button" title="Envoie à chaque élève son code parent à usage unique">Publier les codes parent</button>' : '') + '<button class="btn gris s" id="e-ros" type="button" title="Permet aux élèves affichés de créer leur compte avec leur nom">Publier la liste d\'inscription</button><button class="btn gris s" id="e-csv" type="button">Exporter en CSV</button><button class="btn gris s" onclick="window.print()" type="button">Imprimer</button><button class="btn rouge s" id="e-del" type="button">Supprimer les élèves affichés</button></p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Nom</th><th>Prénom</th><th>Âge</th><th>Classe</th><th>Année</th><th>Matricule</th><th>E-mail</th><th>Code de suivi</th><th>Statut</th><th></th></tr></thead><tbody>' +
      liste.map((e, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(e.nom || '') + '</td><td>' + esc(e.prenom || '') + '</td><td>' + esc(e.age || '') + '</td><td>' + esc(e.classe || '') + '</td><td>' + esc(e.annee || '') + '</td><td>' + esc(e.matricule || '') + '</td><td>' + esc(e.email || '') + '</td><td style="font-family:monospace;white-space:nowrap">' + esc(e.code || '—') + '</td><td>' + (e.statut === 'attente' ? '<b style="color:#b45309">En attente</b>' : e.statut === 'refuse' ? '<b style="color:#b91c1c">Refusé</b>' : 'Validé') + '</td><td style="white-space:nowrap">' + (e.statut === 'attente' || e.statut === 'refuse' ? '<button class="btn dark s" data-va="' + i + '">Valider</button> ' : '') + (e.statut === 'attente' ? '<button class="btn rouge s" data-re="' + i + '">Refuser</button> ' : '') + (e.uid ? '<button class="btn gris s" data-de="' + i + '" title="Détache le compte de cet élève (fiche et notes conservées)">Délier le compte</button> ' : '') + (Session.isSuper() && e.code ? '<button class="btn dark s" data-cp="' + i + '" title="Génère un code à usage unique pour le parent">Code parent</button> ' : '') + '<button class="btn gris s" data-ed="' + i + '">Modifier</button> <button class="btn rouge s" data-sp="' + i + '">Supprimer</button></td></tr>').join('') + '</tbody></table></div>'
      : '<div class="vide-app">Aucun élève pour ces critères.</div>';
  };
  const charger = async () => { const v = A.valCA(); liste = await L.eleves(v.c, v.a); rendre();
    /* Liste d'inscription : republiée automatiquement (une fois par classe et par jour) pour que chaque élève enregistré soit retrouvé à l'inscription */
    if (!A.estEns()) { const k = 'bhn_ros_' + v.c + '_' + v.a, aPub = liste.filter(x => !x.uid && x.classe && x.annee && (x.statut || 'valide') === 'valide');
      if (aPub.length && Date.now() - (+localStorage.getItem(k) || 0) > 864e5) { localStorage.setItem(k, Date.now()); A.rosterLot(aPub).catch(err => { localStorage.removeItem(k); console.warn('Liste d\'inscription', err); }); } } };
  $('#e-go').onclick = () => { if (!$('#f-c').value && !$('#f-a').value) { if (!confirm('Afficher tous les élèves ?')) return; } charger(); };
  $('#e-add').onclick = () => A.dlg('Ajouter un élève', champsEleve({ classe: $('#f-c').value, annee: $('#f-a').value }), async d => {
    if (!L.anneeOk(d.annee)) throw new Error(L.MSG_ANNEE);
    const code = Session.nouveauCode(); const r = await DB.collection('eleves').add(Object.assign({}, d, { email: (d.email || '').trim().toLowerCase(), code, statut: 'valide', dateInscription: new Date().toLocaleString() }));
    await DB.collection('suivi').doc(code).set({ eleveId: r.id, nom: d.nom, prenom: d.prenom || '', classe: d.classe, annee: d.annee, updated: Date.now() }, { merge: true });
    await A.rosterSet({ id: r.id, nom: d.nom, prenom: d.prenom, classe: d.classe, annee: d.annee }); A.log('Ajout d\'un élève', L.fullName(d)); charger(); });
  if ($('#e-ocr')) $('#e-ocr').onclick = async () => {
    const v = A.valCA(); if (!v.c || !L.anneeOk(v.a)) return alert('Choisissez d\'abord la classe et l\'année académique, puis relancez la lecture de la fiche.');
    const texte = await L.ocr.scanner('Fiche de classe · ' + v.c + ' (' + v.a + ')', 'Cadrez la fiche : un élève par ligne, dans l\'ordre alphabétique. Si elle a plusieurs pages, capturez-les l\'une après l\'autre.'); L.ocr.fin(); if (texte == null) return;
    A.importerFiche(v, texte, charger);
  };
  $('#e-res').addEventListener('click', async e => {
    const ed = e.target.closest('[data-ed]'), sp = e.target.closest('[data-sp]'), va = e.target.closest('[data-va]'), re = e.target.closest('[data-re]');
    if (va || re) { const x = liste[(va || re).dataset[va ? 'va' : 're']]; if (re && !confirm('Refuser l\'inscription de ' + L.fullName(x) + ' ?')) return; await DB.collection('eleves').doc(x.id).set({ statut: va ? 'valide' : 'refuse' }, { merge: true }); A.log(va ? 'Validation d\'un élève' : 'Refus d\'un élève', L.fullName(x)); if (window.Notif) Notif.envoyer(x.code ? { code: x.code } : { uid: x.uid || x.id }, va ? 'Inscription validée' : 'Inscription refusée', va ? 'L\'inscription de ' + L.fullName(x) + ' a été validée.' : 'L\'inscription de ' + L.fullName(x) + ' n\'a pas été acceptée. Contactez le secrétariat.', 'espace-eleve.html'); x.statut = va ? 'valide' : 'refuse'; if (va && x.classe && x.annee) { try { await A.syncClasse(x.classe, x.annee); } catch(err){} } rendre(); return; }
    const cp = e.target.closest('[data-cp]');
    if (cp) { const x = liste[cp.dataset.cp]; if (!Session.isSuper() || !x || !x.code) return;
      let r; try { r = await A.publierCodeParent(x); }
      catch(err){ return alert('Code non créé : ' + ((err && err.code) || 'erreur') + '. Publiez d\'abord les nouvelles règles Firestore (firestore.rules).'); }
      A.log('Code parent généré', L.fullName(x));
      A.dlg('Code parent de ' + esc(L.fullName(x)), '<p style="text-align:center;font:700 1.8rem monospace;letter-spacing:.08em;margin:10px 0">' + r.code + '</p><p class="sous">' + (r.envoye ? 'Le code a été envoyé dans l\'espace privé de l\'élève (rubrique « Code parent »).' : 'Cet élève n\'a pas encore de compte : remettez-lui ce code.') + ' Usage unique, valable 7 jours.</p>', async () => {}, 'Fermer');
      return; }
    if (e.target.id === 'e-cpall') {
      const v = liste.filter(x => (x.statut || 'valide') === 'valide' && x.code), av = v.filter(x => x.uid), sans = v.length - av.length;
      if (!av.length) return alert('Aucun élève affiché n\'a de compte : les codes ne peuvent pas être envoyés. Utilisez le bouton « Code parent » de chaque ligne.');
      if (!confirm('Publier un code parent pour ' + av.length + ' élève(s) ? Chacun le recevra dans son espace (rubrique « Code parent »).' + (sans ? '\n' + sans + ' élève(s) sans compte seront ignorés.' : '') + '\nLes anciens codes non utilisés sont annulés.')) return;
      e.target.disabled = true; let ok = 0, ko = 0;
      for (const x of av) { try { await A.publierCodeParent(x); ok++; e.target.textContent = 'Publication… ' + ok + '/' + av.length; } catch(err){ ko++; } }
      A.log('Codes parent publiés', ok + ' élèves'); e.target.disabled = false; e.target.textContent = 'Publier les codes parent';
      alert(ok + ' code(s) publié(s)' + (ko ? ', ' + ko + ' échec(s) (règles Firestore à publier ?)' : '') + (sans ? ', ' + sans + ' ignoré(s) (sans compte)' : '') + '.'); return; }
    const de = e.target.closest('[data-de]');
    if (de) { const x = liste[de.dataset.de]; if (confirm('Délier le compte de ' + L.fullName(x) + ' ?\nLa fiche et les notes sont conservées ; l\'élève pourra se réinscrire avec son nom.')) { await DB.collection('eleves').doc(x.id).set({ uid: '', email: '' }, { merge: true }); A.log('Compte élève délié', L.fullName(x)); await A.rosterSet(x); charger(); } return; }
    if (e.target.id === 'e-ros') { const v = liste.filter(x => !x.uid && x.classe && x.annee && (x.statut || 'valide') === 'valide'); if (!v.length) return alert('Rien à publier.'); e.target.disabled = true; await A.rosterLot(v); A.log('Liste d\'inscription publiée', v.length + ' élèves'); alert(v.length + ' élève(s) pourront créer leur compte avec leur nom, leur classe et l\'année.'); e.target.disabled = false; return; }
    if (e.target.id === 'e-att') { const sn = await DB.collection('eleves').where('statut', '==', 'attente').get(); liste = []; sn.forEach(d => liste.push(Object.assign({ id: d.id }, d.data()))); rendre(); if (!liste.length) $('#e-res').innerHTML = '<div class="vide-app">Aucune inscription en attente.</div>'; return; }
    if (ed) { const x = liste[ed.dataset.ed]; A.dlg('Modifier l\'élève', champsEleve(x), async d => { if (!L.anneeOk(d.annee)) throw new Error(L.MSG_ANNEE); const code = x.code || Session.nouveauCode(); await DB.collection('eleves').doc(x.id).set(Object.assign({}, d, { email: (d.email || '').trim().toLowerCase(), code }), { merge: true });
        await DB.collection('suivi').doc(code).set({ eleveId: x.id, nom: d.nom, prenom: d.prenom || '', classe: d.classe, annee: d.annee, updated: Date.now() }, { merge: true });
        await A.rosterSup(x); await A.rosterSet({ id: x.id, nom: d.nom, prenom: d.prenom, classe: d.classe, annee: d.annee }); A.log('Modification d\'un élève', L.fullName(d)); charger(); }); }
    if (sp) { const x = liste[sp.dataset.sp]; if (confirm('Supprimer ' + L.fullName(x) + ' ?')) { await DB.collection('eleves').doc(x.id).delete(); if (x.code) await DB.collection('suivi').doc(x.code).delete(); await A.rosterSup(x); A.log('Suppression d\'un élève', L.fullName(x)); charger(); } }
    if (e.target.id === 'e-sa') {
      const sans = liste.filter(x => !x.sexe || !x.age); if (!sans.length) return alert('Le sexe et l\'âge sont déjà renseignés.'); const v = A.valCA();
      const texte = await L.ocr.scanner('Remplir sexe et âge', 'Cadrez une fiche où figurent, sur chaque ligne : le numéro, le nom, le sexe (M ou F) et l\'âge.'); L.ocr.fin(); if (texte == null) return;
      L.ocr.verifier({ titre: 'Sexe et âge · ' + v.c + ' (' + v.a + ')', eleves: sans, lignes: L.ocr.analyserSexeAge(texte, sans), colonne: 'Sexe et âge (ex. M 17)', champ: 'valeur',
        surSauver: async rows => {
          const lus = rows.map(r => ({ eleve: r.eleve, sexe: (String(r.valeur).match(/\b([MF])\b/i) || [])[1], age: (String(r.valeur).match(/\b(\d{1,2})\b/) || [])[1] })).filter(r => r.sexe || r.age);
          await A.lots(lus, (b, r) => { const d = {}; if (r.sexe) d.sexe = r.sexe.toUpperCase(); if (r.age) { d.age = r.age; if (!r.eleve.naissance) d.naissance = L.anneeNaissance(r.age); } b.set(DB.collection('eleves').doc(r.eleve.id), d, { merge: true }); });
          A.log('Sexe et âge remplis (OCR)', v.c + ' ' + v.a + ' (' + lus.length + ' élèves)'); await charger(); alert(lus.length + ' fiche(s) complétée(s) : l\'année de naissance est calculée à partir de l\'âge.'); } });
    }
    if (e.target.id === 'e-mat') {
      const sans = liste.filter(x => !x.matricule); if (!sans.length) return alert('Tous les élèves affichés ont déjà un matricule.'); const v = A.valCA();
      const texte = await L.ocr.scanner('Remplir les matricules', 'Cadrez une fiche où figurent le nom et le matricule de chaque élève (un élève par ligne).'); L.ocr.fin(); if (texte == null) return;
      L.ocr.verifier({ titre: 'Matricules · ' + v.c + ' (' + v.a + ')', eleves: sans, lignes: L.ocr.analyserMatricules(texte, sans), colonne: 'Matricule', champ: 'matricule',
        surSauver: async rows => { await A.lots(rows, (b, r) => b.set(DB.collection('eleves').doc(r.eleve.id), { matricule: r.valeur.toUpperCase().slice(0, 40) }, { merge: true })); A.log('Matricules remplis (OCR)', v.c + ' ' + v.a + ' (' + rows.length + ' élèves)'); await charger(); alert(rows.length + ' matricule(s) enregistré(s).'); } });
    }
    if (e.target.id === 'e-csv') L.csv('eleves.csv', [['Nom', 'Prénom', 'Âge', 'Classe', 'Année', 'Matricule', 'E-mail']].concat(liste.map(x => [x.nom, x.prenom, x.age, x.classe, x.annee, x.matricule, x.email])));
    if (e.target.id === 'e-del' && A.confirmerMot('Supprimer ' + liste.length + ' élève(s) affiché(s) ?', 'SUPPRIMER')) { await A.lots(liste, (b, x) => { b.delete(DB.collection('eleves').doc(x.id)); if (x.code) b.delete(DB.collection('suivi').doc(x.code)); }); try { for (const x of liste) await A.rosterSup(x); } catch(err){} A.log('Suppression groupée d\'élèves', liste.length + ' élèves'); charger(); }
    if (e.target.id === 'e-sync') { const v = A.valCA(); if (!v.c || !L.anneeOk(v.a)) return alert('Choisissez une classe et une année académique pour publier le suivi.'); e.target.disabled = true; e.target.textContent = 'Publication…'; const n = await A.syncClasse(v.c, v.a, $('#e-per').value); A.log('Publication du suivi', v.c + ' ' + v.a + ' (' + n + ' élèves)'); if (window.Notif) Notif.envoyer({ public: 'classe:' + v.c }, 'Nouveaux résultats publiés', 'Les notes et la présence de ' + v.c + ' ont été mises à jour.', 'espace-eleve.html'); alert('Suivi publié pour ' + n + ' élève(s).'); charger(); }
  });
});

/* ---------- Notes ----------
   Enseignant : une seule matière à la fois, importée par OCR (caméra) ; aucune moyenne.
   Administration : voit toutes les matières, peut importer par OCR, corriger, puis « Calculer les moyennes et rangs ». */
A.def('notes', 'Notes', async el => {
  const ens = A.estEns(), mats = A.cols().map(x => x[0]);
  if (!mats.length) { el.innerHTML = '<h1>Notes</h1><div class="vide-app">Aucune matière notée n\'est associée à votre compte. Contactez le super administrateur.</div>'; return; }
  el.innerHTML = '<h1>Notes</h1><p class="sous">' + (ens
    ? 'Choisissez la classe, l\'année et la matière, puis importez la fiche avec la caméra : chaque nom est reconnu et sa note est enregistrée. Les moyennes sont calculées par l\'administration.'
    : 'Choisissez la séquence (1 à 6), la classe et l\'année, puis remplissez les notes de la séquence (matière par matière avec la caméra, ou directement dans le tableau). La moyenne et le rang de la séquence se calculent avec les coefficients ; « Enregistrer » les garde en base pour le bulletin.') + '</p>' +
    A.filtreCA('<label>Séquence<select id="f-s">' + [1, 2, 3, 4, 5, 6].map(i => '<option value="' + i + '">Séquence ' + i + '</option>').join('') + '<option value="0">Note annuelle (ancien mode)</option></select></label><label>Matière<select id="f-m">' + L.options(mats, mats.length === 1 ? mats[0] : '', 'Choisir…') + '</select></label><button class="btn dark s" id="n-go" type="button">Afficher les élèves</button>') + '<div id="n-res"></div>';
  let eleves = [], ctx = null;
  const colonnes = () => ens ? A.cols(ctx.c).filter(([m]) => m === ctx.m) : A.cols(ctx.c);
  /* la liste des matières suit la série de la classe choisie (pas de Physique/Chimie/SVT en A, Espagnol ou Allemand selon la section) */
  $('#f-c').addEventListener('change', () => { const l = A.cols($('#f-c').value).map(x => x[0]), s = $('#f-m'); if (s) s.innerHTML = L.options(l, l.length === 1 ? l[0] : '', 'Choisir…'); });
  const lire = td => { const v = parseFloat(td.textContent.replace(',', '.')); return isNaN(v) ? null : v; };
  const idNote = (nom, m) => encodeURIComponent(ctx.c + '_' + ctx.a + '_' + nom + '_' + m + (ctx.s ? '_s' + ctx.s : ''));   /* ctx.s : 0 = note annuelle unique, 1 à 6 = séquence */

  async function charger(){
    eleves = await L.eleves(ctx.c, ctx.a);
    if (!eleves.length) { $('#n-res').innerHTML = '<div class="vide-app">Aucun élève pour cette classe et cette année académique.</div>'; return; }
    const snap = await DB.collection('notes').where('classe', '==', ctx.c).where('annee', '==', ctx.a).get(); const map = {};
    snap.forEach(d => { const x = d.data(); if ((+x.seq || 0) !== (ctx.s || 0)) return; (map[x.eleve] = map[x.eleve] || {})[x.matiere] = x.note; });
    const cols = colonnes(); let coefs = {};
    if (!ens) { try { const cd = await DB.collection('classements').doc(L.classementId(ctx.c, ctx.a)).get(); coefs = (cd.exists && cd.data().coefs) || {}; } catch(e){} }   /* coefficients enregistrés */
    $('#n-res').innerHTML = '<p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn dark s" id="n-ocr" type="button">📷 Importer les notes' + (ctx.m ? ' de ' + esc(ctx.m) : '') + ' (caméra)</button>' +
      (ens ? '' : '<button class="btn s" id="n-calc" type="button">Calculer les moyennes et rangs</button>') +
      '<button class="btn gris s" id="n-save" type="button">Enregistrer les corrections</button><button class="btn gris s" id="n-csv" type="button">Exporter en CSV</button><button class="btn rouge s" id="n-del" type="button">Supprimer ' + (ens ? 'mes notes de ' + esc(ctx.m) : 'toutes les notes') + '</button></p><div id="n-info" class="sous"></div>' +
      '<div class="tbl-wrap"><table class="tbl" id="n-t"><thead><tr><th>#</th><th>Élève</th>' +
      cols.map(([m, c]) => '<th>' + esc(m) + (ens ? '' : '<br><input class="coef" type="number" min="0" value="' + (coefs[m] != null ? coefs[m] : c) + '" style="width:54px" title="Coefficient">') + '</th>').join('') + (ens ? '' : '<th>Moyenne' + (ctx.s ? ' séq. ' + ctx.s : '') + '</th><th>Mention</th><th>Rang</th>') + '</tr></thead><tbody>' +
      eleves.map((e, i) => { const nom = L.fullName(e); return '<tr data-nom="' + esc(nom) + '"><td>' + (i + 1) + '</td><td>' + esc(nom) + '</td>' + cols.map(([m]) => { const n = map[nom] && map[nom][m]; return '<td contenteditable="true" class="nc" data-m="' + esc(m) + '" data-old="' + (n == null ? '' : esc(n)) + '">' + (n == null ? '' : esc(n)) + '</td>'; }).join('') + (ens ? '' : '<td class="moy"></td><td class="men"></td><td class="rg"></td>') + '</tr>'; }).join('') + '</tbody></table></div>';
    if (!ens) calc();   /* moyennes, mentions et rangs toujours affichés, sans cliquer sur « Calculer » */
  }
  function calc(){
    const coefs = [...document.querySelectorAll('#n-t .coef')].map(i => parseFloat(i.value) || 0), rows = [...document.querySelectorAll('#n-t tbody tr')], moys = [], manque = {};
    rows.forEach(tr => { let t = 0, c = 0; [...tr.querySelectorAll('.nc')].forEach((td, i) => { const n = lire(td); if (n != null) { t += n * coefs[i]; c += coefs[i]; } else manque[td.dataset.m] = (manque[td.dataset.m] || 0) + 1; });
      const m = c ? t / c : null; moys.push(m); tr.querySelector('.moy').textContent = m == null ? '' : m.toFixed(2); tr.querySelector('.men').textContent = m == null ? '' : L.mention(m); });
    const tri = moys.filter(x => x != null).sort((a, b) => b - a); rows.forEach((tr, i) => { tr.querySelector('.rg').textContent = moys[i] == null ? '' : (tri.indexOf(moys[i]) + 1); });
    const ks = Object.keys(manque);
    $('#n-info').innerHTML = ks.length ? '<b>Matières pas encore complètes :</b> ' + ks.map(k => esc(k) + ' (' + manque[k] + ' élève' + (manque[k] > 1 ? 's' : '') + ' sans note)').join(', ') + '. Les moyennes tiennent compte des notes déjà saisies ; relancez le calcul quand tout est rempli.' : 'Toutes les matières sont remplies : moyennes et rangs à jour.';
  }
  async function sauverCoefs(){   /* les coefficients sont enregistrés pour la classe et l'année, puis publiés aux élèves */
    const co = {}, cols = colonnes(); document.querySelectorAll('#n-t .coef').forEach((i, k) => { const v = parseFloat(i.value); if (!isNaN(v) && v >= 0 && cols[k]) co[cols[k][0]] = v; });
    try { await DB.collection('classements').doc(L.classementId(ctx.c, ctx.a)).set({ classe: ctx.c, annee: ctx.a, coefs: co }, { merge: true }); await A.syncClasse(ctx.c, ctx.a); }
    catch(e){ alert('Coefficients non enregistrés : ' + e.message); }
  }
  const publier = () => ens ? A.syncClasse(ctx.c, ctx.a) : sauverCoefs();
  async function importer(){
    if (!ctx.m) return alert('Choisissez d\'abord la matière dont vous importez les notes.');
    const texte = await L.ocr.scanner('Notes de ' + ctx.m + ' · ' + ctx.c, 'Cadrez la fiche : un élève par ligne, avec sa note sur 20. Si la fiche a plusieurs pages, capturez-les l\'une après l\'autre.');
    L.ocr.fin(); if (texte == null) return;
    L.ocr.verifier({ titre: 'Notes de ' + ctx.m + ' · ' + ctx.c + ' (' + ctx.a + ')', eleves, lignes: L.ocr.analyserNotes(texte, eleves), colonne: 'Note /20', champ: 'note',
      surSauver: async rows => {
        const ops = rows.map(r => { const n = parseFloat(String(r.valeur).replace(',', '.')), nom = L.fullName(r.eleve);
          if (isNaN(n) || n < 0 || n > 20) throw new Error('Note invalide pour ' + nom + ' : elle doit être entre 0 et 20.');
          return [DB.collection('notes').doc(idNote(nom, ctx.m)), Object.assign({ classe: ctx.c, annee: ctx.a, eleve: nom, matiere: ctx.m, note: n }, ctx.s ? { seq: ctx.s } : {})]; });
        await A.lots(ops, (b, o) => b.set(o[0], o[1])); await publier(); A.log('Import de notes (OCR)', ctx.c + ' ' + ctx.a + ' ' + ctx.m + ' (' + ops.length + ')'); await charger();
        alert(ops.length + ' note(s) enregistrée(s) pour ' + ctx.m + '.' + (!ens && A.classementOk === false ? '\n\nAttention : le classement de la classe n\'a pas pu être publié (republiez firestore.rules dans Firebase). Le tableau d\'honneur des élèves en dépend.' : ''));
      } });
  }
  $('#n-go').onclick = async () => { const v = A.okCA(); if (!v) return; const m = $('#f-m').value; if (ens && !m) return alert('Choisissez la matière.'); ctx = Object.assign(v, { m, s: +($('#f-s') || {}).value || 0 }); await charger(); };
  $('#n-res').addEventListener('change', e => { if (!ens && e.target.matches && e.target.matches('.coef')) sauverCoefs(); });
  $('#n-res').addEventListener('input', e => { if (!ens && e.target.matches && e.target.matches('.nc, .coef')) calc(); });
  $('#n-res').addEventListener('click', async e => {
    const id = e.target.id;
    if (id === 'n-ocr') importer();
    if (id === 'n-calc') calc();
    if (id === 'n-save') {
      const ops = [];
      for (const tr of document.querySelectorAll('#n-t tbody tr')) for (const td of tr.querySelectorAll('.nc')) {
        const n = lire(td), ref = DB.collection('notes').doc(idNote(tr.dataset.nom, td.dataset.m));
        if (n != null) { if (n < 0 || n > 20) return alert('Note invalide (' + n + ') pour ' + tr.dataset.nom + ' en ' + td.dataset.m + ' : entre 0 et 20.'); ops.push([ref, Object.assign({ classe: ctx.c, annee: ctx.a, eleve: tr.dataset.nom, matiere: td.dataset.m, note: n }, ctx.s ? { seq: ctx.s } : {})]); }
        else if (td.dataset.old !== '') ops.push([ref, null]);
      }
      await A.lots(ops, (b, o) => o[1] ? b.set(o[0], o[1]) : b.delete(o[0])); await publier(); A.log('Saisie de notes', ctx.c + ' ' + ctx.a); alert('Notes enregistrées et publiées aux familles.' + (!ens && A.classementOk === false ? '\n\nAttention : le classement de la classe n\'a pas pu être publié (republiez firestore.rules dans Firebase). Le tableau d\'honneur des élèves en dépend.' : '')); await charger();
    }
    if (id === 'n-csv') { const cols = colonnes(), rows = [['Élève'].concat(cols.map(x => x[0]), ens ? [] : ['Moyenne', 'Mention', 'Rang'])];
      document.querySelectorAll('#n-t tbody tr').forEach(tr => rows.push([tr.dataset.nom].concat([...tr.querySelectorAll('.nc')].map(t => t.textContent.trim()), ens ? [] : [tr.querySelector('.moy').textContent, tr.querySelector('.men').textContent, tr.querySelector('.rg').textContent])));
      L.csv('notes_' + ctx.c + '_' + L.anneeKey(ctx.a) + '.csv', rows); }
    if (id === 'n-del' && A.confirmerMot('Supprimer ' + (ens ? 'vos notes de ' + ctx.m : 'toutes les notes') + ' de ' + ctx.c + ' (' + ctx.a + ') ?', 'SUPPRIMER')) {
      const s = await DB.collection('notes').where('classe', '==', ctx.c).where('annee', '==', ctx.a).get(); const mes = colonnes().map(x => x[0]);
      await A.lots(s.docs.filter(d => !ens || mes.includes(d.data().matiere)), (b, d) => b.delete(d.ref)); await A.syncClasse(ctx.c, ctx.a); A.log('Suppression des notes', ctx.c + ' ' + ctx.a); await charger();
    }
  });
  $('#n-res').addEventListener('input', e => { if (e.target.classList.contains('coef') && $('#n-t .moy')) { const pret = [...document.querySelectorAll('#n-t .moy')].some(td => td.textContent); if (pret) calc(); } });
});

/* ---------- Présence ---------- */
A.def('presence', 'Présence', async el => {
  const SE = S.seuilsAbsences || { avertissement: 10, exclusion: 30 };
  el.innerHTML = '<h1>Présence et discipline</h1><p class="sous">Appel par cours : à la fin de son cours, le professeur fait l\'appel, indique la matière et l\'horaire (ex. Mathématiques, 8 h à 10 h), note sur papier les numéros des absents et photographie la liste : les numéros lus sont cochés comme absents, il vérifie et enregistre. Le numéro d\'un élève est sa place dans la liste de la classe (ordre alphabétique) affichée ci-dessous.</p>' +
    A.filtreCA('<button class="btn dark s" id="p-go" type="button">Charger la classe</button>') + '<div id="p-form"></div><div id="p-hist"></div>';
  let ctx = null, l = [], tot = {}, parNom = {};
  const nomDe = e => L.fullName(e);
  const etat = n => n >= SE.exclusion ? '<b style="color:#c0392b">Exclusion</b>' : n >= SE.avertissement ? '<b style="color:#b9770e">Avertissement</b>' : '';
  const hhmm = dm => { const d = new Date(Date.now() + dm * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const matsDispo = () => A.estEns() ? (Session.ens.matiereNoms || []) : A.cols(ctx && ctx.c).map(x => x[0]);
  const matSel = () => '<label>Matière<select id="p-mat">' + (A.estEns() ? '' : '<option value="">— (non précisée)</option>') + matsDispo().map(m => '<option>' + esc(m) + '</option>').join('') + '</select></label>';
  const cours = () => ({ matiere: ($('#p-mat') || {}).value || '', debut: ($('#p-deb') || {}).value || '', fin: ($('#p-fin') || {}).value || '' });
  const profNom = () => A.estEns() ? String(Session.ens.nom || '').slice(0, 80) : '';
  const libCours = x => x.matiere ? esc(x.matiere) + (x.debut ? ' ' + esc(x.debut) + '–' + esc(x.fin || '') : '') : esc(x.heure || '');
  const charger = async () => {
    const s = await DB.collection('absences').where('classe', '==', ctx.c).where('annee', '==', ctx.a).get(); tot = {}; parNom = {};
    s.forEach(d => { const x = d.data(); (parNom[x.nom] = parNom[x.nom] || []).push(Object.assign({ id: d.id }, x)); if (/absent/i.test(x.statut || '')) tot[x.nom] = (tot[x.nom] || 0) + 1; });
  };
  const lignes = () => l.map((e, i) => { const n = tot[nomDe(e)] || 0; return '<tr><td>' + (i + 1) + '</td><td>' + esc(nomDe(e)) + '</td><td>' + n + '</td><td>' + etat(n) + '</td><td><input type="checkbox" class="p-ck" data-i="' + i + '" aria-label="Absent : ' + esc(nomDe(e)) + '"></td></tr>'; }).join('');
  const hist = () => {
    const noms = Object.keys(parNom).sort((a, b) => a.localeCompare(b, 'fr'));
    $('#p-hist').innerHTML = noms.length ? '<h3 style="margin-top:26px">Historique</h3>' + (A.estEns() ? '' : '<p><button class="btn rouge s" id="p-delall" type="button">Supprimer tout l\'historique de cette classe</button></p>') + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Élève</th><th>Présences / absences</th></tr></thead><tbody>' +
      noms.map((n, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(n) + '</td><td>' + parNom[n].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(a => '<div style="display:flex;gap:8px;align-items:center;margin:3px 0"><span>' + esc(a.date) + ' ' + libCours(a) + ' · ' + esc(a.statut) + ' / ' + esc(a.sanction) + '</span>' + (A.estEns() ? '' : '<button class="btn gris s" data-pe="' + a.id + '" data-st="' + esc(a.statut) + '" data-sa="' + esc(a.sanction) + '">Modifier</button><button class="btn rouge s" data-ps="' + a.id + '">×</button>') + '</div>').join('') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="vide-app" style="margin-top:18px">Aucun enregistrement pour cette classe.</div>';
  };
  const cocher = nums => { document.querySelectorAll('.p-ck').forEach(c => { c.checked = nums.includes(+c.dataset.i + 1); }); };
  const rafraichir = async () => { await charger(); $('#p-tb').innerHTML = lignes(); hist(); };
  $('#p-go').onclick = async () => {
    const v = A.okCA(); if (!v) return; ctx = v; l = await L.eleves(v.c, v.a);
    if (!l.length) { $('#p-form').innerHTML = '<div class="vide-app">Aucun élève trouvé. Ajoutez d\'abord les élèves de cette classe (Administration > Élèves) : ceux qui n\'ont pas de téléphone aussi, pour que la liste soit complète.</div>'; $('#p-hist').innerHTML = ''; return; }
    await charger();
    $('#p-form').innerHTML = '<div class="carte-app"><h3>Appel du cours</h3><div class="filtres"><label>Date de l\'appel<input type="date" id="p-date" value="' + new Date().toISOString().slice(0, 10) + '"></label>' + matSel() + '<label>Début du cours<input type="time" id="p-deb" value="' + hhmm(-60) + '"></label><label>Fin du cours<input type="time" id="p-fin" value="' + hhmm(0) + '"></label></div><div class="filtres">' +
      '<button class="btn dark s" id="p-ocr" type="button">📷 Lire la liste des absents (OCR)</button></div>' +
      '<div class="filtres"><label style="flex:1;min-width:220px">Ou saisir les numéros des absents<input id="p-nums" inputmode="numeric" placeholder="ex. 3, 7, 12"></label><button class="btn gris s" id="p-appl" type="button">Cocher ces numéros</button><button class="btn gris s" id="p-aucun" type="button">Tout décocher</button></div>' +
      '<div id="p-info" class="sous"></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Élève</th><th>Absences cumulées</th><th>Situation</th><th>Absent</th></tr></thead><tbody id="p-tb">' + lignes() + '</tbody></table></div>' +
      '<p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn dark" id="p-save" type="button">Enregistrer l\'appel</button></p>' +
      '<p class="sous">Seuils : avertissement à ' + SE.avertissement + ' absences, exclusion définitive à ' + SE.exclusion + ' absences (cumul sur l\'année).</p></div>' +
      '<details class="carte-app" style="margin-top:14px"><summary><b>Saisie manuelle d\'un seul élève</b></summary><form class="form" id="pf" style="max-width:none;margin-top:12px"><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));max-width:none"><label>Élève<select name="nom">' + l.map((e, i) => '<option value="' + esc(nomDe(e)) + '">' + (i + 1) + ' - ' + esc(nomDe(e)) + '</option>').join('') + '</select></label>' +
      '<label>Date<input type="date" name="date" required value="' + new Date().toISOString().slice(0, 10) + '"></label><label>Statut<select name="statut"><option>Présent</option><option>Absent</option></select></label><label>Sanction<select name="sanction"><option>Aucune</option><option>Avertissement</option><option>Exclusion</option><option>Sanction</option></select></label></div><button class="btn dark" type="submit">Enregistrer</button></form></details>';
    $('#p-ocr').onclick = async () => {
      const texte = await L.ocr.scanner('Appel · ' + ctx.c, 'Cadrez la liste où sont écrits les numéros des élèves absents (un ou plusieurs par ligne). Si la liste a plusieurs pages, capturez-les l\'une après l\'autre.'); L.ocr.fin(); if (texte == null) return;
      const r = L.ocr.analyserNumeros(texte, l.length); cocher(r.numeros);
      L.say($('#p-info'), r.numeros.length > 0, r.numeros.length ? r.numeros.length + ' numéro(s) lu(s) et coché(s) : ' + r.numeros.join(', ') + '. Vérifiez la liste, corrigez si besoin, puis enregistrez.' + (r.hors.length ? ' Ignoré(s) car hors de la liste : ' + r.hors.join(', ') + '.' : '') : 'Aucun numéro lu. Reprenez la photo plus près, bien à plat, avec plus de lumière, ou saisissez les numéros.');
    };
    $('#p-appl').onclick = () => { const r = L.ocr.analyserNumeros($('#p-nums').value, l.length); cocher(r.numeros); L.say($('#p-info'), true, r.numeros.length + ' numéro(s) coché(s)' + (r.hors.length ? ' · hors liste : ' + r.hors.join(', ') : '') + '.'); };
    $('#p-aucun').onclick = () => { cocher([]); L.say($('#p-info'), true, ''); };
    $('#p-save').onclick = async () => {
      const date = $('#p-date').value; if (!date) return alert('Choisissez la date de l\'appel.');
      const co = cours(); if (A.estEns() && !co.matiere) return alert('Choisissez la matière du cours.'); if (co.debut && co.fin && co.fin <= co.debut) return alert('L\'heure de fin doit être après l\'heure de début.');
      const cle = x => (x.date || '') + '|' + (x.matiere || '') + '|' + (x.debut || '');
      const idx = [...document.querySelectorAll('.p-ck:checked')].map(c => +c.dataset.i);
      if (!idx.length) return alert('Aucun élève n\'est coché absent. Cochez les absents ou lisez la liste par OCR.');
      const deja = new Set(); Object.keys(parNom).forEach(n => parNom[n].forEach(x => { if (cle(x) === cle({ date, matiere: co.matiere, debut: co.debut }) && /absent/i.test(x.statut || '')) deja.add(n); }));
      const liste = idx.map(i => l[i]).filter(e => !deja.has(nomDe(e)));
      if (!liste.length) return alert('Ces absences sont déjà enregistrées pour ce cours.');
      if (!confirm(liste.length + ' absence(s) à enregistrer le ' + date + ' pour ' + ctx.c + (co.matiere ? ' (' + co.matiere + (co.debut ? ', ' + co.debut + '–' + co.fin : '') + ')' : '') + ' ?' + (idx.length > liste.length ? '\n(' + (idx.length - liste.length) + ' déjà enregistrée(s), ignorée(s).)' : ''))) return;
      const b = $('#p-save'); b.disabled = true; b.textContent = 'Enregistrement…';
      try {
        const heure = new Date().toLocaleTimeString('fr-FR'), ops = liste.map(e => { const nom = nomDe(e), av = tot[nom] || 0, ap = av + 1;
          const sanction = ap >= SE.exclusion && av < SE.exclusion ? 'Exclusion' : ap >= SE.avertissement && av < SE.avertissement ? 'Avertissement' : 'Aucune'; return { e, nom, ap, sanction }; });
        await A.lots(ops, (bt, o) => bt.set(DB.collection('absences').doc(), Object.assign({ nom: o.nom, date, heure, statut: 'Absent', sanction: o.sanction, classe: ctx.c, annee: ctx.a }, co.matiere ? { matiere: co.matiere, debut: co.debut, fin: co.fin, prof: profNom() } : {})));
        await A.syncClasse(ctx.c, ctx.a);
        ops.forEach(o => { if (!window.Notif) return;
          if (o.e.code) Notif.envoyer({ code: o.e.code }, o.sanction === 'Exclusion' ? 'Exclusion définitive' : o.sanction === 'Avertissement' ? 'Avertissement pour absences' : 'Absence enregistrée',
            o.nom + ' a été noté(e) absent(e) le ' + date + (co.matiere ? ' en ' + co.matiere + (co.debut ? ' (' + co.debut + '–' + co.fin + ')' : '') : '') + '. Total : ' + o.ap + ' absence(s).', 'espace-eleve.html');
          if (o.sanction !== 'Aucune') Notif.envoyer({ staff: 'admin' }, o.sanction === 'Exclusion' ? 'Seuil d\'exclusion atteint' : 'Seuil d\'avertissement atteint', o.nom + ' (' + ctx.c + ') : ' + o.ap + ' absences.', 'administration.html'); });
        A.log('Appel par numéros', ctx.c + ' ' + ctx.a + ' ' + date + (co.matiere ? ' ' + co.matiere : '') + ' (' + ops.length + ' absents)');
        await rafraichir(); cocher([]);
        const sa = ops.filter(o => o.sanction !== 'Aucune');
        L.say($('#p-info'), true, ops.length + ' absence(s) enregistrée(s). Les familles sont prévenues.' + (sa.length ? ' Sanctions : ' + sa.map(o => o.nom + ' (' + o.sanction + ')').join(', ') + '.' : ''));
      } catch(err){ alert('Enregistrement impossible : ' + (err.message || err.code)); }
      b.disabled = false; b.textContent = 'Enregistrer l\'appel';
    };
    $('#pf').onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target).entries());
      const co2 = cours(); if (A.estEns() && !co2.matiere) return alert('Choisissez la matière du cours.'); await DB.collection('absences').add(Object.assign({ nom: d.nom, date: d.date, heure: new Date().toLocaleTimeString('fr-FR'), statut: d.statut, sanction: d.sanction, classe: ctx.c, annee: ctx.a }, co2.matiere ? { matiere: co2.matiere, debut: co2.debut, fin: co2.fin, prof: profNom() } : {})); await A.syncClasse(ctx.c, ctx.a); await rafraichir(); };
    hist();
  };
  el.addEventListener('click', async e => {
    const pe = e.target.closest('[data-pe]'), ps = e.target.closest('[data-ps]');
    if (pe) A.dlg('Modifier', '<label>Statut<select name="statut"><option' + (pe.dataset.st === 'Présent' ? ' selected' : '') + '>Présent</option><option' + (pe.dataset.st === 'Absent' ? ' selected' : '') + '>Absent</option></select></label><label>Sanction<select name="sanction">' + L.options(['Aucune', 'Avertissement', 'Exclusion', 'Sanction'], pe.dataset.sa) + '</select></label>', async d => { await DB.collection('absences').doc(pe.dataset.pe).update(d); await A.syncClasse(ctx.c, ctx.a); await rafraichir(); });
    if (ps && confirm('Supprimer cet enregistrement ?')) { await DB.collection('absences').doc(ps.dataset.ps).delete(); await A.syncClasse(ctx.c, ctx.a); await rafraichir(); }
    if (e.target.id === 'p-delall' && A.confirmerMot('Supprimer toute la présence de ' + ctx.c + ' (' + ctx.a + ') ?', 'SUPPRIMER')) { const s = await DB.collection('absences').where('classe', '==', ctx.c).where('annee', '==', ctx.a).get(); await A.lots(s.docs, (b, d) => b.delete(d.ref)); await A.syncClasse(ctx.c, ctx.a); A.log('Suppression de la présence', ctx.c + ' ' + ctx.a); await rafraichir(); }
  });
});

A.def('emploi', 'Emplois du temps', async el => {
  el.innerHTML = '<h1>Emplois du temps</h1><p class="sous">Saisissez la matière (et la salle) dans chaque case, puis enregistrez. Les élèves et les parents le voient immédiatement.</p><div class="filtres"><label>Classe<select id="t-c">' + L.options(S.classes, '', 'Choisir…') + '</select></label><button class="btn gris s" id="t-ocr" type="button" hidden>📷 Lire la fiche papier (OCR)</button><button class="btn dark s" id="t-save" type="button" hidden>Enregistrer</button></div><div class="msg" id="t-msg" role="status"></div><div id="t-res"></div>';
  $('#t-c').onchange = async () => { const c = $('#t-c').value; if (!c) { $('#t-res').innerHTML = ''; $('#t-save').hidden = true; $('#t-ocr').hidden = true; return; }
    $('#t-res').innerHTML = L.emploiHtml(await L.emploi(c), true); $('#t-save').hidden = false; $('#t-ocr').hidden = false; $('#t-msg').textContent = ''; $('#t-msg').className = 'msg'; };
  $('#t-res').addEventListener('input', e => { if (e.target.dataset && e.target.dataset.c) e.target.style.background = ''; });
  $('#t-ocr').onclick = async () => { const c = $('#t-c').value; if (!c) return;
    const pages = await L.ocr.scanner('Emploi du temps · ' + c, 'Posez la fiche de la classe à plat, bien éclairée, et cadrez tout le tableau : les jours en haut et les périodes (ou les horaires) à gauche.', { mots: true }); L.ocr.fin(); if (!pages || !pages.length) return;
    const r = L.ocr.analyserEmploi(pages); if (!r.ok) return L.say($('#t-msg'), false, (r.raison || 'Aucune case reconnue.') + ' Reprenez la photo ou saisissez à la main.');
    const tds = {}; document.querySelectorAll('#t-res [data-c]').forEach(td => { tds[td.dataset.c] = td; }); let n = 0;
    Object.keys(r.cases).forEach(k => { const td = tds[k]; if (!td) return; td.textContent = r.cases[k]; td.style.background = r.incertains.includes(k) ? '#fff6d6' : '#e6f4ea'; n++; });
    L.say($('#t-msg'), true, n + ' case(s) remplie(s)' + (r.incertains.length ? ', dont ' + r.incertains.length + ' à vérifier (en jaune)' : '') + (r.repli ? ' · lignes repérées sans les numéros de période : vérifiez bien chaque ligne' : '') + '. Corrigez si besoin puis cliquez sur « Enregistrer ».'); };
  $('#t-save').onclick = async () => { const cases = {}; document.querySelectorAll('#t-res [data-c]').forEach(td => { const v = td.textContent.trim(); if (v) cases[td.dataset.c] = v; });
    await DB.collection('emplois_du_temps').doc($('#t-c').value).set({ cases, maj: Date.now() }); alert('Emploi du temps enregistré.'); };
});
})();
