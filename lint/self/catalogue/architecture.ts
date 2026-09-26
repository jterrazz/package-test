import type { Row as CatalogueRow } from '../../engine/catalogue/row.js';
import type { SelfFamily } from './families.js';

type Row = CatalogueRow<SelfFamily>;

export const ARCHITECTURE_STATIQUE_RULES: Row[] = [
    {
        audience: 'self',
        channel: 'statique',
        convention:
            'A facet file — `src/facets/<facet>/<facet>.facet.ts` — is a composition and nothing else: its imports, one `const composition = { … }` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported `defineFacet<…>()({ … })` — the definer handed nothing — whose `drivers` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error. Nothing in them is written inline either: the composition lists by name setups and actions imported from a `*.capability.ts` or `*.action.ts` module, and states each option as a matrix row of string literals; each adapter `drivers` hands back is a name, a read of the config, or a constructor a driver module exports — under `world/`, or in a concept folder of the facet — called on those; and every other member of the facet is a reference imported from its module. Every key of the composition, of its options and their rows, of the facet and of the adapters is a name written as it is, never a computed `[…]`. The constructor beside it, `<facet>.handle.ts`, starts the infrastructure and opens the facet: it never calls a step (`reduce`, `arm`, `perform`) of a definition imported from a `*.capability.ts` or `*.action.ts` module — read off it by a written or a string key, through a namespace import, a cast or a `const` alias of it or of the step, destructured (a default included), off the facet’s composition, or through `call`/`apply`, wherever in the file the alias is declared — nor builds with `new` a result imported from a `*.result.ts` module or `expectations/`, by name or through a namespace import. A step reaching the constructor any other way — a function parameter, a `bind`, a value it computes — is beyond the rule’s reach.',
        facet: 'model',
        family: 'architecture',
        fix: 'Move the logic to the capability, the action or the driver that owns it; the facet file lists definitions and wires drivers, the constructor opens it.',
        name: 'facet-is-a-composition',
        rationale:
            'A setup is defined once and composed by every facet that offers it; logic written in one facet file is a second definition of it, which the next facet does not share and the matrix cannot see.',
        reach: 'all',
        severity: 'error',
    },
];

export const ARCHITECTURE_META_ROWS: Row[] = [
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'The chain kernel and every setup load in a page: no module of the chain kernel (`src/kernel/chain/`) or a setup module (`src/**/*.capability.ts`) reaches — through its value imports, its re-exports and every `import()` of a string literal, at any depth — imports a node builtin, or a package at all: the walk cannot follow a package into its own imports, so none is reached. An `import type` is erased and loads nothing; an import whose every name is inline-typed (`import { type X }`) still loads its module under `verbatimModuleSyntax`.',
        facet: 'model',
        family: 'architecture',
        fix: 'Put what needs the builtin or the package behind the port of the driver that owns it — an adapter a world area or the facet\u2019s own concept folder exports, handed in by the facet — or import only its type.',
        name: 'kernel-loads-in-a-page',
        rationale:
            'The component facet composes the same kernel and setups inside a browser page, and `import-within-declared-layers` cannot see a builtin: it judges declared edges between trees and skips `node:*`, so one reached at any depth — directly, or inside a package — is a component chain that stops bundling.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'A definition is its module. Every setup a `<name>.capability.ts` exports is named `<name>`, and every action an `*.action.ts` exports is one that file is listed for; the setups and the actions found under `src/` are exactly the ones the meta-test lists. Each is tested beside its module, or claimed by a kind of `lint/self/corpus/siblingless-kinds.ts` that says what proves it instead, and a setup has a `<name>.port.ts` beside it exactly when it arms a driver.',
        facet: 'model',
        family: 'architecture',
        fix: 'Name the definition for its module, write its test beside it (or declare its kind in `lint/self/corpus/siblingless-kinds.ts` when no test can run it where it lives), and declare the port its `arm` goes through (or drop the port it does not use).',
        name: 'definition-is-its-module',
        rationale:
            'A facet composes a setup by its definition and the chain calls it by its name: a module and a name that disagree are two places to look for one setup, and a driver reached without a port is an adapter the definition knows.',
        reach: 'module',
    },
];

export const ARCHITECTURE_PASSES: Row[] = [
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'The source root reads the sentence of a test: `src/` holds the node entry `index.ts`, the page entry `index.browser.ts`, the entry\u2019s test `index.test.ts`, the type channel `type-channel.test-d.ts`, and the six trees — `kernel/`, `world/`, `elements/`, `expectations/`, `facets/`, `vitest/` — and nothing else. An error at the stray entry.',
        facet: 'model',
        family: 'architecture',
        fix: 'Move the module into the tree whose concept it is — what is tested (`facets/`), what surrounds it (`world/`), how a screen is touched (`elements/`), how a result is judged (`expectations/`), the machinery (`kernel/`) or the runner config (`vitest/`).',
        name: 'source-root-holds-known-entries',
        rationale:
            'A module left at the root belongs to every tree and to none: the grab-bag the restructure dissolved (`surface.ts`, `settings.ts`) starts again as one file nobody owns.',
        reach: 'module',
        severity: 'error',
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'A facet never imports another: no production module under `src/facets/<a>/` names a module under `src/facets/<b>/`, types included. From outside a facet, a production module enters it by its face (`index.ts`, `index.browser.ts`); each other root file has its one reader — the project `vitest/`, the handle `facets/specification.ts`, the composition `lint/self/corpus/compositions.ts` — and a concept folder is never reached, but for the modules reached by one tree for their reason: the cli\u2019s literate plugin, which `vitest/` wires, and the route ratchet and the `.spec.yaml` grammar `lint/` reads with the runner. An error at the import.',
        facet: 'model',
        family: 'architecture',
        fix: 'Move what two facets share below the facets — to `kernel/`, `world/`, `elements/` or `expectations/` — and export what the entries publish from the facet\u2019s `index.ts`.',
        name: 'no-cross-facet-import',
        rationale:
            '`import-within-declared-layers` judges edges between layers and cannot tell one facet from another inside `facets/`: a facet reaching into a sibling is the coupling the slices exist to prevent, and a concept folder reached from outside is an internal that can no longer move.',
        reach: 'module',
        severity: 'error',
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'Each third-party library is imported — statically, dynamically or for a type — by exactly one slice: `webdriverio` by `facets/mobile/`, `playwright` by `facets/website/`, `react`, `react-dom`, `vite`, `@vitest/browser-playwright`, `vitest-browser-react` and `vitest/browser` by `facets/component/`, `hono` and `@hono/node-server` by `facets/api/`, `msw` by `world/stubs/network/`, `testcontainers` by `world/services/containers/`, `pg`, `redis` and `better-sqlite3` by their own `world/services/<db>/`, `vitest-mock-extended` by `world/mocks/`, `yaml` by `lint/engine/project/yaml-document.ts` and `oxc-parser` by `lint/engine/project/module-parser.ts`. A node builtin is no library ([ADR-009](decisions/009-node-builtins-are-not-libraries.md)): `node:child_process` is imported by the one module of each slice that owns the program it spawns — the subject binary by `facets/cli/process/`, `xcrun simctl` by `facets/mobile/server/`, `docker` by `expectations/command/docker-cli.ts`, `git` by `lint/engine/project/git-tree.ts`, and every process of `world/` by `world/services/process/serve.ts` — which review holds, not this pass. An error at the import.',
        facet: 'model',
        family: 'architecture',
        fix: 'Reach the library through the port its owner implements, handed in by the facet — or import only what the owner exports.',
        name: 'one-owner-per-library',
        rationale:
            'A library imported from two slices is two adapters of it that drift, and an optional peer loaded where its owner did not ask is a missing-peer refusal nobody wrote; the layer map declares packages per layer, too coarse to say which folder owns one.',
        reach: 'module',
        severity: 'error',
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'A folder under `src/` is named for a concept, never a role (`ports/`, `adapters/`, `capabilities/`, `actions/`, `results/`, `types/`, `utils/`, `helpers/`, `common/`, `lib/`, `core/`, `shared/`, `misc/`): the role rides on the file suffix (`*.port.ts`, `*.adapter.ts`, `*.capability.ts` …). It holds two entries or more — a lone file sits at its parent — and a facet with concept folders holds at its root its face alone: `index.ts` (and the component\u2019s `index.browser.ts`), `<facet>.facet.ts`, `<facet>.handle.ts`, `<facet>.project.ts` and their tests. Ground (`_fixtures/`, `_expected/`, `_requests/`, `_seeds/`) is exempt. An error at the folder, or at the stray file.',
        facet: 'model',
        family: 'architecture',
        fix: 'Name the folder for what its files are about, fold a lone file into its parent, and move a facet\u2019s other root files into the concept folder they belong to.',
        name: 'folder-named-for-a-concept',
        rationale:
            'A role folder gathers files by what they are, so one change opens five of them; a one-file folder is a name with nothing to group; and a facet root that grows loose files stops reading as its face.',
        reach: 'module',
        severity: 'error',
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'The folders of `lint/` import in the one direction [01 — Architecture](01-architecture.md#the-source-trees) draws, the same in every repository that keeps the tree — `engine/` imports no declaration, a consumer folder the catalogue and the engine alone, nothing shipped imports `self/` — and the shipped `lint/` imports nothing of `src/`: what both read lives in `lint/engine/`, or is composed by a `lint/` index — the runtime refusals by `lint/index.refusal.ts` — and `src/` imports those two alone. Tests are exempt. An error at the import.',
        facet: 'model',
        family: 'architecture',
        fix: 'Move what the importer needs into a folder it may import — a module both `lint/` and `src/` read into `lint/engine/`, or a declaration the product speaks into a `lint/` index that composes it — or move the importer up the tree.',
        name: 'lint-imports-follow-the-direction',
        rationale:
            '`import-within-declared-layers` sees `lint/` as one layer, so the engine reaching a rule, a check reaching a rule, or a shipped module typed against `self/` — erased at bundling, beyond the tarball proof — all passed it.',
        reach: 'module',
        severity: 'error',
    },
];
