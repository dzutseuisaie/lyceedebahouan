/* Lycée de Bahouan - finitions (accessibilité, animations, assistant, contact rapide, consentement) */
(function(){
const S = window.SITE, esc = window.esc, $ = (s, r) => (r || document).querySelector(s);
const H = document.documentElement; H.classList.add('js');
const LS = localStorage;

/* ---------- Préférences d'accessibilité ---------- */
let pref = {}; try { pref = JSON.parse(LS.getItem('bhn_a11y') || '{}'); } catch(e){}
const KEYS = ['big', 'big2', 'read', 'links', 'contrast', 'calm'];
const appliquer = () => KEYS.forEach(k => H.classList.toggle('a11y-' + k, !!pref[k]));
appliquer();
const sauver = () => { try { LS.setItem('bhn_a11y', JSON.stringify(pref)); } catch(e){} appliquer(); };

/* ---------- Lien d'évitement ---------- */
function evitement(){
  const m = $('main'); if (!m) return; if (!m.id) m.id = 'contenu';
  const a = document.createElement('a'); a.className = 'skip'; a.href = '#' + m.id; a.textContent = 'Aller au contenu principal';
  document.body.insertBefore(a, document.body.firstChild);
}

/* ---------- Consentement et mesure d'audience (chargée seulement après accord) ---------- */
function chargerAudience(){
  if (window.__ga) return; window.__ga = 1;
  const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=G-TCG98TKBGG'; document.head.appendChild(s);
  window.dataLayer = window.dataLayer || []; window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date()); gtag('config', 'G-TCG98TKBGG', { anonymize_ip: true });
}
function consentement(){
  const c = LS.getItem('bhn_consent');
  if (c === 'oui') return chargerAudience();
  if (c === 'non') return;
  const b = document.createElement('div'); b.className = 'cookies'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Mesure d\'audience');
  b.innerHTML = '<p>Ce site mesure son audience de façon anonyme pour s\'améliorer. Aucune donnée n\'est vendue. <a href="politique-confidentialite.html">En savoir plus</a></p><div class="a"><button class="btn small" type="button" data-c="oui">Accepter</button><button class="btn small ghost" type="button" data-c="non">Refuser</button></div>';
  b.addEventListener('click', e => { const v = e.target.getAttribute && e.target.getAttribute('data-c'); if (!v) return; LS.setItem('bhn_consent', v); b.remove(); if (v === 'oui') chargerAudience(); });
  setTimeout(() => { if (!document.getElementById('intro')) document.body.appendChild(b); else { const t = setInterval(() => { if (!document.getElementById('intro')) { clearInterval(t); document.body.appendChild(b); } }, 800); } }, 1200);
}

/* ---------- Apparitions au défilement + compteurs ---------- */
function animations(){
  const cibles = document.querySelectorAll('.section > .wrap > *, .panneau .ptxt, .croit .ctxt, .bloc, .carte, .temo blockquote, .honneur figure, .final .wrap > *, .exp .wrap > *');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return; en.target.classList.add('in'); io.unobserve(en.target);
    en.target.querySelectorAll && en.target.querySelectorAll('.stats b').forEach(compter);
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  cibles.forEach(el => { el.classList.add('rv'); io.observe(el); });
}
function compter(el){
  const txt = el.textContent.trim(); if (!/^\d{1,3}$/.test(txt) || el.dataset.ok) return; el.dataset.ok = 1;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || H.classList.contains('a11y-calm')) return;
  const fin = +txt, t0 = performance.now(), d = 1100;
  const f = n => { const p = Math.min(1, (n - t0) / d); el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); else el.textContent = txt; };
  requestAnimationFrame(f);
}

/* ---------- Assistant du lycée (réponses tirées de la FAQ) ---------- */
const sans = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const VIDES = new Set('le la les un une des de du d l et ou a au aux en dans pour par sur est sont je tu il elle nous vous on que qui quoi quel quelle quels quelles ce cet cette ces mon ma mes ton ta tes son sa ses y ne pas plus se si comment combien'.split(' '));
const mots = s => sans(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !VIDES.has(w));
function repondre(q){
  const n = sans(q);
  const lien = (t, h) => ({ t, h });
  if (/horaire|heure|ouvert|ferme/.test(n)) return { txt: S.horaires, liens: [lien('Emploi du temps', 'emploi.html')] };
  if (/adresse|ou se trouve|situe|localis|chemin|venir/.test(n)) return { txt: S.adresse + '.', liens: [lien('Planifier une visite', 'visite.html'), lien('Contact', 'contact.html')] };
  if (/telephone|appeler|numero|joindre|whatsapp/.test(n)) return { txt: 'Secrétariat : ' + S.telephoneAffiche + ' (appel ou WhatsApp). ' + S.horaires, liens: [lien('Écrire sur WhatsApp', S.whatsapp), lien('Contact', 'contact.html')] };
  if (/connexion|connecter|mot de passe|compte|code parent|code de suivi/.test(n)) return { txt: 'Les élèves s\'inscrivent une seule fois dans leur espace. Les parents entrent le code de suivi de leur enfant (visible dans le profil de l\'élève). Aucun compte pour les parents.', liens: [lien('Se connecter', 'connexion.html')] };
  if (/pre.?inscri|inscri|admission|admis/.test(n) && !/resultat/.test(n)) return { txt: 'Vous pouvez envoyer une pré-inscription en ligne depuis la page Admissions, ou passer au secrétariat avec les documents demandés.', liens: [lien('Admissions', 'admissions.html#preinscription'), lien('Documents à fournir', 'admissions.html#documents')] };
  const q2 = mots(q); if (!q2.length || !window.FAQ_DATA) return null;
  let best = null, score = 0;
  window.FAQ_DATA.forEach(f => { const qm = mots(f.q), am = mots(f.a); let s = 0; q2.forEach(w => { if (qm.some(x => x.indexOf(w) === 0 || w.indexOf(x) === 0)) s += 3; if (am.some(x => x.indexOf(w) === 0 || w.indexOf(x) === 0)) s += 1; }); if (s > score) { score = s; best = f; } });
  return score >= 3 ? { txt: best.a, liens: [lien('Toutes les questions', 'faq.html')] } : null;
}
function dock(){
  const IC = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.2 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/></svg>',
    a11y: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4.5" r="2"/><path d="M5 8l7 1 7-1M12 9v5m0 0l-3 6m3-6l3 6"/></svg>',
    top: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5m-6 6l6-6 6 6"/></svg>'
  };
  const d = document.createElement('div'); d.className = 'dock';
  d.innerHTML = '<button class="b-top" type="button" aria-label="Retour en haut">' + IC.top + '</button><button class="b-a11y" type="button" aria-label="Options d\'accessibilité">' + IC.a11y + '</button><a class="b-wa" href="' + esc(S.whatsapp) + '" target="_blank" rel="noopener noreferrer" aria-label="Écrire sur WhatsApp">' + IC.wa + '</a><button class="b-ass" type="button" aria-label="Poser une question à l\'assistant">' + IC.chat + '</button>';
  document.body.appendChild(d);

  /* panneau assistant */
  const pa = document.createElement('div'); pa.className = 'panel'; pa.setAttribute('role', 'dialog'); pa.setAttribute('aria-label', 'Assistant du lycée');
  pa.innerHTML = '<header>Assistant du lycée<button type="button" aria-label="Fermer">×</button></header><div class="corps"></div><form><input type="text" maxlength="200" placeholder="Posez votre question…" aria-label="Votre question"><button type="submit">Envoyer</button></form>';
  document.body.appendChild(pa);
  const corps = $('.corps', pa); let ouvert = false;
  const bulle = (html, cl) => { const b = document.createElement('div'); b.className = 'b ' + cl; b.innerHTML = html; corps.appendChild(b); corps.scrollTop = corps.scrollHeight; return b; };
  const puces = () => { const p = document.createElement('div'); p.className = 'puces'; ['Inscription', 'Documents à fournir', 'Horaires', 'Résultats d\'examens', 'Contact'].forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = () => poser(t); p.appendChild(b); }); corps.appendChild(p); };
  const poser = q => {
    if (!autorise) return;
    bulle(esc(q), 'moi'); const r = repondre(q);
    if (r) bulle(esc(r.txt) + (r.liens || []).map(l => '<p style="margin:8px 0 0"><a class="lien" href="' + esc(l.h) + '"' + (/^https?:/.test(l.h) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(l.t) + '</a></p>').join(''), 'bot');
    else bulle('Je n\'ai pas la réponse précise. Le secrétariat vous répond au ' + esc(S.telephoneAffiche) + '.<p style="margin:8px 0 0"><a class="lien" href="' + esc(S.whatsapp) + '" target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a> · <a class="lien" href="#" data-demande="information">Être rappelé</a></p>', 'bot');
  };
  /* Assistant réservé aux personnes de 18 ans et plus : élève (âge de son profil), parent et personnel (adultes), visiteur (confirmation) */
  const AGE_MIN = (S.assistant && S.assistant.ageMin != null) ? S.assistant.ageMin : 18;   /* 0 = ouvert à tous */
  let autorise = false;
  const statutAge = async () => {
    if (!AGE_MIN) return 'ok';
    try { if (window.Session && Session.ready) await Session.ready; } catch(e){}
    const Se = window.Session || {};
    if (Se.admin || Se.parentDoc) return 'ok';
    if (Se.user) { const a = parseInt(Se.profile && Se.profile.age, 10); return isNaN(a) ? 'age-inconnu' : (a >= AGE_MIN ? 'ok' : 'mineur'); }
    try { if (sessionStorage.getItem('bhn_ia18') === '1') return 'ok'; } catch(e){}
    return 'confirmer';
  };
  const ouvrirAssistant = async () => {
    corps.innerHTML = ''; autorise = false;
    const st = await statutAge();
    if (st === 'ok') { autorise = true; bulle('Bonjour ! Je réponds aux questions sur l\'inscription, les horaires, les résultats et le contact. Choisissez un thème ou écrivez votre question.', 'bot'); puces(); return; }
    if (st === 'mineur') bulle('L\'assistant est réservé aux personnes de ' + AGE_MIN + ' ans et plus. Pour toute question, contactez le secrétariat au ' + esc(S.telephoneAffiche) + '.', 'bot');
    else if (st === 'age-inconnu') bulle('L\'assistant est réservé aux personnes de ' + AGE_MIN + ' ans et plus. Renseignez votre âge dans « Mon profil », ou contactez le secrétariat au ' + esc(S.telephoneAffiche) + '.', 'bot');
    else bulle('L\'assistant est réservé aux personnes de ' + AGE_MIN + ' ans et plus. Avez-vous ' + AGE_MIN + ' ans ou plus ?<p style="margin:8px 0 0"><button type="button" class="lien" data-ia18="1">Oui, j\'ai ' + AGE_MIN + ' ans ou plus</button></p>', 'bot');
  };
  corps.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-ia18]')) { try { sessionStorage.setItem('bhn_ia18', '1'); } catch(x){} ouvrirAssistant(); } });
  $('.b-ass', d).onclick = () => { ouvert = !ouvert; pa.classList.toggle('open', ouvert); $('.panel.a11y') && $('.panel.a11y').classList.remove('open'); if (ouvert && !corps.children.length) ouvrirAssistant(); if (ouvert) $('input', pa).focus(); };
  $('header button', pa).onclick = () => { ouvert = false; pa.classList.remove('open'); };
  $('form', pa).onsubmit = e => { e.preventDefault(); const i = $('input', pa), v = i.value.trim(); if (v) { i.value = ''; poser(v); } };

  /* panneau accessibilité */
  const pb = document.createElement('div'); pb.className = 'panel a11y'; pb.setAttribute('role', 'dialog'); pb.setAttribute('aria-label', 'Options d\'accessibilité');
  const OPT = [['big', 'Texte plus grand'], ['big2', 'Texte très grand'], ['read', 'Police de lecture facile'], ['links', 'Souligner les liens'], ['contrast', 'Contraste renforcé'], ['calm', 'Réduire les animations']];
  const rendreB = () => { $('.corps', pb).innerHTML = OPT.map(o => '<div class="opt"><span>' + o[1] + '</span><button type="button" data-k="' + o[0] + '" aria-pressed="' + !!pref[o[0]] + '">' + (pref[o[0]] ? 'Activé' : 'Activer') + '</button></div>').join('') + '<div class="opt"><span>Tout remettre par défaut</span><button type="button" data-k="_raz">Réinitialiser</button></div>'; };
  pb.innerHTML = '<header>Accessibilité<button type="button" aria-label="Fermer">×</button></header><div class="corps"></div>';
  document.body.appendChild(pb); rendreB();
  $('.b-a11y', d).onclick = () => { pb.classList.toggle('open'); pa.classList.remove('open'); ouvert = false; };
  $('header button', pb).onclick = () => pb.classList.remove('open');
  pb.addEventListener('click', e => { const k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!k) return;
    if (k === '_raz') pref = {}; else { pref[k] = !pref[k]; if (k === 'big' && pref.big) pref.big2 = false; if (k === 'big2' && pref.big2) pref.big = false; } sauver(); rendreB(); });

  /* retour en haut */
  const top = $('.b-top', d); top.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  addEventListener('scroll', () => top.classList.toggle('on', scrollY > 700), { passive: true });
}

/* ---------- Lettre d'information (pied de page) ---------- */
function lettre(){ const f = document.getElementById('f-news'); if (f && window.bindForm) window.bindForm(f, 'abonnes', 'Merci ! Vous recevrez les nouvelles du lycée.'); }

function init(){ evitement(); dock(); consentement(); lettre(); setTimeout(animations, 250); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
