import type { Row as CatalogueRow } from '../../engine/catalogue/row.js';
import type { SelfFamily } from './families.js';

type Row = CatalogueRow<SelfFamily>;

export const ARCHITECTURE_STATIQUE_RULES: Row[] = [
    {
        audience: 'self',
        channel: 'statique',
        convention:
            'A facet file — `src/facets/<facet>/<facet>.facet.ts` — is a composition and nothing else: its imports, one `const composition = { … }` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported `defineFacet<…>()({ … })` — the definer handed nothing — whose `adapters` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error. Nothing in them is written inline either: the composition lists by name setups and actions imported from a `*.capability.ts` or `*.action.ts` module, and states each option as a matrix row of string literals; each adapter that arrow hands back is a name, a read of the config, or a constructor an adapter module (`*.adapter.ts`) exports — under `world/`, or in a concept folder of the facet — called on those; and every other member of the facet is a reference imported from its module. Every key of the composition, of its options and their rows, of the facet and of the adapters is a name written as it is, never a computed `[…]`. The constructor beside it, `<facet>.handle.ts`, starts the infrastructure and opens the facet: it never calls a step (`reduce`, `arm`, `perform`) of a definition imported from a `*.capability.ts` or `*.action.ts` module — read off it by a written or a string key, through a namespace import, a cast or a `const` alias of it or of the step, destructured (a default included), off the facet’s composition, or through `call`/`apply`, wherever in the file the alias is declared — nor builds with `new` a result imported from a `*.result.ts` module or `expectations/`, by name or through a namespace import. A step reaching the constructor any other way — a function parameter, a `bind`, a value it computes — is beyond the rule’s reach.',
        facet: 'model',
        family: 'architecture',
        fix: 'Move the logic to the capability, the action or the adapter that owns it; the facet file lists definitions and wires adapters, the constructor opens it.',
        name: 'facet-is-a-composition',
        rationale:
            'A setup is defined once and composed by every facet that offers it; logic written in one facet file is a second definition of it, which the next facet does not share and the matrix cannot see.',
        reach: 'all',
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
        fix: 'Put what needs the builtin or the package behind the port of the adapter that owns it — an adapter a world area or the facet\u2019s own concept folder exports, handed in by the facet — or import only its type.',
        name: 'kernel-loads-in-a-page',
        rationale:
            'The component facet composes the same kernel and setups inside a browser page, and a builtin reached at any depth — directly, or inside a package — is a component chain that stops bundling. The layer map judges one edge at a time and lets a builtin through by choice: its package rules name the npm dependency types alone.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'A definition is its module. Every setup a `<name>.capability.ts` exports is named `<name>`, and every action an `*.action.ts` exports is one that file is listed for; the setups and the actions found under `src/` are exactly the ones the meta-test lists. Each is tested beside its module, or claimed by a kind of `lint/self/corpus/siblingless-kinds.ts` that says what proves it instead, and a setup has a `<name>.port.ts` beside it exactly when it arms an adapter.',
        facet: 'model',
        family: 'architecture',
        fix: 'Name the definition for its module, write its test beside it (or declare its kind in `lint/self/corpus/siblingless-kinds.ts` when no test can run it where it lives), and declare the port its `arm` goes through (or drop the port it does not use).',
        name: 'definition-is-its-module',
        rationale:
            'A facet composes a setup by its definition and the chain calls it by its name: a module and a name that disagree are two places to look for one setup, and an adapter reached without a port is an adapter the definition knows.',
        reach: 'module',
    },
];

export const ARCHITECTURE_PASSES: Row[] = [
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'The source root reads the sentence of a test: `src/` holds the node entry `index.ts`, the page entry `index.browser.ts`, the runner-config entry `index.vitest.ts`, the entries\u2019 tests `index.test.ts` and `index.vitest.test.ts`, the type channel `type-channel.test-d.ts`, and the six trees — `kernel/`, `world/`, `elements/`, `expectations/`, `facets/`, `vitest/` — and nothing else. An error at the stray entry.',
        facet: 'model',
        family: 'architecture',
        fix: 'Move the module into the tree whose concept it is — what is tested (`facets/`), what surrounds it (`world/`), how a screen is touched (`elements/`), how a result is judged (`expectations/`), the machinery (`kernel/`) or the runner config (`vitest/`).',
        name: 'source-root-holds-known-entries',
        rationale:
            'A module left at the root belongs to every tree and to none: the grab-bag the restructure dissolved (`surface.ts`, `settings.ts`) starts again as one file nobody owns.',
        reach: 'module',
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
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'The stubs are entered by what they publish: from outside `src/world/stubs/`, a production module imports `stub.ts`, `exchange.ts`, a module of `kinds/`, or `intercept/intercept.ts` or `intercept/intercept.capability.ts` — the entries (`index.ts`, `index.browser.ts`) also the `delivery/<channel>/intercept.ts` their channel picks, and a facet the delivery module it wires, each edge declared in `DELIVERY_READERS`. `matching/`, the rest of `intercept/` (the delivery port `intercept.port.ts` among it) and the rest of `delivery/` are reached from inside the stubs alone. An error at the import; a `DELIVERY_READERS` row whose reader no longer takes its edge, an error at the lock.',
        facet: 'model',
        family: 'architecture',
        fix: 'Import what the stubs publish; a facet that wires a delivery adapter declares the edge in `DELIVERY_READERS`, beside the pass.',
        name: 'stubs-reached-by-their-surface',
        rationale:
            'the layer map lets every facet reach all of `world/`, so the queue that matches a request and the msw server that serves it were one relative import away from any module: an internal reached from outside is one that can no longer move, and a delivery wired by a facet that never declared it is a second channel nobody chose.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'A module of `src/` that implements a port — the clock of a process or of a page, a page, a device, the disk — is an adapter, and carries the one suffix `*.adapter.ts`, named for what it adapts (`process-clock.adapter.ts`, `page-clock.adapter.ts`). Implementing is read off the module: a class whose `implements` names a `*Port` imported from a `*.port.ts`, or an object literal annotated with one or `satisfies` one; a delegate choosing between adapters implements the port too, and is one. Such an implementation outside a `*.adapter.ts` is an error at it; a module whose name carries `.driver` before its extension — the module, its test, type test, fixtures or browser entry, `.ts` or `.tsx` — is an error at its first line.',
        facet: 'model',
        family: 'architecture',
        fix: 'Rename the file `<what it adapts>.adapter.ts`, keeping its sibling kind and extension, and the paths that import it.',
        name: 'one-word-for-an-adapter',
        rationale:
            'Two suffixes for one role split every search in two: the reader looking for what implements a port opens the `*.adapter.ts` files and misses the half named `*.driver.ts`.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'checker',
        convention:
            "An error a user can cause — a verb misused, an option out of range, a path, a peer or a tool the machine lacks, a peer or a runtime breaking its own contract — is thrown as a refusal: `new Error(refusal(…))`, its four parts found · why · fix · read, the read a chapter heading written in place that exists (`docs/05-module-tests.md#time`) or a catalogue row. An error only the framework can cause, a broken internal invariant, is `invariant('<what broke>')`, whose message says the bug is the framework\u2019s. Any other construction of an error under `src/` — `new` on a built-in error class or on a class of `src/` that extends one, or a built-in called bare (`Error(…)`) — is an error at the construction, a stack read (`new Error().stack`) and tests excepted; a refusal reading a heading no chapter has, an error at its read.",
        facet: 'model',
        family: 'architecture',
        fix: "Throw `new Error(refusal({ found, why, fix, read }))` for what a user can cause, reading the heading that explains it (write that section where none does), and `invariant('<what broke>')` for what only the framework can.",
        name: 'error-is-a-refusal-or-an-invariant',
        rationale:
            'A message written by hand at the throw says what went wrong and stops: the reader is left to guess the law and the gesture, and a hundred of them drifted into a hundred shapes. Split in two declared forms, a refusal teaches its reader, and an invariant tells them the bug is not theirs to fix.',
        reach: 'module',
    },
];
