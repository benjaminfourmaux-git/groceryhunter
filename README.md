# Liste de courses du foyer — Guide d'installation pas à pas

Bienvenue ! Ce guide est écrit pour **une personne qui n'a jamais codé**. On va y aller
**très lentement**, en expliquant chaque mot et chaque clic. Tu n'as rien à comprendre à
l'avance : il suffit de suivre les étapes dans l'ordre.

À la fin, tu auras une **application de liste de courses** installée sur les téléphones de la
maison. Tout le monde voit la même liste, en temps réel. Quand quelqu'un part faire les courses,
il appuie sur un bouton : la liste se vide, passe dans l'historique, et les autres reçoivent une
notification.

- ⏱️ Compte environ **45 minutes** la première fois.
- 💳 C'est **entièrement gratuit**, sans carte bancaire.
- 🧑‍💻 Aucune compétence en programmation requise. On copie, on colle, on clique.

---

## 📖 Petit lexique (à lire une fois, en diagonale)

Pas besoin de tout retenir, c'est juste pour ne pas être perdu :

- **Terminal** : une fenêtre où l'on tape des commandes texte au lieu de cliquer. On va t'expliquer
  exactement où la trouver et quoi taper.
- **Node.js** : un logiciel gratuit à installer sur ton ordinateur. Il permet de « fabriquer »
  l'application à partir du code. On l'installe une fois et on l'oublie.
- **VS Code** : un éditeur de texte gratuit fait pour le code. Il regroupe au même endroit :
  les fichiers du projet, un terminal intégré, et de quoi éditer les fichiers. On va l'utiliser
  pour tout faire au même endroit (c'est le plus simple).
- **Supabase** : un service en ligne gratuit qui va stocker la liste et la synchroniser entre les
  téléphones. C'est le « cerveau » de l'app, hébergé sur internet.
- **Frontend** : l'application visible (ce que tu vois et touches à l'écran).
- **Déployer** : mettre quelque chose en ligne pour que ce soit accessible depuis internet.
- **`.env`** : un petit fichier texte où l'on range les « clés » de connexion à Supabase.
- **Clé / token** : un long mot de passe technique. On va faire des copier-coller, sans le retaper.

> 💡 Tout au long du guide, les blocs gris comme `ceci` sont des choses à copier-coller
> (commandes ou valeurs). Les **✅ Vérification** te disent à quoi reconnaître que ça a marché.

---

## 🧰 Ce qu'il te faut avant de commencer

1. Un ordinateur (Windows ou Mac).
2. Le dossier du projet (le fichier `.zip` que tu as reçu).
3. Une adresse e-mail, pour créer un compte Supabase gratuit.
4. (Plus tard, facultatif) un compte GitHub, gratuit aussi.

C'est tout. On installe le reste ensemble.

---

# PARTIE 1 — Préparer l'ordinateur

## Étape 1.1 — Décompresser le projet

1. Retrouve le fichier `liste-courses.zip` (sans doute dans ton dossier **Téléchargements**).
2. **Double-clique** dessus pour le décompresser (sur Windows : clic droit → « Extraire tout »).
3. Tu obtiens un dossier nommé **`liste-courses`**. Déplace-le quelque part de facile à retrouver,
   par exemple sur ton **Bureau**.

✅ **Vérification** : en ouvrant le dossier `liste-courses`, tu vois des fichiers comme
`package.json`, `index.html`, et des sous-dossiers `src` et `supabase`.

## Étape 1.2 — Installer Node.js

1. Va sur **https://nodejs.org**.
2. Clique sur le bouton de la version **LTS** (à gauche, la version « recommandée », stable).
3. Ouvre le fichier téléchargé et installe-le en cliquant **Suivant / Continuer** jusqu'au bout
   (les choix par défaut sont parfaits).

> ⚠️ Il faut **Node.js version 20 ou plus récente**. La version LTS actuelle convient largement.

✅ **Vérification** : on la fera juste après, dans le terminal.

## Étape 1.3 — Installer VS Code (notre « atelier »)

1. Va sur **https://code.visualstudio.com**.
2. Télécharge la version pour ton système (Windows ou Mac) et installe-la (choix par défaut).

Pourquoi VS Code ? Parce qu'il réunit **au même endroit** les fichiers du projet, un **terminal**
intégré (donc plus besoin de chercher « où taper les commandes »), et de quoi éditer les fichiers.

## Étape 1.4 — Ouvrir le projet dans VS Code

1. Ouvre **VS Code**.
2. Menu **Fichier → Ouvrir le dossier…** (sur Mac : **File → Open Folder…**).
3. Sélectionne le dossier **`liste-courses`** que tu as extrait, puis valide.
4. Si une fenêtre demande « Faites-vous confiance aux auteurs ? », réponds **Oui**.

À gauche, tu vois maintenant la liste des fichiers du projet. 🎉

## Étape 1.5 — Ouvrir le terminal intégré

C'est **ici** que se tapent toutes les commandes du guide.

1. Dans VS Code, menu **Terminal → Nouveau terminal** (ou **Terminal → New Terminal**).
2. Une zone s'ouvre en bas de l'écran. Le curseur clignote : tu peux y taper.

> 💡 Bonne nouvelle : ce terminal est **déjà placé dans le dossier du projet**. Tu n'as rien à
> faire pour « t'y rendre ».

**Vérifie que Node.js est bien installé.** Tape exactement ceci, puis appuie sur **Entrée** :

```bash
node -v
```

✅ **Vérification** : une ligne s'affiche, du type `v20.x.x` (ou un nombre plus grand). Si tu vois
une erreur « commande introuvable », ferme VS Code, rouvre-le, et réessaie. Sinon, reprends
l'étape 1.2.

## Étape 1.6 — Installer les pièces de l'application

Toujours dans le terminal, tape :

```bash
npm install
```

Appuie sur **Entrée**. Ça télécharge les composants nécessaires. **Patiente** : ça prend une à
deux minutes et affiche beaucoup de texte. C'est normal.

✅ **Vérification** : à la fin, ça revient à une ligne où tu peux retaper, avec un message du type
`added 359 packages`. Un nouveau dossier `node_modules` est apparu (c'est normal, ne le touche pas).

---

# PARTIE 2 — Créer le « cerveau » en ligne (Supabase)

Cette partie se fait **entièrement dans ton navigateur web**. Aucune commande ici.

## Étape 2.1 — Créer un compte et un projet

1. Va sur **https://supabase.com** et clique **Start your project** (ou **Sign in**).
2. Crée un compte (avec GitHub ou une adresse e-mail, au choix).
3. Une fois connecté, clique **New project**.
4. Remplis :
   - **Name** : un nom libre, par exemple `liste-courses`.
   - **Database Password** : clique le bouton qui en génère un automatiquement, puis **copie-le et
     colle-le dans une note** au cas où. (On ne s'en servira pas dans ce guide, mais il faut en
     mettre un.)
   - **Region** : choisis la plus proche de chez toi (par ex. « Central EU (Frankfurt) »).
5. Clique **Create new project**.

⏳ Le projet se prépare pendant **1 à 2 minutes**. Laisse l'onglet ouvert.

✅ **Vérification** : tu arrives sur le tableau de bord du projet (une barre de menus à gauche :
Table Editor, SQL Editor, Authentication, etc.).

## Étape 2.2 — Autoriser les « connexions anonymes »

L'app crée une identité automatique pour chaque téléphone, **sans mot de passe**. Il faut
l'autoriser.

1. Dans le menu de gauche, clique **Authentication**.
2. Cherche la section des fournisseurs de connexion (**Sign In / Providers**, ou **Providers**).
3. Trouve l'option **Anonymous sign-ins** (Connexions anonymes) et **active-la** (l'interrupteur
   passe au vert / « Enabled »).
4. S'il y a un bouton **Save**, clique-le.

✅ **Vérification** : l'option « Anonymous sign-ins » est marquée comme activée.

## Étape 2.3 — Créer les tables (le « plan » de la base de données)

1. Dans le menu de gauche, clique **SQL Editor**.
2. Clique **New query** (Nouvelle requête) : une grande zone de texte vide apparaît.
3. Reviens dans **VS Code**, ouvre le fichier `supabase/schema.sql` (dans la liste de gauche,
   déplie le dossier `supabase`, clique sur `schema.sql`).
4. Sélectionne **tout** son contenu : clique dans le fichier puis presse **Ctrl + A** (Mac :
   **Cmd + A**), puis **Ctrl + C** (Mac : **Cmd + C**) pour copier.
5. Retourne dans l'onglet Supabase, clique dans la zone vide, et colle avec **Ctrl + V**
   (Mac : **Cmd + V**).
6. Clique le bouton **Run** (en bas à droite, ou « RUN »).

✅ **Vérification** : un message vert « Success. No rows returned » (ou similaire) s'affiche.
Si tu cliques **Table Editor** à gauche, tu vois maintenant les tables `households`, `members`,
`items`, `shopping_trips`, `push_subscriptions`.

## Étape 2.4 — Récupérer les deux clés de connexion

1. Dans le menu de gauche, tout en bas, clique **Project Settings** (l'icône engrenage).
2. Clique **API** (ou **API Keys**).
3. Repère et garde sous la main deux valeurs (on les collera à l'étape suivante) :
   - **Project URL** : une adresse du type `https://abcdefgh.supabase.co`.
   - **anon public** : une très longue clé. C'est la clé « publique », **sans danger** à mettre
     dans l'application.

> ⚠️ Tu verras aussi une clé **service_role** (secrète). **Ne l'utilise jamais** dans l'application
> ni dans le fichier `.env`. On n'en a pas besoin ici. Garde-la privée.

✅ **Vérification** : tu as noté/copié l'**URL du projet** et la clé **anon public**.

---

# PARTIE 3 — Relier l'application à Supabase et la tester

## Étape 3.1 — Créer le fichier `.env`

Ce fichier range les clés de connexion. On va le créer dans VS Code.

1. Dans VS Code, dans la liste des fichiers à gauche, **clic droit** dans une zone vide →
   **Nouveau fichier** (New File).
2. Nomme-le exactement (le point au début est important, et il n'y a rien avant) :

   ```
   .env
   ```

3. Clique sur ce nouveau fichier `.env` pour l'ouvrir, et **colle dedans** ces trois lignes :

   ```bash
   VITE_SUPABASE_URL=colle-ici-l-URL-du-projet
   VITE_SUPABASE_ANON_KEY=colle-ici-la-cle-anon-public
   VITE_VAPID_PUBLIC_KEY=colle-ici-la-cle-vapid-publique
   ```

4. Remplace chaque `colle-ici-...` par la vraie valeur :
   - `VITE_SUPABASE_URL` → l'**URL du projet** (étape 2.4).
   - `VITE_SUPABASE_ANON_KEY` → la clé **anon public** (étape 2.4).
   - `VITE_VAPID_PUBLIC_KEY` → la **clé VAPID publique** (voir l'encadré ci-dessous).

   Il ne doit y avoir **ni espace ni guillemets** autour des valeurs. Exemple correct :
   `VITE_SUPABASE_URL=https://abcdefgh.supabase.co`

5. Enregistre : **Ctrl + S** (Mac : **Cmd + S**).

> 🔑 **Clés VAPID** (pour les notifications). Une paire a déjà été générée pour toi :
> - Clé **publique** (à mettre dans `.env`, ligne `VITE_VAPID_PUBLIC_KEY`) :
>   `BBIxHY3ozWOTx6wi8fY5G_v-aeBDclQPq-4igAo2-3F4UfI185SRNfGA5dxIII6CplJWc49tyw8tenWH-d3a-SE`
> - Clé **privée** (on s'en servira en PARTIE 5, à garder secrète) :
>   `eVbN6mmaBMQ7OuJZlQWEcLU5BXw29j9Ea9oGkBmZZ8Q`
>
> Si tu n'as pas encore les notifications en tête, tu peux mettre n'importe quoi sur cette ligne
> pour l'instant et y revenir : la liste fonctionnera quand même.
> ⚠️ Ces clés sont **personnelles**. Si un jour tu publies ce code en public (sur GitHub par
> exemple), régénère-les et ne partage jamais la clé privée.

✅ **Vérification** : le fichier `.env` contient trois lignes commençant par `VITE_`, avec tes
vraies valeurs après le `=`.

## Étape 3.2 — Lancer l'application sur ton ordinateur

Dans le terminal de VS Code, tape :

```bash
npm run dev
```

Appuie sur **Entrée**. Au bout de quelques secondes, une adresse s'affiche, du type
`http://localhost:5173/`.

**Ouvre cette adresse** : maintiens **Ctrl** (Mac : **Cmd**) et clique dessus, ou copie-la dans
ton navigateur.

✅ **Vérification** : l'application s'ouvre. Tu vois un écran d'accueil « Liste de courses » avec
deux onglets « Créer un foyer » et « Rejoindre ».

> Si tu vois un message d'erreur à la place :
> - « Configuration manquante » → ton `.env` est incomplet (reprends l'étape 3.1) et relance.
> - « Connexions anonymes désactivées » → reprends l'étape 2.2.
> - « Base non initialisée » → reprends l'étape 2.3.
> Après correction, dans le terminal appuie sur les touches `Ctrl + C` pour arrêter, puis retape
> `npm run dev`.

## Étape 3.3 — Faire un premier essai

1. Dans l'app, onglet **Créer un foyer**, mets ton prénom, un nom de foyer (ex. « Maison »), puis
   **Créer mon foyer**.
2. Ajoute quelques articles (« Lait », « Pain »…). Ils s'affichent dans la liste.
3. En haut, un **code** à 6 lettres est affiché : c'est lui que les autres saisiront pour rejoindre.

✅ **Vérification** : tu peux ajouter, cocher et supprimer des articles. 🎉 Le cœur de l'app
fonctionne déjà ! Pour l'instant, ça ne tourne que sur ton ordinateur ; les prochaines parties la
mettent en ligne et l'installent sur les téléphones.

> Pour arrêter l'aperçu local quand tu veux : dans le terminal, presse `Ctrl + C`.

---

# PARTIE 4 — Mettre l'application en ligne

Pour que les téléphones y accèdent, il faut l'héberger sur internet (gratuitement). On utilise
**Netlify** et sa méthode la plus simple : un **glisser-déposer**.

## Étape 4.1 — Fabriquer la version « finale » de l'app

Dans le terminal de VS Code (si `npm run dev` tourne encore, presse d'abord `Ctrl + C`), tape :

```bash
npm run build
```

Appuie sur **Entrée**. Ça crée un dossier **`dist`** dans le projet : c'est l'application prête à
être mise en ligne.

✅ **Vérification** : un message « built in … » s'affiche, et le dossier `dist` apparaît dans la
liste de gauche.

## Étape 4.2 — Publier sur Netlify

1. Va sur **https://app.netlify.com** et crée un compte gratuit (avec e-mail ou GitHub).
2. Cherche l'option pour déposer un site manuellement : **Add new site → Deploy manually**
   (ou rends-toi sur **https://app.netlify.com/drop**).
3. Ouvre le dossier `liste-courses` sur ton ordinateur, et **glisse-dépose le dossier `dist`**
   (celui créé à l'étape 4.1) dans la zone prévue sur la page Netlify.
4. Netlify met le site en ligne et te donne une **adresse** du type
   `https://nom-au-hasard-123.netlify.app`.

> 💡 Tu peux renommer cette adresse : dans Netlify, **Site configuration → Change site name**.

> ⚠️ **Important** : les notifications et l'installation sur téléphone exigent une adresse en
> **https://** (sécurisée). Netlify en fournit une automatiquement, tout est bon.

✅ **Vérification** : en ouvrant l'adresse `.netlify.app` dans ton navigateur, tu retrouves ton
application (avec le foyer et les articles déjà créés, puisque les données sont dans Supabase).

> 📝 **À chaque modification future** : refais `npm run build`, puis re-glisse le dossier `dist`
> dans Netlify (onglet **Deploys → Drag and drop**). (Une méthode automatique via GitHub existe ;
> elle est décrite tout en bas, en option.)

---

# PARTIE 5 — Activer les notifications (recommandé)

L'app marche déjà sans cette partie. Ici, on ajoute le « Quelqu'un fait les courses » qui prévient
tout le monde. **Tout se fait dans le navigateur**, sur le tableau de bord Supabase.

## Étape 5.1 — Créer la fonction qui envoie les notifications

1. Tableau de bord Supabase → menu de gauche → **Edge Functions**.
2. Clique **Deploy a new function** → choisis **Via Editor** (créer dans l'éditeur).
3. Donne-lui **exactement** ce nom (sinon l'app ne la trouvera pas) :

   ```
   go-shopping
   ```

4. Un éditeur de code s'ouvre avec un exemple. **Efface tout** son contenu.
5. Dans VS Code, ouvre le fichier `supabase/functions/go-shopping/index.ts`, sélectionne tout
   (**Ctrl + A**), copie (**Ctrl + C**).
6. Reviens dans l'éditeur Supabase, colle (**Ctrl + V**).
7. Clique **Deploy** (Déployer).

✅ **Vérification** : la fonction `go-shopping` apparaît dans la liste des Edge Functions.

## Étape 5.2 — Donner les clés VAPID à la fonction (les « secrets »)

La fonction a besoin de la **clé privée** pour envoyer les notifications. On la range dans les
secrets (jamais dans l'app visible).

1. Toujours dans **Edge Functions**, cherche l'onglet **Manage** puis **Secrets** (ou
   « Environment Variables » / « Secrets »).
2. Ajoute ces **trois** secrets (un par un : un **nom** à gauche, une **valeur** à droite) :

   | Nom | Valeur |
   |---|---|
   | `VAPID_PUBLIC_KEY` | `BBIxHY3ozWOTx6wi8fY5G_v-aeBDclQPq-4igAo2-3F4UfI185SRNfGA5dxIII6CplJWc49tyw8tenWH-d3a-SE` |
   | `VAPID_PRIVATE_KEY` | `eVbN6mmaBMQ7OuJZlQWEcLU5BXw29j9Ea9oGkBmZZ8Q` |
   | `VAPID_SUBJECT` | `mailto:ton-email@exemple.com` (mets ta vraie adresse) |

3. Enregistre (**Save**).

> ⚠️ Ces trois valeurs doivent correspondre à la clé publique mise dans `.env` à l'étape 3.1.
> Si tu as gardé celles fournies par défaut, tout concorde.

✅ **Vérification** : les trois secrets `VAPID_...` apparaissent dans la liste.

C'est fini côté Supabase : pas besoin de redéployer le site Netlify pour ça.

---

# PARTIE 6 — Installer l'app sur les téléphones

L'app s'installe **depuis le navigateur**, sans passer par un store. Utilise l'adresse
**`https://…netlify.app`** de la PARTIE 4.

## Sur Android (Chrome)

1. Ouvre l'adresse `https://…netlify.app` dans **Chrome**.
2. Menu **⋮** (trois points en haut à droite) → **Installer l'application** (ou « Ajouter à l'écran
   d'accueil »).
3. Confirme. Une icône apparaît sur l'écran d'accueil, comme une vraie app.

## Sur iPhone (Safari)

1. Ouvre l'adresse `https://…netlify.app` dans **Safari** (ça doit être Safari).
2. Appuie sur le bouton **Partager** (le carré avec une flèche vers le haut, en bas de l'écran).
3. Fais défiler et choisis **Sur l'écran d'accueil**, puis **Ajouter**.

> ⚠️ **Sur iPhone, c'est obligatoire** : les notifications ne fonctionnent **que** si l'app a été
> ajoutée ainsi à l'écran d'accueil (iPhone à jour, iOS 16.4 ou plus récent). Ouvrir le site dans
> Safari ne suffit pas pour les notifications.

## Pour chaque membre du foyer

1. Ouvre l'app **installée** (l'icône sur l'écran d'accueil).
2. La première personne **crée** le foyer et lit le **code** affiché en haut.
3. Les autres choisissent **Rejoindre**, saisissent ce **code** et leur prénom.
4. Dans l'app, appuie sur la **cloche** 🔔 (en haut à droite) et accepte les notifications.
   À faire **sur chaque téléphone**.

✅ **Vérification finale** : depuis un téléphone, ajoute un article → il apparaît sur les autres.
Appuie sur **« Je pars faire les courses »** → la liste se vide, passe dans l'**Historique**, et
les autres téléphones reçoivent une **notification**. 🎉 Bravo, tout est en place !

---

# (Option) PARTIE 7 — Empêcher la mise en pause automatique

Le projet Supabase gratuit se met en **pause après 7 jours sans activité** (il faut alors le
réveiller à la main). Si le foyer s'en sert régulièrement, ça n'arrive presque jamais. Pour être
tranquille pendant les périodes creuses (vacances…), ce projet inclut un « réveil » quotidien
automatique via GitHub. C'est **facultatif**.

1. Crée un compte gratuit sur **https://github.com** et un nouveau dépôt (**New repository**).
2. Envoies-y le contenu du dossier `liste-courses` (le plus simple : **GitHub Desktop**,
   https://desktop.github.com, qui se fait par glisser-déposer et clics).
3. Sur la page du dépôt GitHub : **Settings → Secrets and variables → Actions → New repository
   secret**. Ajoute deux secrets :
   - `SUPABASE_URL` → l'URL de ton projet (étape 2.4).
   - `SUPABASE_ANON_KEY` → ta clé anon public (étape 2.4).

Le fichier `.github/workflows/keepalive.yml` (déjà inclus) s'occupera du reste : il « pingue »
Supabase chaque jour.

> 💡 Bonus : si tu as mis le projet sur GitHub, tu peux relier ce dépôt à Netlify (**Add new site →
> Import an existing project**). Netlify reconstruira et republiera tout seul à chaque modification
> envoyée sur GitHub — plus besoin de refaire `npm run build` ni le glisser-déposer.

---

# 🆘 En cas de problème

- **« Configuration manquante »** au lancement → le fichier `.env` est absent ou incomplet
  (étape 3.1). Vérifie qu'il n'y a ni espace ni guillemets, puis relance `npm run dev`.
- **« Connexions anonymes désactivées »** → étape 2.2 non faite.
- **« Base non initialisée »** → le `schema.sql` n'a pas été exécuté (étape 2.3).
- **`npm` ou `node` « commande introuvable »** → Node.js n'est pas (bien) installé : reprends
  l'étape 1.2, puis ferme et rouvre VS Code.
- **La page reste blanche après le déploiement Netlify** → vérifie que tu as bien glissé le dossier
  **`dist`** (et pas le dossier `liste-courses` entier).
- **Pas de notification sur iPhone** → l'app doit être **installée** via « Sur l'écran d'accueil »
  (pas seulement ouverte dans Safari), et la cloche activée. iOS 16.4 minimum.
- **Pas de notification ailleurs** → vérifie la PARTIE 5 : fonction `go-shopping` déployée, et les
  trois secrets `VAPID_...` bien renseignés.
- **Quelqu'un ne voit pas la liste des autres** → il a rejoint un **autre** foyer. Tout le monde
  doit utiliser le **même code** de foyer.

---

# 📋 Aide-mémoire des commandes

Toutes se tapent dans le **terminal de VS Code**, dans le dossier du projet :

```bash
node -v        # vérifier que Node.js est installé (doit afficher v20 ou plus)
npm install    # installer les composants (une seule fois, au début)
npm run dev    # lancer l'app en local pour la tester (Ctrl + C pour arrêter)
npm run build  # fabriquer la version finale (dossier dist/) à mettre en ligne
```

---

## Structure du projet (pour info)

```
liste-courses/
├── index.html
├── package.json            # liste des composants et des commandes
├── vite.config.js          # réglages de l'app + PWA
├── .env                    # TES clés (à créer, étape 3.1 — jamais partagé)
├── .env.example            # modèle du fichier .env
├── public/                 # icônes de l'app
├── src/                    # le code de l'application visible
│   ├── App.jsx             # logique principale
│   ├── index.css           # apparence (style type Tricount)
│   ├── components/         # les morceaux d'écran (liste, historique, etc.)
│   └── lib/                # connexion Supabase, notifications
└── supabase/
    ├── schema.sql          # à exécuter dans Supabase (étape 2.3)
    └── functions/
        └── go-shopping/    # la fonction des notifications (étape 5.1)
```

Bon courage — en suivant les parties dans l'ordre, tu ne peux pas te tromper. 💚
