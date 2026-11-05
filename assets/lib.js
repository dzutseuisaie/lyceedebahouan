/* Lycée de Bahouan - fonctions communes aux espaces connectés */
(function(){
const S = window.SITE, DB = window.DB, esc = window.esc;
const $ = (s, r) => (r || document).querySelector(s);

const L = window.L = {
  $, classes: S.classes,
  niveau: c => /^term/i.test(c || '') ? 2 : 1,
  /* série d'une classe : AE (A Espagnol), AD (A Allemand), C, D ; null si le nom n'est pas reconnu */
  serie: c => { c = String(c || ''); if (/\bA\b.*esp/i.test(c)) return 'AE'; if (/\bA\b.*all/i.test(c)) return 'AD'; const m = c.match(/\b([CD])\s*$/i); return m ? m[1].toUpperCase() : null; },
  /* une matière (ou colonne de notes) concerne-t-elle cette série ? série inconnue → comme C/D */
  dansSerie: (s, serie) => !s || s.includes(serie || 'C'),
  matieresDe: c => S.matieres.filter(m => L.dansSerie(m.s, L.serie(c))),
  notesDe: c => S.notesMatieres.filter(([m]) => L.dansSerie((S.notesSeries || {})[m], L.serie(c))),
  fullName: p => p ? ((p.nom||'') + ' ' + (p.prenom||'')).trim() : '',
  mention(m){
    m = +m; if (m < 5) return 'Très faible'; if (m < 8) return 'Faible'; if (m < 10) return 'Médiocre'; if (m < 12) return 'Passable';
    if (m < 14) return 'Assez bien'; if (m < 16) return 'Bien'; if (m < 18) return 'Très bien'; return m >= 20 ? 'Parfait' : 'Excellent';
  },
  moyenne(map){
    let t = 0, c = 0;
    S.notesMatieres.forEach(([m, c0]) => { const coef = L.coef(map, m, c0), n = parseFloat(map[m]); if (!isNaN(n) && n >= 0 && n <= 20) { t += n * coef; c += coef; } });
    return c ? t / c : null;
  },
  options(list, sel, vide){
    return (vide ? '<option value="">' + esc(vide) + '</option>' : '') + list.map(x => '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
  },
  say(el, ok, t){ if (!el) return; el.className = 'msg ' + (ok ? 'ok' : 'err'); el.textContent = t; },
  alerte(t){ alert(t); },
  csv(nom, lignes){
    const txt = '\ufeff' + lignes.map(l => l.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type:'text/csv;charset=utf-8'}));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  },
  dateFr(iso){ try { return new Date(iso).toLocaleString(window.LOCALE||'fr-FR', {day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'}); } catch(e){ return ''; } },

  /* ----- Onglets (menu latéral + contenus chargés à la demande) ----- */
  tabs(nav, main, defs, depart){
    const rendu = {};
    const side = nav.parentElement; let tg = side.querySelector('.side-toggle');
    if (!tg) { tg = document.createElement('button'); tg.type = 'button'; tg.className = 'side-toggle'; tg.innerHTML = '<span>Menu</span><b></b>'; side.insertBefore(tg, nav); tg.onclick = () => side.classList.toggle('ouvert'); }
    const show = async (k, empiler) => {
      const d = defs.find(x => x.k === k) || defs[0];
      nav.querySelectorAll('[data-k]').forEach(b => b.removeAttribute('aria-current'));
      const b = nav.querySelector('[data-k="' + d.k + '"]'); if (b) b.setAttribute('aria-current', 'page');
      tg.querySelector('b').textContent = d.t; side.classList.remove('ouvert');
      main.innerHTML = '<p class="sous">Chargement…</p>';
      try { await d.render(main); } catch(e){ console.error(e); main.innerHTML = '<div class="vide-app">Cette section n\'a pas pu se charger. Vérifiez votre connexion puis réessayez.</div>'; }
      if (location.hash !== '#' + d.k) history[empiler ? 'pushState' : 'replaceState'](null, '', '#' + d.k);   /* « Retour » ramène à l'onglet précédent */
      if (empiler || !location.hash) window.scrollTo({top: 0, behavior: 'instant'});
    };
    nav.innerHTML = defs.map(d => d.groupe ? '<div class="grp">' + esc(d.groupe) + '</div>' : '<button type="button" data-k="' + d.k + '">' + esc(d.t) + '<span class="badge" data-b="' + d.k + '" hidden></span></button>').join('');
    nav.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) show(b.dataset.k, true); });
    window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (defs.some(d => d.k === k)) show(k); });
    const k0 = location.hash.slice(1);
    show(defs.some(d => d.k === k0) ? k0 : depart);
    return show;
  },

  /* ----- Annonces de l'administration (collection annonces) ----- */
  async annonces(max, publicOnly){
    let q = DB.collection('annonces');
    q = publicOnly ? q.where('public', '==', true) : q.orderBy('date', 'desc').limit(max || 20);
    const snap = await q.get();
    const l = []; snap.forEach(d => { const x = d.data(); if (x.texte) l.push(Object.assign({ id: d.id }, x)); });
    l.sort((p, q2) => String(q2.date || '').localeCompare(String(p.date || '')));
    return l.slice(0, max || 20);
  },
  annoncesHtml(l){
    return l.length ? l.map(a => '<div class="annonce ' + esc(a.type || '') + '"><small>' + esc(L.dateFr(a.date)) + '</small><b>' + esc(a.type || 'Message') + '</b><div>' + esc(a.texte).replace(/\n/g, '<br>') + '</div></div>').join('')
      : '<div class="vide-app">Aucune annonce pour le moment.</div>';
  },

  /* ----- Suivi (notes et présence) : document suivi/{code}, lisible uniquement par qui connaît le code ----- */
  async suivi(code){
    if (!code) return null;
    try { const d = await DB.collection('suivi').doc(code).get(); return d.exists ? d.data() : null; } catch(e){ console.warn('Lecture du suivi refusée', e); L.derniereErreurSuivi = e; return null; }
  },
  annees(s){ return Object.keys((s && s.annees) || {}).map(k => L.anneeAff(k)).sort().reverse(); },
  anneeSuivi(s, annee){ const A = (s && s.annees) || {}; return A[L.anneeKey(annee)] || A[annee] || {}; },
  suiviNotes(s, annee){ const a = L.anneeSuivi(s, annee), n = Object.assign({}, a.notes || {}); Object.defineProperty(n, '__coefs', { value: a.coefs || null, enumerable: false }); return n; },   /* les coefficients publiés par l'administration accompagnent les notes */
  coef(map, m, def){ const v = map && map.__coefs ? parseFloat(map.__coefs[m]) : NaN; return isNaN(v) ? def : v; },
  profCourt(e){   /* « M. DJOFACK » ou « Mme TUEBOU » : civilité + un seul nom, pour garder le bulletin net */
    const p = String((e && e.nom) || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); let civ = (e && e.civilite) || '';
    const m = p[0] && p[0].match(/^(monsieur|madame|mademoiselle|mme|mlle|mr|m)\.?$/i); if (m) { if (!civ) civ = /^(madame|mademoiselle|mme|mlle)$/i.test(m[1]) ? 'Mme' : 'M.'; p.shift(); }
    const nom = p.find(x => x.length > 1 && x === x.toUpperCase() && /[A-ZÀ-Ý]/.test(x)) || p[0] || '';
    return ((civ === 'Mme' || civ === 'M.' ? civ + ' ' : '') + nom.toUpperCase()).trim();
  },
  suiviSeqs(s, annee){ return L.anneeSuivi(s, annee).seqs || {}; },   /* notes par séquence : { matière: [S1..S6] } */
  moySeq(map, seqs, idx){ let t = 0, c = 0; S.notesMatieres.forEach(([m, c0]) => { const coef = L.coef(map, m, c0); idx.forEach(i => { const n = parseFloat(((seqs || {})[m] || [])[i]); if (!isNaN(n) && n >= 0 && n <= 20) { t += n * coef; c += coef; } }); }); return c ? t / c : null; },
  suiviAbs(s, annee){ return (L.anneeSuivi(s, annee).absences || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')); },
  /* relevé imprimable (aperçu dans une nouvelle fenêtre) */
  releve(nom, classe, annee, map){
    const moy = L.moyenne(map), w = window.open('', '_blank'); if (!w) return alert('Autorisez les fenêtres pour imprimer.');
    const lignes = S.notesMatieres.filter(([m]) => map[m] !== undefined).map(([m, c]) => '<tr><td>' + esc(m) + '</td><td>' + L.coef(map, m, c) + '</td><td>' + esc(map[m]) + '</td></tr>').join('');
    w.document.write('<!doctype html><meta charset="utf-8"><title>Relevé de notes</title><style>body{font:16px Georgia,serif;margin:40px;color:#111}h1{margin:0}table{border-collapse:collapse;width:100%;margin-top:20px}td,th{border:1px solid #999;padding:8px;text-align:left}th{background:#eee}.r{margin-top:20px;font-size:1.2rem}</style><h1>Lycée de Bahouan</h1><p>Relevé de notes · année ' + esc(annee) + '</p><p><b>' + esc(nom) + '</b> · ' + esc(classe) + '</p><table><tr><th>Matière</th><th>Coef.</th><th>Note /20</th></tr>' + lignes + '</table><p class="r">Moyenne pondérée : <b>' + (moy == null ? '-' : moy.toFixed(2)) + '</b> · Mention : <b>' + (moy == null ? '-' : L.mention(moy)) + '</b></p><p style="margin-top:50px;color:#555">Document généré le ' + new Date().toLocaleDateString('fr-FR') + ' - sans valeur officielle sans cachet de l\'administration.</p>');
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  },
  notesHtml(map){
    const lignes = S.notesMatieres.filter(([m]) => map[m] !== undefined);
    if (!lignes.length) return '<div class="vide-app">Aucune note enregistrée pour le moment.</div>';
    const moy = L.moyenne(map);
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Matière</th><th>Coef.</th><th>Note /20</th></tr></thead><tbody>' +
      lignes.map(([m, c]) => '<tr><td>' + esc(m) + '</td><td>' + L.coef(map, m, c) + '</td><td><b>' + esc(map[m]) + '</b></td></tr>').join('') +
      '</tbody></table></div><div class="kpis" style="margin-top:18px"><div class="kpi"><b>' + (moy == null ? '-' : moy.toFixed(2)) + '</b><span>Moyenne pondérée</span></div><div class="kpi"><b style="font-size:1.5rem">' + (moy == null ? '-' : L.mention(moy)) + '</b><span>Mention</span></div></div>';
  },

  /* ----- Présence ----- */
  absencesHtml(l){
    if (!l.length) return '<div class="vide-app">Aucune présence ni absence enregistrée.</div>';
    const abs = l.filter(x => /absent/i.test(x.statut)).length, SE = S.seuilsAbsences || { avertissement: 10, exclusion: 30 };
    const alerte = abs >= SE.exclusion ? '<div class="annonce"><b>Exclusion définitive</b> : le seuil de ' + SE.exclusion + ' absences est atteint.</div>' : abs >= SE.avertissement ? '<div class="annonce"><b>Avertissement</b> : le seuil de ' + SE.avertissement + ' absences est atteint. À ' + SE.exclusion + ' absences, l\'exclusion est définitive.</div>' : '';
    return alerte + '<div class="kpis"><div class="kpi"><b>' + (l.length - abs) + '</b><span>Présences</span></div><div class="kpi"><b>' + abs + '</b><span>Absences</span></div><div class="kpi"><b>' + l.filter(x => x.sanction && x.sanction !== 'Aucune').length + '</b><span>Sanctions</span></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Cours</th><th>Statut</th><th>Sanction</th></tr></thead><tbody>' +
      l.map(x => '<tr><td>' + esc(x.date || '') + '</td><td>' + (x.matiere ? esc(x.matiere) + (x.debut ? '<br><small>' + esc(x.debut) + ' – ' + esc(x.fin || '') + (x.prof ? ' · ' + esc(x.prof) : '') + '</small>' : '') : esc(x.heure || '')) + '</td><td>' + esc(x.statut || '') + '</td><td>' + esc(x.sanction || '') + '</td></tr>').join('') + '</tbody></table></div>';
  },


  /* ----- Fenêtre (modale) qui s'intègre à l'historique : « Retour » la ferme et laisse la page exactement où elle était ----- */
  fenetre(titre, html, onClose){
    const m = document.createElement('div'); m.className = 'modal open mat-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="in mat-in"><div class="mat-tete"><h2>' + titre + '</h2><button class="x" type="button" aria-label="Fermer">×</button></div><div class="mat-corps">' + html + '</div></div>';
    document.body.appendChild(m); document.body.classList.add('modal-ouverte');
    const hauteur = window.scrollY; let ferme = false;
    const fin = () => { if (ferme) return; ferme = true; window.removeEventListener('popstate', surRetour); m.remove(); document.body.classList.remove('modal-ouverte'); window.scrollTo({ top: hauteur, behavior: 'instant' }); if (onClose) onClose(); };
    const surRetour = () => fin();
    history.pushState({ fenetre: true }, '');
    window.addEventListener('popstate', surRetour);
    const fermer = () => { if (history.state && history.state.fenetre) history.back(); else fin(); };
    m.querySelector('.x').onclick = fermer; m.addEventListener('click', e => { if (e.target === m) fermer(); });
    document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape') { document.removeEventListener('keydown', esc); if (!ferme) fermer(); } });
    return { el: m, fermer };
  },

  /* ----- Cours et épreuves : cartes avec aperçu de l'image, description et bouton Télécharger ----- */
  estImage: u => /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(u || '') || /\/image\/upload\//.test(u || ''),
  nomFichier(f){
    const u = String(f.url || f.fichier || ''), ext = (u.split('?')[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1] || '';
    const base = (f.name || f.original_filename || 'fichier').replace(/[\\/:*?"<>|]+/g, '-').trim();
    return ext && !new RegExp('\\.' + ext + '$', 'i').test(base) ? base + '.' + ext : base;
  },
  async telecharger(f, bouton){
    const url = f.url || f.fichier; if (!url) return;
    const txt = bouton ? bouton.textContent : ''; if (bouton) { bouton.disabled = true; bouton.textContent = 'Téléchargement…'; }
    try {
      const r = await fetch(url); if (!r.ok) throw new Error('http');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = L.nomFichier(f);
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch(e){ window.open(url, '_blank', 'noopener'); }   /* si le navigateur refuse, on ouvre le fichier : l'élève peut l'enregistrer */
    if (bouton) { bouton.disabled = false; bouton.textContent = txt; }
  },
  fichiersCartes(l){
    if (!l.length) return '<div class="vide-app">Rien n\'a encore été publié pour cette matière dans votre salle.</div>';
    const seq = f => /^s/i.test(f.sequence || '') ? f.sequence : (f.sequence ? 'Séquence ' + f.sequence : '');
    return '<div class="mfich-liste">' + l.map((f, i) => {
      const u = f.url || f.fichier || '', img = L.estImage(u);
      return '<article class="mfich" data-i="' + i + '">' + (img ? '<a class="mfich-img" href="' + esc(u) + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" alt="' + esc(f.name || 'Aperçu') + '" src="' + esc(window.cld ? window.cld(u, 640) : u) + '"></a>' : '<div class="mfich-doc" aria-hidden="true">PDF</div>') +
        '<div class="mfich-txt"><span class="t">' + esc(f.type || 'Fichier') + '</span><h4>' + esc(f.name || f.original_filename || 'Fichier') + '</h4>' +
        '<small>' + esc([f.classe, f.annee ? 'Année ' + f.annee : '', seq(f)].filter(Boolean).join(' · ')) + '</small>' +
        (f.description ? '<p>' + esc(f.description).replace(/\n/g, '<br>') + '</p>' : '') +
        '<div class="mfich-act"><button class="btn dark s" type="button" data-tel="' + i + '">Télécharger</button><a class="btn gris s" href="' + esc(u) + '" target="_blank" rel="noopener">Ouvrir</a></div></div></article>';
    }).join('') + '</div>';
  },
  async ouvrirMatiere(m, niveau, classe){
    const fen = L.fenetre(esc(m.l) + '<small>' + esc(classe) + '</small>', '<p class="sous">Chargement…</p>');
    const corps = fen.el.querySelector('.mat-corps');
    let l = []; try { l = await L.fichiers(L.matiereId(m.k, niveau), classe); } catch(e){ corps.innerHTML = '<div class="vide-app">Impossible de charger cette matière pour le moment. Vérifiez votre connexion.</div>'; return; }
    const types = [...new Set(l.map(f => f.type || 'Fichier'))];
    const dessiner = t => { const sel = t ? l.filter(f => (f.type || 'Fichier') === t) : l;
      corps.innerHTML = (types.length > 1 ? '<div class="mat-filtres">' + ['Tout'].concat(types).map(x => '<button type="button" class="chip' + ((x === 'Tout' && !t) || x === t ? ' on' : '') + '" data-t="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' : '') + L.fichiersCartes(sel);
      corps._sel = sel; };
    dessiner('');
    corps.addEventListener('click', e => {
      const c = e.target.closest('[data-t]'); if (c) return dessiner(c.dataset.t === 'Tout' ? '' : c.dataset.t);
      const d = e.target.closest('[data-tel]'); if (d) L.telecharger(corps._sel[+d.dataset.tel], d);
    });
  },

  /* ----- Fichiers de cours (collection fichiers, même format que l'ancien portail) ----- */
  matiereId: (k, niveau) => k + niveau,
  async fichiers(matiereId, classe){
    let q = DB.collection('fichiers').where('matiere', '==', matiereId);
    if (classe) q = q.where('classe', '==', classe);
    const snap = await q.get(); const l = [];
    snap.forEach(d => l.push(Object.assign({ id: d.id }, d.data())));
    return l.sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
  },
  fichiersHtml(l, avecSuppr){
    if (!l.length) return '<div class="vide-app">Aucun fichier pour le moment.</div>';
    const g = {}; l.forEach(f => { const k = 'Classe ' + f.classe + ' · Année ' + f.annee + ' · ' + (/^s/i.test(f.sequence || '') ? f.sequence : 'Séquence ' + f.sequence); (g[k] = g[k] || []).push(f); });
    return Object.keys(g).map(k => '<div class="seq"><h4>' + esc(k) + '</h4>' + g[k].map(f =>
      '<div class="fich">' + (window.apercuHtml ? window.apercuHtml(f.url || f.fichier, f.name) : '') + '<span class="t">' + esc(f.type || 'Fichier') + '</span><a href="' + esc(f.url || f.fichier || '#') + '" target="_blank" rel="noopener">' + esc(f.original_filename || f.name || 'Fichier') + '</a>' +
      (avecSuppr ? '<button class="btn s rouge" style="margin-left:auto" data-supprfich="' + f.id + '">Supprimer</button>' : '') + '</div>').join('') + '</div>').join('');
  },

  /* ----- Emploi du temps ----- */
  async emploi(classe){
    const d = await DB.collection('emplois_du_temps').doc(classe).get();
    return d.exists ? (d.data().cases || {}) : {};
  },
  emploiHtml(cases, editable){
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    return '<div class="tbl-wrap"><table class="edt"><thead><tr><th>Période</th><th>Horaire</th>' + jours.map(j => '<th>' + j + '</th>').join('') + '</tr></thead><tbody>' +
      S.periodes.map(([p, h]) => /^\d$/.test(p)
        ? '<tr><td><b>' + p + '</b></td><td>' + h + '</td>' + jours.map(j => '<td' + (editable ? ' contenteditable="true"' : '') + ' data-c="' + j + '|' + p + '">' + esc(cases[j + '|' + p] || '') + '</td>').join('') + '</tr>'
        : '<tr class="pause"><td colspan="2">' + p + '</td><td colspan="5">' + h + '</td></tr>').join('') + '</tbody></table></div>';
  },

  /* ----- WhatsApp de la classe ----- */
  async whatsapp(classe){
    try { const d = await DB.collection('liens_whatsapp').doc(classe).get(); const l = d.exists ? d.data().lien : ''; return l && l.indexOf('https://chat.whatsapp.com/') === 0 ? l : ''; } catch(e){ return ''; }
  },

  /* ----- Élèves (liste filtrée) ----- */
  async eleves(classe, annee){
    let q = DB.collection('eleves'); if (classe) q = q.where('classe', '==', classe); if (annee) q = q.where('annee', '==', annee);
    const snap = await q.get(); const l = [];
    snap.forEach(d => l.push(Object.assign({ id: d.id }, d.data())));
    return l.sort((a, b) => L.fullName(a).localeCompare(L.fullName(b), 'fr'));
  },

  /* ----- Messagerie avec l'administration : conversations/{code}/echanges ----- */
  chat(box, ident){
    box.innerHTML = '<div class="chat"><div class="fil" id="fil"></div><form id="chat-f"><textarea id="chat-t" maxlength="1000" placeholder="Écrire un message à l\'administration" required></textarea><button class="btn dark s" type="submit">Envoyer</button></form></div>';
    const fil = $('#fil', box), f = $('#chat-f', box), t = $('#chat-t', box);
    const ref = DB.collection('conversations').doc(ident.code);
    const stop = ref.collection('echanges').orderBy('timestamp').onSnapshot(snap => {
      fil.innerHTML = '';
      snap.forEach(d => {
        const x = d.data(), adm = x.de === 'admin';
        const b = document.createElement('div'); b.className = 'bulle ' + (adm ? 'autre' : 'moi'); b.textContent = x.text || '';
        const s = document.createElement('small'); s.textContent = (adm ? 'Administration · ' : (x.de === 'parent' && ident.de !== 'parent' ? 'Parent · ' : '')) + (x.timestamp && x.timestamp.toDate ? x.timestamp.toDate().toLocaleString('fr-FR') : '');
        b.appendChild(s); fil.appendChild(b);
      });
      if (!fil.children.length) fil.innerHTML = '<div class="vide-app" style="margin:auto;border:0;background:none">Aucun message. Écrivez le premier.</div>';
      fil.scrollTop = fil.scrollHeight;
    }, () => { fil.innerHTML = '<div class="vide-app">Messagerie indisponible pour le moment.</div>'; });
    f.addEventListener('submit', async e => {
      e.preventDefault(); const txt = t.value.trim(); if (!txt) return;
      if (Date.now() - (L._dernierMsg || 0) < 1500) return; L._dernierMsg = Date.now();
      t.value = '';
      try {
        /* un seul envoi atomique : conversation + message (jamais l'un sans l'autre) */
        const nom = String(ident.nom || 'Sans nom').slice(0, 120), lot = DB.batch();
        lot.set(ref, { nom, classe: String(ident.classe || '').slice(0, 30), dernier: Date.now(), nonLus: firebase.firestore.FieldValue.increment(1) }, { merge: true });
        lot.set(ref.collection('echanges').doc(), { de: ident.de || 'eleve', nom, text: txt.slice(0, 1000), lu: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await lot.commit();
        if (window.Notif && ident.de !== 'admin') Notif.envoyer({ staff: 'admin' }, 'Nouveau message', nom + ' : ' + txt.slice(0, 100), 'administration.html');
      } catch(err){
        console.warn('Messagerie', err);
        alert(err && err.code === 'permission-denied'
          ? "Message refusé par la base de données. L'administrateur doit republier le fichier firestore.rules (Firebase > Firestore > Règles > Publier)."
          : "Le message n'a pas pu être envoyé (" + ((err && (err.code || err.message)) || 'erreur') + "). Vérifiez votre connexion et réessayez.");
        t.value = txt;
      }
    });
    t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    return stop;
  },

  /* ----- Calculatrice scientifique simple ----- */
  calculatrice(box){
    const keys = [['(','op'],[')','op'],['C','op'],['⌫','op'],['÷','op'],['sin(','op'],['7'],['8'],['9'],['×','op'],['cos(','op'],['4'],['5'],['6'],['−','op'],['tan(','op'],['1'],['2'],['3'],['+','op'],['√(','op'],['0'],['.'],['^','op'],['=','eq'],['π','op'],['ln(','op'],['log(','op'],['e','op'],['Rép','op']];
    box.innerHTML = '<div class="calc"><output id="ca">0</output><div>' + keys.map(k => '<button type="button" class="' + (k[1] || '') + '">' + k[0] + '</button>').join('') + '</div></div>';
    const out = $('#ca', box); let ex = '', last = '';
    const calc = () => {
      let e = ex.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-').replace(/\^/g, '**').replace(/π/g, 'Math.PI').replace(/√\(/g, 'Math.sqrt(')
        .replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(').replace(/ln\(/g, 'Math.log(').replace(/log\(/g, 'Math.log10(').replace(/(?<![A-Za-z.])e(?![A-Za-z(])/g, 'Math.E');
      if (!/^[0-9+\-*/().,\sMathPIEqrtsinco loglnE]*$/.test(e)) throw new Error('x');
      const v = Function('"use strict";return (' + e + ')')(); if (!isFinite(v)) throw new Error('x'); return v;
    };
    box.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return; const k = b.textContent;
      if (k === 'C') ex = ''; else if (k === '⌫') ex = ex.slice(0, -1); else if (k === 'Rép') ex += last;
      else if (k === '=') { try { const v = calc(); last = String(+v.toFixed(10)); ex = last; } catch(e){ ex = ''; out.textContent = 'Erreur'; return; } }
      else ex += k;
      out.textContent = ex || '0';
    });
  }
};
})();


/* ============================================================
   ANNÉE ACADÉMIQUE (2025/2026) : liste à choisir OU saisie libre
   ============================================================ */
(function(){
const L = window.L, esc = window.esc;
L.classementId = (c, a) => String(a || '').replace(/\//g, '-') + '_' + String(c || '').replace(/[^A-Za-z0-9]/g, '');
L.profId = c => String(c || '').replace(/[^A-Za-z0-9]/g, '');
/* noms des professeurs par matière pour une classe (publiés par l'administration) : { 'Mathématiques': 'M. DJOFACK', … } */
L.profsClasse = async c => { try { const d = await DB.collection('profs_classes').doc(L.profId(c)).get(); return d.exists ? (d.data().profs || {}) : {}; } catch(e){ console.warn('Noms des professeurs illisibles (règles Firestore non déployées ?)', e); return {}; } };
L.classement = async (c, a) => { try { const d = await DB.collection('classements').doc(L.classementId(c, a)).get(); return d.exists ? d.data() : null; } catch(e){ return null; } };
L.anneeKey = a => String(a || '').replace(/\//g, '-');                       /* clé sûre pour Firestore (pas de « / » dans un chemin de champ) */
L.anneeAff = k => /^\d{4}-\d{4}$/.test(k) ? k.replace('-', '/') : k;
L.anneeCourante = () => { const d = new Date(), y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return y + '/' + (y + 1); };
L.anneesListe = (avant, apres) => { const y0 = +L.anneeCourante().slice(0, 4), r = []; for (let y = y0 + (apres == null ? 3 : apres); y >= y0 - (avant == null ? 5 : avant); y--) r.push(y + '/' + (y + 1)); return r; };
/* accepte 2025, 2025/26, 2025-2026, 2025/2026 → 2025/2026 ; renvoie '' si invalide */
L.anneeNorm = v => {
  v = String(v || '').trim(); let m = v.match(/^(\d{4})$/); if (m) return m[1] + '/' + (+m[1] + 1);
  m = v.match(/^(\d{4})\s*[\/\-–]\s*(\d{2}|\d{4})$/); if (!m) return '';
  const a = +m[1], b = m[2].length === 2 ? +(String(a).slice(0, 2) + m[2]) : +m[2];
  return b === a + 1 ? a + '/' + b : '';
};
L.anneeOk = a => /^\d{4}\/\d{4}$/.test(a || '') && L.anneeNorm(a) === a;
L.MSG_ANNEE = "Choisissez ou saisissez l'année académique (exemple : 2025/2026).";

/* champ complet : <select> des années + option « Saisir moi-même » ; la valeur est dans un <input type=hidden name=… id=…> */
L.anneeField = (o) => {
  o = o || {}; const v = o.value || '', liste = L.anneesListe(), enListe = liste.includes(v), saisie = !!v && !enListe;
  return '<span class="annee" data-annee><select class="annee-sel" aria-label="Année académique"' + (saisie ? ' hidden' : '') + '>' +
    (o.vide === false ? '' : '<option value="">' + esc(o.vide || 'Choisir…') + '</option>') +
    liste.map(a => '<option' + (a === v ? ' selected' : '') + '>' + a + '</option>').join('') + '<option value="__autre">✎ Saisir moi-même…</option></select>' +
    '<span class="annee-ligne"' + (saisie ? '' : ' hidden') + '><input class="annee-txt" inputmode="numeric" maxlength="9" placeholder="2025/2026" aria-label="Année académique" value="' + esc(saisie ? v : '') + '"><button class="annee-back" type="button">↩ Liste</button></span>' +
    '<input type="hidden"' + (o.name ? ' name="' + o.name + '"' : '') + (o.id ? ' id="' + o.id + '"' : '') + ' value="' + esc(v) + '"></span>';
};
const hid = w => w.querySelector('input[type=hidden]');
const prevenir = w => hid(w).dispatchEvent(new Event('change', { bubbles: true }));
document.addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('.annee-sel'); if (!s) return; const w = s.closest('[data-annee]');
  if (s.value === '__autre') { s.hidden = true; w.querySelector('.annee-ligne').hidden = false; const t = w.querySelector('.annee-txt'); t.value = ''; hid(w).value = ''; t.focus(); }
  else hid(w).value = s.value;
  prevenir(w);
});
document.addEventListener('input', e => { const t = e.target.closest && e.target.closest('.annee-txt'); if (t) hid(t.closest('[data-annee]')).value = L.anneeNorm(t.value); });
document.addEventListener('focusout', e => { const t = e.target.closest && e.target.closest('.annee-txt'); if (!t) return; const n = L.anneeNorm(t.value); if (n) { t.value = n; hid(t.closest('[data-annee]')).value = n; prevenir(t.closest('[data-annee]')); } });
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.annee-back'); if (!b) return; const w = b.closest('[data-annee]'), s = w.querySelector('.annee-sel');
  w.querySelector('.annee-ligne').hidden = true; s.hidden = false; s.selectedIndex = 0; hid(w).value = s.value; prevenir(w);
});
})();

/* ============================================================
   OCR : caméra → lecture du texte → rapprochement avec les élèves
   (Tesseract.js, chargé seulement quand on clique sur « importer »)
   ============================================================ */
(function(){
const L = window.L, esc = window.esc;
const OCR = L.ocr = {};
let worker = null, chargement = null;

OCR.charger = () => chargement || (chargement = new Promise((ok, ko) => {
  if (window.Tesseract) return ok();
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  s.onload = ok; s.onerror = () => { chargement = null; ko(new Error("Le module de lecture n'a pas pu se charger. Vérifiez la connexion Internet.")); }; document.head.appendChild(s);
}));
OCR.lire = async (canvas, prog) => {
  await OCR.charger();
  if (!worker) worker = await Tesseract.createWorker('fra', 1, { logger: m => { if (prog && m.status === 'recognizing text') prog(m.progress); } });
  try { await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); } catch(e){}
  const r = await worker.recognize(canvas); return r.data.text || '';
};
OCR.fin = () => { if (worker) { try { worker.terminate(); } catch(e){} worker = null; } };

/* lecture avec position des mots (pour les tableaux : emploi du temps) */
OCR.lireMots = async (canvas, prog) => {
  await OCR.charger();
  if (!worker) worker = await Tesseract.createWorker('fra', 1, { logger: m => { if (prog && m.status === 'recognizing text') prog(m.progress); } });
  try { await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' }); } catch(e){}
  const r = await worker.recognize(canvas, {}, { text: true, blocks: true }), d = r.data || {};
  let mots = d.words;
  if (!mots || !mots.length) { mots = []; (d.blocks || []).forEach(b => (b.paragraphs || []).forEach(pa => (pa.lines || []).forEach(l => (l.words || []).forEach(w => mots.push(w))))); }
  return { w: canvas.width, h: canvas.height, mots: (mots || []).filter(w => w && w.bbox).map(w => ({ t: String(w.text || '').trim(), c: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })).filter(w => w.t) };
};

/* image → canvas réduit, niveaux de gris, contraste étiré (aide beaucoup la lecture d'une photo de fiche) */
OCR.preparer = (src, w0, h0) => {
  const m0 = Math.max(w0, h0), k = m0 < 1500 ? 1800 / m0 : Math.min(1, 2200 / m0), c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data, h = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = g; h[g]++; }
  const tot = c.width * c.height; let lo = 0, hi = 255, s = 0;
  for (; lo < 255; lo++) { s += h[lo]; if (s > tot * .02) break; } s = 0; for (; hi > 0; hi--) { s += h[hi]; if (s > tot * .25) break; }
  hi = Math.max(hi, lo + 40);
  for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, (d[i] - lo) * 255 / (hi - lo))); d[i] = d[i + 1] = d[i + 2] = g; }
  x.putImageData(im, 0, 0); return c;
};

/* fenêtre caméra : une ou plusieurs photos ; renvoie tout le texte lu (ou null si annulé) */
OCR.scanner = (titre, aide, opts) => new Promise(res => {
  const m = document.createElement('div'); m.className = 'modal open';
  m.innerHTML = '<div class="in" style="max-width:720px"><button class="x" type="button" aria-label="Fermer">×</button><h2>' + esc(titre) + '</h2><p class="sous" style="margin-top:0">' + esc(aide || 'Posez la fiche à plat, bien éclairée, et cadrez toutes les lignes.') + '</p>' +
    '<video playsinline muted autoplay style="width:100%;max-height:58vh;background:#000;display:block"></video><div class="msg" role="status" id="oc-msg"></div>' +
    '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0"><button class="btn dark" id="oc-cap" type="button">📷 Capturer la fiche</button><label class="btn gris" style="cursor:pointer;margin:0">🖼 Choisir une image de la galerie<input id="oc-file" type="file" accept="image/*" hidden></label><label class="btn gris" id="oc-camlab" hidden style="cursor:pointer;margin:0">📷 Prendre une nouvelle photo<input id="oc-cam" type="file" accept="image/*" capture="environment" hidden></label><button class="btn" id="oc-fin" type="button" hidden>Terminer et vérifier</button></p></div>';
  document.body.appendChild(m); document.body.classList.add('modal-ouverte');
  const v = m.querySelector('video'), msg = m.querySelector('#oc-msg'), cap = m.querySelector('#oc-cap'), fin = m.querySelector('#oc-fin'), fi = m.querySelector('#oc-file'), fc = m.querySelector('#oc-cam');
  let flux = null, texte = '', pages = 0, occupe = false; const lots = [];
  const arreter = () => { if (flux) flux.getTracks().forEach(t => t.stop()); };
  const fermer = r => { arreter(); m.remove(); document.body.classList.remove('modal-ouverte'); res(r); };
  m.querySelector('.x').onclick = () => fermer(null);
  fin.onclick = () => fermer(opts && opts.mots ? lots : texte);
  const traiter = async (src, w, h) => {
    if (occupe) return; occupe = true; cap.disabled = true; L.say(msg, true, 'Lecture de la fiche… (la première fois, le chargement peut durer un peu)');
    try { const cv = OCR.preparer(src, w, h), pr = p => L.say(msg, true, 'Lecture de la fiche… ' + Math.round(p * 100) + ' %');
      if (opts && opts.mots) lots.push(await OCR.lireMots(cv, pr)); else { const t = await OCR.lire(cv, pr); texte += (texte ? '\n' : '') + t; } pages++;
      L.say(msg, true, 'Page ' + pages + ' lue. Capturez une autre page, ou terminez.'); fin.hidden = false; }
    catch(e){ L.say(msg, false, e.message || 'Lecture impossible.'); }
    occupe = false; cap.disabled = false;
  };
  cap.onclick = () => { if (!v.videoWidth) return L.say(msg, false, "La caméra n'est pas prête : utilisez « Choisir une image de la galerie »."); traiter(v, v.videoWidth, v.videoHeight); };
  /* « Capturer la fiche » (caméra intégrée) et « Choisir une image de la galerie » ne laissent AUCUN fichier dans le téléphone : l'image est seulement lue en mémoire : elle n'est ni copiée ni enregistrée dans le téléphone (seul « Prendre une nouvelle photo » en crée une, par l'appareil photo) */
  const lireFichier = inp => () => { const f = inp.files[0]; inp.value = ''; if (!f) return; const im = new Image(); im.onload = () => { traiter(im, im.naturalWidth, im.naturalHeight); URL.revokeObjectURL(im.src); }; im.src = URL.createObjectURL(f); };
  fi.onchange = lireFichier(fi); fc.onchange = lireFichier(fc);
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then(s => { flux = s; v.srcObject = s; v.play().catch(() => {}); })
      .catch(() => { v.hidden = true; cap.hidden = true; m.querySelector('#oc-camlab').hidden = false; L.say(msg, false, "Caméra non autorisée ou indisponible. Utilisez « Choisir une image de la galerie » ou « Prendre une nouvelle photo »."); });
  } else { v.hidden = true; cap.hidden = true; m.querySelector('#oc-camlab').hidden = false; L.say(msg, false, "Caméra indisponible ici (le site doit être en https). Utilisez « Choisir une image de la galerie »."); }
  OCR.charger().catch(e => L.say(msg, false, e.message));   /* préchargement pendant le cadrage */
});

/* ---------- rapprochement des noms ---------- */
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const lev = (a, b) => { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
const sim = (a, b) => a === b ? 1 : (a.length < 3 || b.length < 3) ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length);
OCR.score = (ligneNom, eleve) => {
  const lt = norm(ligneNom).split(' ').filter(x => x.length > 1), et = norm(L.fullName(eleve)).split(' ').filter(x => x.length > 1); if (!lt.length || !et.length) return 0;
  let tot = 0, poids = 0; et.forEach(t => { const b = Math.max(...lt.map(u => sim(t, u))); tot += b * t.length; poids += t.length; }); return tot / poids;
};
OCR.meilleur = (ligneNom, eleves) => {
  let b = null, s1 = 0, s2 = 0; eleves.forEach(e => { const s = OCR.score(ligneNom, e); if (s > s1) { s2 = s1; s1 = s; b = e; } else if (s > s2) s2 = s; });
  return { eleve: b, score: s1, ambigu: s1 - s2 < .08 };
};
const EST_MATRICULE = t => /^[A-Za-z0-9][A-Za-z0-9\-\/._]{3,24}$/.test(t) && (t.match(/\d/g) || []).length >= 3 && !/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(t) && !/^\d{1,2}[.,]\d{1,2}$/.test(t);
const sansRang = l => l.replace(/^\s*\d{1,3}\s*[.)\-:]?\s+(?=[A-Za-zÀ-ÿ])/, '');

/* lignes « nom … note » → [{ brut, nom, note, incertain, eleve, score }] */
OCR.analyserNotes = (texte, eleves) => {
  const out = [];
  texte.split(/\r?\n/).forEach(brut => {
    let l = brut.replace(/[|_\\]/g, ' ').replace(/(\d+(?:[.,]\d+)?)\s*\/\s*20\b/g, '$1').trim(); if (l.length < 4) return;
    const tk = l.match(/(\S+)\s*$/);   /* dernier mot confondu avec un chiffre : « 1O,5 » → « 10,5 » (jamais appliqué à un mot sans chiffre) */
    if (tk && /^[\dOoIl|SsBb.,]{1,5}$/.test(tk[1]) && /\d/.test(tk[1])) l = l.slice(0, tk.index) + tk[1].replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8');
    const mt = l.split(/\s+/).filter(EST_MATRICULE); mt.forEach(t => { l = l.replace(t, ' '); });
    const nums = [...l.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)(?!\d)/g)]; if (!nums.length) return;
    const dern = nums[nums.length - 1]; let txt = dern[1].replace(',', '.'), note = parseFloat(txt), incertain = false;
    if (note > 20 && /^\d{3}$/.test(txt) && note / 10 <= 20) { note = note / 10; incertain = true; } else if (note > 20) { incertain = true; }
    const nom = sansRang(l.slice(0, dern.index)).replace(/[\d.,:;()\[\]\-–—]+/g, ' ').replace(/\s+/g, ' ').trim(); if (norm(nom).length < 3) return;
    const r = OCR.meilleur(nom, eleves);
    out.push({ brut: brut.trim(), nom, note: note > 20 ? '' : note, incertain: incertain || r.score < .72 || r.ambigu, eleve: r.score >= .5 ? r.eleve : null, score: r.score });
  });
  return out;
};
/* numéros des absents : « 3, 7 12 » → { numeros:[3,7,12], hors:[…] } ; les dates, décimaux et années sont ignorés ; O/l/I lus comme 0/1 dans un nombre */
OCR.analyserNumeros = (texte, max) => {
  const t = String(texte || '').replace(/\d{1,2}\s*[\/\-.]\s*\d{1,2}(\s*[\/\-.]\s*\d{2,4})?/g, ' ').replace(/\d+[.,]\d+/g, ' ');
  const ok = new Set(), hors = new Set();
  t.split(/[^0-9OoIl|]+/).forEach(tok => {
    if (!tok || !/\d/.test(tok) || tok.length > 3) return;
    const n = parseInt(tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'), 10); if (!n) return;
    if (n <= max) ok.add(n); else hors.add(n);
  });
  return { numeros: [...ok].sort((a, b) => a - b), hors: [...hors].sort((a, b) => a - b) };
};
/* lignes « nom … matricule » → [{ brut, nom, matricule, eleve, score }] (seulement les élèves sans matricule) */
OCR.analyserMatricules = (texte, eleves) => {
  const out = [];
  texte.split(/\r?\n/).forEach(brut => {
    let l = brut.replace(/[|\\]/g, ' ').trim(), mt = l.split(/\s+/).filter(EST_MATRICULE).map(t => t.replace(/[._\-\/]+$/, '')); if (!mt.length) return;
    const mat = mt[mt.length - 1].toUpperCase(); mt.forEach(t => { l = l.replace(t, ' '); });
    const nom = sansRang(l).replace(/[\d.,:;()\[\]\-–—]+/g, ' ').replace(/\s+/g, ' ').trim(); if (norm(nom).length < 3) return;
    const r = OCR.meilleur(nom, eleves);
    out.push({ brut: brut.trim(), nom, matricule: mat, incertain: r.score < .72 || r.ambigu, eleve: r.score >= .5 ? r.eleve : null, score: r.score });
  });
  return out;
};


/* ---------- emploi du temps : photo de la fiche papier → { 'Lundi|1': 'Mathématiques', … } ---------- */
const JOURS_OCR = [['Lundi', ['lundi', 'lun', 'monday', 'mon']], ['Mardi', ['mardi', 'mar', 'tuesday', 'tue', 'tues']], ['Mercredi', ['mercredi', 'mer', 'wednesday', 'wed']], ['Jeudi', ['jeudi', 'jeu', 'thursday', 'thu', 'thur', 'thurs']], ['Vendredi', ['vendredi', 'ven', 'friday', 'fri']]];
const jourDe = t => { const n = norm(t).replace(/ /g, ''); if (n.length < 3) return null; let best = null, bs = 0;
  JOURS_OCR.forEach(([j, al]) => al.forEach(a => { const sc = a.length <= 4 ? (n === a ? 1 : 0) : sim(n, a); if (sc > bs) { bs = sc; best = j; } }));
  return bs >= .78 ? { jour: best, score: bs } : null; };
/* abréviations courantes écrites sur les fiches (la clé est le libellé de la matière dans config.js) */
const ALIAS_MAT = { 'Mathématiques': ['maths', 'math'], 'Physique': ['phys', 'physiques', 'pct', 'pc'], 'Chimie': ['chim'], 'SVT': ['svt', 'sciences naturelles'], 'Informatique': ['info', 'informatiques', 'tic'],
  'Français': ['fr', 'litterature', 'lettres', 'langue', 'expression ecrite'], 'Anglais': ['angl', 'ang', 'english'], 'Histoire': ['hist'], 'Géographie': ['geo', 'geog'], 'Philosophie': ['philo'],
  'ECM': ['ecm', 'education civique'], 'Dessin': ['arts', 'arts plastiques'], 'EPS': ['eps', 'sport', 'education physique'], 'Travail manuel': ['tm'], 'Espagnol': ['esp'], 'Allemand': ['all'] };
const EXTRA_MAT = [['Histoire-Géographie', ['hist geo', 'histgeo', 'histoire geo', 'histoire geographie', 'hg']]];
const NON_MATIERE = /recre|pause|break|midi|lunch|dejeuner|^salle$/;
const vocabulaire = () => { const v = []; ((window.SITE || {}).matieres || []).forEach(m => v.push({ label: m.l, formes: [norm(m.l)].concat((ALIAS_MAT[m.l] || []).map(norm)) }));
  EXTRA_MAT.forEach(([l, f]) => v.push({ label: l, formes: f.map(norm) })); return v; };
OCR.matiereDe = texte => {
  const tk = norm(texte).split(' ').filter(Boolean); if (!tk.length) return null;
  const cands = tk.slice(); for (let i = 0; i < tk.length - 1; i++) cands.push(tk[i] + ' ' + tk[i + 1]); if (tk.length > 2) cands.push(tk.join(' '));
  const trouves = {};
  vocabulaire().forEach(v => cands.forEach(c => v.formes.forEach(f => {
    const sc = (f.length <= 4 || c.length <= 4) ? (f === c ? 1 : 0) : sim(f, c);
    if (sc >= .78 && (!trouves[v.label] || sc > trouves[v.label])) trouves[v.label] = sc; })));
  if (trouves['Histoire-Géographie'] >= .85) { delete trouves['Histoire']; delete trouves['Géographie']; }   /* « Hist-Géo » = une seule matière */
  const l = Object.keys(trouves).sort((a, b) => trouves[b] - trouves[a]); if (!l.length) return null;
  const forts = l.filter(x => trouves[x] >= .85);
  if (forts.length > 1) return { texte: forts.join(' / '), incertain: true };
  return { texte: l[0], incertain: trouves[l[0]] < .85 };
};
const minutesDe = t => { const m = String(t).match(/(\d{1,2})\s*[hH:.]\s*(\d{2})?/); if (!m) return null; const h = +m[1]; if (h < 5 || h > 21) return null; return h * 60 + (m[2] ? +m[2] : 0); };
const mediane = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

function lireGrille(pg, periodes) {
  const mots = pg.mots.filter(w => w.t && !/^[|_\\\/\-–—.,:;'"`~=()\[\]{}<>•*]+$/.test(w.t) && (w.c == null || w.c >= 25)); if (mots.length < 8) return { raison: 'Trop peu de texte lu sur la photo.' };
  const cx = w => (w.x0 + w.x1) / 2, cy = w => (w.y0 + w.y1) / 2, hs = mediane(mots.map(w => w.y1 - w.y0)) || 12;
  const parJour = {}; mots.forEach(w => { const j = jourDe(w.t); if (j && (!parJour[j.jour] || j.score > parJour[j.jour].score)) parJour[j.jour] = { score: j.score, w }; });
  const noms = JOURS_OCR.map(x => x[0]).filter(j => parJour[j]); if (noms.length < 3) return { raison: 'Les jours (Lundi … Vendredi) ne sont pas lisibles : cadrez aussi la ligne d\'en-tête.' };
  const xs = noms.map(j => cx(parJour[j].w)), ys = noms.map(j => cy(parJour[j].w));
  if (Math.max(...xs) - Math.min(...xs) < Math.max(...ys) - Math.min(...ys)) return { raison: 'Cette fiche a les jours en lignes : la lecture automatique attend les jours en colonnes (comme sur le site). Saisissez-la à la main.' };
  /* droite des jours : x = a + b * numéro du jour (moindres carrés, ce qui comble un jour mal lu) */
  const idx = noms.map(j => JOURS_OCR.findIndex(x => x[0] === j)), n = idx.length, mi = idx.reduce((a, b) => a + b, 0) / n, mx = xs.reduce((a, b) => a + b, 0) / n;
  let nu = 0, de = 0; idx.forEach((i, k) => { nu += (i - mi) * (xs[k] - mx); de += (i - mi) * (i - mi); }); const b = de ? nu / de : 0, a = mx - b * mi; if (b < 20) return { raison: 'Colonnes des jours trop rapprochées : reprenez la photo plus près.' };
  const jourDeX = x => { const i = Math.round((x - a) / b); return i >= 0 && i < 5 && Math.abs(x - (a + b * i)) <= b / 2 ? JOURS_OCR[i][0] : null; };
  const basEntete = Math.max(...noms.map(j => parJour[j].w.y1)), gauche = a - b / 2;
  /* ancres des lignes : numéros ou horaires lus dans la colonne de gauche */
  const marge = mots.filter(w => cx(w) < gauche && cy(w) > basEntete).sort((p, q) => cy(p) - cy(q)), grp = [];
  marge.forEach(w => { const g = grp[grp.length - 1]; if (g && cy(w) - g.y <= hs * .8) { g.mots.push(w); g.y = g.mots.reduce((s, x) => s + cy(x), 0) / g.mots.length; } else grp.push({ mots: [w], y: cy(w) }); });
  const nums = periodes.filter(([p]) => /^\d$/.test(p)), ancres = [], vus = new Set();
  grp.forEach(g => { const tx = g.mots.sort((p, q) => cx(p) - cx(q)).map(w => w.t).join(' ');
    if (NON_MATIERE.test(norm(tx).replace(/ /g, ''))) { ancres.push({ p: null, y: g.y }); return; }
    let p = null; const nb = g.mots.find(w => /^[1-9](e|è|ème|er|re)?$/i.test(w.t)); if (nb) p = nb.t.charAt(0);
    if (!p) { const t0 = g.mots.map(w => minutesDe(w.t)).find(x => x != null); if (t0 != null) { const o = nums.find(([, h]) => { const m0 = minutesDe(h); return m0 != null && Math.abs(m0 - t0) <= 20; }); if (o) p = o[0]; } }
    if (p && nums.some(o => o[0] === p) && !vus.has(p)) { vus.add(p); ancres.push({ p, y: g.y }); } });
  let repli = false, bandes = [];
  if (ancres.filter(x => x.p).length >= 3) {
    ancres.sort((p, q) => p.y - q.y); const pas = mediane(ancres.slice(1).map((x, i) => x.y - ancres[i].y)) || hs * 3;
    bandes = ancres.map((x, i) => ({ p: x.p, h: i ? (ancres[i - 1].y + x.y) / 2 : x.y - pas / 2, b: i < ancres.length - 1 ? (x.y + ancres[i + 1].y) / 2 : x.y + pas / 2 }));
  } else {   /* repli : lignes repérées par les écarts verticaux, associées dans l'ordre aux périodes (tout est à vérifier) */
    repli = true; const c = mots.filter(w => cx(w) >= gauche && cy(w) > basEntete && jourDeX(cx(w))).sort((p, q) => cy(p) - cy(q)), lg = [];
    c.forEach(w => { const g = lg[lg.length - 1]; if (g && w.y0 - g.y1 <= hs * 1.6) { g.y1 = Math.max(g.y1, w.y1); } else lg.push({ y0: w.y0, y1: w.y1 }); });
    if (lg.length < 3) return { raison: 'Impossible de repérer les lignes (périodes). Ajoutez la colonne des numéros de période dans le cadre.' };
    bandes = lg.slice(0, nums.length).map((g, i) => ({ p: nums[i][0], h: i ? (lg[i - 1].y1 + g.y0) / 2 : g.y0 - hs, b: i < lg.length - 1 ? (g.y1 + lg[i + 1].y0) / 2 : g.y1 + hs }));
  }
  const cell = {}; mots.forEach(w => { if (cx(w) < gauche || cy(w) <= basEntete) return; const j = jourDeX(cx(w)); if (!j) return; const bd = bandes.find(z => z.p && cy(w) >= z.h && cy(w) < z.b); if (!bd) return; (cell[j + '|' + bd.p] = cell[j + '|' + bd.p] || []).push(w); });
  const cases = {}, inc = [];
  Object.keys(cell).forEach(k => { const tx = cell[k].sort((p, q) => Math.abs(cy(p) - cy(q)) > hs * .6 ? cy(p) - cy(q) : cx(p) - cx(q)).map(w => w.t).join(' ');
    const r = OCR.matiereDe(tx);
    if (r) { cases[k] = r.texte; if (r.incertain || repli) inc.push(k); }
    else { const brut = tx.replace(/[|_\\]/g, ' ').replace(/\s+/g, ' ').trim(); if (norm(brut).length >= 3 && !NON_MATIERE.test(norm(brut).replace(/ /g, ''))) { cases[k] = brut.slice(0, 40); inc.push(k); } } });
  return { cases, incertains: inc, jours: noms.length, lignes: bandes.filter(z => z.p).length, repli };
}
OCR.analyserEmploi = pages => {
  const periodes = (window.SITE || {}).periodes || [], cases = {}, inc = new Set(); let raison = '', jours = 0, repli = false;
  (pages || []).forEach(pg => { const r = lireGrille(pg, periodes); if (!r.cases) { raison = r.raison; return; } jours = Math.max(jours, r.jours); repli = repli || r.repli;
    Object.keys(r.cases).forEach(k => { if (!cases[k]) cases[k] = r.cases[k]; }); r.incertains.forEach(k => inc.add(k)); });
  return { cases, incertains: [...inc], jours, repli, ok: Object.keys(cases).length, raison };
};

/* fenêtre de vérification : lignes modifiables ; surSauver(lignesValidées) enregistre */
OCR.verifierManuel = (o) => {
  /* o = { titre, eleves, lignes, colonne:'Note /20'|'Matricule', champ:'note'|'matricule', surSauver:async(rows)=>… } */
  const m = document.createElement('div'); m.className = 'modal open';
  const opts = sel => '<option value="">— ignorer cette ligne —</option>' + o.eleves.map((e, i) => '<option value="' + i + '"' + (sel === e ? ' selected' : '') + '>' + esc(L.fullName(e)) + '</option>').join('');
  m.innerHTML = '<div class="in" style="max-width:920px"><button class="x" type="button" aria-label="Fermer">×</button><h2>' + esc(o.titre) + '</h2><p class="sous" style="margin-top:0">' + o.lignes.length + ' ligne(s) lue(s). Les lignes à vérifier sont en jaune : corrigez l\'élève ou la valeur si besoin, puis validez.</p>' +
    (o.lignes.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Texte lu</th><th>Élève</th><th>' + esc(o.colonne) + '</th></tr></thead><tbody>' +
      o.lignes.map((r, i) => '<tr data-i="' + i + '"' + (r.incertain || !r.eleve ? ' style="background:#fff6d6"' : '') + '><td style="font-size:.85rem;color:#555">' + esc(r.brut) + '</td><td><select class="oc-el" style="width:100%;min-width:180px">' + opts(r.eleve) + '</select></td><td><input class="oc-val" style="width:110px" value="' + esc(r[o.champ] == null ? '' : r[o.champ]) + '"></td></tr>').join('') + '</tbody></table></div>'
      : '<div class="vide-app">Aucune ligne exploitable. Reprenez la photo plus près, bien à plat, avec plus de lumière.</div>') +
    '<div class="msg" role="status"></div><p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn dark" id="oc-ok" type="button"' + (o.lignes.length ? '' : ' hidden') + '>Valider et enregistrer</button><button class="btn gris" id="oc-non" type="button">Annuler</button></p></div>';
  document.body.appendChild(m); document.body.classList.add('modal-ouverte');
  const fermer = () => { m.remove(); document.body.classList.remove('modal-ouverte'); };
  m.querySelector('.x').onclick = m.querySelector('#oc-non').onclick = fermer;
  m.querySelector('#oc-ok') && (m.querySelector('#oc-ok').onclick = async () => {
    const msg = m.querySelector('.msg'), vus = new Set(), rows = [];
    for (const tr of m.querySelectorAll('tbody tr')) {
      const k = tr.querySelector('.oc-el').value; if (k === '') continue; const e = o.eleves[+k], v = tr.querySelector('.oc-val').value.trim();
      if (vus.has(e)) return L.say(msg, false, L.fullName(e) + ' apparaît deux fois : corrigez ou ignorez une des lignes.'); vus.add(e);
      if (v === '') continue; rows.push({ eleve: e, valeur: v });
    }
    if (!rows.length) return L.say(msg, false, 'Rien à enregistrer.');
    const b = m.querySelector('#oc-ok'); b.disabled = true; L.say(msg, true, 'Enregistrement…');
    try { await o.surSauver(rows); fermer(); } catch(err){ L.say(msg, false, err.message || 'Échec.'); b.disabled = false; }
  });
};

/* Enregistrement AUTOMATIQUE : les lignes sûres (élève reconnu sans ambiguïté, valeur lue, élève non répété) sont enregistrées
   directement, sans fenêtre de contrôle. La fenêtre ne s'ouvre que pour les lignes douteuses (lecture incertaine ou nom ambigu),
   afin qu'aucune note ne soit attribuée au mauvais élève. */
OCR.verifier = async (o) => {
  if (o.auto === false || !o.lignes.length) return OCR.verifierManuel(o);
  const vus = new Set(), sures = [], doute = [];
  o.lignes.forEach(r => { const v = r[o.champ]; if (r.eleve && !r.incertain && r.score >= .72 && v !== '' && v != null && !vus.has(r.eleve)) { vus.add(r.eleve); sures.push({ eleve: r.eleve, valeur: String(v) }); } else doute.push(r); });
  if (!sures.length) return OCR.verifierManuel(o);
  try { await o.surSauver(sures); }
  catch(err){ alert('Enregistrement automatique impossible : ' + (err.message || err)); return OCR.verifierManuel(o); }
  if (doute.length) OCR.verifierManuel(Object.assign({}, o, { titre: o.titre + ' · lignes à vérifier', lignes: doute.map(r => r.eleve && vus.has(r.eleve) ? Object.assign({}, r, { eleve: null }) : r) }));
};
})();

/* ============================================================
   LISTE D'INSCRIPTION (roster) : les élèves enregistrés par l'administration (fiche de classe lue par OCR, ou ajout manuel)
   peuvent créer leur compte en tapant seulement leur nom + classe + année : le compte est alors relié à leur fiche
   (notes, absences, matricule déjà saisis). Le document roster/{clé} ne contient que l'identifiant de la fiche.
   La clé est une empreinte SHA-256 du nom (mots triés, sans accents ni majuscules) + classe + année : sans le nom exact, on ne la devine pas.
   ============================================================ */
(function(){
const L = window.L;
const R = L.roster = {};
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
R.jetons = nom => norm(nom).split(' ').filter(Boolean).sort().join(' ');   /* « DJOMO Luc » = « Luc Djomo » */
R.cle = async (nom, prenom, classe, annee) => {
  const txt = R.jetons(String(nom || '') + ' ' + String(prenom || '')) + '|' + norm(classe) + '|' + (L.anneeNorm(annee) || String(annee || '').replace(/\s+/g, ''));   /* « 2025-2026 », « 2025 / 2026 », « 2025/26 » donnent la même clé */
  if (!(window.crypto && crypto.subtle)) throw new Error('Le navigateur ne permet pas la vérification (le site doit être ouvert en https).');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
};
R.doc = async (f) => ({ eleveId: f.id, nom: String(f.nom || '').slice(0, 80), prenom: String(f.prenom || '').slice(0, 80), classe: f.classe || '', annee: f.annee || '', updated: Date.now() });

/* Texte lu sur la fiche → [{ brut, rang, nom, prenom, naissance, matricule, sexe }]. Une ligne = un élève, dans l'ordre alphabétique de la fiche.
   Le nom est gardé tel qu'écrit (majuscules et accents). Les NOMS en capitales suivis de prénoms en minuscules sont séparés ;
   sinon tout le texte reste dans « nom » (c'est équivalent pour les notes : nom + prénom). */
const MAT = t => /^[A-Za-z0-9][A-Za-z0-9\-\/._]{3,24}$/.test(t) && (t.match(/\d/g) || []).length >= 3 && !/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(t);
R.analyserListe = (texte) => {
  /* Seules les lignes « numéro + nom » sont prises : titre, lycée, classe, en-têtes… sont ignorés. */
  const out = [], vus = new Set();
  String(texte || '').split(/\r?\n/).forEach(brut => {
    const m = brut.replace(/[|_\\]/g, ' ').match(/^\s*([\dOoIl]{1,3})\s*[.)\-:]?\s+(?=[A-Za-zÀ-ÿ])/);   /* « 1. », « 12 », « 3) » ; O/I/l mal lus à la place d'un chiffre */
    if (!m || !/\d/.test(m[1])) return;
    const nom0 = brut.replace(/[|_\\]/g, ' ').slice(m[0].length).replace(/[^A-Za-zÀ-ÿ'’\-\s]+/g, ' ').replace(/\s+/g, ' ').trim(); if (norm(nom0).length < 3) return;
    const mots = nom0.split(' '), maj = mots.map(w => w.length > 1 && w === w.toUpperCase());
    let n = nom0, p = '';
    if (maj.some(Boolean) && maj.some(x => !x)) { let k = 0; while (k < mots.length && maj[k]) k++; if (k > 0 && k < mots.length) { n = mots.slice(0, k).join(' '); p = mots.slice(k).join(' '); } }
    const cle = R.jetons(n + ' ' + p); if (vus.has(cle)) return; vus.add(cle);
    out.push({ brut: brut.trim(), rang: m[1], nom: n, prenom: p });
  });
  return out;
};
})();

/* ---------- Sexe et âge → année de naissance ---------- */
(function(){
const L = window.L;
/* âge de la fiche → année de naissance : année en cours − âge (ex. 17 ans en 2026 → 2009). Approximative (à un an près) tant que la date exacte n'est pas connue. */
L.anneeNaissance = age => { const a = parseInt(age, 10); return (a >= 5 && a <= 40) ? String(new Date().getFullYear() - a) : ''; };
/* lignes « numéro, nom, sexe (M/F), âge » → [{ brut, nom, sexe, age, valeur:'M 17', incertain, eleve, score }] ; le reste (titre, lycée, classe) est ignoré */
L.ocr.analyserSexeAge = (texte, eleves) => {
  const out = [];
  String(texte || '').split(/\r?\n/).forEach(brut => {
    let l = brut.replace(/[|_\\]/g, ' ').trim(); if (l.length < 5) return;
    const mr = l.match(/^\s*([\dOoIl]{1,3})\s*[.)\-:]?\s+(?=[A-Za-zÀ-ÿ])/); if (!mr || !/\d/.test(mr[1])) return;   /* seulement « numéro + nom … » */
    l = l.slice(mr[0].length);
    let sexe = ''; l = l.replace(/(?:^|\s)(M|F|Masculin|Féminin|Feminin|G|Garçon|Fille)(?=\s|$)/i, (m, s) => { sexe = /^(f|fem|fém|fille)/i.test(s) ? 'F' : 'M'; return ' '; });
    let age = ''; l = l.replace(/(?:^|\s)(\d{1,2})(?:\s*ans?)?\s*$/i, (m, a) => { if (+a >= 5 && +a <= 40) age = a; return ' '; });
    if (!age) l = l.replace(/(?:^|\s)(\d{1,2})\s*ans?\b/i, (m, a) => { if (+a >= 5 && +a <= 40) age = a; return ' '; });
    const nom = l.replace(/[^A-Za-zÀ-ÿ'’\-\s]+/g, ' ').replace(/\s+/g, ' ').trim(); if (nom.length < 3 || (!sexe && !age)) return;
    const r = L.ocr.meilleur(nom, eleves);
    out.push({ brut: brut.trim(), nom, sexe, age, valeur: (sexe + ' ' + age).trim(), incertain: r.score < .72 || r.ambigu || !sexe || !age, eleve: r.score >= .5 ? r.eleve : null, score: r.score });
  });
  return out;
};
})();
