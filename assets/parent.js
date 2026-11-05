/* Lycée de Bahouan - espace parent : compte personnel du parent ; les codes de suivi de ses enfants sont enregistrés dans son compte */
(function(){
const S = window.SITE, esc = window.esc, $ = id => document.getElementById(id);
const main = $('main'), nav = $('nav'), idBox = $('id');
let E = Session.enfant(), SU = null, stopChat = null, showFn;

async function charger(){ SU = E ? await L.suivi(E.code) : null; }
function entete(){
  idBox.innerHTML = '<b>Espace parent</b><small>' + (E ? esc(E.nom) + ' · ' + esc(E.classe || '') : 'Aucun enfant ajouté') + '</small>' +
    '<p style="margin:10px 0 0"><button class="petit-lien" id="chg" type="button">' + (E ? 'Mes enfants' : 'Ajouter un enfant') + '</button></p>';
  $('chg').onclick = () => show('enfant');
}
const show = k => showFn && showFn(k);
const besoin = el => { el.innerHTML += '<div class="vide-app">Ajoutez d\'abord votre enfant avec le code parent remis par l\'administration. <p><button class="btn dark s" type="button" id="b-ch">Ajouter mon enfant</button></p></div>'; $('b-ch').onclick = () => show('enfant'); };
const pasPublie = '<div class="vide-app">L\'administration n\'a pas encore publié le suivi de cet enfant.</div>';

const sections = [
  { k:'accueil', t:'Accueil', async render(el){
      const l = await L.annonces(5);
      el.innerHTML = '<h1>Espace parent</h1><p class="sous">Suivez la scolarité de votre enfant sans vous déplacer.</p>' +
        (E ? '<div class="kpis"><div class="kpi"><b style="font-size:1.3rem">' + esc(E.nom) + '</b><span>Enfant suivi</span></div><div class="kpi"><b>' + esc((SU && SU.classe) || E.classe || '-') + '</b><span>Classe</span></div><div class="kpi"><b>' + esc((SU && SU.annee) || '-') + '</b><span>Année académique</span></div></div>' : '<div class="annonce"><b>Pour commencer :</b> ajoutez votre enfant avec le code parent remis par l\'administration.</div>') +
        '<div class="carte-app"><h3>Annonces de l\'administration</h3>' + L.annoncesHtml(l) + '</div>' +
        '<div class="carte-app"><h3>Accès rapide</h3><p style="display:flex;gap:10px;flex-wrap:wrap;margin:0"><a class="btn dark s" href="#notes">Notes</a><a class="btn dark s" href="#presence">Présence</a><a class="btn dark s" href="#resultats">Résultats d\'examens</a><a class="btn dark s" href="#messagerie">Écrire à l\'école</a>' +
        (SU && SU.whatsapp ? '<a class="btn s" href="' + esc(SU.whatsapp) + '" target="_blank" rel="noopener noreferrer">Groupe WhatsApp de la classe</a>' : '') + '</p></div>';
  }},
  { k:'enfant', t:'Mes enfants', async render(el){
      const l = Session.enfants();
      el.innerHTML = '<h1>Mes enfants</h1><p class="sous">Ajoutez votre enfant avec le code parent remis par l\'administration. Ce code ne sert qu\'une fois : ensuite votre enfant reste lié à votre compte, sur tous vos appareils.</p>' +
        '<div class="carte-app"><h3>Ajouter un enfant</h3><form class="form" id="e-f" style="max-width:520px"><label>Code parent (usage unique)<input name="code" required placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="20"></label>' +
        '<p style="font-size:.92rem;color:var(--gris);margin:0">Où trouver ce code ? Demandez-le à l\'administration du lycée (secrétariat) ; votre enfant peut en faire la demande par écrit. Le code expire dès qu\'il est utilisé. Si vous changez de téléphone, reconnectez-vous simplement à votre compte : aucun nouveau code n\'est nécessaire. Si vous perdez l\'accès à votre compte, l\'administration vous en remettra un nouveau.</p><button class="btn dark" type="submit">Ajouter</button><div class="msg" role="status"></div></form></div>' +
        (l.length ? '<div class="carte-app"><h3>Enfants enregistrés</h3>' + l.map(x => '<div class="fich"><b>' + esc(x.nom) + '</b><span class="t">' + esc(x.classe || '') + '</span>' + (E && E.code === x.code ? '<span class="t" style="background:var(--or-clair)">Suivi actuel</span>' : '<button class="btn gris s" data-c="' + esc(x.code) + '" type="button" style="margin-left:auto">Suivre</button>') + '<button class="btn rouge s" data-r="' + esc(x.code) + '" type="button">Retirer</button></div>').join('') + '</div>' : '');
      $('e-f').onsubmit = async e => { e.preventDefault(); const m = e.target.querySelector('.msg'), bt = e.target.querySelector('button[type=submit]'), code = Session.normCode(e.target.code.value);
        if (code.length !== 14) return L.say(m, false, 'Le code parent comporte 12 caractères (XXXX-XXXX-XXXX).');
        bt.disabled = true; L.say(m, true, 'Vérification…');
        try { await Session.utiliserCodeParent(code); } catch(err){ bt.disabled = false; return L.say(m, false, err.message || 'Ajout impossible. Réessayez.'); }
        E = Session.enfant(); await charger(); entete(); show('accueil'); };
      el.onclick = async e => { const c = e.target.closest('[data-c]'), r = e.target.closest('[data-r]');
        if (c) { Session.choisirEnfant(c.dataset.c); E = Session.enfant(); await charger(); entete(); show('accueil'); }
        if (r && confirm('Retirer cet enfant de votre compte ?')) { await Session.retirerEnfant(r.dataset.r); E = Session.enfant(); await charger(); entete(); show('enfant'); } };
  }},
  { k:'notes', t:'Notes', async render(el){
      el.innerHTML = '<h1>Notes de l\'enfant</h1>'; if (!E) return besoin(el); if (!SU) return el.insertAdjacentHTML('beforeend', pasPublie);
      const ans = L.annees(SU); if (!ans.length) return el.insertAdjacentHTML('beforeend', pasPublie);
      el.insertAdjacentHTML('beforeend', '<div class="filtres"><label>Année académique<select id="n-a">' + L.options(ans) + '</select></label><button class="btn gris s" id="n-pr" type="button">Imprimer le relevé</button></div><div id="n-res"></div>');
      const go = () => { $('n-res').innerHTML = L.notesHtml(L.suiviNotes(SU, $('n-a').value)); }; $('n-a').onchange = go; go();
      $('n-pr').onclick = () => L.releve(E.nom, SU.classe || E.classe, $('n-a').value, L.suiviNotes(SU, $('n-a').value));
  }},
  { k:'presence', t:'Présence', async render(el){
      el.innerHTML = '<h1>Suivi de présence</h1>'; if (!E) return besoin(el); if (!SU) return el.insertAdjacentHTML('beforeend', pasPublie);
      const ans = L.annees(SU); if (!ans.length) return el.insertAdjacentHTML('beforeend', pasPublie);
      el.insertAdjacentHTML('beforeend', '<div class="filtres"><label>Année académique<select id="p-a">' + L.options(ans) + '</select></label></div><div id="p-res"></div>');
      const go = () => { $('p-res').innerHTML = L.absencesHtml(L.suiviAbs(SU, $('p-a').value)); }; $('p-a').onchange = go; go();
  }},
  { k:'resultats', t:'Résultats d\'examens', async render(el){
      el.innerHTML = '<h1>Résultats d\'examens</h1><p class="sous">Deux moyens de consulter un résultat officiel (OBC).</p>' +
        '<div class="carte-app"><h3>Avec l\'application Ayoba</h3><ol><li>Ouvrez l\'application Ayoba avec le bouton ci-dessous.</li><li>Cliquez sur la table « OBC EXAMEN ».</li><li>Choisissez « Mon résultat ».</li><li>Entrez le matricule et l\'année, puis « Recherche ».</li></ol><a class="btn dark" href="https://i.ayo.ba/YgBb/face" target="_blank" rel="noopener noreferrer">Voir les résultats dans Ayoba</a></div>' +
        '<div class="carte-app"><h3>Par SMS (150 FCFA)</h3><p>Envoyez le matricule par SMS au 8070 et recevez le résultat directement.</p><div class="form" style="max-width:420px"><label>Matricule<input id="mat" placeholder="Matricule de l\'élève"></label><button class="btn dark" id="sms" type="button">Envoyer le matricule</button></div></div>';
      $('sms').onclick = () => { const m = $('mat').value.trim(); if (!m) return alert('Veuillez entrer le matricule.'); location.href = 'sms:8070?body=' + encodeURIComponent(m); };
  }},
  { k:'emploi', t:'Emploi du temps', async render(el){
      el.innerHTML = '<h1>Emploi du temps</h1>'; if (!E) return besoin(el);
      const cl = (SU && SU.classe) || E.classe; const cases = cl ? await L.emploi(cl) : {};
      el.insertAdjacentHTML('beforeend', '<p class="sous">' + esc(cl || '') + (Object.keys(cases).length ? '' : ' · pas encore publié par l\'administration') + '</p>' + L.emploiHtml(cases, false));
  }},
  { k:'messagerie', t:'Écrire à l\'école', async render(el){
      if (stopChat) { stopChat(); stopChat = null; }
      el.innerHTML = '<h1>Écrire à l\'école</h1><p class="sous">Votre message est lu par l\'administration, qui répond ici même.</p><div id="chatbox"></div>';
      if (!E) return besoin($('chatbox'));
      if (Session.admin) { $('chatbox').innerHTML = '<div class="vide-app">Aperçu : la messagerie est désactivée en mode administrateur.</div>'; return; }
      stopChat = L.chat($('chatbox'), { code: E.code, nom: E.nom, classe: (SU && SU.classe) || E.classe, de: 'parent' });
  }}
];

(async function init(){
  await Session.ready;
  if (!Session.require('parent')) return;
  if (Session.admin) { idBox.innerHTML = '<b>Aperçu parent</b><small>Mode administrateur</small>'; main.innerHTML = '<h1>Aperçu parent</h1><div class="carte-app"><p>Pour voir ce que voit un parent, créez un code parent (Administration > Élèves > Code parent).</p></div>'; }
  if (Session.admin && !Session.parentDoc) Session.parentDoc = { uid: 'apercu', nom: 'Aperçu', enfants: [], local: true };
  E = Session.enfant(); await charger(); entete();
  showFn = L.tabs(nav, main, sections, E ? 'accueil' : 'enfant');
})();
})();
