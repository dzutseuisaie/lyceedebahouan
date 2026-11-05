/* Lycée de Bahouan - petit cadre d'aperçu pour chaque fichier (1re page du PDF, image, Google Drive, autres).
   Utilisation : window.apercuHtml(url, nom) renvoie un cadre ; le contenu se remplit tout seul quand il apparaît à l'écran. */
(function(){
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function genre(url){
  const u = String(url || ''), bas = u.split('?')[0].toLowerCase();
  let m = u.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) || u.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([^&#]+)/);
  if (m) return { t: 'drive', src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
  m = u.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([^/?#]+)/);
  if (m) return { t: 'drive', src: 'https://docs.google.com/' + m[1] + '/d/' + m[2] + '/preview' };
  if (/\.pdf$/.test(bas)) return { t: 'pdf' };
  if (/\.(jpe?g|png|gif|webp|avif|svg)$/.test(bas) || /\/image\/upload\//.test(u)) return { t: 'image' };
  const e = (bas.match(/\.([a-z0-9]{2,5})$/) || [])[1];
  return { t: 'autre', ext: (e || 'fichier').toUpperCase() };
}

window.apercuHtml = function(url, nom){
  if (!url) return '';
  const g = genre(url);
  return '<a class="apercu" data-apercu="' + esc(g.t) + '" data-url="' + esc(url) + '"' + (g.src ? ' data-src="' + esc(g.src) + '"' : '') + (g.ext ? ' data-ext="' + esc(g.ext) + '"' : '') +
    ' href="' + esc(url) + '" target="_blank" rel="noopener" title="Ouvrir ' + esc(nom || 'le fichier') + '" aria-label="Aperçu de ' + esc(nom || 'le fichier') + '"><span class="ap-att">…</span></a>';
};

let pdfPret = null;
function chargerPdfJs(){
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfPret) pdfPret = new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = PDFJS; s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); } catch(e){ ko(e); } }; s.onerror = ko; document.head.appendChild(s);
  });
  return pdfPret;
}
const icone = (el, texte) => { el.classList.add('ap-icone'); el.innerHTML = '<span class="ap-ext">' + esc(texte) + '</span>'; };

async function remplir(el){
  if (el.dataset.fait) return; el.dataset.fait = '1';
  const t = el.dataset.apercu, url = el.dataset.url;
  if (t === 'drive') { el.innerHTML = '<iframe src="' + esc(el.dataset.src) + '" loading="lazy" tabindex="-1" scrolling="no" referrerpolicy="no-referrer" title="Aperçu"></iframe>'; return; }
  if (t === 'image') { const i = new Image(); i.loading = 'lazy'; i.alt = ''; i.src = url; i.onerror = () => icone(el, 'IMG'); el.innerHTML = ''; el.appendChild(i); return; }
  if (t === 'pdf' && /res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) {
    const mini = url.replace('/image/upload/', '/image/upload/pg_1,w_400,c_limit,f_jpg,q_auto/').replace(/\.pdf(\?.*)?$/i, '.jpg');
    const i = new Image(); i.loading = 'lazy'; i.alt = ''; i.src = mini; i.onerror = () => { el.dataset.fait = ''; el.dataset.apercu = 'pdfjs'; remplir(el); }; el.innerHTML = ''; el.appendChild(i); return;
  }
  if (t === 'pdf' || t === 'pdfjs') {
    try {
      const lib = await chargerPdfJs(), pdf = await lib.getDocument({ url }).promise, page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 }), echelle = (el.clientWidth || 200) * (window.devicePixelRatio || 1) / base.width, vp = page.getViewport({ scale: echelle });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      el.innerHTML = ''; el.appendChild(c);
      if (pdf.numPages > 1) { const b = document.createElement('span'); b.className = 'ap-pg'; b.textContent = pdf.numPages + ' pages'; el.appendChild(b); }
    } catch(e){ icone(el, 'PDF'); }
    return;
  }
  icone(el, el.dataset.ext || 'FICHIER');
}

const obs = 'IntersectionObserver' in window ? new IntersectionObserver(l => l.forEach(x => { if (x.isIntersecting) { obs.unobserve(x.target); remplir(x.target); } }), { rootMargin: '200px' }) : null;
function balayer(racine){ (racine.querySelectorAll ? racine.querySelectorAll('.apercu[data-apercu]:not([data-fait]):not([data-obs])') : []).forEach(el => { el.dataset.obs = '1'; obs ? obs.observe(el) : remplir(el); }); }
new MutationObserver(l => l.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('.apercu[data-apercu]')) { n.dataset.obs = '1'; obs ? obs.observe(n) : remplir(n); } else balayer(n); } }))).observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => balayer(document)); else balayer(document);
})();
