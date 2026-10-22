# L'Atelier des enfants : mise en ligne

Ce dossier contient tout le site :

| Fichier | Rôle |
|---|---|
| `index.html` | Connexion des parents, puis « Qui joue aujourd'hui ? » |
| `jade.html` | L'atelier de Jade (CM2) |
| `mael.html` | La quête de Mael (CE1) |
| `histoires.html` | L'atelier d'histoires (IA) |
| `parents.html` | L'espace parents : suivi, carnet d'erreurs, invitation, sauvegardes |
| `config.js` | **À remplir** avec l'adresse et la clé de votre projet Supabase |
| `sync.js`, `portal.js`, `portal.css` | Code commun du site |
| `supabase/schema.sql` | La base de données, à coller une seule fois dans Supabase |
| `supabase/functions/story/index.ts` | La fonction qui écrit les histoires |

Comptez environ 30 minutes, une seule fois.

---

## Étape 1 : préparer la base Supabase

1. Ouvrez votre projet sur supabase.com. Vous pouvez aussi en créer un nouveau, nommé par exemple `atelier-enfants`, en région Europe.
2. Menu **SQL Editor** → **New query**.
3. Ouvrez `supabase/schema.sql`, copiez tout, collez, puis cliquez sur **Run**. Le message « Success » doit apparaître. Le script peut être relancé sans risque.
4. Menu **Authentication** → **URL Configuration** :
   - **Site URL** : l'adresse de votre site. Vous l'aurez à l'étape 3 ; revenez la remplir ensuite.
   - **Redirect URLs** : ajoutez la même adresse.

## Étape 2 : relier le site à la base

1. Dans Supabase : **Project Settings** → **API**.
2. Ouvrez `config.js` avec un éditeur de texte et remplacez :
   - `https://VOTRE-PROJET.supabase.co` par la **Project URL** ;
   - `VOTRE-CLE-ANON` par la clé **anon public**.

Cette clé « anon » est faite pour être visible dans un site web. Les données restent protégées : chaque parent ne peut lire et écrire que les données de sa propre famille. Ne mettez **jamais** la clé `service_role` dans ce fichier.

## Étape 3 : mettre le site en ligne avec GitHub Pages (gratuit)

1. Sur github.com → **New repository**, nommé par exemple `atelier-enfants`.
   - Avec un compte GitHub gratuit, GitHub Pages ne fonctionne qu'avec un dépôt **public**. Le code sera donc visible, mais il ne contient ni mot de passe ni données : les résultats des enfants restent dans Supabase, protégés.
   - Si vous préférez un dépôt **privé**, Cloudflare Pages ou Netlify (gratuits) savent publier un dépôt privé.
2. Dans le dépôt : **Add file** → **Upload files**, puis glissez **tout le contenu du dossier**. Cliquez sur **Commit changes**.
3. **Settings** → **Pages** → Source : *Deploy from a branch* → Branch : `main` / `(root)` → **Save**.
4. Après une minute environ, l'adresse s'affiche, par exemple `https://ldp-axel.github.io/atelier-enfants/`. Reportez-la dans Supabase (étape 1, point 4).

## Étape 4 : activer l'atelier d'histoires

Les histoires sont écrites par Claude, via l'API d'Anthropic.

1. Sur **console.anthropic.com** : créez une clé API et ajoutez un petit crédit, 5 € suffisent pour commencer. Une histoire coûte de l'ordre d'un centime avec le modèle par défaut.
2. Dans Supabase : **Edge Functions** → **Deploy a new function** → **Via Editor**.
   - Nom : `story` (exactement).
   - Remplacez le code par le contenu de `supabase/functions/story/index.ts`, puis **Deploy**.
3. **Edge Functions** → **Secrets** → ajoutez :
   - `ANTHROPIC_API_KEY` = votre clé ;
   - `STORY_MODEL` (facultatif) : le nom d'un autre modèle Claude si vous voulez changer. Par défaut, c'est `claude-haiku-5-5`. Si la console Anthropic indique que ce nom n'existe plus, mettez ici le nom actuel d'un modèle Haiku ou Sonnet.

## Étape 5 : premiers pas

1. Ouvrez l'adresse du site → **Créer mon compte parent**, avec votre e-mail et un mot de passe. Confirmez avec le lien reçu par e-mail, puis connectez-vous.
2. Cliquez sur **Créer la famille** : les profils Jade (CM2) et Mael (CE1) sont créés.
3. **Espace parents** → **Famille & sauvegarde** → invitez leur maman avec son adresse e-mail. Elle crée ensuite son compte sur la page d'accueil **avec cette même adresse** et rejoint automatiquement la famille.
4. Quand vos deux comptes existent, fermez les inscriptions : Supabase → **Authentication** → **Sign In / Providers** → désactivez **Allow new users to sign up**.

## Sur les tablettes des enfants

- Connectez-vous **une fois** avec un compte parent sur la tablette. La connexion reste active.
- Ajoutez le site à l'écran d'accueil : sur iPad, Partager → *Sur l'écran d'accueil* ; sur Android, menu ⋮ → *Ajouter à l'écran d'accueil*.
- Chaque réponse est enregistrée en ligne. Sans internet, l'atelier continue de marcher et envoie tout dès que la connexion revient. En bas de l'accueil de chaque atelier, un petit message indique « Sauvegardé en ligne ✓ ».
- Le code parent à 4 chiffres de chaque atelier protège les réglages contre les enfants. Il est propre à chaque atelier.

À noter : les étoiles gagnées dans les anciens fichiers HTML ne sont pas reprises automatiquement. Le site repart de zéro, parce qu'il a une adresse différente.

## Sauvegardes

- Dans l'**Espace parents**, vous pouvez télécharger à tout moment toutes les données en JSON, ou les réponses en tableau CSV pour Excel.
- La formule gratuite de Supabase ne fait pas de sauvegarde automatique quotidienne : téléchargez la sauvegarde complète de temps en temps, par exemple une fois par mois.

## Mettre à jour le site

Remplacez les fichiers modifiés dans le dépôt GitHub (**Add file** → **Upload files**), en gardant **votre** `config.js`. La mise à jour est en ligne en une minute environ.
