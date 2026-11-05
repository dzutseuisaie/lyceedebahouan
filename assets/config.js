/* ============================================================
   CONFIGURATION DU SITE - Lycée de Bahouan
   Tout ce qu'on peut changer se trouve ici.
   ============================================================ */
window.SITE = {
  /* Firebase (même projet que le portail scolaire) */
  firebase: {
    apiKey: "AIzaSyDmTwBSOe50pu9ZVK4CBkBdK1Gc16hTYZ8",
    authDomain: "bahouan-site.firebaseapp.com",
    projectId: "bahouan-site",
    storageBucket: "bahouan-site.appspot.com",
    messagingSenderId: "186639948385",
    appId: "1:186639948385:web:720da7e5e04e1842c1f639"
  },

  /* Cloudinary (envoi des images depuis admin-site.html) */
  assistant: { ageMin: 0 },   /* âge minimum de l'assistant du site (0 = ouvert à tous ; 18 = réservé aux adultes) */
  cloudinary: { cloudName: "dgrxxtmnz", uploadPreset: "preset_lycee" },

  /* VIDEO : mets ici le lien de la vidéo.
     - fichier envoyé dans le dossier videos/ : "videos/presentation.mp4"
     - lien YouTube : "https://www.youtube.com/watch?v=XXXX"
     - lien Vimeo   : "https://vimeo.com/XXXX"
     Laisse vide ("") pour masquer la vidéo.
     (admin-site.html > Informations générales peut aussi la changer.) */
  videoUrl: "videos/presentation.mp4",

  nom: "Lycée de Bahouan",
  adresse: "Village de Bahouan, arrondissement de Bamendjou, Région de l'Ouest, Cameroun",
  telephone: "+237696837926",
  telephoneAffiche: "+237 696 83 79 26",
  email: "dzutseuisaie@gmail.com",
  whatsapp: "https://wa.me/237696837926",
  facebook: "https://www.facebook.com/profile.php?id=100062984124125",
  horaires: "Lundi au vendredi, 7h30 à 16h30. Secrétariat ouvert le samedi de 8h00 à 12h00.",
  anneeScolaire: "",

  /* Classes (modifiable) */
  classes: ["Première C", "Première D", "Première A Espagnol", "Première A Allemand",
            "Terminale C", "Terminale D", "Terminale A Espagnol", "Terminale A Allemand"],

  /* Séries : C, D, AE (A Espagnol), AD (A Allemand). La série d'une classe est déduite de son nom
     (« Première A Espagnol » → AE). Chaque matière a une liste « s » des séries qui la suivent ;
     sans « s », elle est suivie par toutes les séries. */

  /* Présence : seuils d'absences (cumul sur l'année) qui déclenchent une sanction automatique */
  seuilsAbsences: { avertissement: 10, exclusion: 30 },

  /* Notifications hors application (téléphone fermé) : clé « Web Push » de Firebase
     (Firebase > Paramètres du projet > Cloud Messaging > Certificats Web Push > Générer une paire de clés).
     Laisser vide tant que les Cloud Functions (dossier functions/) ne sont pas déployées. */
  vapidKey: "",

  /* Matières des cours et épreuves. La clé + niveau (1 = Première, 2 = Terminale) donne l'identifiant
     enregistré dans Firestore (exemple : anglais1, anglais2, eleve-math1). Ne pas changer les clés. */
  matieres: [
    { k:"eleve-math", l:"Mathématiques", n:["Mathématiques"] }, { k:"physique", l:"Physique", n:["Physiques"], s:["C","D"] }, { k:"chimie", l:"Chimie", n:["Chimie"], s:["C","D"] },
    { k:"svt", l:"SVT", n:["SVT"], s:["C","D"] }, { k:"informatique", l:"Informatique", n:["Informatiques"] }, { k:"francais", l:"Français", n:["Littérature","Langue"] },
    { k:"anglais", l:"Anglais", n:["Anglais"] }, { k:"histoire", l:"Histoire", n:["Histoire/Géographie"] }, { k:"geographie", l:"Géographie", n:["Histoire/Géographie"] },
    { k:"philosophie", l:"Philosophie", n:["Philosophie"] }, { k:"ecm", l:"ECM", n:["ECM"] }, { k:"dessin", l:"Dessin", n:["Dessin"] }, { k:"eps", l:"EPS", n:["EPS"] }, { k:"tm", l:"Travail manuel", n:["TM"] },
    { k:"espagnol", l:"Espagnol", n:["Espagnol"], s:["AE"] }, { k:"allemand", l:"Allemand", n:["Allemand"], s:["AD"] }
  ],
  /* n = colonnes de la feuille de notes gérées par l'enseignant de cette matière */

  /* Matières notées et coefficients (même liste que l'ancien portail) */
  notesMatieres: [
    ["Mathématiques",4], ["Physiques",3], ["Chimie",4], ["Informatiques",3], ["Littérature",3], ["Langue",2],
    ["Anglais",2], ["Histoire/Géographie",4], ["Dessin",2], ["SVT",3], ["TM",2], ["Philosophie",3],
    ["ECM",2], ["EPS",2],
    ["Espagnol",2], ["Allemand",2]
  ],
  /* colonnes de notes réservées à certaines séries (les autres colonnes sont communes à toutes) */
  notesSeries: { "Physiques":["C","D"], "Chimie":["C","D"], "SVT":["C","D"], "Espagnol":["AE"], "Allemand":["AD"] },

  /* Examens proposés par défaut */
  examens: ["Séquence 1","Séquence 2","Séquence 3","Séquence 4","Séquence 5","Séquence 6","BEPC Blanc","Bac Blanc","Concours Interne","Concours Médecine","Concours ENSP","Concours IUT"],

  /* Emploi du temps : périodes de la journée */
  periodes: [
    ["1","8h00-8h50"], ["2","8h50-9h40"], ["3","9h40-10h30"], ["Récréation","10h30-10h50"],
    ["4","10h50-11h40"], ["5","11h40-12h30"], ["Pause","12h30-13h00"],
    ["6","13h00-13h50"], ["7","13h50-14h40"], ["8","14h40-15h30"]
  ],

  /* Chiffres affichés sur l'accueil (modifiables aussi dans admin-site.html) */
  stats: {
    terre: [
      { n: "1978", t: "Ouverture du CEG", d: "Les premières classes ouvrent à Bahouan." },
      { n: "1990", t: "Lycée bilingue", d: "Le CEG devient lycée bilingue en septembre 1990." },
      { n: "34", t: "Salles de classe", d: "Un bloc administratif et des salles spécialisées." }
    ],
    communaute: [
      { n: "4", t: "Séries proposées", d: "A, C, D et TI, avec un club d'orientation pour choisir." },
      { n: "2", t: "Langues d'enseignement", d: "Français et anglais, dans un lycée général bilingue." },
      { n: "5 j", t: "Par semaine", d: "Ouvert du lundi au vendredi, de 7h30 à 16h30." }
    ],
    numerique: [
      { n: "3", t: "Espaces en ligne", d: "Élève, parent et administration ont chacun leur espace." },
      { n: "SMS", t: "Résultats d'examens", d: "Par SMS ou via l'application Ayoba, avec le matricule." },
      { n: "1 / classe", t: "Groupe WhatsApp", d: "Chaque classe a son groupe pour rester informée." }
    ]
  },

  /* Direction et proviseurs : valeurs de départ. Le super administrateur les modifie dans
     Administration > Direction et proviseurs (enregistré dans Firestore, contenu_site/direction et contenu_site/proviseurs). */
  direction: {
    annee: "2024-2025",
    legendeProviseur: "Feugang Jean-Marie, proviseur depuis 2023",
    membres: [
      { f: "Proviseur", n: "Feugang Jean-Marie", g: "Direction" },
      { f: "Censeur du 1er cycle", n: "Mme Nguimfack Armelle", g: "Direction" },
      { f: "Censeur du 2e cycle", n: "M. Djomo Luc", g: "Direction" },
      { f: "Surveillant général", n: "M. Nguekam Thomas", g: "Direction" },
      { f: "Secrétaire", n: "Mme Fongang Laure", g: "Personnel" },
      { f: "Responsable informatique", n: "M. Tchouankeu Bertrand", g: "Personnel" },
      { f: "Responsable de l'orientation", n: "Mme Mekam Rosine", g: "Personnel" }
    ]
  },
  proviseurs: [
    { p: "2004-2008", n: "Jean Paul Wotadji" }, { p: "2008-2012", n: "Mendo Esther" }, { p: "2012-2016", n: "Kameni Ernest" },
    { p: "2016-2023", n: "Nkenfack Paul" }, { p: "Depuis 2023", n: "Feugang Jean-Marie" }
  ],

  /* Liste des images (nom, taille, emplacement) - utilisée par admin-site.html */
  images: [{"key": "logo", "w": 1280, "h": 1280, "desc": "[FIXE] Logo du lycée (déjà en place, ne pas changer)"}, {"key": "hero-accueil", "w": 1920, "h": 1080, "desc": "[PHOTO] Accueil : grande image du haut (sert aussi d'aperçu quand le site est partagé)"}, {"key": "theme-terre", "w": 1600, "h": 900, "desc": "[PHOTO] Accueil : panneau « Bahouan, notre terre de savoir »"}, {"key": "theme-communaute", "w": 1600, "h": 900, "desc": "[PHOTO] Accueil : panneau « Une communauté bilingue »"}, {"key": "video-poster", "w": 1600, "h": 900, "desc": "[PHOTO] Accueil : image affichée avant la lecture de la vidéo"}, {"key": "banniere-lycee", "w": 1920, "h": 600, "desc": "[PHOTO] Page Le lycée : bannière"}, {"key": "banniere-vie-scolaire", "w": 1920, "h": 600, "desc": "[PHOTO] Page Vie scolaire : bannière"}, {"key": "banniere-visite", "w": 1920, "h": 600, "desc": "[PHOTO] Page Visite : bannière"}, {"key": "lycee-batiment", "w": 1200, "h": 800, "desc": "[PHOTO] Page Le lycée : photo du bâtiment / de la cour"}, {"key": "lycee-chefferie", "w": 1200, "h": 800, "desc": "[PHOTO] Page Le lycée : photo liée à Bahouan et sa chefferie"}, {"key": "proviseur", "w": 600, "h": 750, "desc": "[PHOTO] Page Le lycée : portrait du proviseur"}, {"key": "vie-sport", "w": 1200, "h": 800, "desc": "[PHOTO] Page Vie scolaire : sport et gymnase"}, {"key": "vie-cantine", "w": 1200, "h": 800, "desc": "[PHOTO] Page Vie scolaire : cantine"}, {"key": "vie-bibliotheque", "w": 1200, "h": 800, "desc": "[PHOTO] Page Vie scolaire : bibliothèque"}, {"key": "vie-nkaing", "w": 1200, "h": 800, "desc": "[PHOTO] Page Vie scolaire : festival Nkaing"}, {"key": "admissions-secretariat", "w": 1200, "h": 800, "desc": "[PHOTO] Page Admissions : secrétariat / accueil"}, {"key": "cta-fond", "w": 1920, "h": 800, "desc": "[IA] Accueil : fond du bloc final (Se renseigner, Visiter, S'inscrire)"}, {"key": "valeur-discipline", "w": 900, "h": 1100, "desc": "[IA] Accueil / Valeurs : onglet Discipline"}, {"key": "valeur-assiduite", "w": 900, "h": 1100, "desc": "[IA] Accueil / Valeurs : onglet Assiduité"}, {"key": "valeur-respect", "w": 900, "h": 1100, "desc": "[IA] Accueil / Valeurs : onglet Respect"}, {"key": "valeur-excellence", "w": 900, "h": 1100, "desc": "[IA] Accueil / Valeurs : onglet Excellence"}, {"key": "valeur-communaute", "w": 900, "h": 1100, "desc": "[IA] Accueil / Valeurs : onglet Communauté"}, {"key": "valeur-culture", "w": 900, "h": 1100, "desc": "[IA] Accueil / Valeurs : onglet Culture"}, {"key": "banniere-admissions", "w": 1920, "h": 600, "desc": "[IA] Page Admissions : bannière"}, {"key": "banniere-academique", "w": 1920, "h": 600, "desc": "[IA] Page Académique : bannière"}, {"key": "banniere-valeurs", "w": 1920, "h": 600, "desc": "[IA] Page Valeurs : bannière"}, {"key": "banniere-actualites", "w": 1920, "h": 600, "desc": "[IA] Page Actualités : bannière"}, {"key": "banniere-contact", "w": 1920, "h": 600, "desc": "[IA] Page Contact : bannière"}, {"key": "banniere-anciens", "w": 1920, "h": 600, "desc": "[IA] Page Anciens : bannière"}, {"key": "banniere-familles", "w": 1920, "h": 600, "desc": "[IA] Page Espace familles : bannière"}, {"key": "banniere-calendrier", "w": 1920, "h": 600, "desc": "[IA] Page Calendrier : bannière"}, {"key": "banniere-equipe", "w": 1920, "h": 600, "desc": "[IA] Page Équipe pédagogique : bannière"}, {"key": "banniere-galerie", "w": 1920, "h": 600, "desc": "[IA] Page Galerie : bannière"}, {"key": "banniere-connexion", "w": 1920, "h": 600, "desc": "[IA] Page Connexion : bannière"}, {"key": "banniere-resultats", "w": 1920, "h": 600, "desc": "[IA] Page Résultats d'examens : bannière"}, {"key": "banniere-club", "w": 1920, "h": 600, "desc": "[IA] Page Club scientifique : bannière"}, {"key": "banniere-orientation", "w": 1920, "h": 600, "desc": "[IA] Page Orientation : bannière"}, {"key": "banniere-emploi", "w": 1920, "h": 600, "desc": "[IA] Page Emploi du temps : bannière"}, {"key": "banniere-reussite", "w": 1920, "h": 600, "desc": "[IA] Page Réussite : bannière"}, {"key": "banniere-faq", "w": 1920, "h": 600, "desc": "[IA] Page FAQ : bannière"}, {"key": "banniere-apropos", "w": 1920, "h": 600, "desc": "[IA] Page À propos du site : bannière"}, {"key": "banniere-confidentialite", "w": 1920, "h": 600, "desc": "[IA] Page Politique de confidentialité : bannière"}, {"key": "actualite-defaut", "w": 1200, "h": 800, "desc": "[IA] Actualités : image utilisée quand une actualité n'a pas de photo"}],
};

/* Bulletin de notes annuel (assets/bulletin.js) : tout est rempli automatiquement depuis la base ; ici seulement les réglages. */
window.SITE.bulletin = {
  section: 'FRANCOPHONE',
  specialites: { C: 'Mathématiques', D: 'SVTEEHB', AE: 'Espagnol', AD: 'Allemand' },   /* matière de spécialité imprimée selon la série */
  profs: {   /* facultatif : secours si la base n'a pas le professeur (clé = nom de la matière), ex. 'Mathématiques': 'M. DJOFACK' */ },
  profPrincipal: '',   /* signature écrite du professeur principal (texte, facultatif) */
  seuilsCompetences: [7.5, 10, 14],   /* < 7,5 Non acquises · < 10 A acquérir · < 14 En cours d'acquisition · sinon Acquises */
  decision: { passe: 12, conditionnel: 10 }   /* ≥ 12 passe · ≥ 10 « Redouble si échec » · sinon redouble */
};
