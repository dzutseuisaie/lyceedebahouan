/* Lycée de Bahouan - administration (partie 3) : contenu modifiable par le super administrateur, anciens élèves.
   Tout ce qui est enregistré ici va dans Firestore (contenu_site, liens_anciens, anciens_adhesions). */
(function(){
const S = window.SITE, esc = window.esc, A = window.ADM;
const $ = (s, r) => (r || document).querySelector(s);
const FV = () => firebase.firestore.FieldValue;
A.estSuper = () => Session.role === 'super';
const reserve = el => { el.innerHTML = '<h1>Réservé</h1><div class="vide-app">Cette section est réservée au super administrateur.</div>'; };

/* Modifier une fiche existante : A.edit(collection, id, titre, champsHtml, (valeurs) => champsÀÉcrire, rafraîchir) */
A.edit = (col, id, titre, champs, versDoc, apres) => A.dlg(titre, champs, async d => {
  const ref = DB.collection(col).doc(id); let avant = {}; try { const s0 = await ref.get(); avant = s0.data() || {}; } catch(e){}
  const data = await versDoc(d); await ref.update(data); A.log(titre, id);
  const vieux = ['image', 'photo', 'url'].filter(k => typeof avant[k] === 'string' && typeof data[k] === 'string' && data[k] && data[k] !== avant[k]).map(k => avant[k]);
  if (vieux.length) A.nettoyerCloud(vieux, col + '/' + id);   /* photo remplacée : l'ancienne quitte Cloudinary */
  if (apres) apres();
}, 'Enregistrer');

/* ---------- Éditeur de lignes (déplacer, supprimer, ajouter) ---------- */
const BTN = '<span style="white-space:nowrap"><button type="button" class="btn gris s" data-up aria-label="Monter">↑</button> <button type="button" class="btn gris s" data-down aria-label="Descendre">↓</button> <button type="button" class="btn rouge s" data-del aria-label="Supprimer la ligne">×</button></span>';
function brancherLignes(box){
  box.addEventListener('click', e => {
    const row = e.target.closest('.lg'); if (!row || !box.contains(row)) return;
    if (e.target.closest('[data-del]')) row.remove();
    else if (e.target.closest('[data-up]') && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
    else if (e.target.closest('[data-down]') && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
  });
}
const lire = (box, champs) => [...box.querySelectorAll('.lg')].map(r => { const o = {}; champs.forEach(k => { o[k] = (r.querySelector('[data-f="' + k + '"]').value || '').trim(); }); return o; });

/* ---------- Direction, censeurs, surveillants et proviseurs successifs (super administrateur) ---------- */
A.def('contenu', 'Direction et proviseurs', async el => {
  if (!A.estSuper()) return reserve(el);
  let dir = JSON.parse(JSON.stringify(S.direction)), prov = JSON.parse(JSON.stringify(S.proviseurs));
  try {
    const [d, p] = await Promise.all([DB.collection('contenu_site').doc('direction').get(), DB.collection('contenu_site').doc('proviseurs').get()]);
    if (d.exists && Array.isArray(d.data().membres)) dir = Object.assign({ annee: '', legendeProviseur: '' }, d.data());
    if (p.exists && Array.isArray(p.data().liste)) prov = p.data().liste;
  } catch(e){}
  const GR = ['Direction', 'Personnel'];
  const rD = m => '<div class="lg" style="display:grid;grid-template-columns:1.2fr 1.4fr 120px auto;gap:6px;margin-bottom:6px"><input data-f="f" value="' + esc(m.f || '') + '" placeholder="Fonction (Censeur…)" aria-label="Fonction"><input data-f="n" value="' + esc(m.n || '') + '" placeholder="Nom" aria-label="Nom"><select data-f="g" aria-label="Groupe">' + L.options(GR, m.g || 'Direction') + '</select>' + BTN + '</div>';
  const rP = m => '<div class="lg" style="display:grid;grid-template-columns:1fr 1.6fr auto;gap:6px;margin-bottom:6px"><input data-f="p" value="' + esc(m.p || '') + '" placeholder="Période (2016-2023)" aria-label="Période"><input data-f="n" value="' + esc(m.n || '') + '" placeholder="Nom du proviseur" aria-label="Nom"><span>' + BTN + '</span></div>';
  el.innerHTML = '<h1>Direction et proviseurs</h1><p class="sous">Noms et fonctions affichés sur la page « Le lycée » (et sur la page Équipe en l\'absence de personnel enregistré). Modifiez, ajoutez, déplacez avec les flèches, puis enregistrez.</p>' +
    '<div class="carte-app"><h3>Équipe de direction</h3><div class="filtres"><label>Année scolaire affichée<input id="c-an" value="' + esc(dir.annee || '') + '" placeholder="2025-2026"></label><label style="flex:1;min-width:240px">Légende sous la photo du proviseur<input id="c-lg" value="' + esc(dir.legendeProviseur || '') + '"></label></div>' +
    '<div id="c-dir">' + dir.membres.map(rD).join('') + '</div><p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn gris s" id="c-dir-add" type="button">+ Ajouter une personne</button><button class="btn dark s" id="c-dir-save" type="button">Enregistrer la direction</button></p><div class="msg" id="c-dir-m" role="status"></div></div>' +
    '<div class="carte-app"><h3>Les proviseurs successifs</h3><div id="c-prov">' + prov.map(rP).join('') + '</div><p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn gris s" id="c-prov-add" type="button">+ Ajouter un proviseur</button><button class="btn dark s" id="c-prov-save" type="button">Enregistrer les proviseurs</button></p><div class="msg" id="c-prov-m" role="status"></div></div>';
  brancherLignes($('#c-dir')); brancherLignes($('#c-prov'));
  $('#c-dir-add').onclick = () => $('#c-dir').insertAdjacentHTML('beforeend', rD({ g: 'Direction' }));
  $('#c-prov-add').onclick = () => $('#c-prov').insertAdjacentHTML('beforeend', rP({}));
  $('#c-dir-save').onclick = async () => {
    const m = $('#c-dir-m'), membres = lire($('#c-dir'), ['f', 'n', 'g']).filter(x => x.f && x.n);
    if (!membres.length) return L.say(m, false, 'Ajoutez au moins une personne.');
    try { await DB.collection('contenu_site').doc('direction').set({ annee: $('#c-an').value.trim(), legendeProviseur: $('#c-lg').value.trim(), membres, maj: Date.now() }); A.log('Direction modifiée', membres.length + ' personnes'); L.say(m, true, 'Enregistré. La page « Le lycée » est à jour.'); }
    catch(err){ L.say(m, false, 'Échec : ' + (err.code === 'permission-denied' ? 'seul le super administrateur peut modifier (vérifiez admins/{uid}.role = super et les règles publiées).' : err.message)); }
  };
  $('#c-prov-save').onclick = async () => {
    const m = $('#c-prov-m'), liste = lire($('#c-prov'), ['p', 'n']).filter(x => x.n);
    try { await DB.collection('contenu_site').doc('proviseurs').set({ liste, maj: Date.now() }); A.log('Proviseurs modifiés', liste.length + ' lignes'); L.say(m, true, 'Enregistré.'); }
    catch(err){ L.say(m, false, 'Échec : ' + (err.code === 'permission-denied' ? 'seul le super administrateur peut modifier.' : err.message)); }
  };
});

/* ---------- Textes de toutes les pages (super administrateur) ---------- */
const PAGES = [["academique", "Académique"], ["actualites", "Actualités"], ["admissions", "Admissions"], ["anciens", "Anciens"], ["calendrier", "Calendrier"], ["club_scientifique", "Club scientifique"], ["contact", "Contact"], ["emploi", "Emploi du temps"], ["equipe", "Équipe pédagogique"], ["espace-familles", "Espace familles"], ["faq", "Questions fréquentes"], ["galerie", "Galerie photos"], ["index", "Accueil"], ["le-lycee", "Le lycée"], ["orientation", "Club d’orientation"], ["politique-confidentialite", "Politique de confidentialité"], ["resultats_examen", "Résultats d’examens"], ["reussite", "Réussite et tableau d’honneur"], ["valeurs", "Nos valeurs"], ["vie-scolaire", "Vie scolaire"], ["visite", "Planifier une visite"]];
const GENRE = { h1: 'Titre de la page', h2: 'Titre de section', h3: 'Sous-titre', h4: 'Sous-titre', p: 'Paragraphe', li: 'Ligne de liste', figcaption: 'Légende', summary: 'Question' };
A.def('textes', 'Textes des pages', async el => {
  if (!A.estSuper()) return reserve(el);
  el.innerHTML = '<h1>Textes des pages</h1><p class="sous">Choisissez une page : tous ses titres, paragraphes et listes deviennent modifiables, sans toucher au code. Mise en forme permise : <code>&lt;em&gt;mot&lt;/em&gt;</code> (italique doré), <code>&lt;b&gt;</code>, <code>&lt;br&gt;</code>. Vider une case rétablit le texte d\'origine.</p>' +
    '<div class="filtres"><label>Page<select id="tx-p">' + PAGES.map(p => '<option value="' + p[0] + '">' + esc(p[1]) + '</option>').join('') + '</select></label><label>Rechercher<input id="tx-q" placeholder="un mot du texte"></label><button class="btn dark s" id="tx-go" type="button">Afficher</button></div><div id="tx-res"></div>';
  let items = [], page = '';
  const dessiner = (over) => {
    $('#tx-res').innerHTML = '<p style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn dark s" id="tx-save" type="button">Enregistrer les modifications</button><a class="btn gris s" href="' + page + '.html" target="_blank" rel="noopener">Voir la page</a><span class="sous" style="margin:0">' + items.length + ' texte(s)</span></p><div class="msg" id="tx-m" role="status"></div>' +
      items.map((x, i) => { const v = typeof over[x.k] === 'string' && over[x.k].trim() ? over[x.k] : x.def;
        return '<div class="carte-app tx" data-i="' + i + '" style="padding:14px 18px"><small style="color:var(--gris)">' + (GENRE[x.tag] || x.tag) + (v !== x.def ? ' · <b style="color:#b3261e">modifié</b>' : '') + '</small><textarea style="width:100%;margin-top:6px" rows="' + Math.max(1, Math.min(8, Math.ceil(v.length / 70))) + '" data-def="' + esc(x.def) + '">' + esc(v) + '</textarea>' + (v !== x.def ? '<p style="margin:6px 0 0"><button type="button" class="petit-lien" data-raz="' + i + '">Rétablir le texte d\'origine</button></p>' : '') + '</div>'; }).join('');
  };
  $('#tx-go').onclick = async () => {
    page = $('#tx-p').value; $('#tx-res').innerHTML = '<p class="sous">Chargement…</p>';
    try {
      const r = await fetch(page + '.html', { cache: 'no-store' }); if (!r.ok) throw new Error('page introuvable');
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      items = [...doc.querySelectorAll('[data-cms]')].map(n => ({ k: n.getAttribute('data-cms'), tag: n.tagName.toLowerCase(), def: CMS.clean(n.innerHTML).trim() }));
      let over = {}; try { const d = await DB.collection('contenu_site').doc(CMS.docId(page)).get(); if (d.exists) over = d.data(); } catch(e){}
      dessiner(over);
    } catch(err){ $('#tx-res').innerHTML = '<div class="vide-app">Impossible de charger cette page (' + esc(err.message) + '). Ouvrez l\'administration depuis le site publié, pas depuis un fichier local.</div>'; }
  };
  $('#tx-q').oninput = () => { const q = $('#tx-q').value.trim().toLowerCase(); document.querySelectorAll('#tx-res .tx').forEach(c => { c.hidden = !!q && c.querySelector('textarea').value.toLowerCase().indexOf(q) < 0; }); };
  el.addEventListener('click', async e => {
    const raz = e.target.closest('[data-raz]');
    if (raz) { const c = raz.closest('.tx'), t = c.querySelector('textarea'); t.value = t.dataset.def; raz.remove(); return; }
    if (e.target.id !== 'tx-save') return;
    const m = $('#tx-m'), upd = {}; let n = 0, cur = {};
    try { const d = await DB.collection('contenu_site').doc(CMS.docId(page)).get(); if (d.exists) cur = d.data(); } catch(err){}
    document.querySelectorAll('#tx-res .tx').forEach(c => {
      const x = items[+c.dataset.i], v = CMS.clean(c.querySelector('textarea').value).trim();
      if (!v || v === x.def) { if (typeof cur[x.k] === 'string') { upd[x.k] = FV().delete(); n++; } }
      else if (v !== cur[x.k]) { upd[x.k] = v.slice(0, 4000); n++; }
    });
    if (!n) return L.say(m, true, 'Aucun changement à enregistrer.');
    try { await DB.collection('contenu_site').doc(CMS.docId(page)).set(upd, { merge: true }); CMS.oublier(); A.log('Textes modifiés', page + ' (' + n + ')'); L.say(m, true, n + ' texte(s) enregistré(s). La page est à jour (visiteurs : jusqu\'à 2 minutes).'); $('#tx-go').click(); }
    catch(err){ L.say(m, false, 'Échec : ' + (err.code === 'permission-denied' ? 'seul le super administrateur peut modifier les textes.' : err.message)); }
  });
});

/* ---------- Anciens élèves : groupes WhatsApp par promotion et adhésions ---------- */
A.def('anciens_groupes', 'Anciens et WhatsApp', async el => {
  const slug = c => String(c || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  el.innerHTML = '<h1>Anciens élèves : groupes WhatsApp</h1><p class="sous">Quand un ancien remplit le formulaire de la page Anciens, une fenêtre « Bienvenue » lui demande sa classe puis sa promotion et l\'invite à rejoindre le groupe que vous enregistrez ici. Un lien par promotion (et par classe si vous le souhaitez).</p>' +
    '<form class="form carte-app" id="ag-f" style="max-width:none"><h3 id="ag-t">Ajouter le groupe d\'une promotion</h3><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));max-width:none"><label>Année de sortie du lycée<input name="promotion" inputmode="numeric" maxlength="4" required placeholder="2018"></label><label>Classe (facultatif)<select name="classe"><option value="">Toutes les classes</option>' + S.classes.map(c => '<option>' + esc(c) + '</option>').join('') + '<option>Autre classe</option></select></label></div>' +
    '<label>Lien d\'invitation du groupe WhatsApp<input name="lien" required placeholder="https://chat.whatsapp.com/…"></label><button class="btn dark" type="submit">Enregistrer le groupe</button><div class="msg" role="status"></div></form><div id="ag-l"></div>' +
    '<h3 style="margin-top:30px">Anciens qui ont rejoint un groupe</h3><div id="ag-a"></div>';
  let liens = [], adh = [];
  const groupes = async () => {
    const s = await DB.collection('liens_anciens').get(); liens = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.promotion).localeCompare(String(a.promotion)) || String(a.classe || '').localeCompare(String(b.classe || '')));
    $('#ag-l').innerHTML = liens.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Promotion</th><th>Classe</th><th>Lien</th><th></th></tr></thead><tbody>' + liens.map((x, i) => '<tr><td><b>' + esc(x.promotion) + '</b></td><td>' + esc(x.classe || 'Toutes') + '</td><td><a href="' + esc(x.lien) + '" target="_blank" rel="noopener noreferrer">Ouvrir le groupe</a></td><td style="white-space:nowrap"><button class="btn gris s" data-m="' + i + '" type="button">Modifier</button> <button class="btn rouge s" data-x="' + i + '" type="button">Supprimer</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="vide-app">Aucun groupe enregistré pour le moment.</div>';
  };
  const adhesions = async () => {
    try { const s = await DB.collection('anciens_adhesions').orderBy('createdAt', 'desc').limit(300).get(); adh = s.docs.map(d => Object.assign({ id: d.id }, d.data())); } catch(e){ adh = []; }
    $('#ag-a').innerHTML = adh.length ? '<p><button class="btn gris s" id="ag-csv" type="button">Exporter en CSV</button></p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Classe</th><th>Promotion</th><th>Groupe rejoint</th><th>Date</th><th></th></tr></thead><tbody>' + adh.map(x => '<tr><td>' + esc(x.nom || '') + '</td><td>' + esc(x.classe || '') + '</td><td>' + esc(x.promotion || '') + '</td><td>' + esc(x.groupe || '') + '</td><td>' + esc(window.fmtDate(x.createdAt)) + '</td><td><button class="btn rouge s" data-ax="' + x.id + '" type="button">Supprimer</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="vide-app">Personne n\'a encore rejoint un groupe.</div>';
  };
  $('#ag-f').onsubmit = async e => {
    e.preventDefault(); const f = e.target, m = f.querySelector('.msg'), promo = f.promotion.value.trim(), lien = f.lien.value.trim();
    if (!/^\d{4}$/.test(promo)) return L.say(m, false, 'L\'année doit comporter 4 chiffres (exemple : 2018).');
    if (lien.indexOf('https://chat.whatsapp.com/') !== 0) return L.say(m, false, 'Le lien doit commencer par https://chat.whatsapp.com/');
    try { await DB.collection('liens_anciens').doc(promo + '_' + (slug(f.classe.value) || 'toutes')).set({ promotion: promo, classe: f.classe.value, lien, maj: Date.now() }); A.log('Groupe des anciens', promo + ' ' + (f.classe.value || 'toutes classes')); f.reset(); $('#ag-t').textContent = 'Ajouter le groupe d\'une promotion'; L.say(m, true, 'Groupe enregistré.'); groupes(); }
    catch(err){ L.say(m, false, 'Échec : ' + err.message); }
  };
  el.addEventListener('click', async e => {
    const mo = e.target.closest('[data-m]'), x = e.target.closest('[data-x]'), ax = e.target.closest('[data-ax]');
    if (mo) { const g = liens[+mo.dataset.m], f = $('#ag-f'); f.promotion.value = g.promotion; f.classe.value = g.classe || ''; f.lien.value = g.lien; $('#ag-t').textContent = 'Modifier le groupe ' + g.promotion; f.scrollIntoView({ behavior: 'smooth' }); }
    if (x && confirm('Supprimer ce groupe ?')) { await DB.collection('liens_anciens').doc(liens[+x.dataset.x].id).delete(); A.log('Groupe des anciens supprimé', liens[+x.dataset.x].promotion); groupes(); }
    if (ax && confirm('Supprimer cette ligne ?')) { await DB.collection('anciens_adhesions').doc(ax.dataset.ax).delete(); adhesions(); }
    if (e.target.id === 'ag-csv') L.csv('anciens-adhesions.csv', [['Nom', 'Classe', 'Promotion', 'Groupe', 'Date']].concat(adh.map(a => [a.nom, a.classe, a.promotion, a.groupe, window.fmtDate(a.createdAt)])));
  });
  groupes(); adhesions();
});
})();
