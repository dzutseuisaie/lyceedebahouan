/* Lycée de Bahouan - mode hors ligne.
   - À l'installation : toutes les pages, scripts et styles sont mis en réserve (précache).
   - Pages, scripts, styles : réseau d'abord (toujours à jour), copie locale si pas de connexion.
   - Images : copie locale d'abord, mise à jour en arrière-plan.
   - Bibliothèques externes (Firebase, lecture de fiches Tesseract) : mises en réserve à la première utilisation,
     puis disponibles hors ligne.
   - Firestore (notes, élèves…) : copie locale gérée par Firebase (enablePersistence, voir site.js).
   - Cloudinary : images mises en réserve au fil de la navigation. Jamais d'appel à l'API Firebase mis en cache ici. */
const V = 'bahouan-v24.0';
const PRECACHE = ['./', 'a-propos-du-site.html', 'academique.html', 'actualites.html', 'administration.html', 'admissions.html', 'anciens.html', 'calendrier.html', 'club_scientifique.html', 'connexion.html', 'contact.html', 'emploi.html', 'equipe.html', 'espace-eleve.html', 'espace-familles.html', 'espace-parent.html', 'faq.html', 'galerie.html', 'index.html', 'le-lycee.html', 'orientation.html', 'politique-confidentialite.html', 'resultats_examen.html', 'reussite.html', 'valeurs.html', 'vie-scolaire.html', 'visite.html', 'assets/admin.js', 'assets/admin2.js', 'assets/admin3.js', 'assets/anciens.js', 'assets/apercu.js', 'assets/auth.js', 'assets/config.js', 'assets/connexion.js', 'assets/eleve.js', 'assets/extras.js', 'assets/faq-data.js', 'assets/home.js', 'assets/honneur.js', 'assets/bulletin.js', 'assets/i18n.js', 'assets/intro.js', 'assets/lang-de.js', 'assets/lang-en.js', 'assets/lang-es.js', 'assets/lib.js', 'assets/notif.js', 'assets/parent.js', 'assets/site.js', 'assets/espace.css', 'assets/intro.css', 'assets/site.css', 'manifest.webmanifest', 'images/logo.jpg', 'images/logo-blanc.png', 'images/icon-192.png', 'images/icon-512.png'];
const EXTERNES = /^(www\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|tessdata\.projectnaptha\.com|res\.cloudinary\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});

const copie = (c, r, n) => { try { if (n && (n.ok || n.type === 'opaque')) c.put(r, n.clone()); } catch(e){} return n; };

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin !== location.origin) {
    if (!EXTERNES.test(u.hostname)) return;                        /* Firestore, Auth, etc. : jamais interceptés */
    e.respondWith(caches.open(V).then(c => c.match(r).then(m => {
      const f = fetch(r).then(n => copie(c, r, n)).catch(() => m);
      return m || f;                                                  /* réserve d'abord, mise à jour en arrière-plan */
    })));
    return;
  }
  const img = /\.(jpg|jpeg|png|webp|svg|mp4)$/i.test(u.pathname);
  if (img) {
    e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: true }).then(m => { const f = fetch(r).then(n => copie(c, r, n)).catch(() => m); return m || f; })));
  } else {
    e.respondWith(fetch(r).then(n => { if (n.ok) caches.open(V).then(c => c.put(r, n.clone())); return n; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined) || new Response('', { status: 504 }))));
  }
});

/* ---------- Notifications (application fermée) ---------- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch(x){ d = { notification: { title: 'Lycée de Bahouan', body: e.data ? e.data.text() : '' } }; }
  const n = d.notification || {}, x = d.data || {};
  const titre = n.title || x.titre || 'Lycée de Bahouan', corps = n.body || x.texte || '';
  e.waitUntil(self.registration.showNotification(titre, { body: corps, icon: 'images/icon-192.png', badge: 'images/icon-192.png', data: { lien: x.lien || (d.fcmOptions && d.fcmOptions.link) || 'index.html' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const lien = (e.notification.data && e.notification.data.lien) || 'index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) { if ('focus' in c) { c.focus(); if (c.navigate) c.navigate(lien).catch(() => {}); return; } }
    return self.clients.openWindow(lien);
  }));
});
