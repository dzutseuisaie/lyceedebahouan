/* Lycée de Bahouan - espace élève */
(function(){
const S = window.SITE, esc = window.esc, $ = id => document.getElementById(id);
const main = $('main'), nav = $('nav'), idBox = $('id');
let P = null, apercu = false, stopChat = null;

const fullName = () => L.fullName(P);
const imgs = () => { if (window.__imgMap && window.applyImages) window.applyImages(window.__imgMap); };

/* ---------- Aperçu administrateur : choisir un élève ---------- */
async function choisirApercu(){
  main.innerHTML = '<h1>Aperçu élève</h1><p class="sous">En tant qu\'administrateur, choisissez l\'élève dont vous voulez voir l\'espace. La messagerie reste en lecture seule.</p>' +
    '<div class="carte-app"><div class="filtres"><label>Classe<select id="ap-c">' + L.options(S.classes) + '</select></label><label>Année académique' + L.anneeField({ id: 'ap-a', value: L.anneeCourante() }) + '</label>' +
    '<label>Élève<select id="ap-e"><option value="">Choisir…</option></select></label><button class="btn dark s" id="ap-go" type="button">Voir cet espace</button></div></div>';
  let liste = [];
  const charger = async () => {
    liste = await L.eleves($('ap-c').value, $('ap-a').value.trim());
    $('ap-e').innerHTML = '<option value="">' + (liste.length ? 'Choisir…' : 'Aucun élève') + '</option>' + liste.map((e, i) => '<option value="' + i + '">' + esc(L.fullName(e)) + '</option>').join('');
  };
  $('ap-c').onchange = charger; $('ap-a').onchange = () => { if (L.anneeOk($('ap-a').value)) charger(); };
  $('ap-go').onclick = () => { const e = liste[$('ap-e').value]; if (!e) return alert('Choisissez un élève.'); sessionStorage.setItem('bhn_apercu', JSON.stringify(e)); location.reload(); };
}

/* ---------- Sections ---------- */

/* Compte provisoire : demande d'une vraie adresse e-mail + mot de passe (nécessaire pour consulter les notes) */
function formEmail(el, apres){
  el.innerHTML = '<div class="carte-app"><h3>Complétez votre profil</h3><p>Votre nom a bien été retrouvé. Pour <b>consulter vos notes</b> et garder l\'accès à votre espace sur tous vos appareils, ajoutez une adresse e-mail et choisissez un mot de passe.</p>' +
    '<form class="form" id="fe-f" style="max-width:none"><label>Adresse e-mail<input name="email" type="email" required autocomplete="email"></label><label>Mot de passe (6 caractères minimum)<input name="password" type="password" minlength="6" required autocomplete="new-password"></label><button class="btn dark" type="submit">Enregistrer</button><div class="msg" role="status"></div></form></div>';
  $('fe-f').onsubmit = async ev => { ev.preventDefault(); const f = ev.target, m = f.querySelector('.msg'), b = f.querySelector('button[type=submit]'); b.disabled = true; L.say(m, true, 'Enregistrement…');
    try { const r = await Session.definirEmail(f.email.value, f.password.value);
      if (r.verif) { L.say(m, true, 'Un e-mail de confirmation vient d\'être envoyé à ' + f.email.value.trim() + '. Cliquez sur le lien qu\'il contient, puis reconnectez-vous avec cette adresse.'); return; }
      L.say(m, true, 'Profil complété ✔'); setTimeout(() => location.reload(), 700);
    } catch(err){ b.disabled = false; L.say(m, false, err.message || 'Enregistrement impossible. Réessayez.'); } };
}
const sections = [
  { k:'accueil', t:'Accueil', async render(el){
      const l = await L.annonces(5); const s = await L.suivi(P.code); const wa = P.classe ? await L.whatsapp(P.classe) : '';
      const moy = (s && P.annee) ? L.moyenne(L.suiviNotes(s, P.annee)) : null;
      el.innerHTML = '<h1>Bonjour' + (P.prenom ? ' ' + esc(P.prenom) : '') + '</h1><p class="sous">' + esc(P.classe || 'Classe non renseignée') + (P.annee ? ' · année ' + esc(P.annee) : '') + '</p>' +
        '<div class="kpis"><div class="kpi"><b>' + esc(P.classe || '-') + '</b><span>Ma classe</span></div><div class="kpi"><b>' + (moy == null ? '-' : moy.toFixed(2)) + '</b><span>Ma moyenne pondérée</span></div><div class="kpi"><b>' + esc(P.matricule || '-') + '</b><span>Matricule</span></div></div>' +
        '<div class="carte-app"><h3>Annonces de l\'administration</h3>' + L.annoncesHtml(l) + '</div>' +
        '<div class="carte-app"><h3>Accès rapide</h3><p style="display:flex;gap:10px;flex-wrap:wrap;margin:0"><a class="btn dark s" href="#cours">Cours et épreuves</a><a class="btn dark s" href="#notes">Mes notes</a><a class="btn dark s" href="#planning">Mon planning</a><a class="btn dark s" href="#ia">Assistants IA</a><a class="btn dark s" href="#messagerie">Écrire à l\'administration</a>' +
        (wa ? '<a class="btn s" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">Groupe WhatsApp de ma classe</a>' : '') + '<a class="btn gris s" href="vie-scolaire.html#reglement">Règlement du lycée</a></p></div>';
  }},
  { k:'notes', t:'Mes notes', async render(el){
      if (!apercu && Session.emailFictif()) return formEmail(el);
      const s = await L.suivi(P.code), ans = L.annees(s); const an = ans.length ? ans : (P.annee ? [P.annee] : []);
      el.innerHTML = '<h1>Mes notes</h1>' + (s ? '<div class="filtres"><label>Année académique<select id="n-a">' + L.options(an, P.annee) + '</select></label><button class="btn gris s" id="n-pr" type="button">Imprimer mon relevé</button></div><div id="n-res"></div>' : '<div class="vide-app">L\'administration n\'a pas encore publié votre suivi.</div>');
      if (!s) return;
      const go = () => { const a = $('n-a').value, m = L.suiviNotes(s, a); $('n-res').innerHTML = L.notesHtml(m); };
      $('n-a').onchange = go; go();
      $('n-pr').onclick = () => L.releve(fullName(), P.classe, $('n-a').value, L.suiviNotes(s, $('n-a').value));
  }},
  { k:'babillard', t:'Babillard', async render(el){
      el.innerHTML = '<h1>Babillard</h1><p class="sous">Le Babillard affiche vos notes. Entrez votre nom et choisissez votre classe pour consulter vos notes, votre tableau d\'honneur et votre bulletin.</p>' +
        '<form class="form carte-app" id="bb-f" style="max-width:560px"><label>Nom complet<input id="bb-n" autocomplete="off" required placeholder="Nom et prénom"></label><label>Classe<select id="bb-c" required>' + L.options(S.classes, '', 'Choisir…') + '</select></label><button class="btn dark" type="submit">Vérifier</button><div class="msg" role="status"></div></form><div id="bb-res"></div>';
      $('bb-f').onsubmit = async e => {
        e.preventDefault(); const m = e.target.querySelector('.msg'), res = $('bb-res'); res.innerHTML = '';
        if (!Honneur.memeNom($('bb-n').value, fullName()) || $('bb-c').value !== P.classe) return L.say(m, false, 'Ce nom et cette classe ne correspondent pas à votre compte validé.');
        L.say(m, true, 'Vérification réussie.');
        const s = await L.suivi(P.code), notes = s ? L.suiviNotes(s, P.annee) : {}, per = s ? (L.anneeSuivi(s, P.annee).periode || '') : '', moy = L.moyenne(notes);
        if (moy == null) { res.innerHTML = '<div class="vide-app">Vos notes ne sont pas encore publiées par l\'administration.</div>'; return; }
        const cl = await L.classement(P.classe, P.annee), profs = await L.profsClasse(P.classe), rang = Honneur.rang(moy, cl), total = cl ? cl.effectif : null;
        const nomDiplome = (P.nom || '').toUpperCase() + (P.prenom ? ' ' + P.prenom : '');
        const base = { nom: nomDiplome, classe: P.classe, annee: P.annee, periode: per, moyenne: moy, rang, total, notes, eleve: P, seqs: L.suiviSeqs(s, P.annee), absences: L.suiviAbs(s, P.annee), seqRang: L.anneeSuivi(s, P.annee).seqRang || null, cl, profs };
        res.innerHTML = '<div class="kpis" style="margin-top:18px"><div class="kpi"><b>' + (rang ? (rang === 1 ? '1er' : rang + 'e') + ' / ' + total : '-') + '</b><span>Position dans la classe</span></div><div class="kpi"><b style="font-size:1.5rem">' + esc(L.mention(moy)) + '</b><span>' + esc(Honneur.libelleMoyenne(per)) + ' : ' + moy.toFixed(2) + ' /20</span></div></div>' +
          '<div class="annonce">' + esc(Honneur.mot(moy)) + '</div>' + L.notesHtml(notes) +
          '<div class="carte-app"><h3>Tableau d\'honneur</h3>' + (moy >= Honneur.SEUIL_HONNEUR ? (rang ? '<div id="bb-th"></div><p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn dark s" id="bb-thp" type="button">Télécharger mon tableau d\'honneur</button><button class="btn gris s" id="bb-thi" type="button">Imprimer / PDF</button></p>' : '<div class="vide-app">Le classement de votre classe n\'est pas encore publié.</div>') : '<div class="vide-app">Le tableau d\'honneur s\'affiche à partir de ' + Honneur.SEUIL_HONNEUR + '/20 de moyenne.</div>') + '</div>' +
          '<div class="carte-app"><h3>Bulletin de notes</h3><div id="bb-bu"></div><p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn dark s" id="bb-bv" type="button">Afficher mon bulletin</button><button class="btn s" id="bb-bp" type="button" hidden>Télécharger (PNG)</button><button class="btn gris s" id="bb-bi" type="button" hidden>Imprimer / PDF</button></p></div>';
        if (moy >= Honneur.SEUIL_HONNEUR && rang) {
          const html = Honneur.tableau(base), d = Honneur.monter($('bb-th'), html, 1123, 794);
          $('bb-thp').onclick = () => Honneur.png(d, 'tableau-honneur-' + (P.nom || 'eleve').replace(/\s+/g, '_'));
          $('bb-thi').onclick = () => Honneur.imprimer(html, true);
        }
        $('bb-bv').onclick = () => { const html = Honneur.bulletin(base), d = Honneur.monter($('bb-bu'), html, 794, 1160);
          ['bb-bp', 'bb-bi'].forEach(i => $(i).hidden = false);
          $('bb-bp').onclick = () => Honneur.png(d, 'bulletin-' + (P.nom || 'eleve').replace(/\s+/g, '_')); $('bb-bi').onclick = () => Honneur.imprimer(html, false); };
      };
  }},
  { k:'presence', t:'Ma présence', async render(el){
      const s = await L.suivi(P.code), ans = L.annees(s); const an = ans.length ? ans : (P.annee ? [P.annee] : []);
      el.innerHTML = '<h1>Ma présence</h1>' + (s ? '<div class="filtres"><label>Année académique<select id="p-a">' + L.options(an, P.annee) + '</select></label></div><div id="p-res"></div>' : '<div class="vide-app">L\'administration n\'a pas encore publié votre suivi.</div>');
      if (!s) return;
      const go = () => { $('p-res').innerHTML = L.absencesHtml(L.suiviAbs(s, $('p-a').value)); };
      $('p-a').onchange = go; go();
  }},
  { k:'cours', t:'Cours et épreuves', async render(el){
      /* l'élève ne voit que les contenus de sa propre salle de classe */
      const niv = L.niveau(P.classe);
      el.innerHTML = '<h1>Cours et épreuves</h1><p class="sous">' + esc(P.classe || 'Classe non renseignée') + '. Touchez une matière pour voir ce qui a été publié pour votre salle.</p>' +
        (P.classe ? '<div class="matgrid">' + L.matieresDe(P.classe).map(m => '<button type="button" class="mat" data-k="' + m.k + '"><i data-img="matiere-' + m.k + '" style="background-image:url(\'images/matiere-' + m.k + '.jpg\')"></i><span>' + esc(m.l) + '</span></button>').join('') + '</div>'
          : '<div class="vide-app">Renseignez votre classe dans « Mon profil » pour voir vos cours.</div>'); imgs();
      const grille = el.querySelector('.matgrid'); if (!grille) return;
      grille.onclick = e => { const b = e.target.closest('.mat'); if (!b) return; L.ouvrirMatiere(S.matieres.find(x => x.k === b.dataset.k), niv, P.classe); };
  }},
  { k:'examens', t:'Examens', async render(el){
      let liste = S.examens; try { const d = await DB.collection('configuration').doc('examens').get(); if (d.exists && d.data().liste && d.data().liste.length) liste = d.data().liste; } catch(e){}
      el.innerHTML = '<h1>Examens et épreuves</h1><div class="filtres"><label>Examen<select id="x-e">' + L.options(liste, '', 'Tous') + '</select></label><label>Matière<select id="x-m">' + L.options((P.classe ? L.matieresDe(P.classe) : S.matieres).map(m => m.l), '', 'Toutes') + '</select></label>' +
        '<label>Classe<select id="x-c">' + L.options(S.classes, P.classe, 'Toutes') + '</select></label><label>Année académique<input id="x-a" inputmode="numeric" maxlength="9" placeholder="Toutes (ex. 2025/2026)"></label></div><div id="x-res"></div>';
      let tout = null;
      const go = async () => {
        if (!tout) { const s = await DB.collection('examens_fichiers').get(); tout = []; s.forEach(d => tout.push(Object.assign({ id: d.id }, d.data()))); }
        const e = $('x-e').value, m = $('x-m').value, c = $('x-c').value, a = $('x-a').value.trim();
        const l = tout.filter(f => (!e || f.examen === e) && (!m || f.matiere === m) && (!c || f.classe === c) && (!a || (f.annee || '').includes(a)));
        $('x-res').innerHTML = l.length ? '<div class="matgrid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">' + l.map(f => '<div class="carte-app" style="margin:0">' + (window.apercuHtml ? window.apercuHtml(f.url, f.name).replace('class="apercu"', 'class="apercu grand"') : '') + '<small style="color:var(--gris)">' + esc(f.examen || '') + ' · ' + esc(f.classe || '') + ' · ' + esc(f.annee || '') + '</small><h3 style="margin:6px 0">' + esc(f.matiere || '') + '</h3><p style="margin:0 0 10px">' + esc(f.name || '') + '</p><a class="btn dark s" href="' + esc(f.url) + '" target="_blank" rel="noopener">Ouvrir</a></div>').join('') + '</div>' : '<div class="vide-app">Aucun fichier pour ces critères.</div>';
      };
      ['x-e', 'x-m', 'x-c'].forEach(i => $(i).onchange = go); $('x-a').oninput = go; go();
  }},
  { k:'emploi', t:'Emploi du temps', async render(el){
      const cases = P.classe ? await L.emploi(P.classe) : {};
      el.innerHTML = '<h1>Emploi du temps</h1><p class="sous">' + esc(P.classe || '') + (Object.keys(cases).length ? '' : ' · L\'administration n\'a pas encore publié l\'emploi du temps de cette classe.') + '</p>' + L.emploiHtml(cases, false);
  }},
  { k:'codeparent', t:'Code parent', async render(el){
      /* code à usage unique publié par l'administration : l'élève le remet à son parent, qui l'entre dans son espace parent */
      const uidE = P.uid || (Session.authUser && Session.authUser.uid) || '';
      el.innerHTML = '<h1>Code parent</h1><p class="sous">Ce code permet à votre parent de suivre votre scolarité (notes, présence, messagerie). Donnez-le-lui : il l\'entre une seule fois dans son espace parent, puis vous restez liés. Le code ne fonctionne qu\'une fois et expire au bout de 7 jours.</p><div class="carte-app" id="cp-zone">Chargement…</div>';
      const zone = $('cp-zone'); let cp = null, utilise = false;
      if (apercu) { zone.textContent = 'Aperçu administrateur : le code de l\'élève n\'est pas affiché.'; return; }
      try { const sn = await DB.collection('utilisateurs').doc(uidE).collection('code_parent').doc('actuel').get(); if (sn.exists) cp = sn.data(); } catch(e){}
      if (cp && cp.code) { try { const t = await DB.collection('codes_parent').doc(cp.code).get(); utilise = !t.exists || !!t.data().utilise; } catch(e){} }
      const expire = cp && cp.exp && Date.now() > cp.exp;
      const bouton = '<p style="margin-top:14px"><button class="btn dark s" id="cp-dem" type="button">Demander un nouveau code</button></p><div class="msg" id="cp-m" role="status"></div>';
      if (!cp || !cp.code) zone.innerHTML = '<p>Aucun code n\'a encore été publié pour vous.</p>' + bouton;
      else if (utilise) zone.innerHTML = '<p><b>Le dernier code a déjà été utilisé</b> : votre parent est lié à votre compte. S\'il a changé de compte ou perdu l\'accès, demandez un nouveau code.</p>' + bouton;
      else if (expire) zone.innerHTML = '<p><b>Votre code a expiré.</b> Demandez-en un nouveau : l\'administration vous l\'enverra ici.</p>' + bouton;
      else zone.innerHTML = '<p style="text-align:center;font:700 2rem monospace;letter-spacing:.08em;margin:8px 0">' + esc(cp.code) + '</p><p class="sous" style="text-align:center">Valable jusqu\'au ' + esc(new Date(cp.exp).toLocaleDateString('fr-FR')) + ', une seule utilisation.</p><p style="text-align:center"><button class="petit-lien" id="cp-copie" type="button">Copier le code</button></p>' + bouton;
      const cc = $('cp-copie'); if (cc) cc.onclick = async () => { try { await navigator.clipboard.writeText(cp.code); cc.textContent = 'Copié'; } catch(e){ prompt('Copiez le code :', cp.code); } };
      $('cp-dem').onclick = () => { const m = $('cp-m'); if (window.Notif) Notif.envoyer({ staff: 'super' }, 'Demande de code parent', L.fullName(P) + ' (' + (P.classe || '') + ') demande un nouveau code parent.', 'administration.html'); L.say(m, true, 'Demande envoyée à l\'administration. Le nouveau code apparaîtra ici.'); $('cp-dem').disabled = true; };
  }},
  { k:'planning', t:'Mon planning', async render(el){
      /* planning personnel : 16h → 6h par périodes de 2 h, rempli par l'élève ; réveils ajoutés à l'agenda */
      const JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
      const CRENEAUX = ['16h-18h','18h-20h','20h-22h','22h-0h','0h-2h','2h-4h','4h-6h'];
      const uidP = P.uid || (Session.authUser && Session.authUser.uid) || '';
      const cle = 'bhn_planning_' + (uidP || P.code || P.id || 'eleve');
      let data = { cases:{}, reveils:[], maj:0 }; try { data = Object.assign(data, JSON.parse(localStorage.getItem(cle) || '{}')); } catch(e){}
      data.cases = data.cases || {}; data.reveils = data.reveils || []; data.maj = +data.maj || 0;
      /* copie en ligne : utilisateurs/{uid}/planning/perso (le compte suit l'élève sur tous ses appareils) */
      const refP = (!apercu && uidP && window.DB) ? DB.collection('utilisateurs').doc(uidP).collection('planning').doc('perso') : null;
      const etat = (t, ok) => { const n = $('pl-etat'); if (n) { n.textContent = t; n.style.color = ok ? '' : '#b45309'; } };
      let tSauve = null;
      const sauver = garder => { if (apercu) return; if (!garder || !data.maj) data.maj = Date.now();
        try { localStorage.setItem(cle, JSON.stringify(data)); } catch(e){}
        if (!refP) return; etat('Enregistrement…', true); clearTimeout(tSauve);
        tSauve = setTimeout(() => refP.set({ json: JSON.stringify({ cases: data.cases, reveils: data.reveils }), maj: data.maj })
          .then(() => etat('✓ Synchronisé avec votre compte : visible sur tous vos appareils.', true))
          .catch(err => etat('⚠ Enregistré sur cet appareil seulement (' + ((err && err.code) || 'erreur') + '). Prévenez l\'administration.', false)), 600); };
      /* ancienne copie (champ planning_perso de la fiche élève) : reprise une seule fois */
      if (!data.maj && !Object.keys(data.cases).length && !data.reveils.length && P.planning_perso) { try { Object.assign(data, JSON.parse(P.planning_perso)); } catch(e){} }
      const hm = s => ('0' + s.split(':')[0]).slice(-2) + ':' + s.split(':')[1];
      const dessiner = () => {
        const lignes = CRENEAUX.map((c, i) => '<tr><td><b>' + c + '</b></td>' + JOURS.map(j => {
          const rv = data.reveils.filter(r => r.jours.indexOf(j) > -1 && creneau(r.heure) === i).sort((a, b) => a.heure.localeCompare(b.heure));
          return '<td data-k="' + j + '|' + c + '"><div class="pl-txt" contenteditable="' + (apercu ? 'false' : 'true') + '" data-k="' + j + '|' + c + '" aria-label="' + j + ' ' + c + '">' + esc(data.cases[j + '|' + c] || '') + '</div>' +
            rv.map(r => '<span class="pl-rv">⏰ ' + hm(r.heure) + ' ' + esc(r.nom) + '</span>').join('') + '</td>'; }).join('') + '</tr>').join('');
        $('pl-t').innerHTML = '<thead><tr><th>Période</th>' + JOURS.map(j => '<th>' + j + '</th>').join('') + '</tr></thead><tbody>' + lignes + '</tbody>';
        $('pl-rvl').innerHTML = data.reveils.length ? data.reveils.map(r => '<li><span>⏰ <b>' + hm(r.heure) + '</b> · ' + esc(r.nom) + ' <small>(' + (r.jours.length === 7 ? 'tous les jours' : r.jours.map(j => j.slice(0, 3)).join(', ')) + ')</small></span>' + (apercu ? '' : '<button class="petit-lien" type="button" data-sup="' + r.id + '">Supprimer</button>') + '</li>').join('') : '<li class="sous">Aucun réveil pour le moment.</li>';
      };
      el.innerHTML = '<h1>Mon planning personnel</h1><p class="sous">Votre soirée et votre nuit, de 16h (fin des cours) à 6h (départ pour le lycée), par périodes de 2 heures. Touchez une case et écrivez ce que vous faites (révisions, repas, sport, sommeil…). Chaque colonne correspond au jour où l\'activité a lieu.</p>' +
        '<p class="sous" id="pl-etat" role="status" style="margin:6px 0"></p><div class="tbl-wrap" style="max-height:none"><table class="edt" id="pl-t"></table></div>' +
        '<p style="margin-top:12px"><button class="btn gris s" id="pl-raz" type="button"' + (apercu ? ' hidden' : '') + '>Effacer mes activités</button></p>' +
        '<div class="carte-app" style="margin-top:22px"><h3>⏰ Ajouter un réveil à mon agenda</h3>' +
        (apercu ? '<p class="sous">Aperçu administrateur : lecture seule.</p>' :
        '<form class="form" id="pl-f" style="max-width:520px"><label>Nom du réveil<input id="pl-n" maxlength="40" required placeholder="Ex. Réveil, Révision de maths"></label>' +
        '<label>Heure (entre 16h et 6h)<input id="pl-h" type="time" required></label>' +
        '<label>Jours<select id="pl-j"><option value="tous">Tous les jours</option>' + JOURS.map(j => '<option>' + j + '</option>').join('') + '</select></label>' +
        '<button class="btn dark" type="submit">Valider et ajouter à mon agenda</button><div class="msg" id="pl-m" role="status"></div></form>') +
        '<ul class="pl-liste" id="pl-rvl"></ul>' +
        '<p class="sous" style="margin-top:10px"><small>Le réveil sonne et affiche une notification tant que cette page reste ouverte dans le navigateur. Pour être sûr d\'être réveillé, doublez-le avec l\'alarme de votre téléphone.</small></p></div>';
      dessiner();
      if (refP) { const stop = refP.onSnapshot(sn => {
          if (!document.getElementById('pl-t')) { stop(); return; }
          if (sn.metadata.hasPendingWrites) return;
          const d = sn.exists ? sn.data() : null;
          if (!d) { if (data.maj || Object.keys(data.cases).length || data.reveils.length) sauver(true); else etat('Synchronisation active.', true); return; }
          const dist = +d.maj || 0;
          if (dist > data.maj) {
            const ae = document.activeElement; if (ae && ae.classList && ae.classList.contains('pl-txt')) return;   /* ne pas écraser ce que l'élève est en train d'écrire */
            try { const r = JSON.parse(d.json); data.cases = r.cases || {}; data.reveils = r.reveils || []; data.maj = dist; localStorage.setItem(cle, JSON.stringify(data)); dessiner(); etat('✓ Planning mis à jour depuis votre autre appareil.', true); } catch(e){}
          } else if (dist < data.maj) sauver(true);
          else etat('✓ Synchronisé avec votre compte.', true);
        }, err => etat('⚠ Synchronisation impossible (' + ((err && err.code) || 'erreur') + ') : le planning reste enregistré sur cet appareil.', false)); }
      $('pl-t').addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (!k || !e.target.classList.contains('pl-txt')) return; data.cases[k] = e.target.textContent.slice(0, 120); sauver(); });
      $('pl-raz').onclick = () => { if (confirm('Effacer toutes les activités de votre planning ? (vos réveils sont conservés)')) { data.cases = {}; sauver(); dessiner(); } };
      $('pl-rvl').onclick = e => { const id = e.target.dataset && e.target.dataset.sup; if (!id) return; data.reveils = data.reveils.filter(r => r.id !== id); sauver(); dessiner(); };
      const f = $('pl-f'); if (!f) return;
      f.onsubmit = ev => { ev.preventDefault(); const m = $('pl-m'), h = $('pl-h').value, nom = $('pl-n').value.trim();
        if (!nom || !h) return;
        if (creneau(h) < 0) return L.say(m, false, 'Votre planning commence à 16h et finit à 6h : choisissez une heure dans cette plage.');
        const j = $('pl-j').value;
        data.reveils.push({ id: 'r' + Date.now().toString(36), nom: nom.slice(0, 40), heure: h, jours: j === 'tous' ? JOURS.slice() : [j] });
        sauver(); dessiner(); f.reset(); L.say(m, true, 'Réveil ajouté à votre agenda.');
        if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch(e){} } };
      /* vérification des réveils chaque 20 s tant que la page est ouverte */
      if (window.__bhnReveil) clearInterval(window.__bhnReveil);
      window.__bhnReveil = setInterval(() => {
        const d = new Date(), j = JOURS[(d.getDay() + 6) % 7], t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), marque = j + t;
        data.reveils.forEach(r => { if (r.jours.indexOf(j) < 0 || hm(r.heure) !== t || window.__bhnDernier === marque + r.id) return; window.__bhnDernier = marque + r.id;
          try { new Notification('⏰ ' + r.nom, { body: 'Il est ' + t }); } catch(e){}
          try { navigator.vibrate && navigator.vibrate([300, 150, 300]); const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(); o.connect(a.destination); o.frequency.value = 880; o.start(); setTimeout(() => o.stop(), 1500); } catch(e){}
          alert('⏰ ' + r.nom + ' — ' + t); });
      }, 20000);
  }},
  { k:'messagerie', t:'Messagerie', async render(el){
      if (stopChat) { stopChat(); stopChat = null; }
      el.innerHTML = '<h1>Écrire à l\'administration</h1><p class="sous">Posez une question, signalez un problème. L\'administration vous répond ici.</p><div id="chatbox"></div>';
      if (apercu) { $('chatbox').innerHTML = '<div class="vide-app">Aperçu administrateur : l’écriture est réservée à l’élève. Pour répondre, ouvrez Administration > Messagerie.</div>'; return; }
      if (!P.code) { $('chatbox').innerHTML = '<div class="vide-app">Ouvrez « Mon profil » et cliquez sur « Enregistrer » une fois : votre code sera créé et vous pourrez écrire.</div>'; return; }
      stopChat = L.chat($('chatbox'), { code: P.code, nom: fullName(), classe: P.classe, de: 'eleve' });
  }},
  { k:'outils', t:'Outils', async render(el){
      el.innerHTML = '<h1>Outils</h1><div class="carte-app"><h3>Calculatrice scientifique</h3><div id="calc"></div></div>' +
        '<div class="carte-app"><h3>Pour aller plus loin</h3><p style="display:flex;gap:10px;flex-wrap:wrap;margin:0"><a class="btn dark s" href="club_scientifique.html">Club scientifique</a><a class="btn dark s" href="orientation.html">Club d\'orientation</a><a class="btn dark s" href="resultats_examen.html">Résultats d\'examens</a></p></div>';
      L.calculatrice($('calc'));
  }},
  { k:'ia', t:'Assistants IA', async render(el){
      const logoGpt = '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#10a37f"/><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"><path d="M24 9l12 7v14l-12 7-12-7V16z"/><path d="M24 9v14l12 7M24 23l-12 7M12 16l12 7 12-7"/></g></svg>';
      const logoCl = '<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#d97757"/><g stroke="#fff" stroke-width="3.4" stroke-linecap="round">' + [0,30,60,90,120,150].map(a => '<line x1="24" y1="10" x2="24" y2="38" transform="rotate(' + a + ' 24 24)"/>').join('') + '</g></svg>';
      el.innerHTML = '<h1>Assistants IA pour mes devoirs</h1><p class="sous">Traitez vos sujets, faites vos recherches et faites-vous expliquer ce que vous n\'avez pas compris. Servez-vous-en pour comprendre et vous entraîner, pas pour recopier : en composition, vous serez seul face à la feuille.</p>' +
        '<div class="ia-grille">' +
        '<div class="carte-app ia-c">' + logoGpt + '<h3>ChatGPT</h3><p>Posez votre sujet ou votre exercice, demandez une explication pas à pas, des exemples ou une correction.</p><a class="btn dark" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Ouvrir ChatGPT</a></div>' +
        '<div class="carte-app ia-c">' + logoCl + '<h3>Claude</h3><p>Envoyez un énoncé ou une photo de votre exercice et laissez-vous guider vers la solution, avec des explications claires.</p><a class="btn dark" href="https://claude.ai/" target="_blank" rel="noopener noreferrer">Ouvrir Claude</a></div></div>' +
        '<div class="carte-app"><h3>Se connecter</h3><p>Sur chaque site, touchez « Continuer avec Google » et choisissez votre compte Google. ' + (P.email ? 'Votre adresse : <b>' + esc(P.email) + '</b> <button class="petit-lien" id="ia-cp" type="button">Copier</button>' : '') + '</p></div>';
      const cp = $('ia-cp'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(P.email); cp.textContent = 'Copiée'; } catch(e){ prompt('Copiez votre adresse :', P.email); } };
  }},
  { k:'profil', t:'Mon profil', async render(el){
      const verrou = !apercu && !P._nouveau && Session.valide(P) && !!P.code;   /* identité enregistrée par l'administration : non modifiable (les notes sont rangées sous ce nom) */
      el.innerHTML = '<h1>Mon profil</h1>' + (apercu ? '<p class="sous">Aperçu : le profil ne peut pas être modifié.</p>' : '<p class="sous">Complétez ce qui manque (sexe, date de naissance, âge, matricule). Votre nom et votre classe viennent de l\'administration : pour les changer, contactez le secrétariat.</p>') +
        '<form class="form carte-app" id="pf" style="max-width:640px"><div class="form" style="grid-template-columns:1fr 1fr;max-width:none">' +
        '<label>Nom<input name="nom" value="' + esc(P.nom || '') + '" required' + (verrou ? ' readonly' : '') + '></label><label>Prénom<input name="prenom" value="' + esc(P.prenom || '') + '"' + (verrou ? ' readonly' : ' required') + '></label>' +
        '<label>Âge<input name="age" type="number" value="' + esc(P.age || '') + '"></label><label>Classe<select name="classe" required' + (verrou ? ' disabled' : '') + '>' + L.options(S.classes, P.classe, 'Choisir…') + '</select></label>' +
        (verrou ? '<label>Année académique<input value="' + esc(P.annee || '') + '" readonly></label>' : '<label>Année académique' + L.anneeField({ name: 'annee', value: P.annee }) + '</label>') + '<label>Matricule<input name="matricule" value="' + esc(P.matricule || '') + '"></label>' +
        '<label>Date de naissance<input name="naissance" placeholder="JJ/MM/AAAA" maxlength="10" value="' + esc(P.naissance || '') + '"></label><label>Sexe<select name="sexe"><option value="">—</option><option value="M"' + (P.sexe === 'M' ? ' selected' : '') + '>M</option><option value="F"' + (P.sexe === 'F' ? ' selected' : '') + '>F</option></select></label></div>' +
        '<label>Adresse e-mail<input value="' + esc(Session.emailFictif() ? '' : (P.email || '')) + '" placeholder="' + (Session.emailFictif() ? 'À ajouter (formulaire ci-dessus)' : '') + '" disabled></label>' + (apercu ? '' : '<button class="btn dark" type="submit">Enregistrer</button>') + '<div class="msg" role="status"></div></form>' +
        '<div class="carte-app" style="max-width:640px"><h3>Code parent</h3><p>Pour que votre parent suive vos notes et votre présence, utilisez la rubrique <a href="#codeparent"><b>Code parent</b></a> : l\'administration vous y envoie un code à usage unique.</p></div>' +
        (apercu ? '' : '<p><button class="petit-lien" type="button" id="quit">Me déconnecter</button></p>');
      if (!apercu && Session.emailFictif()) { el.insertAdjacentHTML('afterbegin', '<div id="pf-email" style="max-width:640px;margin-bottom:14px"></div>'); formEmail($('pf-email')); }
      if (apercu) { el.querySelectorAll('#pf input,#pf select').forEach(i => i.disabled = true); return; }
      $('pf').onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target).entries()), m = e.target.querySelector('.msg'); d.nom = (d.nom || '').slice(0, 80); d.prenom = (d.prenom || '').slice(0, 80);
        if (verrou) { d.nom = P.nom; d.prenom = P.prenom || ''; d.classe = P.classe; d.annee = P.annee; }
        if (!L.anneeOk(d.annee)) return L.say(m, false, L.MSG_ANNEE);
        if (d.naissance && !/^(\d{2}\/\d{2}\/)?\d{4}$/.test(d.naissance.trim())) return L.say(m, false, 'Date de naissance : JJ/MM/AAAA (ou seulement l\'année).');
        if (!(d.naissance || '').trim() && d.age) d.naissance = L.anneeNaissance(d.age);   /* âge connu, date inconnue : on garde l'année (année en cours − âge) */
        if (P && P._nouveau && Session.user) { const rec = await Session.reclamerFiche(Session.user, { nom: d.nom, prenom: d.prenom, classe: d.classe, annee: d.annee, email: Session.user.email, age: d.age });
          if (rec.etat === 'ok') { L.say(m, true, 'Votre nom a été retrouvé : ouverture de votre espace…'); setTimeout(() => location.reload(), 600); return; }
          if (rec.etat === 'prise') return L.say(m, false, "Cette fiche est déjà reliée à un autre compte. Présentez-vous à l'administration."); }
        try { await Session.saveProfile({ nom:d.nom.trim(), prenom:d.prenom.trim(), age:d.age, classe:d.classe, annee:d.annee, matricule:(d.matricule || '').trim(), naissance:(d.naissance || '').trim(), sexe:d.sexe || '' }); P = Session.profile; entete(); L.say(m, true, 'Profil enregistré.'); } catch(err){ L.say(m, false, "Enregistrement impossible. Réessayez."); } };
      const cp = $('cp'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(P.code); cp.textContent = 'Code copié'; } catch(err){ prompt('Copiez ce code :', P.code); } };
      $('quit').onclick = () => Session.logoutAll();
  }}
];

function entete(){
  idBox.innerHTML = '<b>' + esc(fullName() || 'Mon espace') + '</b><small>' + esc(P.classe || 'Classe à renseigner') + (apercu ? ' · aperçu' : '') + '</small>' +
    (apercu ? '<p style="margin:10px 0 0"><button class="petit-lien" id="chg" type="button">Changer d\'élève</button></p>' : '');
  const c = $('chg'); if (c) c.onclick = () => { sessionStorage.removeItem('bhn_apercu'); location.reload(); };
}

(async function init(){
  await Session.ready;
  if (!Session.require('eleve')) return;
  if (Session.user) P = Session.profile;
  else {
    apercu = true;
    try { P = JSON.parse(sessionStorage.getItem('bhn_apercu') || 'null'); } catch(e){}
    if (!P) { nav.innerHTML = ''; idBox.innerHTML = '<b>Aperçu élève</b><small>Mode administrateur</small>'; return choisirApercu(); }
  }
  entete();
  if (!apercu && !Session.valide()) {
    nav.innerHTML = '';
    L.tabs(nav, main, sections.filter(s => s.k === 'profil'), 'profil');
    main.insertAdjacentHTML('afterbegin', '<div class="annonce"><b>Inscription en attente de validation.</b> L\'administrateur doit confirmer que vous êtes bien élève du lycée avant de vous donner accès à vos notes, au Babillard et à vos cours.</div>');
    return;
  }
  if (!apercu && !Session.profilComplet()) {
    nav.innerHTML = '';
    L.tabs(nav, main, sections.filter(s => s.k === 'profil'), 'profil');
    main.insertAdjacentHTML('afterbegin', '<div class="annonce"><b>Bienvenue !</b> Complétez votre profil (nom, classe, année) pour accéder à vos notes et à vos cours.</div>');
    return;
  }
  L.tabs(nav, main, sections, 'accueil');
  if (!apercu && Session.emailFictif()) main.insertAdjacentHTML('afterbegin', '<div class="annonce"><b>Votre nom a été retrouvé.</b> Ajoutez votre adresse e-mail et un mot de passe dans <a href="#profil"><b>Mon profil</b></a> pour sécuriser votre compte et consulter vos notes.</div>');
})();
})();
