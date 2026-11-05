/* Lycée de Bahouan - administration (partie 2) */
(function(){
const S = window.SITE, esc = window.esc, A = window.ADM;
const $ = (s, r) => (r || document).querySelector(s);
const TS = () => firebase.firestore.FieldValue.serverTimestamp();

/* ---------- Annonces ---------- */
A.def('annonces', 'Annonces', async el => {
  el.innerHTML = '<h1>Annonces aux élèves et parents</h1><form class="form carte-app" id="a-f" style="max-width:none"><label>Type<select name="type" required><option value="">Choisir…</option><option>Message</option><option>Communiqué</option><option>Ordre</option><option>Information</option></select></label>' +
    '<label>Contenu<textarea name="texte" maxlength="1500" required></textarea></label><label class="coche"><input type="checkbox" name="public"> Afficher aussi sur la page d\'accueil du site (public)</label><button class="btn dark" type="submit">Publier</button><div class="msg" role="status"></div></form><p><button class="btn gris s" id="a-imp" type="button">Importer les anciennes annonces (ancien portail)</button></p><div id="a-l"></div>';
  const AN = {};
  const liste = async () => { const l = await L.annonces(60); l.forEach(a => { AN[a.id] = a; });
    $('#a-l').innerHTML = (l.length ? '<p><button class="btn rouge s" id="a-all" type="button">Supprimer toutes les annonces</button></p>' : '') + (l.map(a => '<div class="annonce ' + esc(a.type || '') + '"><small>' + esc(L.dateFr(a.date)) + (a.public ? ' · visible sur l\'accueil' : '') + '</small><b>' + esc(a.type || 'Message') + '</b><div>' + esc(a.texte).replace(/\n/g, '<br>') + '</div><p style="margin:8px 0 0"><button class="btn gris s" data-ed="' + a.id + '" type="button">Modifier</button> <button class="btn rouge s" data-x="' + a.id + '" type="button">Supprimer</button></p></div>').join('') || '<div class="vide-app">Aucune annonce.</div>'); };
  $('#a-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg');
    try { await DB.collection('annonces').add({ texte: f.texte.value.trim(), type: f.type.value, date: new Date().toISOString(), public: f.public.checked }); A.log('Annonce publiée', f.type.value); if (window.Notif) Notif.envoyer({ public: 'tous' }, 'Nouvelle annonce', f.texte.value.trim().slice(0, 100), 'index.html'); f.reset(); L.say(m, true, 'Annonce publiée.'); liste(); } catch(err){ L.say(m, false, 'Échec de la publication.'); } };
  el.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]');
    if (x && confirm('Supprimer cette annonce ?')) { await DB.collection('annonces').doc(x.dataset.x).delete(); A.log('Annonce supprimée', x.dataset.x); liste(); }
    if (e.target.id === 'a-all' && A.confirmerMot('Supprimer toutes les annonces ?', 'SUPPRIMER')) { const l = await L.annonces(500); await A.lots(l, (b2, a) => b2.delete(DB.collection('annonces').doc(a.id))); A.log('Toutes les annonces supprimées'); liste(); }
    if (e.target.id === 'a-imp') { const s = await DB.collection('messages').get(); const l = []; s.forEach(d => { const x2 = d.data(); if (x2.texte && x2.date) l.push(x2); });
      if (!l.length) return alert('Aucune ancienne annonce trouvée.'); await A.lots(l, (b2, x2) => b2.set(DB.collection('annonces').doc(), { texte: x2.texte, type: x2.type || 'Message', date: x2.date, public: false })); alert(l.length + ' annonce(s) importée(s).'); liste(); }
  });
  el.addEventListener('click', e => { const ed = e.target.closest('[data-ed]'); if (!ed) return; const a = AN[ed.dataset.ed];
    A.edit('annonces', ed.dataset.ed, 'Modifier l\'annonce', '<label>Type<select name="type">' + L.options(['Message', 'Communiqué', 'Ordre', 'Information'], a.type) + '</select></label><label>Contenu<textarea name="texte" rows="5" maxlength="1500" required>' + esc(a.texte || '') + '</textarea></label><label class="coche"><input type="checkbox" name="public"' + (a.public ? ' checked' : '') + '> Afficher aussi sur la page d\'accueil du site (public)</label>',
      async d => ({ type: d.type, texte: d.texte.trim(), public: d.public === 'on' }), liste); });
  liste();
});

/* ---------- Messagerie (conversations/{code}/echanges) ---------- */
A.def('messagerie', 'Messagerie', async el => {
  el.innerHTML = '<h1>Messagerie</h1><p class="sous">Messages reçus des élèves et des parents. Cliquez sur une conversation pour répondre.</p><div id="m-liste"></div><div id="m-conv" hidden></div>';
  let convs = [], courant = null, unsubMsgs = null;
  const rendreListe = () => {
    const g = {}; convs.forEach(c => (g[c.classe || ''] = g[c.classe || ''] || []).push(c));
    $('#m-liste').innerHTML = Object.keys(g).sort().map(cl => '<h3 style="margin-top:20px">' + esc(cl || 'Classe inconnue') + '</h3><div class="carte-app" style="padding:0">' + g[cl].map(c => '<button type="button" class="petit-lien" style="display:flex;justify-content:space-between;width:100%;padding:14px 20px;border-bottom:1px solid var(--ligne);text-decoration:none" data-code="' + esc(c.id) + '"><span>' + esc(c.nom || c.id) + '</span>' + (c.nonLus ? '<span style="background:#c0392b;color:#fff;border-radius:10px;padding:1px 9px">' + c.nonLus + ' nouveau(x)</span>' : '') + '</button>').join('') + '</div>').join('') || '<div class="vide-app">Aucun message reçu pour le moment.</div>';
  };
  const unsub = DB.collection('conversations').orderBy('dernier', 'desc').onSnapshot(s => { convs = s.docs.map(d => Object.assign({ id: d.id }, d.data())); rendreListe(); });
  A.cleanup = () => { unsub(); if (unsubMsgs) unsubMsgs(); };
  const ouvrir = c => {
    courant = c; $('#m-liste').hidden = true; $('#m-conv').hidden = false;
    $('#m-conv').innerHTML = '<p><button class="petit-lien" id="m-back" type="button">← Toutes les conversations</button></p><h2>' + esc(c.nom || '') + ' <small style="font:400 1rem var(--sans);color:var(--gris)">' + esc(c.classe || '') + '</small></h2><div class="chat"><div class="fil" id="m-fil"></div><form id="m-f"><textarea id="m-t" maxlength="1000" placeholder="Votre réponse" required></textarea><button class="btn dark s" type="submit">Répondre</button></form></div><p><button class="btn rouge s" id="m-del" type="button">Supprimer cette conversation</button></p>';
    const ref = DB.collection('conversations').doc(c.id);
    if (unsubMsgs) unsubMsgs();
    unsubMsgs = ref.collection('echanges').orderBy('timestamp').onSnapshot(s => {
      const fil = $('#m-fil'); if (!fil) return; const nonLus = [];
      fil.innerHTML = s.docs.map(d => { const x = d.data(); if (x.de !== 'admin' && !x.lu) nonLus.push(d.ref); return '<div class="bulle ' + (x.de === 'admin' ? 'moi' : 'autre') + '">' + esc(x.text || '') + '<small>' + (x.de === 'parent' ? 'Parent · ' : '') + (x.timestamp && x.timestamp.toDate ? x.timestamp.toDate().toLocaleString('fr-FR') : '') + '</small></div>'; }).join('');
      fil.scrollTop = fil.scrollHeight;
      if (nonLus.length) { A.lots(nonLus, (b2, r) => b2.update(r, { lu: true })).catch(() => {}); ref.set({ nonLus: 0 }, { merge: true }).catch(() => {}); }
    });
  };
  el.addEventListener('click', async e => {
    const c = e.target.closest('[data-code]'); if (c) ouvrir(convs.find(x => x.id === c.dataset.code));
    if (e.target.id === 'm-back') { if (unsubMsgs) unsubMsgs(); unsubMsgs = null; courant = null; $('#m-conv').hidden = true; $('#m-liste').hidden = false; }
    if (e.target.id === 'm-del' && confirm('Supprimer toute la conversation ?')) {
      const ref = DB.collection('conversations').doc(courant.id); const s = await ref.collection('echanges').get(); await A.lots(s.docs, (b2, d) => b2.delete(d.ref)); await ref.delete(); A.log('Conversation supprimée', courant.nom);
      if (unsubMsgs) unsubMsgs(); unsubMsgs = null; courant = null; $('#m-conv').hidden = true; $('#m-liste').hidden = false; }
  });
  el.addEventListener('submit', async e => { if (e.target.id !== 'm-f') return; e.preventDefault(); const t = $('#m-t').value.trim(); if (!t) return; $('#m-t').value = '';
    const ref = DB.collection('conversations').doc(courant.id);
    await ref.collection('echanges').add({ de: 'admin', nom: 'Administration', text: t.slice(0, 1000), lu: true, timestamp: TS() }); await ref.set({ dernier: Date.now() }, { merge: true }); if (window.Notif) Notif.envoyer({ code: courant.id }, 'Nouveau message de l\'administration', t.slice(0, 100), 'espace-eleve.html'); });
});

/* ---------- WhatsApp et admissions ---------- */
A.def('whatsapp', 'WhatsApp et contact', async el => {
  const num = (await DB.collection('informations_site').doc('admissions').get()).data() || {};
  const liens = {}; await Promise.all(S.classes.map(async c => { const d = await DB.collection('liens_whatsapp').doc(c).get(); liens[c] = d.exists ? d.data().lien || '' : ''; }));
  el.innerHTML = '<h1>WhatsApp et numéro d\'admissions</h1><div class="carte-app"><h3>Numéro d\'admissions (affiché sur le site)</h3><div class="filtres"><label>Numéro<input id="w-n" value="' + esc(num.numero || '') + '" placeholder="+237…"></label><button class="btn dark s" id="w-ns" type="button">Enregistrer</button></div></div>' +
    '<div class="carte-app"><h3>Groupes WhatsApp des classes</h3>' + S.classes.map((c, i) => '<div class="filtres"><label style="flex:1;min-width:260px">' + esc(c) + '<input data-c="' + esc(c) + '" value="' + esc(liens[c]) + '" placeholder="https://chat.whatsapp.com/…"></label><button class="btn dark s" data-s="' + i + '" type="button">Enregistrer</button><button class="btn rouge s" data-d="' + i + '" type="button">Supprimer</button></div>').join('') + '</div>';
  el.addEventListener('click', async e => {
    if (e.target.id === 'w-ns') { await DB.collection('informations_site').doc('admissions').set({ numero: $('#w-n').value.trim() }, { merge: true }); alert('Numéro enregistré.'); }
    const s = e.target.closest('[data-s]'), d = e.target.closest('[data-d]');
    if (s) { const c = S.classes[s.dataset.s], v = $('[data-c="' + c + '"]').value.trim(); if (v.indexOf('https://chat.whatsapp.com/') !== 0) return alert('Le lien doit commencer par https://chat.whatsapp.com/'); await DB.collection('liens_whatsapp').doc(c).set({ lien: v }); alert('Lien enregistré pour ' + c + '.'); }
    if (d) { const c = S.classes[d.dataset.d]; await DB.collection('liens_whatsapp').doc(c).delete(); $('[data-c="' + c + '"]').value = ''; }
  });
});

/* ---------- Envoi de fichier (Cloudinary) ou lien ---------- */
const champFichier = '<label>Fichier (PDF ou image)<input type="file" name="fichier" accept=".pdf,image/*,.doc,.docx"></label><label>… ou coller un lien (URL)<input name="url" placeholder="https://…"></label>';
async function urlFichier(f){ const file = f.elements.fichier.files[0], u = (f.elements.url.value || '').trim(); if (file) return window.uploadToCloudinary(file); if (u) return u; throw new Error('Choisissez un fichier ou collez un lien.'); }

/* ---------- Cours et épreuves ---------- */
A.def('cours', 'Cours et épreuves', async el => {
  el.innerHTML = '<h1>Cours et épreuves</h1><p class="sous">Les fichiers ajoutés ici apparaissent dans l\'espace élève, par matière et par classe.</p>' +
    '<div class="filtres"><label>Niveau<select id="k-n">' + [1, 2].filter(n => A.classesPerm().some(c => L.niveau(c) === n)).map(n => '<option value="' + n + '">' + (n === 1 ? 'Première' : 'Terminale') + '</option>').join('') + '</select></label><label>Matière<select id="k-m">' + A.matPerm().map(m => '<option value="' + m.k + '">' + esc(m.l) + '</option>').join('') + '</select></label></div>' +
    '<form class="form carte-app" id="k-f" style="max-width:none"><h3>Ajouter un fichier</h3><label>Nom du fichier<input name="name" required></label><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));max-width:none"><label>Classe<select name="classe" id="k-c" required></select></label><label>Année académique' + L.anneeField({ name: 'annee', value: L.anneeCourante() }) + '</label>' +
    '<label>Séquence<select name="sequence">' + [1, 2, 3, 4, 5, 6].map(n => '<option>Séquence ' + n + '</option>').join('') + '</select></label><label>Type<select name="type"><option>Cours</option><option>Exercices</option><option>Épreuve</option></select></label></div><label>Description (ce que l\'élève verra avant de télécharger)<textarea name="description" maxlength="400" rows="2" placeholder="Exemple : Exercices sur les limites, avec corrigé page 2"></textarea></label>' + champFichier + '<button class="btn dark" type="submit">Envoyer et enregistrer</button><div class="msg" role="status"></div></form><div id="k-l"></div>';
  const id = () => L.matiereId($('#k-m').value, $('#k-n').value);
  const classes = () => { $('#k-c').innerHTML = L.options(A.classesPerm().filter(c => L.niveau(c) === +$('#k-n').value)); };
  const liste = async () => { $('#k-l').innerHTML = '<h3>Fichiers déjà publiés</h3>' + L.fichiersHtml((await L.fichiers(id())).filter(f => !A.estEns() || A.classesPerm().includes(f.classe)), true); };
  $('#k-n').onchange = () => { classes(); liste(); }; $('#k-m').onchange = liste; classes(); liste();
  $('#k-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]'); b.disabled = true; L.say(m, true, 'Envoi en cours…');
    try { if (!L.anneeOk(f.annee.value)) throw new Error(L.MSG_ANNEE); const url = await urlFichier(f); await DB.collection('fichiers').add({ name: f.name.value.trim(), classe: f.classe.value, annee: f.annee.value.trim(), sequence: f.sequence.value, type: f.type.value, description: (f.description.value || '').trim().slice(0, 400), matiere: id(), url, createdAt: new Date() });
      if (window.Notif) Notif.envoyer({ public: 'classe:' + f.classe.value }, 'Nouveau contenu publié', f.name.value.trim(), 'espace-eleve.html'); f.reset(); classes(); L.say(m, true, 'Fichier publié.'); liste(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } b.disabled = false; };
  el.addEventListener('click', async e => { const x = e.target.closest('[data-supprfich]'); if (x && confirm('Supprimer ce fichier ?')) { await A.supprimerDoc('fichiers', x.dataset.supprfich, ['url']); liste(); } });
});

/* ---------- Examens ---------- */
A.def('examens', 'Examens', async el => {
  let liste = S.examens; try { const d = await DB.collection('configuration').doc('examens').get(); if (d.exists && d.data().liste && d.data().liste.length) liste = d.data().liste; } catch(e){}
  el.innerHTML = '<h1>Examens et épreuves</h1><div class="carte-app"' + (A.estEns() ? ' hidden' : '') + '><h3>Liste des examens</h3><p id="x-tags" style="display:flex;gap:8px;flex-wrap:wrap"></p><div class="filtres"><label>Nouvel examen<input id="x-new" placeholder="Exemple : Évaluation harmonisée"></label><button class="btn dark s" id="x-add" type="button">Ajouter</button></div></div>' +
    '<form class="form carte-app" id="x-f" style="max-width:none"><h3>Ajouter un fichier</h3><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));max-width:none"><label>Examen<select name="examen" id="x-sel"></select></label><label>Classe<select name="classe">' + L.options(A.classesPerm()) + '</select></label><label>Année académique' + L.anneeField({ name: 'annee', value: L.anneeCourante() }) + '</label><label>Matière<select name="matiere">' + A.matPerm().map(m => '<option>' + esc(m.l) + '</option>').join('') + '</select></label></div><label>Nom du fichier<input name="name" required></label>' + champFichier + '<button class="btn dark" type="submit">Envoyer et enregistrer</button><div class="msg" role="status"></div></form><div id="x-l"></div>';
  const tags = () => { $('#x-tags').innerHTML = liste.map((x, i) => '<span class="t fich" style="display:inline-flex;padding:4px 10px">' + esc(x) + ' <button type="button" class="petit-lien" data-r="' + i + '" aria-label="Retirer">×</button></span>').join(''); $('#x-sel').innerHTML = L.options(liste); };
  const sauver = () => DB.collection('configuration').doc('examens').set({ liste });
  const fichiers = async () => { const s = await DB.collection('examens_fichiers').get(); const l = []; s.forEach(d => l.push(Object.assign({ id: d.id }, d.data()))); l.sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0)); if (A.estEns()) { const nm = Session.ens.matiereNoms || []; for (let i = l.length - 1; i >= 0; i--) if (!nm.includes(l[i].matiere) || !A.classesPerm().includes(l[i].classe)) l.splice(i, 1); }
    $('#x-l').innerHTML = '<h3>Fichiers publiés</h3>' + (l.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Examen</th><th>Classe</th><th>Année académique</th><th>Matière</th><th>Fichier</th><th></th></tr></thead><tbody>' + l.map(f => '<tr><td>' + esc(f.examen) + '</td><td>' + esc(f.classe) + '</td><td>' + esc(f.annee) + '</td><td>' + esc(f.matiere) + '</td><td><div style="display:flex;gap:10px;align-items:center">' + (window.apercuHtml ? window.apercuHtml(f.url, f.name) : '') + '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a></div></td><td><button class="btn rouge s" data-fx="' + f.id + '">Supprimer</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="vide-app">Aucun fichier.</div>'); };
  tags(); fichiers();
  el.addEventListener('click', async e => {
    if (e.target.id === 'x-add') { const v = $('#x-new').value.trim(); if (v && !liste.includes(v)) { liste.push(v); await sauver(); $('#x-new').value = ''; tags(); } }
    const r = e.target.closest('[data-r]'); if (r) { liste.splice(+r.dataset.r, 1); await sauver(); tags(); }
    const fx = e.target.closest('[data-fx]'); if (fx && confirm('Supprimer ce fichier ?')) { await A.supprimerDoc('examens_fichiers', fx.dataset.fx, ['url']); fichiers(); }
  });
  $('#x-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]'); b.disabled = true; L.say(m, true, 'Envoi en cours…');
    try { if (!L.anneeOk(f.annee.value)) throw new Error(L.MSG_ANNEE); const url = await urlFichier(f); await DB.collection('examens_fichiers').add({ examen: f.examen.value, classe: f.classe.value, annee: f.annee.value.trim(), matiere: f.matiere.value, name: f.name.value.trim(), url, createdAt: new Date() });
      f.reset(); tags(); L.say(m, true, 'Fichier publié.'); fichiers(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } b.disabled = false; };
});

/* ---------- Actualités ---------- */
A.def('actualites', 'Actualités', async el => {
  const AC = {};
  el.innerHTML = '<h1>Actualités du site</h1><form class="form carte-app" id="ac-f" style="max-width:none"><label>Titre<input name="titre" required></label><label>Date<input name="date" type="date" required value="' + new Date().toISOString().slice(0, 10) + '"></label><label>Résumé (accueil)<input name="resume" maxlength="180"></label><label>Texte complet<textarea name="texte"></textarea></label><label>Photo (facultatif)<input name="photo" type="file" accept="image/*"></label><button class="btn dark" type="submit">Publier</button><div class="msg" role="status"></div></form><table class="tbl" id="ac-t"></table>';
  const liste = async () => { const s = await DB.collection('actualites').orderBy('date', 'desc').get(); const r = []; s.forEach(d => { const a = d.data(); AC[d.id] = a; r.push('<tr><td>' + (a.image ? '<img class="thumb" style="width:90px;height:56px;object-fit:cover" src="' + esc(cld(a.image, 200)) + '" alt="">' : '') + '</td><td><b>' + esc(a.titre || '') + '</b><br><small>' + esc(a.date || '') + '</small></td><td style="white-space:nowrap"><button class="btn gris s" data-ed="' + d.id + '">Modifier</button> <button class="btn rouge s" data-x="' + d.id + '">Supprimer</button></td></tr>'); }); $('#ac-t').innerHTML = r.join('') || '<tr><td>Aucune actualité.</td></tr>'; };
  $('#ac-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]'); b.disabled = true;
    try { let image = ''; const file = f.photo.files[0]; if (file) { L.say(m, true, 'Envoi de la photo…'); image = await uploadToCloudinary(file); }
      await DB.collection('actualites').add({ titre: f.titre.value.trim(), date: f.date.value, resume: f.resume.value.trim(), texte: f.texte.value.trim(), image, createdAt: TS() }); if (window.Notif) Notif.envoyer({ public: 'tous' }, 'Nouvelle actualité', f.titre.value.trim(), 'actualites.html'); f.reset(); L.say(m, true, 'Actualité publiée.'); liste(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } b.disabled = false; };
  el.addEventListener('click', async e => { const x = e.target.closest('[data-x]'); if (x && confirm('Supprimer cette actualité ?')) { await A.supprimerDoc('actualites', x.dataset.x, ['image']); liste(); } });
  el.addEventListener('click', e => { const ed = e.target.closest('[data-ed]'); if (!ed) return; const a = AC[ed.dataset.ed];
    A.edit('actualites', ed.dataset.ed, 'Modifier l\'actualité', '<label>Titre<input name="titre" required value="' + esc(a.titre || '') + '"></label><label>Date<input name="date" type="date" required value="' + esc(a.date || '') + '"></label><label>Résumé (accueil)<input name="resume" maxlength="180" value="' + esc(a.resume || '') + '"></label><label>Texte complet<textarea name="texte" rows="7">' + esc(a.texte || '') + '</textarea></label><label>Nouvelle photo (facultatif)<input name="photo" type="file" accept="image/*"></label>',
      async d => { const o = { titre: d.titre.trim(), date: d.date, resume: (d.resume || '').trim(), texte: (d.texte || '').trim() }; if (d.photo && d.photo.size) o.image = await uploadToCloudinary(d.photo); return o; }, liste); });
  liste();
});

/* ---------- Événements et calendrier ---------- */
A.def('evenements', 'Événements', async el => {
  const EV = {};
  el.innerHTML = '<h1>Événements et calendrier</h1><p class="sous">Les événements s\'affichent sur l\'accueil et dans la page Calendrier.</p><form class="form carte-app" id="ev-f" style="max-width:none"><label>Titre<input name="titre" required></label><div class="form" style="grid-template-columns:1fr 1fr;max-width:none"><label>Date de début<input name="date" type="date" required></label><label>Date de fin (facultatif)<input name="fin" type="date"></label></div><label>Lieu<input name="lieu"></label><label>Précisions<input name="description"></label><button class="btn dark" type="submit">Ajouter</button><div class="msg" role="status"></div></form><table class="tbl" id="ev-t"></table>';
  const liste = async () => { const s = await DB.collection('evenements').orderBy('date', 'desc').get(); const r = []; s.forEach(d => { const x = d.data(); EV[d.id] = x; r.push('<tr><td><b>' + esc(x.titre || '') + '</b><br><small>' + esc(x.date || '') + (x.fin ? ' → ' + esc(x.fin) : '') + ' ' + esc(x.lieu || '') + '</small></td><td style="white-space:nowrap"><button class="btn gris s" data-ed="' + d.id + '">Modifier</button> <button class="btn rouge s" data-x="' + d.id + '">Supprimer</button></td></tr>'); }); $('#ev-t').innerHTML = r.join('') || '<tr><td>Aucun événement.</td></tr>'; };
  $('#ev-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'); try { await DB.collection('evenements').add({ titre: f.titre.value.trim(), date: f.date.value, fin: f.fin.value, lieu: f.lieu.value.trim(), description: f.description.value.trim() }); if (window.Notif) Notif.envoyer({ public: 'tous' }, 'Nouvel événement', f.titre.value.trim() + ' · ' + f.date.value, 'calendrier.html'); f.reset(); L.say(m, true, 'Événement ajouté.'); liste(); } catch(err){ L.say(m, false, 'Échec.'); } };
  el.addEventListener('click', async e => { const x = e.target.closest('[data-x]'); if (x && confirm('Supprimer cet événement ?')) { await DB.collection('evenements').doc(x.dataset.x).delete(); liste(); } });
  el.addEventListener('click', e => { const ed = e.target.closest('[data-ed]'); if (!ed) return; const x = EV[ed.dataset.ed];
    A.edit('evenements', ed.dataset.ed, 'Modifier l\'événement', '<label>Titre<input name="titre" required value="' + esc(x.titre || '') + '"></label><label>Date de début<input name="date" type="date" required value="' + esc(x.date || '') + '"></label><label>Date de fin (facultatif)<input name="fin" type="date" value="' + esc(x.fin || '') + '"></label><label>Lieu<input name="lieu" value="' + esc(x.lieu || '') + '"></label><label>Précisions<input name="description" value="' + esc(x.description || '') + '"></label>',
      async d => ({ titre: d.titre.trim(), date: d.date, fin: d.fin || '', lieu: (d.lieu || '').trim(), description: (d.description || '').trim() }), liste); });
  liste();
});

/* ---------- Équipe pédagogique ---------- */
A.def('personnel', 'Équipe', async el => {
  const PE = {};
  el.innerHTML = '<h1>Équipe pédagogique et administrative</h1><form class="form carte-app" id="pe-f" style="max-width:none"><div class="form" style="grid-template-columns:1fr 1fr;max-width:none"><label>Nom complet<input name="nom" required></label><label>Fonction<input name="fonction" required placeholder="Exemple : Professeur de mathématiques"></label><label>Catégorie<select name="categorie"><option>Direction</option><option>Enseignants</option><option>Personnel</option></select></label><label>Photo (facultatif)<input name="photo" type="file" accept="image/*"></label></div><button class="btn dark" type="submit">Ajouter</button><div class="msg" role="status"></div></form><p><button class="btn gris s" id="pe-imp" type="button">Importer la direction (liste de la page Le lycée)</button></p><table class="tbl" id="pe-t"></table>';
  const liste = async () => { const s = await DB.collection('personnel').get(); const r = []; s.forEach(d => { const x = d.data(); PE[d.id] = x; r.push('<tr><td>' + (x.photo ? '<img class="thumb" style="width:50px;height:50px;object-fit:cover;border-radius:50%" src="' + esc(cld(x.photo, 120)) + '" alt="">' : '') + '</td><td><b>' + esc(x.nom) + '</b><br><small>' + esc(x.fonction) + ' · ' + esc(x.categorie) + '</small></td><td style="white-space:nowrap"><button class="btn gris s" data-ed="' + d.id + '">Modifier</button> <button class="btn rouge s" data-x="' + d.id + '">Supprimer</button></td></tr>'); }); $('#pe-t').innerHTML = r.join('') || '<tr><td>Personne pour le moment.</td></tr>'; };
  $('#pe-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]'); b.disabled = true;
    try { let photo = ''; if (f.photo.files[0]) { L.say(m, true, 'Envoi de la photo…'); photo = await uploadToCloudinary(f.photo.files[0]); }
      await DB.collection('personnel').add({ nom: f.nom.value.trim(), fonction: f.fonction.value.trim(), categorie: f.categorie.value, photo, createdAt: Date.now() }); f.reset(); L.say(m, true, 'Ajouté.'); liste(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } b.disabled = false; };
  el.addEventListener('click', async e => { const x = e.target.closest('[data-x]'); if (x && confirm('Supprimer cette personne ?')) { await A.supprimerDoc('personnel', x.dataset.x, ['photo']); liste(); } });
  el.addEventListener('click', async e => {
    const ed = e.target.closest('[data-ed]');
    if (ed) { const x = PE[ed.dataset.ed];
      A.edit('personnel', ed.dataset.ed, 'Modifier la fiche', '<label>Nom complet<input name="nom" required value="' + esc(x.nom || '') + '"></label><label>Fonction<input name="fonction" required value="' + esc(x.fonction || '') + '"></label><label>Catégorie<select name="categorie">' + L.options(['Direction', 'Enseignants', 'Personnel'], x.categorie) + '</select></label><label>Nouvelle photo (facultatif)<input name="photo" type="file" accept="image/*"></label>',
        async d => { const o = { nom: d.nom.trim(), fonction: d.fonction.trim(), categorie: d.categorie }; if (d.photo && d.photo.size) o.photo = await uploadToCloudinary(d.photo); return o; }, liste); }
    if (e.target.id === 'pe-imp') {
      let membres = S.direction.membres.map(m => ({ f: m.f, n: m.n, g: m.g })); try { const d = await DB.collection('contenu_site').doc('direction').get(); if (d.exists && Array.isArray(d.data().membres)) membres = d.data().membres; } catch(err){}
      const deja = new Set(Object.values(PE).map(x => (x.nom || '').toLowerCase())), neufs = membres.filter(m => !deja.has((m.n || '').toLowerCase()));
      if (!neufs.length) return alert('Toutes ces personnes figurent déjà dans l\'équipe.');
      if (!confirm('Ajouter ' + neufs.length + ' personne(s) à la page Équipe ?')) return;
      await A.lots(neufs, (b2, m) => b2.set(DB.collection('personnel').doc(), { nom: m.n, fonction: m.f, categorie: m.g || 'Direction', photo: '', createdAt: Date.now() })); A.log('Équipe importée', neufs.length + ' personnes'); liste();
    } });
  liste();
});

/* ---------- Galerie photos ---------- */
A.def('galerie', 'Galerie photos', async el => {
  el.innerHTML = '<h1>Galerie photos</h1><form class="form carte-app" id="ga-f" style="max-width:none"><div class="form" style="grid-template-columns:1fr 1fr;max-width:none"><label>Légende<input name="titre" required></label><label>Album<input name="album" placeholder="Exemple : Festival Nkaing" required></label></div><label>Photo<input name="photo" type="file" accept="image/*" required></label><button class="btn dark" type="submit">Ajouter à la galerie</button><div class="msg" role="status"></div></form><div class="matgrid" id="ga-l"></div>';
  const liste = async () => { const s = await DB.collection('galerie').get(); const r = []; s.forEach(d => { const x = d.data(); r.push('<div class="mat" style="cursor:default"><i style="background-image:url(\'' + esc(cld(x.url, 500)) + '\')"></i><span style="font-size:.95rem">' + esc(x.titre) + '<br><small>' + esc(x.album) + '</small><br><button class="btn rouge s" data-x="' + d.id + '" style="margin-top:6px">Supprimer</button></span></div>'); }); $('#ga-l').innerHTML = r.join('') || '<div class="vide-app">Aucune photo.</div>'; };
  $('#ga-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]'); b.disabled = true; L.say(m, true, 'Envoi de la photo…');
    try { const url = await uploadToCloudinary(f.photo.files[0]); await DB.collection('galerie').add({ titre: f.titre.value.trim(), album: f.album.value.trim(), url, date: new Date().toISOString() }); f.reset(); L.say(m, true, 'Photo ajoutée.'); liste(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } b.disabled = false; };
  el.addEventListener('click', async e => { const x = e.target.closest('[data-x]'); if (x && confirm('Supprimer cette photo ?')) { await A.supprimerDoc('galerie', x.dataset.x, ['url']); liste(); } });
  liste();
});

/* ---------- Images du site ---------- */
A.def('images', 'Images du site', async el => {
  el.innerHTML = '<h1>Images du site</h1><p class="sous">Envoyez une photo pour remplacer une image du site. Elle est stockée sur Cloudinary. « Retirer » rétablit l\'image du dossier <code>images/</code>.</p><div class="msg" id="im-m" role="status"></div><div class="tbl-wrap"><table class="tbl" id="im-t"></table></div>';
  const liste = async () => { let map = {}; try { const s = await DB.collection('site_images').get(); s.forEach(d => map[d.id] = d.data().url); } catch(e){}
    $('#im-t').innerHTML = '<thead><tr><th>Aperçu</th><th>Fichier</th><th>Emplacement</th><th></th></tr></thead><tbody>' + S.images.map(i => '<tr><td><img style="width:90px;height:56px;object-fit:cover;background:var(--abysse)" src="' + esc(map[i.key] ? cld(map[i.key], 200) : 'images/' + i.key + '.jpg') + '" alt=""></td><td><b>' + i.key + '.jpg</b><br><small>' + i.w + '×' + i.h + '</small></td><td><small>' + esc(i.desc) + '</small></td><td style="white-space:nowrap"><label class="btn dark s" style="cursor:pointer">Remplacer<input type="file" accept="image/*" data-up="' + i.key + '" hidden></label> ' + (map[i.key] ? '<button class="btn gris s" data-rm="' + i.key + '">Retirer</button>' : '') + '</td></tr>').join('') + '</tbody>'; };
  el.addEventListener('change', async e => { const k = e.target.getAttribute && e.target.getAttribute('data-up'); if (!k || !e.target.files[0]) return; const m = $('#im-m'); L.say(m, true, 'Envoi de ' + k + '.jpg…');
    try { const url = await uploadToCloudinary(e.target.files[0]); await DB.collection('site_images').doc(k).set({ url, maj: Date.now() }); sessionStorage.removeItem('bhn_imgs'); L.say(m, true, k + '.jpg remplacée.'); liste(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } });
  el.addEventListener('click', async e => { const k = e.target.getAttribute && e.target.getAttribute('data-rm'); if (!k) return; await A.supprimerDoc('site_images', k, ['url']); sessionStorage.removeItem('bhn_imgs'); liste(); });
  liste();
});

/* ---------- Informations générales ---------- */
A.def('general', 'Informations générales', async el => {
  let d = {}; try { const x = await DB.collection('informations_site').doc('general').get(); if (x.exists) d = x.data(); } catch(e){}
  const G = [['terre', 'Bahouan, terre de savoir'], ['communaute', 'Communauté bilingue'], ['numerique', 'Lycée connecté']];
  el.innerHTML = '<h1>Informations générales</h1><form class="form carte-app" id="ge-f" style="max-width:none"><label>Lien de la vidéo (videos/presentation.mp4, YouTube ou Vimeo ; vide = pas de vidéo)<input name="videoUrl" value="' + esc(d.videoUrl != null ? d.videoUrl : S.videoUrl) + '"></label><label>Année scolaire des inscriptions<input name="anneeScolaire" value="' + esc(d.anneeScolaire || S.anneeScolaire) + '" placeholder="2026-2027"></label><label>Horaires<input name="horaires" value="' + esc(d.horaires || S.horaires) + '"></label><label>E-mail du lycée<input name="email" type="email" value="' + esc(d.email || S.email) + '"></label><label>Adresse<input name="adresse" value="' + esc(d.adresse || S.adresse) + '"></label><label>Lien Facebook<input name="facebook" value="' + esc(d.facebook || S.facebook) + '"></label><label>Lien WhatsApp du lycée<input name="whatsapp" value="' + esc(d.whatsapp || S.whatsapp) + '"></label>' +
    '<label>Classes du lycée (une par ligne). Modifiez avec précaution : les fiches déjà créées gardent l\'ancien nom.<textarea name="classes" rows="5">' + esc(S.classes.join('\n')) + '</textarea></label>' +
    '<h3>Chiffres de l\'accueil</h3>' + G.map(([k, t]) => { let l = S.stats[k]; try { if (d[k]) l = JSON.parse(d[k]); } catch(e){} return '<h4 style="margin:12px 0 6px;font:600 1rem var(--sans)">' + t + '</h4>' + l.map((s, i) => '<div style="display:grid;grid-template-columns:110px 1fr 2fr;gap:8px;margin-bottom:6px"><input data-g="' + k + '" data-i="' + i + '" data-f="n" value="' + esc(s.n) + '" aria-label="Chiffre"><input data-g="' + k + '" data-i="' + i + '" data-f="t" value="' + esc(s.t) + '" aria-label="Titre"><input data-g="' + k + '" data-i="' + i + '" data-f="d" value="' + esc(s.d || '') + '" aria-label="Description"></div>').join(''); }).join('') + '<button class="btn dark" type="submit">Enregistrer</button><div class="msg" role="status"></div></form>';
  $('#ge-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), data = {};
    ['videoUrl', 'anneeScolaire', 'horaires', 'email', 'adresse', 'facebook', 'whatsapp'].forEach(k => data[k] = f.elements[k].value.trim());
    data.classes = JSON.stringify(f.elements.classes.value.split('\n').map(x => x.trim()).filter(Boolean));
    G.forEach(([k]) => { const l = []; f.querySelectorAll('[data-g="' + k + '"]').forEach(inp => { const i = +inp.dataset.i; l[i] = l[i] || {}; l[i][inp.dataset.f] = inp.value; }); data[k] = JSON.stringify(l); });
    try { await DB.collection('informations_site').doc('general').set(data, { merge: true }); L.say(m, true, 'Enregistré. Le site se met à jour au prochain chargement.'); } catch(err){ L.say(m, false, "Échec de l'enregistrement."); } };
});

/* ---------- Demandes reçues ---------- */
A.def('demandes', 'Demandes reçues', async el => {
  el.innerHTML = '<h1>Demandes reçues</h1><h3>Demandes d\'information, visites et messages</h3><div id="d-1"></div><h3 style="margin-top:26px">Anciens élèves inscrits</h3><div id="d-2"></div>';
  const lire = async (col, champs, box) => { try { const s = await DB.collection(col).orderBy('createdAt', 'desc').limit(100).get(); const r = []; s.forEach(d => { const x = d.data(); r.push('<tr><td><b>' + esc(x.nom || '') + '</b><br><small>' + esc(window.fmtDate(x.createdAt)) + '</small></td><td>' + champs(x) + '</td><td><button class="btn rouge s" data-c="' + col + '" data-id="' + d.id + '">Supprimer</button></td></tr>'); });
    $(box).innerHTML = r.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + r.join('') + '</tbody></table></div>' : '<div class="vide-app">Rien pour le moment.</div>'; } catch(e){ $(box).innerHTML = '<div class="vide-app">Lecture impossible.</div>'; } };
  const tout = () => { lire('demandes', x => esc(x.type || '') + ' · ' + esc(x.telephone || '') + ' ' + esc(x.email || '') + '<br>' + esc(x.niveau || '') + ' ' + (x.dateVisite ? 'Visite le ' + esc(x.dateVisite) + ' ' : '') + esc(x.message || ''), '#d-1'); lire('anciens', x => 'Promotion ' + esc(x.promotion || '?') + ' · ' + esc(x.profession || '') + ' · ' + esc(x.ville || '') + '<br>' + esc(x.contact || '') + ' ' + esc(x.message || ''), '#d-2'); };
  el.addEventListener('click', async e => { const b = e.target.closest('[data-c]'); if (b && confirm('Supprimer ?')) { await DB.collection(b.dataset.c).doc(b.dataset.id).delete(); tout(); } });
  tout();
});

/* ---------- Sécurité du compte ---------- */
A.def('securite', 'Sécurité du compte', async el => {
  const u = Session.authUser; let ancien = false; try { ancien = (await DB.collection('configuration').doc('admin').get()).exists; } catch(e){}
  el.innerHTML = '<h1>Sécurité du compte</h1><div class="carte-app"><h3>Mon compte administrateur</h3><p>Connecté avec <b>' + esc(u ? u.email : '') + '</b>. La session se ferme après 30 minutes sans activité.</p></div>' +
    '<form class="form carte-app" id="sc-f"><h3>Changer mon mot de passe</h3><label>Mot de passe actuel<input name="old" type="password" required autocomplete="current-password"></label><label>Nouveau mot de passe (10 caractères minimum, avec lettres et chiffres)<input name="n1" type="password" minlength="10" required autocomplete="new-password"></label><label>Confirmer<input name="n2" type="password" required autocomplete="new-password"></label><button class="btn dark" type="submit">Changer le mot de passe</button><div class="msg" role="status"></div></form>' +
    (ancien ? '<div class="carte-app" style="border-color:#b3261e"><h3>Ancien mot de passe en clair détecté</h3><p>L\'ancien portail stockait un mot de passe lisible dans la base. Il ne sert plus : supprimez-le.</p><button class="btn rouge" id="sc-old" type="button">Supprimer l\'ancien mot de passe</button></div>' : '<div class="carte-app"><h3>Ancien mot de passe</h3><p>Aucun mot de passe en clair dans la base. Parfait.</p></div>') +
    '<div class="carte-app"><h3>Ajouter un administrateur</h3><p>Pour des raisons de sécurité, un nouvel administrateur se crée depuis la console Firebase : Authentication > Ajouter un utilisateur, puis un document <code>admins/UID</code> dans Firestore. Le guide <b>SECURITE.txt</b> (dans le dossier du site) détaille chaque étape.</p></div>';
  $('#sc-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg');
    try {
      if (f.n1.value !== f.n2.value) throw new Error('Les deux mots de passe ne correspondent pas.');
      if (!/[A-Za-z]/.test(f.n1.value) || !/\d/.test(f.n1.value)) throw new Error('Le mot de passe doit contenir des lettres et des chiffres.');
      const cred = firebase.auth.EmailAuthProvider.credential(u.email, f.old.value); await u.reauthenticateWithCredential(cred); await u.updatePassword(f.n1.value);
      A.log('Mot de passe modifié'); f.reset(); L.say(m, true, 'Mot de passe modifié.');
    } catch(err){ L.say(m, false, err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Mot de passe actuel incorrect.' : (err.message || 'Échec.')); } };
  const so = $('#sc-old'); if (so) so.onclick = async () => { if (!confirm('Supprimer définitivement l\'ancien mot de passe en clair ?')) return; await DB.collection('configuration').doc('admin').delete(); A.log('Ancien mot de passe en clair supprimé'); ADM_SHOW('securite'); };
});

/* ---------- Pré-inscriptions ---------- */
A.def('preinscriptions', 'Pré-inscriptions', async el => {
  el.innerHTML = '<h1>Pré-inscriptions en ligne</h1><p class="sous">Dossiers envoyés depuis la page Admissions.</p><div id="pi"></div>';
  const STAT = ['Nouveau', 'En cours', 'Accepté', 'Refusé'];
  const charge = async () => {
    const s = await DB.collection('preinscriptions').orderBy('createdAt', 'desc').limit(300).get(); const l = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    $('#pi').innerHTML = l.length ? '<p><button class="btn gris s" id="pi-csv" type="button">Exporter en CSV</button></p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Candidat</th><th>Classe demandée</th><th>Contact</th><th>Statut</th><th></th></tr></thead><tbody>' + l.map((x, i) => '<tr><td><b>' + esc(x.nom || '') + ' ' + esc(x.prenom || '') + '</b><br><small>' + esc(window.fmtDate(x.createdAt)) + '</small></td><td>' + esc(x.classe || '') + '</td><td>' + esc(x.tuteurNom || '') + '<br>' + esc(x.telephone || '') + '</td><td><select data-st="' + x.id + '">' + L.options(STAT, x.statut || 'Nouveau') + '</select></td><td style="white-space:nowrap"><button class="btn gris s" data-v="' + i + '">Détails</button> <button class="btn rouge s" data-x="' + x.id + '">Supprimer</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="vide-app">Aucune pré-inscription pour le moment.</div>';
    el.onclick = async e => { const v = e.target.closest('[data-v]'), x = e.target.closest('[data-x]');
      if (v) { const o = l[v.dataset.v]; const ch = { nom: 'Nom', prenom: 'Prénom', naissance: 'Date de naissance', sexe: 'Sexe', classe: 'Classe demandée', etablissement: "Établissement d'origine", tuteurNom: 'Parent / tuteur', telephone: 'Téléphone', email: 'E-mail', adresse: 'Quartier / adresse', message: 'Message', documents: 'Documents (liens)' };
        A.dlg('Dossier de ' + esc(o.nom || ''), '<div class="liste">' + Object.keys(ch).filter(k => o[k]).map(k => '<li><b>' + ch[k] + '</b>' + (k === 'documents' ? String(o[k]).split(/\s+/).map(u => /^https:\/\//.test(u) ? '<a class="lien" target="_blank" rel="noopener noreferrer" href="' + esc(u) + '">Ouvrir le document</a>' : esc(u)).join('<br>') : esc(o[k])) + '</li>').join('') + '</div>', async () => {}, 'Fermer'); }
      if (x && confirm('Supprimer ce dossier ?')) { await A.supprimerDoc('preinscriptions', x.dataset.x, ['documents']); charge(); }
      if (e.target.id === 'pi-csv') L.csv('preinscriptions.csv', [['Nom', 'Prénom', 'Naissance', 'Sexe', 'Classe', 'Établissement', 'Parent', 'Téléphone', 'E-mail', 'Statut']].concat(l.map(o => [o.nom, o.prenom, o.naissance, o.sexe, o.classe, o.etablissement, o.tuteurNom, o.telephone, o.email, o.statut || 'Nouveau']))); };
    el.onchange = async e => { const s2 = e.target.closest('[data-st]'); if (s2) { await DB.collection('preinscriptions').doc(s2.dataset.st).update({ statut: s2.value }); A.log('Statut de pré-inscription', s2.value); } };
  };
  charge();
});

/* ---------- Témoignages ---------- */
A.def('temoignages', 'Témoignages', async el => {
  const TM = {};
  el.innerHTML = '<h1>Témoignages</h1><p class="sous">Les témoignages envoyés depuis le site doivent être approuvés avant d\'être publiés.</p><form class="form carte-app" id="t-f" style="max-width:none"><h3>Ajouter un témoignage</h3><div class="form" style="grid-template-columns:1fr 1fr;max-width:none"><label>Nom<input name="nom" required></label><label>Qui est-ce ? (Élève, Parent, Ancien…)<input name="role" required></label></div><label>Témoignage<textarea name="texte" maxlength="600" required></textarea></label><label class="coche"><input type="checkbox" name="accueil" checked> Afficher sur la page d\'accueil</label><button class="btn dark" type="submit">Publier</button></form><div id="t-l"></div>';
  const charge = async () => { const s = await DB.collection('temoignages').get(); const l = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.approuve === b.approuve ? 0 : a.approuve ? 1 : -1)); l.forEach(x => { TM[x.id] = x; });
    $('#t-l').innerHTML = l.length ? l.map(x => '<div class="annonce" style="border-color:' + (x.approuve ? 'var(--nuit)' : '#c0392b') + '"><small>' + (x.approuve ? 'Publié' : 'En attente d\'approbation') + (x.accueil ? ' · affiché sur la page d\'accueil' : '') + ' · ' + esc(x.role || '') + '</small><b>' + esc(x.nom || '') + '</b><div>' + esc(x.texte || '') + '</div><p style="margin:8px 0 0">' + (x.approuve ? '<button class="btn gris s" data-a="' + x.id + '" data-v="0">Retirer</button>' : '<button class="btn dark s" data-a="' + x.id + '" data-v="1">Approuver</button>') + (x.approuve ? ' <button class="btn dark s" data-h="' + x.id + '" data-v="' + (x.accueil ? '0' : '1') + '">' + (x.accueil ? 'Retirer de l\'accueil' : 'Afficher sur l\'accueil') + '</button>' : '') + ' <button class="btn gris s" data-ed="' + x.id + '">Modifier</button> <button class="btn rouge s" data-x="' + x.id + '">Supprimer</button></p></div>').join('') : '<div class="vide-app">Aucun témoignage.</div>'; };
  $('#t-f').onsubmit = async e => { e.preventDefault(); const f = e.target; await DB.collection('temoignages').add({ nom: f.nom.value.trim(), role: f.role.value.trim(), texte: f.texte.value.trim(), approuve: true, accueil: f.accueil.checked, createdAt: TS() }); f.reset(); charge(); };
  el.addEventListener('click', async e => { const a2 = e.target.closest('[data-a]'), x = e.target.closest('[data-x]');
    if (a2) { await DB.collection('temoignages').doc(a2.dataset.a).update({ approuve: a2.dataset.v === '1' }); charge(); }
    if (x && confirm('Supprimer ce témoignage ?')) { await DB.collection('temoignages').doc(x.dataset.x).delete(); charge(); } });
  el.addEventListener('click', async e => {
    const h = e.target.closest('[data-h]'), ed = e.target.closest('[data-ed]');
    if (h) { await DB.collection('temoignages').doc(h.dataset.h).update({ accueil: h.dataset.v === '1' }); A.log('Témoignage ' + (h.dataset.v === '1' ? 'mis sur l\'accueil' : 'retiré de l\'accueil'), h.dataset.h); charge(); }
    if (ed) { const x = TM[ed.dataset.ed]; A.edit('temoignages', ed.dataset.ed, 'Modifier le témoignage', '<label>Nom<input name="nom" required value="' + esc(x.nom || '') + '"></label><label>Qui est-ce ?<input name="role" required value="' + esc(x.role || '') + '"></label><label>Témoignage<textarea name="texte" rows="5" maxlength="600" required>' + esc(x.texte || '') + '</textarea></label>',
      async d => ({ nom: d.nom.trim(), role: d.role.trim(), texte: d.texte.trim() }), charge); } });
  charge();
});

/* ---------- Réussite : tableau d'honneur et résultats aux examens ---------- */
A.def('palmares', 'Réussite et honneur', async el => {
  el.innerHTML = '<h1>Réussite et tableau d\'honneur</h1><form class="form carte-app" id="h-f" style="max-width:none"><h3>Tableau d\'honneur</h3><div class="form" style="grid-template-columns:1fr 1fr;max-width:none"><label>Nom de l\'élève<input name="nom" required></label><label>Classe<input name="classe" required></label><label>Année académique' + L.anneeField({ name: 'annee', value: L.anneeCourante() }) + '</label><label>Distinction<input name="distinction" required placeholder="Exemple : Major de promotion"></label></div><label>Photo (facultatif)<input name="photo" type="file" accept="image/*"></label><button class="btn dark" type="submit">Ajouter</button><div class="msg" role="status"></div></form><div id="h-l"></div>' +
    '<form class="form carte-app" id="r-f" style="max-width:none"><h3>Résultats aux examens</h3><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));max-width:none"><label>Année académique' + L.anneeField({ name: 'annee', value: L.anneeCourante() }) + '</label><label>Examen<input name="examen" required placeholder="Baccalauréat"></label><label>Présentés<input name="presentes" type="number" min="1" required></label><label>Admis<input name="admis" type="number" min="0" required></label></div><button class="btn dark" type="submit">Ajouter</button></form><div id="r-l"></div>';
  const charge = async () => {
    const h = await DB.collection('palmares').get(); $('#h-l').innerHTML = h.docs.map(d => { const x = d.data(); return '<div class="fich"><b>' + esc(x.nom) + '</b><span class="t">' + esc(x.classe) + ' ' + esc(x.annee) + '</span><span>' + esc(x.distinction) + '</span><button class="btn rouge s" data-h="' + d.id + '" style="margin-left:auto">Supprimer</button></div>'; }).join('') || '<div class="vide-app">Aucun élève au tableau d\'honneur.</div>';
    const r = await DB.collection('reussite_stats').get(); $('#r-l').innerHTML = r.docs.map(d => { const x = d.data(); return '<div class="fich"><b>' + esc(x.examen) + ' ' + esc(x.annee) + '</b><span>' + x.admis + ' admis / ' + x.presentes + ' présentés (' + (x.presentes ? (x.admis / x.presentes * 100).toFixed(1) : 0) + ' %)</span><button class="btn rouge s" data-r="' + d.id + '" style="margin-left:auto">Supprimer</button></div>'; }).join('') || '<div class="vide-app">Aucun résultat enregistré.</div>';
  };
  $('#h-f').onsubmit = async e => { e.preventDefault(); const f = e.target, m = f.querySelector('.msg');
    try { let photo = ''; if (f.photo.files[0]) { L.say(m, true, 'Envoi de la photo…'); photo = await uploadToCloudinary(f.photo.files[0]); }
      if (!L.anneeOk(f.annee.value)) throw new Error(L.MSG_ANNEE); await DB.collection('palmares').add({ nom: f.nom.value.trim(), classe: f.classe.value.trim(), annee: f.annee.value.trim(), distinction: f.distinction.value.trim(), photo, createdAt: Date.now() }); f.reset(); L.say(m, true, 'Ajouté.'); charge(); } catch(err){ L.say(m, false, 'Échec : ' + err.message); } };
  $('#r-f').onsubmit = async e => { e.preventDefault(); const f = e.target; const p = +f.presentes.value, a2 = +f.admis.value; if (a2 > p) return alert('Le nombre d\'admis ne peut pas dépasser le nombre de présentés.'); if (!L.anneeOk(f.annee.value)) return alert(L.MSG_ANNEE);
    await DB.collection('reussite_stats').add({ annee: f.annee.value.trim(), examen: f.examen.value.trim(), presentes: p, admis: a2 }); f.reset(); charge(); };
  el.addEventListener('click', async e => { const h = e.target.closest('[data-h]'), r = e.target.closest('[data-r]');
    if (h && confirm('Supprimer ?')) { await A.supprimerDoc('palmares', h.dataset.h, ['photo']); charge(); }
    if (r && confirm('Supprimer ?')) { await DB.collection('reussite_stats').doc(r.dataset.r).delete(); charge(); } });
  charge();
});

/* ---------- Abonnés à la lettre d'information ---------- */
A.def('abonnes', 'Abonnés', async el => {
  el.innerHTML = '<h1>Abonnés aux nouvelles du lycée</h1><div id="ab"></div>';
  const charge = async () => { const s = await DB.collection('abonnes').orderBy('createdAt', 'desc').get(); const l = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    $('#ab').innerHTML = l.length ? '<p><button class="btn gris s" id="ab-csv" type="button">Exporter les e-mails (CSV)</button> <a class="btn dark s" href="mailto:?bcc=' + encodeURIComponent(l.map(x => x.email).join(',')) + '">Écrire à tous</a></p><div class="tbl-wrap"><table class="tbl"><tbody>' + l.map(x => '<tr><td>' + esc(x.email) + '</td><td>' + esc(window.fmtDate(x.createdAt)) + '</td><td><button class="btn rouge s" data-x="' + x.id + '">Supprimer</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="vide-app">Aucun abonné.</div>';
    el.onclick = async e => { const x = e.target.closest('[data-x]'); if (x && confirm('Supprimer cet abonné ?')) { await DB.collection('abonnes').doc(x.dataset.x).delete(); charge(); } if (e.target.id === 'ab-csv') L.csv('abonnes.csv', [['E-mail', 'Date']].concat(l.map(o => [o.email, window.fmtDate(o.createdAt)]))); }; };
  charge();
});

/* ---------- Journal d'audit ---------- */
A.def('journal', 'Journal d\'activité', async el => {
  el.innerHTML = '<h1>Journal d\'activité</h1><p class="sous">Les 200 dernières actions sensibles de l\'administration (connexions, suppressions, publications).</p><div id="jr"></div>';
  const s = await DB.collection('journal').orderBy('date', 'desc').limit(200).get();
  $('#jr').innerHTML = s.size ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Détail</th></tr></thead><tbody>' + s.docs.map(d => { const x = d.data(); return '<tr><td>' + esc(L.dateFr(x.date)) + '</td><td>' + esc(x.email || '') + '</td><td>' + esc(x.action || '') + '</td><td>' + esc(x.detail || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="vide-app">Journal vide.</div>';
});

/* ---------- Sauvegarde complète ---------- */
A.def('sauvegarde', 'Sauvegarde', async el => {
  el.innerHTML = '<h1>Sauvegarde des données</h1><div class="carte-app"><p>Télécharge une copie complète de la base (élèves, notes, présence, annonces, contenus du site…) dans un fichier JSON. <b>Ce fichier contient des données personnelles : conservez-le en lieu sûr et ne le partagez pas.</b></p><button class="btn dark" id="sv" type="button">Télécharger la sauvegarde</button><div class="msg" id="sv-m" role="status" style="margin-top:12px"></div></div>';
  $('#sv').onclick = async () => {
    const cols = ['eleves', 'notes', 'absences', 'suivi', 'annonces', 'fichiers', 'examens_fichiers', 'actualites', 'evenements', 'personnel', 'galerie', 'site_images', 'preinscriptions', 'demandes', 'anciens', 'abonnes', 'temoignages', 'palmares', 'reussite_stats', 'emplois_du_temps', 'informations_site', 'liens_whatsapp', 'configuration', 'journal', 'contenu_site', 'liens_anciens', 'anciens_adhesions'];
    const out = { genere: new Date().toISOString(), collections: {} }; const m = $('#sv-m'); $('#sv').disabled = true;
    for (const c of cols) { L.say(m, true, 'Lecture de ' + c + '…'); try { const s = await DB.collection(c).get(); out.collections[c] = s.docs.map(d => ({ id: d.id, data: d.data() })); } catch(e){ out.collections[c] = []; } }
    const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' })); a2.download = 'sauvegarde-bahouan-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a2); a2.click(); a2.remove();
    A.log('Sauvegarde téléchargée'); L.say(m, true, 'Sauvegarde téléchargée.'); $('#sv').disabled = false;
  };
});


/* ---------- Enseignants : demandes, validation, matières et salles (super administrateur) ---------- */
A.def('enseignants', 'Enseignants', async el => {
  const charge = async () => { const sn = await DB.collection('enseignants').get(); const l = []; sn.forEach(d => l.push(Object.assign({ id: d.id }, d.data()))); return l.sort((a, b) => (a.statut === 'attente' ? 0 : 1) - (b.statut === 'attente' ? 0 : 1) || (b.createdAt || 0) - (a.createdAt || 0)); };
  let liste = await charge();
  const badge = st => st === 'valide' ? '<span class="t" style="background:#dff3e4">Validé</span>' : st === 'refuse' ? '<span class="t" style="background:#f7dcdc">Refusé</span>' : '<span class="t" style="background:var(--or-clair)">En attente</span>';
  const noms = ks => (ks || []).map(k => { const m = S.matieres.find(x => x.k === k); return m ? m.l : k; }).join(', ');
  const dessiner = () => {
    el.innerHTML = '<h1>Enseignants</h1><p class="sous">Vérifiez l\'adresse e-mail, les matières et les salles demandées, puis validez. Un enseignant validé ne voit et ne publie que dans ses matières et ses salles.</p>' +
      (liste.length ? liste.map((e, i) => '<div class="carte-app"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between"><div><b>' + esc(e.nom || '') + '</b><br><small>' + esc(e.email || '') + '</small></div>' + badge(e.statut) + '</div>' +
        '<p style="margin:10px 0 2px"><b>Matières :</b> ' + esc(noms(e.matieres) || '-') + '</p><p style="margin:0 0 12px"><b>Salles :</b> ' + esc((e.classes || []).join(', ') || '-') + '</p>' +
        '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:0">' + (e.statut !== 'valide' ? '<button class="btn dark s" data-v="' + i + '" type="button">Valider</button>' : '') + (e.statut === 'attente' ? '<button class="btn gris s" data-r="' + i + '" type="button">Refuser</button>' : '') +
        '<button class="btn gris s" data-c="' + i + '" type="button">Civilité : ' + esc(e.civilite || 'à choisir') + '</button><button class="btn gris s" data-m="' + i + '" type="button">Modifier matières et salles</button>' + (e.statut === 'valide' ? '<button class="btn gris s" data-s="' + i + '" type="button">Suspendre</button>' : '') + '<button class="btn rouge s" data-x="' + i + '" type="button">Supprimer</button></p></div>').join('') : '<div class="vide-app">Aucune demande d\'enseignant pour le moment.</div>');
  };
  const calc = (mats, cls) => { const niv = new Set(cls.map(c => L.niveau(c))), ids = [], nm = [], notes = [];
    mats.forEach(k => { const m = S.matieres.find(x => x.k === k); if (!m) return; niv.forEach(n => ids.push(k + n)); nm.push(m.l); (m.n || []).forEach(x => { if (!notes.includes(x)) notes.push(x); }); });
    return { matieres: mats, classes: cls, matiereIds: ids, matiereNoms: nm, notesNoms: notes }; };
  const maj = async (e, data) => { await DB.collection('enseignants').doc(e.id).update(data); Object.assign(e, data); A.log('Enseignant', (data.statut || 'mis à jour') + ' : ' + (e.email || '')); try { await A.publierProfs(); } catch(x){ console.warn('Noms des professeurs non publiés', x); } if (window.Notif) Notif.envoyer({ uid: e.id }, data.statut === 'valide' ? 'Compte enseignant validé' : data.statut === 'refuse' ? 'Demande refusée' : data.statut === 'attente' ? 'Compte suspendu' : 'Matières et salles mises à jour', data.statut === 'valide' ? 'Votre accès enseignant est actif. Vous pouvez publier vos cours et saisir vos notes.' : '', 'administration.html'); dessiner(); };
  dessiner(); A.publierProfs().catch(x => { console.warn('Noms des professeurs non publiés', x); alert('Les noms des professeurs n\'ont pas pu être publiés pour les bulletins : ' + (x.code || x.message) + '.\nVérifiez que le fichier firestore.rules (version v20) est bien déployé.'); });   /* remet à jour les bulletins avec les enseignants déjà validés */
  el.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-v],[data-r],[data-m],[data-s],[data-x],[data-c]'); if (!b) return;
    const e = liste[+(b.dataset.v ?? b.dataset.r ?? b.dataset.m ?? b.dataset.s ?? b.dataset.x ?? b.dataset.c)];
    try {
      if (b.dataset.c !== undefined) { const civ = e.civilite === 'Mme' ? 'M.' : 'Mme'; await DB.collection('enseignants').doc(e.id).update({ civilite: civ }); e.civilite = civ; try { await A.publierProfs(); } catch(x){} dessiner(); }
      else if (b.dataset.v !== undefined) await maj(e, { statut: 'valide' });
      else if (b.dataset.r !== undefined) await maj(e, { statut: 'refuse' });
      else if (b.dataset.s !== undefined) await maj(e, { statut: 'attente' });
      else if (b.dataset.x !== undefined) { if (confirm('Supprimer la demande de ' + (e.nom || e.email) + ' ? Son compte de connexion reste à supprimer dans Firebase > Authentication.')) { await DB.collection('enseignants').doc(e.id).delete(); liste = liste.filter(x => x !== e); A.log('Enseignant supprimé', e.email || ''); try { await A.publierProfs(); } catch(x){} dessiner(); } }
      else if (b.dataset.m !== undefined) {
        A.dlg('Matières et salles de ' + esc(e.nom || ''), '<fieldset class="choix-multi"><legend>Matières</legend><div>' + S.matieres.map(m => '<label class="case"><input type="checkbox" name="mat" value="' + esc(m.k) + '"' + ((e.matieres || []).includes(m.k) ? ' checked' : '') + '> ' + esc(m.l) + '</label>').join('') + '</div></fieldset><fieldset class="choix-multi"><legend>Salles</legend><div>' + S.classes.map(c => '<label class="case"><input type="checkbox" name="cl" value="' + esc(c) + '"' + ((e.classes || []).includes(c) ? ' checked' : '') + '> ' + esc(c) + '</label>').join('') + '</div></fieldset>',
          async (d, f) => { const mats = [...f.querySelectorAll('[name=mat]:checked')].map(i => i.value), cls = [...f.querySelectorAll('[name=cl]:checked')].map(i => i.value); if (!mats.length || !cls.length) throw new Error('Choisissez au moins une matière et une salle.'); await maj(e, calc(mats, cls)); }, 'Enregistrer');
      }
    } catch(err){ alert('Action refusée : ' + (err.message || err.code) + '\n(Seul un compte « super administrateur » peut valider les enseignants.)'); }
  });
});

/* ---------- Accueil de l'enseignant ---------- */
A.def('moi', 'Mon espace', async el => {
  const e = Session.ens || {};
  el.innerHTML = '<h1>Bonjour ' + esc(e.nom || '') + '</h1><p class="sous">Vous êtes connecté en tant qu\'enseignant. Vous ne voyez et ne publiez que dans vos matières et vos salles.</p>' +
    '<div class="kpis"><div class="kpi"><b style="font-size:1.2rem">' + esc((e.matiereNoms || []).join(', ') || '-') + '</b><span>Mes matières</span></div><div class="kpi"><b style="font-size:1.2rem">' + esc((e.classes || []).join(', ') || '-') + '</b><span>Mes salles</span></div></div>' +
    '<div class="carte-app"><h3>Actions rapides</h3><p style="display:flex;gap:10px;flex-wrap:wrap;margin:0"><a class="btn dark s" href="#presence">📋 Faire l\'appel de mon cours</a><a class="btn dark s" href="#cours">Publier un cours ou un exercice</a><a class="btn dark s" href="#notes">Importer des notes</a><a class="btn dark s" href="#examens">Publier une épreuve</a></p></div>';
});

/* ---------- Démarrage ---------- */
(async function(){
  await Session.ready;
  if (!Session.require('admin')) return;
  const main = $('#main'), nav = $('#nav');
  if (Session.ensAttente && !Session.admin) {
    const refus = Session.ensAttente.statut === 'refuse';
    $('#id').innerHTML = '<b>Demande enseignant</b><small>' + esc(Session.ensAttente.nom || '') + '</small><p style="margin:10px 0 0"><button class="petit-lien" type="button" data-sortir>Se déconnecter</button></p>';
    main.innerHTML = '<h1>' + (refus ? 'Demande non retenue' : 'Demande en attente de validation') + '</h1><div class="carte-app"><p>' + (refus ? 'Le super administrateur n\'a pas validé cette demande. Contactez le secrétariat du lycée.' : 'Votre compte est créé. Le super administrateur doit vérifier votre adresse e-mail, vos matières et vos salles avant de vous donner accès. Revenez plus tard : cette page s\'ouvrira automatiquement une fois la validation faite.') + '</p></div>';
    return;
  }
  const roleLib = { super: 'Super administrateur', admin: 'Administrateur', enseignant: 'Enseignant' }[Session.role] || 'Administration';
  $('#id').innerHTML = '<b>' + roleLib + '</b><small>Lycée de Bahouan</small><p style="margin:10px 0 0"><button class="petit-lien" type="button" data-sortir>Se déconnecter</button></p>';
  const ordre = Session.role === 'enseignant'
    ? [{ groupe: 'Mon travail' }, 'moi', 'cours', 'examens', 'notes', 'presence']
    : [{ groupe: 'Pilotage' }, 'dash'].concat(Session.role === 'super' ? ['enseignants', { groupe: 'Contenu du site (super administrateur)' }, 'contenu', 'textes'] : [], [{ groupe: 'Scolarité' }, 'eleves', 'notes', 'presence', 'emploi', { groupe: 'Communication' }, 'annonces', 'messagerie', 'whatsapp', 'anciens_groupes', { groupe: 'Pédagogie' }, 'cours', 'examens', { groupe: 'Site web' }, 'actualites', 'evenements', 'personnel', 'galerie', 'palmares', 'temoignages', 'images', 'general', { groupe: 'Réception' }, 'preinscriptions', 'demandes', 'abonnes', { groupe: 'Sécurité' }, 'securite', 'journal', 'sauvegarde']);
  const defs = ordre.map(o => typeof o === 'string' ? A.mods[o] : o);
  window.ADM_SHOW = L.tabs(nav, main, defs, Session.role === 'enseignant' ? 'moi' : 'dash');
  /* pastille des messages non lus, visible partout dans le menu */
  if (Session.role !== 'enseignant') try { DB.collection('conversations').onSnapshot(s => { let n = 0; s.forEach(d => { n += d.data().nonLus || 0; }); const b = document.querySelector('[data-b="messagerie"]'); if (b) { b.hidden = !n; b.textContent = n; } }); } catch(e){}
})();
})();
