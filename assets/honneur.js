/* Lycée de Bahouan - Tableau d'honneur et bulletin (modèle validé, rendu identique à la maquette) */
(function(){
const S = window.SITE, esc = window.esc;
const SEUIL_HONNEUR = 12, SEUIL_FELICIT = 14;   /* ≥ 12 : tableau d'honneur · ≥ 14 : Félicitations (sinon Encouragements) */
const FAIT_A = 'Bahouan';
const SIGNATURE_IMG = '';   /* image (lien ou data URL) de la signature et du cachet du proviseur ; vide = cachet dessiné */
const fmt = n => n.toFixed(2).replace('.', ',');
const CSS = `.hn-doc{width:1123px;height:794px;background:#fdfdfe;color:#1a1a1a;position:relative;overflow:hidden;font-family:Arial,Helvetica,sans-serif}
.hn-doc svg.cadre{position:absolute;inset:0}
.hn-doc .t{position:absolute;white-space:nowrap}
.hn-doc .b{font-weight:bold}
.hn-doc .e{font-family:"Times New Roman",Times,serif;font-style:italic;font-weight:normal;font-size:13.5px;color:#222}
.hn-doc .c{text-align:center;font-weight:bold;text-transform:uppercase;font-size:13px;line-height:1.28}
.hn-doc .c small{display:block;font-size:9.5px;font-style:italic;font-weight:normal;text-transform:none;text-decoration:underline dotted}
.hn-doc .fr{font-size:47px;font-weight:900;letter-spacing:.5px;color:#b9bcc6;-webkit-text-stroke:1.3px #3b3d44;text-shadow:3px 3px 3px rgba(0,0,0,.35)}
.hn-doc .en{font-size:41px;font-weight:bold;color:#3b3d44;text-shadow:2px 2px 3px rgba(0,0,0,.3)}
.hn-doc .ul{border-bottom:1.5px solid #222;text-align:center;font-style:italic;font-size:18px;padding-bottom:1px}
.hn-doc .bx{border:1.5px solid #222;text-align:center}
.hn-doc .ck{width:50px;height:44px;border:2px solid #333;text-align:center;font-size:40px;line-height:42px;color:#2a7a52;font-weight:bold}
.hn-doc .sceau{width:150px;height:150px;transform:rotate(-8deg)}`;
if (!document.getElementById('hn-css')) { const st = document.createElement('style'); st.id = 'hn-css'; st.textContent = CSS; document.head.appendChild(st); }

function cadreSVG(W,H){
  W=W||1123;H=H||794;const B=30;
  const ornement=(x,y,sx,sy)=>`<g transform="translate(${x},${y}) scale(${sx},${sy})" fill="none" stroke="#555" stroke-width="1.3"><path d="M0 0c28 0 40 16 30 32s-26 8-20-6 22-6 18 4"/><path d="M0 0c0 28 16 40 32 30s8-26-6-20-6 22 4 18"/><circle cx="34" cy="34" r="4"/><path d="M44 8c10-6 22-4 28 4M8 44c-6 10-4 22 4 28"/></g>`;
  return `<svg class="cadre" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><pattern id="k" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#fdfdfe"/><path d="M0 28V2h28v22H8V8h14v10h-8v-4" fill="none" stroke="#3a3a3a" stroke-width="2.4"/></pattern></defs>
  <rect x="3" y="3" width="${W-6}" height="${H-6}" fill="none" stroke="#333" stroke-width="2"/>
  <rect x="${B+2}" y="3" width="${W-2*B-4}" height="${B}" fill="url(#k)" stroke="#333"/>
  <rect x="${B+2}" y="${H-B-3}" width="${W-2*B-4}" height="${B}" fill="url(#k)" stroke="#333"/>
  <rect x="3" y="${B+2}" width="${B}" height="${H-2*B-4}" fill="url(#k)" stroke="#333"/>
  <rect x="${W-B-3}" y="${B+2}" width="${B}" height="${H-2*B-4}" fill="url(#k)" stroke="#333"/>
  ${[[3,3],[W-B-3,3],[3,H-B-3],[W-B-3,H-B-3]].map(([x,y])=>`<rect x="${x}" y="${y}" width="${B}" height="${B}" fill="#fdfdfe" stroke="#333" stroke-width="2"/><rect x="${x+8}" y="${y+8}" width="${B-16}" height="${B-16}" fill="#333"/><rect x="${x+12}" y="${y+12}" width="${B-24}" height="${B-24}" fill="#fff"/>`).join("")}
  <rect x="42" y="42" width="${W-84}" height="${H-84}" fill="none" stroke="#444" stroke-width="2.5"/>
  <rect x="49" y="49" width="${W-98}" height="${H-98}" fill="none" stroke="#666" stroke-width="1"/>
  ${ornement(50,50,1,1)}${ornement(W-50,50,-1,1)}${ornement(50,H-50,1,-1)}${ornement(W-50,H-50,-1,-1)}
  </svg>`;
}
function blason(){return `<svg class="t" style="left:511px;top:150px" width="100" height="92" viewBox="0 0 100 92"><g fill="none" stroke="#444" stroke-width="2"><path d="M14 70C0 50 4 24 20 12M86 70c14-20 10-46-6-58"/><path d="M12 62l8-4M8 50l9-3M8 38l9 0M12 26l9 4M88 62l-8-4M92 50l-9-3M92 38l-9 0M88 26l-9 4"/><path d="M28 24h44v26c0 14-12 20-22 24-10-4-22-10-22-24z" fill="#ddd"/><path d="M34 36h32M34 46h32"/></g><rect x="18" y="76" width="64" height="9" fill="#e5e5e5" stroke="#444"/><text x="50" y="83.5" font-size="6" text-anchor="middle" font-weight="bold" fill="#222">LYCÉE DE BAHOUAN</text></svg>
  <svg class="t" style="left:476px;top:112px" width="170" height="26"><defs><linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="#666"/><stop offset=".45" stop-color="#bbb"/><stop offset="1" stop-color="#ddd"/></linearGradient></defs><path d="M0 4C40 0 60 14 95 8c30-5 48-2 70 4v8c-24-6-40-9-70-4-35 6-55-6-95-2z" fill="url(#f)"/></svg>`}

function genererTableau(el, rang, total, p){
  if(el.moyenne<SEUIL_HONNEUR) return{ok:false,msg:"Moyenne inférieure à "+SEUIL_HONNEUR+" : pas de tableau d'honneur."};
  const felic=el.moyenne>=SEUIL_FELICIT, rt=rang===1?"1er":rang+"e";
  const date=new Date().toLocaleDateString("fr-FR");
  const html=`<div class="hn-doc" id="hn-tableau" style="width:1123px;height:794px">${cadreSVG()}${blason()}
  <div class="t c" style="left:150px;top:150px;width:360px">République du Cameroun<small>Paix- Travail - Patrie</small>Région de l'Ouest<br>Délégation Régionale des<br>Enseignements Secondaires<div style="height:10px"></div>Délégation Départementale des<br>Hauts Plateaux</div>
  <div class="t b" style="left:170px;top:276px;width:200px;font-size:10.5px;text-align:center">LYCÉE DE BAHOUAN<div style="border-bottom:1px dashed #333;margin-top:6px;width:120px;margin-left:40px"></div></div>
  <div class="t c" style="left:612px;top:150px;width:360px">Republic of Cameroon<small>Peace- Work - Fatherland</small>West Region<br>Regional Delegation of<br>Secondary Education<div style="height:10px"></div>Divisional Delegation of<br>Upper Plateaux<div style="height:12px"></div>Government High School<br>Bahouan<div style="border-bottom:1px dashed #333;margin:6px auto 0;width:110px"></div></div>

  <div class="t fr" style="left:72px;top:330px">TABLEAU D'HONNEUR</div>
  <div class="t en" style="left:690px;top:333px"><span style="font-weight:normal">/</span>&nbsp; HONOUR ROLL</div>
  <div class="t b" style="left:72px;top:392px;font-size:12px">En vertu des pouvoirs qui lui sont conférés, le Conseil de Classe décerne le TABLEAU D'HONNEUR</div>
  <div class="t e" style="left:72px;top:410px;font-size:14px">By vertu of the power conferred on it, the class council awards an HONOUR ROLL</div>

  <div class="t b" style="left:72px;top:437px;font-size:16px">A l'élève :</div><div class="t e" style="left:72px;top:462px">To the student:</div>
  <div class="t bx" style="left:226px;top:442px;width:822px;height:50px;line-height:48px;font-size:22px;font-family:Arial">${el.nom}</div>

  <div class="t b" style="left:72px;top:507px;font-size:14px">de la classe de :</div><div class="t e" style="left:72px;top:525px">of Form:</div>
  <div class="t ul" style="left:222px;top:512px;width:128px">${p.classe}</div>
  <div class="t b" style="left:358px;top:518px;font-size:14px">pour son travail durant le :</div><div class="t e" style="left:358px;top:536px">for his/her performances during</div>
  <div class="t ul" style="left:588px;top:512px;width:118px">${p.trimestre}</div>
  <div class="t b" style="left:712px;top:518px;font-size:14px">Trimestre de l'année :</div><div class="t e" style="left:712px;top:536px">term of the school year</div>
  <div class="t ul" style="left:930px;top:512px;width:118px;font-style:normal;font-weight:bold">${p.annee}</div>

  <div class="t b" style="left:72px;top:575px;font-size:15px">Moyenne Obtenue:</div><div class="t e" style="left:72px;top:596px">Average scored</div>
  <div class="t bx" style="left:228px;top:572px;width:150px;height:36px;line-height:34px;font-size:19px">${fmt(el.moyenne)} /20</div>
  <div class="t b" style="left:388px;top:578px;font-size:15px">Position occupée:</div><div class="t e" style="left:388px;top:598px;left:420px">Rank</div>
  <div class="t b" style="left:640px;top:576px;font-size:21px">${rt}/</div><div class="t e" style="left:672px;top:602px">on</div>
  <div class="t b" style="left:712px;top:576px;font-size:21px">★ ${total}&nbsp; Élèves</div><div class="t e" style="left:742px;top:602px">Students</div>

  <div class="t ck" style="left:72px;top:640px">${felic?"":"✓"}</div>
  <div class="t b" style="left:134px;top:648px;font-size:16px">Avec ENCOURAGEMENTS</div><div class="t e" style="left:134px;top:668px;font-style:italic;font-family:Arial;font-size:11px">With CREDITS</div>
  <div class="t ck" style="left:372px;top:652px;width:48px">${felic?"✓":""}</div>
  <div class="t b" style="left:430px;top:664px;font-size:16px">Avec FÉLICITATIONS</div><div class="t e" style="left:430px;top:684px;font-family:Arial;font-size:11px">With DISTINCTIONS</div>

  <div class="t b" style="left:68px;top:712px;font-size:15px">Fait à :</div>
  <div class="t e" style="left:130px;top:712px;width:420px;border-bottom:1.5px dotted #333;font-size:16px">${FAIT_A}, le ${date}</div>

  <div class="t b" style="left:720px;top:700px;font-size:13px">LE CHEF D'ÉTABLISSEMENT</div>
  <div class="t b" style="left:720px;top:716px;font-size:13px">Président du Conseil de Classe</div>
  <div class="t e" style="left:720px;top:732px;font-family:Arial;font-size:12px">The Principal, President of the Class Council</div>
  ${SIGNATURE_IMG?`<img class="t" src="${SIGNATURE_IMG}" style="left:840px;top:610px;width:190px">`:`<svg class="t sceau" style="left:862px;top:560px" viewBox="0 0 150 150"><defs><path id="ar" d="M20 75a55 55 0 0 1 110 0"/><path id="br" d="M12 80a63 63 0 0 0 126 0"/></defs><circle cx="75" cy="75" r="68" fill="none" stroke="rgba(200,40,60,.6)" stroke-width="3"/><circle cx="75" cy="75" r="48" fill="none" stroke="rgba(200,40,60,.5)" stroke-width="1.5"/><text font-size="11" font-weight="bold" fill="rgba(200,40,60,.7)"><textPath href="#ar" startOffset="50%" text-anchor="middle">RÉPUBLIQUE DU CAMEROUN</textPath></text><text font-size="10" font-weight="bold" fill="rgba(200,40,60,.7)"><textPath href="#br" startOffset="50%" text-anchor="middle">LYCÉE DE BAHOUAN</textPath></text><text x="75" y="80" font-size="10" font-weight="bold" text-anchor="middle" fill="rgba(200,40,60,.7)">LE PROVISEUR</text></svg>`}
  </div>`;
  return{ok:true,html,rang,total,mention:felic?"Félicitations":"Encouragements"};
}

/* ======== API ======== */
const H = window.Honneur = { SEUIL_HONNEUR, SEUIL_FELICIT, SIGNATURE_IMG };
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
H.memeNom = (saisi, officiel) => { const a = norm(saisi).split(' ').filter(x => x.length > 1), b = norm(officiel).split(' ').filter(x => x.length > 1); return a.length > 0 && b.length > 0 && a.every(t => b.includes(t)) && b.every(t => a.includes(t)); };
H.trimestreDe = per => { per = per || ''; const m = /(\d)/.exec(per);
  if (/trimestre/i.test(per)) return /prem|1/i.test(per) ? 'Premier' : /deux|2/i.test(per) ? 'Deuxième' : 'Troisième';
  if (/^s[ée]q/i.test(per) && m) return ['Premier', 'Premier', 'Deuxième', 'Deuxième', 'Troisième', 'Troisième'][+m[1] - 1] || '';
  return 'Annuel'; };
H.libelleMoyenne = per => /trimestre/i.test(per || '') ? 'Moyenne du trimestre' : /^s[ée]q/i.test(per || '') ? 'Moyenne séquentielle' : 'Moyenne annuelle';
H.rang = (moy, cl) => (cl && Array.isArray(cl.moyennes) && moy != null) ? 1 + cl.moyennes.filter(m => m > moy + 1e-9).length : null;
H.mot = moy => moy == null ? '' : moy < 8 ? 'Ne vous découragez pas : avec du travail régulier et de l\'aide de vos professeurs, vous pouvez remonter.' : moy < 10 ? 'Vous êtes proche de la moyenne. Un dernier effort et vous y serez !' : moy < 12 ? 'Résultat passable. Continuez, vous avez la capacité de faire mieux.' : moy < 14 ? 'Bon travail, continuez ainsi : vous êtes au tableau d\'honneur avec encouragements !' : moy < 16 ? 'Très bon travail, félicitations ! Gardez ce rythme.' : 'Résultats remarquables, bravo pour votre excellence !';

/* tableau d'honneur : null si la moyenne est inférieure à 12 */
H.tableau = o => {
  if (o.moyenne == null || o.moyenne < SEUIL_HONNEUR) return null;
  const r = genererTableau({ nom: o.nom, moyenne: o.moyenne }, o.rang || 1, o.total || 1, { classe: o.classe, trimestre: H.trimestreDe(o.periode), annee: o.annee });
  return r.ok ? r.html : null;
};

/* Le bulletin de notes annuel est maintenant dans assets/bulletin.js (chargé après ce fichier). */
H.appreciation = n => n >= 20 ? 'Parfait' : n < 5 ? 'Très faible' : n < 8 ? 'Faible' : n < 10 ? 'Médiocre' : n < 12 ? 'Passable' : n < 14 ? 'Assez bien' : n < 16 ? 'Bien' : n < 18 ? 'Très bien' : 'Excellent';

/* affichage réduit à la largeur de l'écran */
H.monter = (zone, html, w, h) => {
  zone.innerHTML = html; const d = zone.firstElementChild, sc = Math.min(1, Math.min(zone.parentElement.clientWidth || 1e9, window.innerWidth - 24) / w);
  zone.style.cssText = 'width:' + w * sc + 'px;height:' + h * sc + 'px;margin:0 auto;overflow:hidden'; d.style.transformOrigin = 'top left'; d.style.transform = 'scale(' + sc + ')'; return d;
};
H.png = async (el, nom) => {
  if (!window.html2canvas) return alert('Téléchargement indisponible : connexion requise pour charger le module d\'image.');
  const old = el.style.transform; el.style.transform = 'none';
  try { const c = await html2canvas(el, { scale: 2, backgroundColor: '#fff' }); const a = document.createElement('a'); a.download = nom + '.png'; a.href = c.toDataURL('image/png'); a.click(); }
  catch (e) { alert('Téléchargement impossible.'); }
  el.style.transform = old;
};
H.imprimer = (html, paysage) => {
  const w = window.open('', '_blank'); if (!w) return alert('Autorisez les fenêtres pour imprimer.');
  w.document.write('<!doctype html><meta charset="utf-8"><title>Lycée de Bahouan</title><style>' + CSS + '@page{size:A4 ' + (paysage ? 'landscape' : 'portrait') + ';margin:0}body{margin:0}.hn-doc{zoom:' + (paysage ? '.9' : '.94') + '}</style>' + html);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
};
})();
