/* Lycée de Bahouan - accueil des anciens élèves
   Après avoir rempli le formulaire, l'ancien élève voit « Bienvenue aux anciens élèves », choisit sa classe puis sa promotion
   et rejoint le groupe WhatsApp des anciens de cette année.
   - Les liens sont saisis par l'administration (Administration > Anciens et WhatsApp) : collection liens_anciens.
   - Pour lire ces liens sans créer de compte, l'ancien reçoit une session anonyme Firebase
     (à activer une fois : Firebase > Authentication > Sign-in method > Anonyme).
   - Chaque adhésion est enregistrée dans anciens_adhesions (visible seulement par l'administration). */
(function(){
const S = window.SITE, esc = window.esc, LS = localStorage;

function sessionAnonyme(){
  if (!window.AUTH) return Promise.reject(new Error('auth'));
  if (AUTH.currentUser) return Promise.resolve(AUTH.currentUser);
  return AUTH.signInAnonymously().then(c => c.user);
}
async function chargerLiens(){
  const snap = await DB.collection('liens_anciens').get(); const l = [];
  snap.forEach(d => { const x = d.data(); if (x.lien && String(x.lien).indexOf('https://chat.whatsapp.com/') === 0 && x.promotion) l.push({ id: d.id, promotion: String(x.promotion), classe: x.classe || '', lien: x.lien }); });
  return l;
}
const anneesPour = (liens, classe) => {
  const a = [...new Set(liens.filter(x => !x.classe || x.classe === classe).map(x => x.promotion))];
  return (a.length ? a : [...new Set(liens.map(x => x.promotion))]).sort().reverse();
};
const lienPour = (liens, annee, classe) => (liens.find(x => x.promotion === annee && x.classe === classe) || liens.find(x => x.promotion === annee && !x.classe) || liens.find(x => x.promotion === annee) || {}).lien || '';

window.Anciens = {
  async bienvenue(info){
    info = info || {};
    const m = document.createElement('div'); m.className = 'modal open'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'an-titre');
    m.innerHTML = '<div class="in"><button class="x" type="button" aria-label="Fermer">×</button><h2 id="an-titre">Bienvenue aux <em>anciens élèves</em></h2>' +
      '<p>' + (info.nom ? 'Merci ' + esc(String(info.nom).split(' ')[0]) + ', vos informations sont enregistrées. ' : '') + 'Rejoignez le groupe WhatsApp des anciens de votre promotion.</p><div id="an-corps"><p style="color:var(--gris)">Chargement…</p></div></div>';
    document.body.appendChild(m);
    const fermer = () => m.remove(); m.querySelector('.x').onclick = fermer; m.addEventListener('click', e => { if (e.target === m) fermer(); });
    const corps = m.querySelector('#an-corps');
    let liens = [];
    try { await sessionAnonyme(); liens = await chargerLiens(); }
    catch(e){ console.warn('Groupes des anciens indisponibles', e); corps.innerHTML = '<p>Les groupes WhatsApp ne sont pas disponibles pour le moment. L\'administration vous contactera, ou écrivez-nous depuis la page Contact.</p><p><a class="btn dark" href="contact.html">Nous contacter</a></p>'; return; }
    if (!liens.length) { corps.innerHTML = '<p>Les groupes WhatsApp des anciens ne sont pas encore créés. Revenez bientôt : cette page vous les proposera dès qu\'ils seront ouverts.</p>'; return; }
    const classes = S.classes.concat(['Autre classe']);
    corps.innerHTML = '<form class="form" style="max-width:none"><label>Veuillez sélectionner votre classe<select name="classe" required><option value="">Choisir…</option>' + classes.map(c => '<option>' + esc(c) + '</option>').join('') + '</select></label>' +
      '<label id="an-l-an" hidden>Votre promotion (année de sortie)<select name="annee"></select></label><div class="msg" role="status"></div><button class="btn dark" type="submit" id="an-go" hidden></button></form>';
    const f = corps.querySelector('form'), selA = f.annee, lab = f.querySelector('#an-l-an'), go = f.querySelector('#an-go'), msg = f.querySelector('.msg');
    const maj = () => { go.textContent = selA.value ? 'Rejoindre le groupe WhatsApp des anciens de ' + selA.value : ''; go.hidden = !selA.value; };
    f.classe.onchange = () => {
      if (!f.classe.value) { lab.hidden = true; go.hidden = true; return; }
      const ans = anneesPour(liens, f.classe.value), pre = String(info.promotion || '');
      selA.innerHTML = ans.map(a => '<option' + (a === pre ? ' selected' : '') + '>' + esc(a) + '</option>').join(''); lab.hidden = false; maj();
    };
    selA.onchange = maj;
    f.onsubmit = async e => {
      e.preventDefault(); const classe = f.classe.value, annee = selA.value, lien = lienPour(liens, annee, classe);
      if (!classe || !annee || !lien) { msg.className = 'msg err'; msg.textContent = 'Choisissez votre classe et votre promotion.'; return; }
      go.disabled = true;
      try { await DB.collection('anciens_adhesions').add({ nom: String(info.nom || '').slice(0, 120), classe: classe.slice(0, 40), promotion: String(info.promotion || '').slice(0, 8), groupe: annee.slice(0, 8), createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } catch(err){ console.warn('Adhésion non enregistrée', err); }
      try { LS.setItem('bhn_ancien', JSON.stringify({ nom: info.nom || '', promotion: info.promotion || '' })); } catch(err){}
      msg.className = 'msg ok'; msg.innerHTML = 'Bienvenue ! <a class="lien" href="' + esc(lien) + '" target="_blank" rel="noopener noreferrer">Ouvrir le groupe WhatsApp</a> si la fenêtre ne s\'ouvre pas.';
      window.open(lien, '_blank', 'noopener'); go.disabled = false;
    };
  }
};

/* page Anciens : ouverture après envoi du formulaire, et bouton « mes groupes » pour un ancien déjà inscrit */
document.addEventListener('DOMContentLoaded', () => {
  const f = document.getElementById('f-anciens'); if (!f) return;
  f.addEventListener('envoye', e => {
    const d = (e.detail && e.detail.data) || {};
    try { LS.setItem('bhn_ancien', JSON.stringify({ nom: d.nom || '', promotion: d.promotion || '' })); } catch(err){}
    Anciens.bienvenue({ nom: d.nom, promotion: d.promotion });
  });
  let moi = null; try { moi = JSON.parse(LS.getItem('bhn_ancien') || 'null'); } catch(e){}
  const bloc = document.getElementById('an-deja');
  if (moi && bloc) { bloc.hidden = false; bloc.querySelector('button').onclick = () => Anciens.bienvenue(moi); }
});
})();
