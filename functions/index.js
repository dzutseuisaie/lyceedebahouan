/* Lycée de Bahouan - Cloud Functions : envoi des notifications sur les téléphones, même application fermée.
   Chaque nouveau document dans une des 4 collections de notifications déclenche un envoi (Firebase Cloud Messaging)
   aux appareils concernés, enregistrés dans la collection « appareils » (voir assets/notif.js).
   Nécessite l'offre Blaze de Firebase (le quota gratuit mensuel suffit largement pour un lycée).
   Déploiement : voir SECURITE.txt, section « Notifications téléphone fermé ». */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const REGION = { region: 'europe-west1' };

async function envoyer(tokens, d) {
  tokens = [...new Set(tokens)];
  for (let i = 0; i < tokens.length; i += 500) {
    const lot = tokens.slice(i, i + 500);
    const r = await admin.messaging().sendEachForMulticast({
      tokens: lot,
      notification: { title: String(d.titre || 'Lycée de Bahouan'), body: String(d.texte || '') },
      data: { lien: String(d.lien || 'index.html') },
      webpush: { fcmOptions: { link: String(d.lien || 'index.html') } }
    });
    /* jetons périmés : supprimés */
    const morts = [];
    r.responses.forEach((x, k) => { if (!x.success && x.error && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(x.error.code || '')) morts.push(lot[k]); });
    await Promise.all(morts.map(t => db.collection('appareils').doc(t).delete().catch(() => {})));
  }
}
const jetons = async q => (await q.get()).docs.map(d => d.id);

/* une personne (validation de compte…) */
exports.notifPersonnelle = onDocumentCreated({ document: 'utilisateurs/{uid}/notifs/{id}', ...REGION }, async e => {
  await envoyer(await jetons(db.collection('appareils').where('uid', '==', e.params.uid)), e.data.data());
});
/* un élève et ses parents (code de suivi) */
exports.notifFamille = onDocumentCreated({ document: 'familles/{code}/notifs/{id}', ...REGION }, async e => {
  await envoyer(await jetons(db.collection('appareils').where('codes', 'array-contains', e.params.code)), e.data.data());
});
/* annonces à tous ou à une classe */
exports.notifPublique = onDocumentCreated({ document: 'notifs_publiques/{id}', ...REGION }, async e => {
  const d = e.data.data(), c = String(d.cible || 'tous');
  const q = c.indexOf('classe:') === 0 ? db.collection('appareils').where('classes', 'array-contains', c.slice(7)) : db.collection('appareils');
  await envoyer(await jetons(q), d);
});
/* alertes pour l'administration : le rôle est VÉRIFIÉ dans admins/{uid}, jamais pris sur parole */
exports.notifPersonnel = onDocumentCreated({ document: 'notifs_staff/{id}', ...REGION }, async e => {
  const d = e.data.data(), snap = await db.collection('appareils').get(), ok = {}, tokens = [];
  for (const t of snap.docs) {
    const uid = t.data().uid; if (!uid) continue;
    if (!(uid in ok)) { const a = await db.collection('admins').doc(uid).get(); ok[uid] = a.exists ? (a.data().role === 'super' ? 'super' : 'admin') : ''; }
    if (ok[uid] === 'super' || (ok[uid] === 'admin' && d.pour !== 'super')) tokens.push(t.id);
  }
  await envoyer(tokens, d);
});
