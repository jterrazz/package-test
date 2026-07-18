# Conventions `@jterrazz/test` — la constitution

Ce fichier tient les **principes** du framework : la philosophie, les canaux d'application, les critères non mécanisables, les règles de processus et les rationales de conception. Il est stable et écrit à la main.

Le **catalogue des règles mécanisées** — la formulation normative de chaque règle vérifiable — ne vit plus ici : il est **généré depuis le code** (`src/lint/manifest.ts`, où chaque règle porte son texte) dans [`/CONVENTIONS-CATALOG.md`](CONVENTIONS-CATALOG.md) et dans la table de [`docs/10-linting.md`](docs/10-linting.md). Le code est ainsi la source de vérité des règles mécaniques ; cette constitution est la source de vérité des principes. **Aucune duplication** : une règle vérifiable par une machine est décrite une seule fois, dans le code.

Objectif directeur : **la majorité de l'application des conventions doit être programmatique, pas de la revue manuelle.**

---

## Les canaux d'application

Chaque règle du catalogue nomme **un** canal. Quatre canaux, plus le meta-test transverse :

- **statique** — le plugin oxlint `@jterrazz/test/oxlint` (un `jterrazz/<règle>` par règle, analyse AST) plus l'étape « conventions checker » (`dist/checker.js`) pour les fichiers de données qu'oxlint ne visite pas.
- **checker** — les passes du même binaire qui lisent ce qu'oxlint ne peut pas : la grammaire de tokens des fixtures `expected/`/`requests/` (D4/D4b/D10) et les analyses cross-fichier (un `*.specification.ts` croisé avec ses tests, ou un arbre de feature entier : C9, B5 par inférence, A7).
- **runtime** — le framework refuse l'usage incorrect à l'exécution, là où l'analyse statique s'abstient (argument non littéral) ou ne peut pas atteindre (réseau, cycle de vie des conteneurs) : A6 ambigu, A7, B2, B6 injection, D7 intercepts stricts, I3 `.intercept()` en compose.
- **process** — jugement de revue, qu'aucun canal ne peut trancher seul : C1 regroupement par assets, D11 golden-file, K1 rétro-propagation.

Le canal **meta-test** double plusieurs de ces vérités en exécutant le framework sur lui-même : chaque token de `match.*` a ≥ 1 test positif et ≥ 1 négatif (`src/core/matching/`) ; toute fixture écrite par `TEST_UPDATE=1` repasse au run suivant ; le catalogue reste synchronisé avec le code (fraîcheur de génération, `src/lint/plugin.test.ts`).

Le **canal types** couvre ce que le système de types garantit sans règle dédiée (membres de trigger inconnus en C4, accesseurs en lecture seule en D1).

> Voir le catalogue complet — chaque règle, son canal, son implémentation et sa rationale — dans [`/CONVENTIONS-CATALOG.md`](CONVENTIONS-CATALOG.md).

---

## A. Runners — le modèle

Un runner est **déclaratif** : créé dans un fichier `*.specification.ts` sous `specs/`, via l'un de **trois** constructeurs (`specification.api(options)`, `specification.jobs(options)`, `specification.cli(bin, options)`), destructuré avec le nom canonique du constructeur, nettoyé par `afterAll(cleanup)`.

- `server` est requis sur `.api()` en mode node, ignoré en compose. `.jobs()` prend `jobs: (services) => JobHandle[]` (ou un tableau statique), n'a pas de serveur HTTP et ne lit jamais `TEST_MODE` : ses services démarrent toujours in-process via testcontainers. Le CLI est un binaire local. (A8)
- `mode` (`'node' | 'compose'`) n'existe que sur `.api()` ; le switch vit dans `vitest.config.ts`, jamais hardcodé dans un fichier de spec. Exception : une app non-Node (pas de `server`) où `mode: 'compose'` est permanent.
- `services` est un record nommé. Une clé se lie au service compose portant **exactement** son nom, sinon à sa **conversion kebab-case** (`analyticsDb` → `analytics-db`) ; `composeService:` reste l'échappatoire pour les noms non dérivables et prime. Un binding ambigu (les deux noms existent) est refusé.
- **Résolution du root** : remontée depuis le fichier de spec jusqu'au premier dossier contenant `docker/compose.test.yaml`, sinon `package.json`. `root` est un override, réservé aux cas que la convention ne couvre pas. Il a **un seul sens** : la racine du projet (détection compose + résolution du binaire testé) — ce **n'est pas** une racine de fixtures ; `.fixture()` résout ses chemins seul.

## B. Chaînes de spec — le modèle

Une chaîne = zéro ou plusieurs setups, puis **une** action terminale. Les bases sont reset au début de chaque chaîne : un spec ne dépend jamais d'un précédent. Il n'existe pas de mode « flow » — les scénarios séquentiels s'expriment par les seeds. (B1, B7)

- **Pas de label** : le nom du `test('…')` est l'unique description du comportement. (B3)
- Actions terminales par facette — `api` : `.request(file)`, `.get/.post/.put/.delete()` · `jobs` : `.trigger(name)` · `cli` : `.exec(args, options?)` (unique méthode d'exécution ; `options.waitFor`/`timeout` couvrent les processus longs — il n'y a pas de `.spawn()`). Setups — `.seed()` partout, `.headers()`/`.intercept()` sur api/jobs, `.fixture(path)`/`.env()` sur cli.
- **`.fixture(path)`** est l'unique verbe de copie de fixtures (il n'y a pas de `.project()`). Résolution : `$FIXTURES/…` vise le pool partagé `<specs-root>/fixtures/…` ; sinon le chemin est feature-local sous `<test-dir>/fixtures/`. Sémantique de copie (règle du slash final de rsync) : `dir/` déverse le contenu dans le cwd, `dir` copie en `<cwd>/<basename>`, un fichier copie par nom ; les `.fixture()` chaînés se superposent (le dernier écrase).
- Le mot **`job`** traverse toutes les couches sans traduction (facette `jobs`, `JobHandle`, `src/core/specification/jobs/`). Un `name` de job est un identifiant kebab-case stable — un contrat entre l'app et les tests. Pas de vocabulaire concurrent (`task`, `worker`, `cron`).

## C. Fichiers & dossiers — le modèle

```
specs/<facet>/                     # facette : api | jobs | cli | integrations | lint
├── <nom>.specification.ts         # ROOT de facette : le runner (nom canonique = nom de la facette)
└── <domain>/                      # un domaine = une commande / aire produit
    ├── <aspect>.test.ts           # 1..n fichiers de test par domaine (nom libre)
    ├── seeds/          # UNIQUEMENT des *.sql — l'état des bases
    ├── requests/       # *.http — entrées : requête COMPLÈTE (méthode, path, headers, body)
    ├── contracts/      # <nom>.<provider>.ts — interactions externes déclarées
    ├── intercepts/     # <provider>/<nom>.json — fixtures d'intercept inline (échappatoire)
    ├── fixtures/       # domain-local : copiés dans le cwd (mode cli) via .fixture('nom')
    └── expected/       # TOUS les attendus, À PLAT (incl. réponses .http) — un slash crée un sous-dossier
```

Le **pool partagé** de fixtures vit à `specs/fixtures/`, atteint via `$FIXTURES/`.

- **Le dossier suit les assets** (critère de regroupement, canal process — voir plus bas). La règle statique ne vérifie que la profondeur : un `*.test.ts` à la profondeur facet/domain, un `*.specification.ts` au root de la facette.
- **Taxonomie état — deux verbes disjoints** : `.seed()` porte l'état des bases (`*.sql`), `.fixture()` porte l'état des fichiers (arbre copié dans le cwd). Toute transformation voulue s'exprime dans la **forme** de l'arbre de fixtures ; il n'existe pas de « seed handler ». (C7)
- **`expected/` est plat**, l'extension fait partie du nom ; un slash organise en sous-dossier (`toMatch('build/verbose.txt')`), un snapshot d'arborescence est un dossier. Les fixtures de réponse sont des `.http` (`HTTP/1.1 <status>` en première ligne ; headers vérifiés en sous-ensemble). Les requêtes sont des `.http` (`MÉTHODE /path`). (C3, C5)

## D. Assertions — le modèle

Toutes les assertions passent par `expect()` (matchers `@jterrazz/test` auto-enregistrés, typés par sujet). Les accesseurs de résultat sont en **lecture seule** (`.text`, `.value`, `.files()`, `.stdout`, `.stderr`, `.container()`, `.file()`). (D1)

- Les opérations texte sont **fermées** sur `TextAccessor` — le handle universel. `.grep(pattern)` vit sur `TextAccessor` et **retourne** un `TextAccessor` (pas une string) : il est composable et snapshot-able, et préserve le contexte `expected/`. Il n'existe pas de `result.grep()` : la source est toujours explicite.
- **Résolution par sujet zéro** : `.request()` lit `requests/`, `toMatch(...)` lit toujours `expected/`. (D3)
- **Grammaire de tokens (D4)** — une seule grammaire, définie/testée/documentée dans le package, valable dans TOUS les fichiers de fixtures sous `expected/`. Vocabulaire figé : `{{uuid}}`, `{{ulid}}`, `{{iso8601}}`, `{{date}}`, `{{time}}`, `{{duration}}`, `{{number}}`, `{{int}}`, `{{float}}`, `{{semver}}`, `{{sha}}`, `{{hex}}`, `{{base64}}`, `{{port}}`, `{{ip}}`, `{{url}}`, `{{email}}`, `{{path}}`, `{{workdir}}`, `{{string}}`, `{{any}}` — capturable via `{{type#ref}}`. Côté code, le même vocabulaire via `match.*`. Portée des refs : le spec courant. Le vocabulaire est partagé avec le matcher runtime (`TOKEN_KINDS`), donc les canaux ne peuvent pas diverger.
- **Mise à jour** (`TEST_UPDATE=1` / `vitest -u`) : le framework écrit les **tokens**, pas les valeurs — les segments couverts par un placeholder existant sont préservés, `{{workdir}}` est substitué. (D5)
- **ANSI** strippé par défaut avant comparaison de stream (`.text` reste brut) ; `transform` ne subsiste qu'en échappatoire pour du bruit non couvert par les tokens. (D6)
- **Intercepts stricts (D7, runtime)** : dès qu'une chaîne api/jobs déclare un intercept, toute requête sortante non matchée fait échouer le spec. Une chaîne sans aucun intercept ne monte pas MSW — son réseau n'est pas gardé (périmètre assumé).

## E. Variables d'environnement du framework

Préfixe générique `TEST_` : `TEST_MODE` (`node` défaut | `compose`), `TEST_UPDATE` (`1`). Aucune autre variable user-facing n'est lue — seule exception `VITEST_POOL_ID` (isolation par worker, positionnée par vitest). Vérifié par un meta-test d'allowlist (`src/lint/env-allowlist.ts`).

## F. Imports & protection de la prod — le modèle

Tout s'importe depuis `@jterrazz/test` — les subpaths n'existent pas. **Exception sanctionnée :** `@jterrazz/test/oxlint`, subpath tool-facing zéro-runtime (le plugin oxlint et son fragment de config). Comme il ne charge aucun runtime, il est exempté de F1/F2 **depuis n'importe quel fichier** (un preset oxlint partagé peut le câbler). Le code de production n'importe jamais d'artefact de test ; dans un repo consommateur, `@jterrazz/test` n'est importable que depuis `specs/`, `*.specification.ts`, `*.test.ts`, `*.fixtures.ts`.

## G. Infrastructure

- `docker/compose.test.yaml` est la source de vérité de l'infra de test ; `docker/<service>/init.sql` s'exécute au démarrage du service. (G1)
- Isolation parallèle automatique par worker vitest : schéma cloné (postgres), index de base (redis), copie de fichier (sqlite), projet compose dédié (mode compose). (G2)
- Le CLI docker-aware déclare `docker: { envVar, nameLabel, testRunLabel }` ; le binaire testé appose `testRunLabel=<valeur de envVar>` sur chaque conteneur créé. (G3)

## H. Nommage — récapitulatif

| Chose                    | Règle                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Racine des specs         | `specs/` (`api/`, `jobs/`, `cli/`, `integrations/`, `lint/`, `fixtures/`)          |
| Pool de fixtures         | `specs/fixtures/` (partagé, via `$FIXTURES/`) · `<domain>/fixtures/` (local)       |
| Fichier de specification | `specs/<facet>/<nom>.specification.ts` (au root de la facette)                     |
| Instances                | `api`, `jobs`, `cli` — imposées par la destructuration                             |
| Fichier de test          | `specs/<facet>/<domain>/<aspect>.test.ts`                                          |
| Test de module           | `<fichier>.test.ts`, voisin de `<fichier>.ts` (sous `src/`)                        |
| Fixtures de module       | `<fichier>.fixtures.ts`, voisin du `.test.ts`                                      |
| Contrats                 | `contracts/<nom>.<provider>.ts`                                                    |
| Requêtes / Attendus      | `requests/<nom>.http` (entrées) · `expected/<nom>` (plat, extension incluse)       |
| Clés de services         | dérivent le service compose : nom exact, sinon kebab-case (sauf `composeService:`) |
| Env framework            | `TEST_MODE`, `TEST_UPDATE`                                                         |

## I. Architecture du code source — le modèle

Quatre couches sous `src/` : `core/` (zéro import externe), `integrations/` (**un dossier = une dépendance externe**), `vitest/` (tout le couplage au runner), `lint/` (couche tool-facing, zéro import runtime — le plugin oxlint bundlé en `dist/oxlint.js`). Les frontières et leurs edges sanctionnés (whitelist explicite à resserrer) sont enforced par `i1-layer-boundaries`. Les tests de module sont des **voisins** (`<fichier>.test.ts` à côté de `<fichier>.ts`, parité avec le `foo_test.go` de Go). Dans les tests de module, mocks et données sont du CODE (`mockOf`, `*.fixtures.ts`) — un test qui a besoin d'un vrai fichier ou d'une vraie infra est une spécification.

`.intercept()` n'existe que sur `api`/`jobs` (MSW in-process) et lève immédiatement en mode compose. (I3, runtime)

---

## Règles de processus (canal process)

Ces règles ne sont pas mécanisables — elles relèvent du jugement de revue. Elles sont listées au catalogue mais leur rationale complète vit ici.

### C1 — le dossier suit les assets

Critère de regroupement : un test qui possède **ses propres** dossiers d'assets (`fixtures/`, `expected/`, `seeds/`, …) a son **propre** dossier de domaine ; des tests **sans assets locaux** (ou partageant le pool `$FIXTURES/`) se regroupent en `<aspect>.test.ts` frères dans un dossier **groupe** nommé. Les deux formes sont légales — ce sont les assets qui tranchent ; un domaine naissant à un seul test est légitime. La règle statique `c1-domain-structure` ne vérifie que la profondeur.

### D11 — golden-file, pas grappe de grep

La sortie d'un outil (linter, compilateur, CLI produit) s'asserte en **snapshot complet par use case scopé**. Chaque cas a son **propre projet fixture** (ses petits fichiers valides/invalides) — la fixture EST le Given, aucun état `beforeAll` partagé — et l'assertion est le snapshot entier (`expect(result.stdout).toMatch('<use-case>.txt')` + `exitCode`), les parties volatiles couvertes par des tokens, généré via `TEST_UPDATE=1`.

`.grep()` / `toContain` restent le **scalpel** — des sondes ciblées, jamais le mode par défaut. Ils ne sont légitimes que pour :

- **(a)** les assertions d'**absence** ;
- **(b)** une sortie **coupée à un instant arbitraire** (`waitFor`, processus long) ;
- **(c)** les **sondes de logs de conteneurs** ;
- **(d)** l'assertion d'**ids de règles** dans les E2E lint (éviter le couplage au format exact d'un binaire tiers) ;
- **(e)** les sondes dans de la sortie **formatée par un tiers**.

Toute autre utilisation doit être convertie en snapshot complet. Un projet « kitchen-sink » unique + snapshot complet sert de filet de régression de toute la surface (il churne, c'est son rôle). Le canal statique ne peut pas distinguer un grep légitime d'un grep paresseux — d'où le canal process.

### K1 — rétro-propagation

Toute classe de défaut découverte (review, bug, migration) produit, **dans le même change**, la protection qui l'empêche de revenir : une règle statique, un meta-test, une erreur runtime — ou documente explicitement pourquoi aucun canal n'est possible (ex. « test redondant » = jugement humain). C'est la règle qui fait croître les trois autres canaux au lieu de les laisser pourrir. Quand une classe de défaut est mécanisable, sa règle rejoint `src/lint/manifest.ts` et le catalogue se régénère.

---

## Maintenir cette constitution

- Une nouvelle règle **mécanisable** s'ajoute au **code** (`src/lint/manifest.ts` + son implémentation), pas ici — puis `npm run docs` régénère le catalogue. Le meta-test de fraîcheur échoue si le catalogue committé n'est plus byte-identique.
- Un nouveau **principe** ou un critère non mécanisable s'ajoute ici, dans la section de sa famille ou en processus.
- Ne jamais dupliquer une règle mécanisée dans cette constitution : le code est sa source de vérité unique.
