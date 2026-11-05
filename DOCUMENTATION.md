# Documentation technique : site du Lycée de Bahouan

## 1. En bref
- Site 100 % statique (HTML + CSS + JavaScript). **Aucun serveur à installer, aucun PHP.**
- Données et connexions : **Firebase** (Authentication + Firestore). Images et fichiers : **Cloudinary**.
- Hébergement possible : GitHub Pages, Netlify, Firebase Hosting, cPanel (simple dépôt de fichiers).
- Lecture des fiches par caméra : **Tesseract.js** (chargé seulement quand on clique sur « Importer »).

## 2. Où est quoi
| Fichier / dossier | Rôle |
|---|---|
| `*.html` | Une page par rubrique (accueil, admissions, académique, espaces élève / parent, administration…) |
| `assets/config.js` | Réglages : clés Firebase, Cloudinary, liste des classes et des images modifiables |
| `assets/site.js` | Menu, pied de page, connexion à Firebase, chargement des images et des textes modifiables |
| `assets/auth.js` | **Session** : rôles (administrateur, enseignant, élève, parent), connexion, déconnexion |
| `assets/connexion.js` | Page de connexion (élève, parent, administration, demande d'accès enseignant) |
| `assets/lib.js` | Fonctions communes (notes, moyennes, listes) **et OCR** (caméra, lecture, rapprochement des noms) |
| `assets/eleve.js` / `parent.js` | Espace élève / espace parent |
| `assets/admin.js`, `admin2.js`, `admin3.js` | Administration (élèves, notes, annonces, messagerie, contenus, anciens…) |
| `assets/honneur.js` | Tableau d'honneur et bulletin |
| `assets/i18n.js`, `lang-en/es/de.js` | Traduction (voir §7) |
| `assets/extras.js`, `intro.js`, `home.js`, `anciens.js`, `apercu.js`, `faq-data.js` | Accessibilité et assistant, animation d'ouverture, accueil, anciens élèves, aperçu des fichiers, questions fréquentes |
| `firestore.rules` | **Règles de sécurité** de la base (à publier dans Firebase) |
| `sw.js`, `manifest.webmanifest` | Application installable et mode hors connexion |
| `SECURITE.txt` | Guide de mise en service (à suivre dans l'ordre) |

## 3. Rôles et accès
| Rôle | Comment il entre | Ce qu'il voit |
|---|---|---|
| Super administrateur | Compte Firebase + `admins/{uid}` avec `role = super` | Tout, y compris validation des enseignants et textes des pages |
| Administrateur | Compte Firebase + `admins/{uid}` avec `role = admin` | Toute l'administration |
| Enseignant | Demande d'accès, puis validation par le super administrateur (`enseignants/{uid}`) | Ses matières et ses salles |
| Élève | Inscription (compte), puis validation par l'administration (`eleves/{uid}`) | Son profil, ses notes, son bulletin |
| **Parent** | **Compte personnel** (`parents/{uid}`) puis **code de suivi de chaque enfant** | Notes, présence, messagerie de ses enfants |
| Ancien élève | Session anonyme après formulaire | Lien WhatsApp de sa promotion |

`auth.js` choisit le rôle à la connexion : administrateur, puis enseignant, puis **parent** (fiche `parents/{uid}`), sinon élève.

## 4. Données (collections Firestore)
- `eleves/{uid}` : fiche élève (nom, classe, année, matricule, `code` de suivi, `statut`).
- `suivi/{code}` : notes et présence publiées pour l'élève ; lisible par un utilisateur connecté qui connaît le code.
- `parents/{uid}` : `{ uid, nom, email, enfants:[{code, nom, classe}], createdAt }` (12 enfants maximum).
- `notes`, `absences`, `classements` : saisie et moyennes (administration et enseignants).
- `conversations/{code}/echanges` : messagerie parent/élève ↔ administration.
- `admins`, `enseignants`, `journal`, `contenu_site`, `annonces`, `actualites`, `evenements`, `galerie`, `anciens`, `temoignages`, `preinscriptions`, `demandes`… : contenus et gestion.
- La liste complète et les droits de chaque collection sont dans `firestore.rules` (tout est refusé par défaut).

## 5. Fonctionnement des principales fonctions
**Compte parent.** Connexion > Parent > créer le compte > « Mes enfants » > saisir le code de suivi (12 caractères). Le code est vérifié (le suivi doit exister), puis enregistré dans `parents/{uid}`. Un parent peut ajouter d'autres codes plus tard.

**Notes et moyennes.** Administration > Notes : choisir classe, année, matière > « Importer (caméra) » ou saisie à la main. Les moyennes pondérées (coefficients modifiables), mentions et rangs se calculent seuls ; le suivi est publié aux élèves et aux parents.

**OCR (lecture par caméra).** `lib.js` : photo → niveaux de gris et contraste → Tesseract (français) → chaque ligne « nom … note » est rapprochée des élèves de la classe (distance de Levenshtein). Les lignes sûres sont **enregistrées automatiquement** ; seules les lignes douteuses ouvrent une fenêtre de contrôle (`OCR.verifier`). Le texte manuscrit est moins bien lu que le texte imprimé.

**Images et fichiers.** Envoi direct vers Cloudinary (preset `preset_lycee`). Supprimer un contenu retire sa ligne de la base ; le fichier reste dans Cloudinary (suppression manuelle possible).

## 6. Mise en service (résumé)
1. Firebase : activer E-mail/Mot de passe, Google et Anonyme ; créer l'administrateur (`admins/{uid}`).
2. Publier `firestore.rules`.
3. Ajouter le domaine du site dans Authentication > Domaines autorisés.
4. Cloudinary : limiter le preset d'envoi (formats, taille, dossier).
5. Envoyer les fichiers sur l'hébergement. Détails : `SECURITE.txt`.

## 7. Ajouter ou compléter une langue
- Français : langue d'origine des pages. Anglais, espagnol, allemand : `assets/lang-en.js`, `lang-es.js`, `lang-de.js`.
- Chaque ligne `"texte français": "traduction",` remplace le texte correspondant. **Un texte absent reste en français** : on complète donc petit à petit.
- Nouvelle langue : copier un fichier `lang-XX.js` et ajouter la langue dans la liste `LANGS` de `i18n.js` avec `ok:true`.

## 8. Modifier le site sans casser
- Après une modification d'un fichier de `assets/`, changer le numéro `?v=` dans les pages HTML et la version `V` dans `sw.js` pour que les navigateurs prennent la nouvelle version.
- Toute nouvelle collection Firestore doit avoir ses règles dans `firestore.rules`.
- Les fichiers JS sont denses : chaque fichier commence par un commentaire qui dit ce qu'il fait, et chaque bloc `/* ---------- Titre ---------- */` marque une fonction.

## 9. Limites connues
- Un enseignant peut techniquement modifier des notes d'une autre matière de **sa** salle en contournant le site (correction complète : Cloud Function, offre Blaze).
- Lecture manuscrite par OCR : moins fiable que l'imprimé (les lignes douteuses sont toujours soumises à contrôle).
- Quotas gratuits Firebase (Spark) : à surveiller si l'effectif est grand.
- Traductions espagnol et allemand : menus, boutons, connexion, espaces élève et parent, formulaires (les longs textes de pages restent en français pour l'instant).
- Dossier `archives/` (ancien `rett/`) : anciens visuels non utilisés par le site, exclus du déploiement (`firebase.json`). Peut être supprimé.

## Ajouts v10
- `assets/notif.js` : notifications (envoi `Notif.envoyer`, cloche, notifications du téléphone). Collections : `utilisateurs/{uid}/notifs`, `familles/{code}/notifs`, `notifs_publiques`, `notifs_staff`, `appareils`.
- `functions/` : Cloud Functions d'envoi aux téléphones fermés (optionnel, offre Blaze). Voir `SECURITE.txt` section C.
- `assets/admin.js` (module Présence) : appel par numéros avec OCR (`L.ocr.analyserNumeros`), seuils `seuilsAbsences` dans `config.js`.
- `sw.js` : précache de toutes les pages et scripts, mise en réserve des bibliothèques externes, gestion des notifications push.
- `assets/site.js` : `enablePersistence` (copie locale Firestore), bandeau hors ligne, liste de classe en deux temps (Première A / Terminale A → Espagnol ou Allemand).
- `assets/i18n.js` et `lang-*.js` : nouveaux textes traduits (anglais, espagnol, allemand), dont les phrases à parties variables.


## Ajouts v11 : bulletin de notes annuel (assets/bulletin.js)
- **Nouveau bulletin** : reproduction fidèle du bulletin officiel (en-tête bilingue, logo, tableau Éval.1 à 6, profil de la classe, conduite, cachet). Il remplace l'ancien `H.bulletin` de `honneur.js`.
- **Rempli tout seul** depuis la base : nom, classe, année, âge, sexe, date de naissance, matricule, redoublant (fiche élève) ; matières de la série (Terminale C, A…) avec leurs coefficients ; notes ; moyennes, rangs et profil de la classe (collection `classements`) ; absences et sanctions (collection `absences`).
- **Mentions** : `L.mention` (lib.js) : 10-11 Passable · 12-13 Assez bien · 14-15 Bien · 16-17 Très bien · 18-19 Excellent · 20 Parfait. Message du chef d'établissement : `Honneur.mot`. Tableau d'honneur : seuil `SEUIL_HONNEUR` (honneur.js).
- **Notes par séquence** : dans Administration > Notes, le nouveau menu « Séquence » permet de saisir les Éval.1 à 6 (champ `seq` de la collection `notes`). « Note annuelle (unique) » garde l'ancien fonctionnement. Dès qu'il y a des séquences, la note annuelle d'une matière = moyenne de ses séquences ; `suivi.annees.<an>.seqs` et `classements.moySeq/moyTrim` (rangs par évaluation et par trimestre) sont publiés à la synchronisation.
- **Fiche élève** : nouveaux champs facultatifs `naissance`, `sexe`, `redoublant` (administration > Élèves). **Règles Firestore à republier** (`firestore.rules`).
- **Réglages** : bloc `SITE.bulletin` de `config.js` (noms des professeurs par matière, spécialité par série, seuils des compétences et de la décision, signature du professeur principal). Cachet : `SIGNATURE_IMG` de `honneur.js`.
- Après chaque modification des notes, cliquer sur « Publier » (synchronisation) pour mettre à jour les bulletins.

### Correctifs bulletin (v15)
- Toutes les classes CSS du bulletin sont préfixées `b-` : le site utilise déjà `.sub` pour son menu, ce qui cachait les lignes « Sous total » et décalait le tableau.
- **Spécialité** selon la série (réglable dans `SITE.bulletin.specialites`) : C = Mathématiques · D = SVTEEHB · A Espagnol = Espagnol · A Allemand = Allemand.
- **Redoublant** : détecté automatiquement (moyenne annuelle < 10 : Oui, sinon Non). Le champ manuel a été retiré de la fiche élève.
- **Notes par séquence** : Administration > Notes > choisir la **Séquence 1 à 6** (par défaut Séquence 1), remplir toutes les matières, la moyenne et le rang de la séquence se calculent avec les coefficients. À l'enregistrement, `suivi.annees.<an>.seqs` (notes), `seqMoy` (moyennes des 6 séquences) et `seqRang` (rangs) sont publiés et lus par le bulletin.

### Professeurs et matricule sur le bulletin (v16)
- **Nom du professeur** : à chaque synchronisation (« Enregistrer » dans Notes), l'administration publie dans `classements/<classe>_<année>.profs` le professeur de chaque matière : enseignants **validés** dont la liste de salles contient la classe. Un seul nom est affiché (« M. DJOFACK », « Mme TUEBOU ») ; un professeur qui enseigne deux matières apparaît sur les deux lignes. Le secours `SITE.bulletin.profs` (config.js) ne sert que si la base n'a pas le professeur.
- **Civilité** : nouvelle liste à l'inscription d'un enseignant (champ `civilite` : M. ou Mme). Pour les enseignants déjà inscrits, le bouton « Civilité » de la page Enseignants (administration) la change ; sinon elle est lue dans le nom s'il commence par M., Mme, Monsieur ou Madame.
- **Règles Firestore** : la liste des enseignants est lisible par l'administration (`allow list: if isAdmin()`), à republier.
- **Matricule** : celui de la fiche élève, tel quel. Le code d'accès de l'élève n'est volontairement jamais imprimé (c'est la clé de consultation de ses notes).

### 14 matières en Terminale C (v17)
- Ajout de **ECM** et **EPS** aux matières notées (coefficient 2 chacune, toutes séries), et des matières de cours « EPS » et « Travail manuel » (ECM reçoit sa colonne de notes). Terminale C / D : 7 littéraires (Langue, Anglais, Histoire/Géographie, Philosophie, Littérature, ECM, Informatique) + 4 scientifiques (Mathématiques, SVT, Chimie, Physique) + 3 complémentaires (EPS, Dessin, Travail manuel) = **14**. Terminale A : mêmes matières sans Chimie/Physique/SVT, avec Espagnol ou Allemand.
- Les coefficients se règlent par classe dans Notes (champ sous chaque matière). Un enseignant d'ECM, d'EPS ou de Travail manuel déjà inscrit : bouton « Modifier matières et salles » (page Enseignants) pour qu'il reçoive sa colonne de notes.

### Connexion élève avec Google (v18)
- **Cause du refus « Enregistrement impossible »** : un élève qui se connectait avec Google n'avait pas de fiche à son identifiant ; la lecture de cette fiche inexistante était refusée par les règles, le profil tombait alors dans un état « provisoire » dont l'enregistrement était lui aussi refusé. De plus, la fiche créée par l'administration (identifiant aléatoire) n'était jamais retrouvée.
- **Correction** : à la connexion, le portail cherche la fiche (1) à l'identifiant de l'élève, (2) déjà liée à son compte (`uid`), (3) créée par l'administration avec **son adresse Google** : elle est alors reprise (champ `uid` ajouté, statut et notes inchangés) et l'élève voit directement son espace, sans compléter son profil. Il ne complète son profil que s'il n'a aucune fiche.
- **À faire côté administration** : renseigner l'**adresse Gmail de l'élève** dans sa fiche (champ E-mail, enregistré en minuscules). **Republier `firestore.rules`.**
- Bouton « Connexion avec Google » avec le logo Google (élève et parent).

## Liste d'inscription par fiche de classe (v19)
- **Super administrateur** : Administration > Élèves > choisir la **classe** et l'**année** > « 📷 Importer la fiche de classe ». Filmer ou photographier la fiche (un nom par ligne, ordre alphabétique ; plusieurs pages possibles). Une fenêtre montre les noms lus **comme sur la fiche** : corriger, retirer les lignes inutiles (titre), ajouter un oubli, puis « Enregistrer les élèves ». Date de naissance, matricule et sexe sont repris s'ils figurent sur la fiche (sinon vides).
- Chaque nom devient un **élève validé** de la classe (code de suivi créé). Le numéro de l'élève est son rang alphabétique dans la classe ; un élève ajouté plus tard (OCR ou « Ajouter un élève ») se range à sa place. Notes, absences et bulletin s'enregistrent sur le nom, sans que l'élève ait de téléphone.
- **Inscription de l'élève** (connexion.html) : nom, prénom, classe, année, e-mail, mot de passe. Si le nom (ordre des mots, accents et majuscules sans importance) existe dans la liste de cette classe et de cette année, le compte est **relié à la fiche** : l'élève voit directement ses notes, absences, matricule ; il ne complète que l'e-mail et l'âge. Sinon : inscription normale, validée par l'administration. Même contrôle dans « Mon profil » pour la connexion Google.
- **Collection `roster/{clé}`** : `{ eleveId, nom, prenom, classe, annee }`. La clé est l'empreinte SHA-256 de (nom + classe + année) : lecture d'un document précis seulement, jamais de liste (règles Firestore). Boutons : « Publier la liste d'inscription » (élèves créés avant la v19), « Délier le compte » (rend la fiche réclamable à nouveau).
- **Une fiche ne se relie qu'une fois** (premier compte). Deux élèves de même nom dans une classe : ajouter le prénom pour les distinguer.
- **À faire** : republier `firestore.rules`, puis dans Élèves cliquer « Publier la liste d'inscription » pour chaque classe déjà saisie.

### Correctifs v19.1
- **Fiche de classe** : seules les lignes « numéro + nom » sont lues (titre, lycée, classe, totaux ignorés). Seuls le nom et le prénom sont enregistrés ; sexe, date de naissance et matricule restent vides.
- **Matricules** : bouton existant « Remplir les matricules manquants » (fiche avec noms et matricules).
- **Profil de l'élève** : après création du compte, ouverture directe sur « Mon profil » pour compléter sexe, date de naissance, âge, matricule. Nom, prénom, classe et année (venant de l'administration) ne sont plus modifiables par l'élève (les notes sont rangées sous ce nom).
- Les messages d'erreur d'enregistrement affichent le code Firebase réel (ex. `permission-denied`).

## v20 — OCR de l'emploi du temps et noms des professeurs sur le bulletin

**OCR emploi du temps** (administration → Emplois du temps) : choisir la classe, « 📷 Lire la fiche papier (OCR) », filmer la fiche.
La lecture repère les jours (colonnes) et les périodes (numéros ou horaires à gauche), puis remplit chaque case avec la matière reconnue.
Les cases douteuses sont en jaune ; rien n'est enregistré avant le clic sur « Enregistrer » (collection `emplois_du_temps`).
Limite : jours en colonnes uniquement (comme sur le site).

**Nom du professeur sur le bulletin** : l'administration publie, pour chaque classe, la liste « matière → nom » dans `profs_classes/{classe}`
à partir des enseignants validés (matières et salles choisies à l'inscription). Mise à jour automatique à chaque validation, modification
ou suppression d'un enseignant, et à l'ouverture de la page « Enseignants » (super administrateur).
**À faire après la mise à jour : déployer `firestore.rules`** (nouvelle règle `profs_classes`), puis ouvrir une fois « Enseignants ».


## v24 : planning synchronisé, codes parent à usage unique, assistant ouvert à tous les élèves
- **Planning personnel** : copie en ligne dans `utilisateurs/{uid}/planning/perso` (`{ json, maj }`), mise à jour en direct entre appareils ; la copie la plus récente gagne. Cause du bug précédent : le champ `planning_perso` était refusé par les règles de `eleves` (erreur avalée en silence).
- **Code parent à usage unique** : le super administrateur clique « Code parent » (Administration > Élèves). Document `codes_parent/{code}` : `{ suivi, nom, classe, cree, exp (7 jours), utilise, par }`. « Publier les codes parent » envoie à chaque élève (ayant un compte) son code dans `utilisateurs/{uid}/code_parent/actuel`, rubrique « Code parent » de l'espace élève ; l'élève le remet à son parent et peut en redemander un après expiration. Le parent le saisit une fois ; il est marqué utilisé et l'enfant est enregistré dans `parents/{uid}` dans le même lot (règles `lienParent`). L'enfant reste lié au compte pour toujours. Compte perdu : nouveau code.
- **Assistant** : réservé aux 18 ans et plus (`SITE.assistant.ageMin`). Élève : âge du profil ; parent et personnel : autorisés ; visiteur : confirmation.
- **Versions** : un seul numéro (`?v=24.0` dans les pages, `bahouan-v24.0` dans `sw.js`).
- **À faire** : republier `firestore.rules`.
- **IA** : la rubrique « Assistants IA » de l'espace élève et l'assistant du site sont ouverts aux élèves de tout âge (réglable : `SITE.assistant.ageMin`).
- **Appel par cours (enseignant)** : Mon espace > « Faire l'appel de mon cours » (rubrique Présence). Le professeur choisit sa salle, sa matière, l'horaire (début/fin) et la date, lit la liste des absents (OCR) ou saisit les numéros, puis enregistre. Chaque absence garde `matiere`, `debut`, `fin`, `prof` ; le suivi de l'élève et des parents les affiche. Règle : un enseignant n'enregistre que dans ses salles ET ses matières (`ensMatNom`). Le super administrateur garde la même rubrique (matière facultative). Chaque absence enregistrée compte pour 1 dans les seuils d'avertissement/exclusion (réglage `seuilsAbsences`).
