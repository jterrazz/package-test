import type { CatalogEntry } from '../manifest.js';
import type { RuleDoc } from '../rule-shape.js';

/**
 * The `self` rows that lock the architecture a facet is composed in — part of
 * the self catalogue (`self-manifest.ts` spreads them), kept beside the other
 * self tooling of that architecture, the compositions the matrix reads.
 */

/** The **statique** row: a rule of the `jterrazz-self` plugin. */
export const ARCHITECTURE_RULE_DOCS = {
    'i6-facet-is-composition': {
        audience: 'self',
        channel: 'statique',
        convention:
            'A facet file — `src/facets/<facet>/<facet>.facet.ts` — is a composition and nothing else: its imports, one `const composition = { … }` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported `defineFacet<…>()({ … })` — the definer handed nothing — whose `engines` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error. Nothing in them is written inline either: the composition lists by name setups and actions imported from `capabilities/` and `actions/`, and states each option as a matrix row of string literals; each adapter `engines` hands back is a name, a read of the config, or a constructor a seam under `seams/` exports, called on those; and every other member of the facet is a reference imported from its module. Every key of the composition, of its options and their rows, of the facet and of the adapters is a name written as it is, never a computed `[…]`. The constructor beside it, `<facet>.handle.ts`, starts the infrastructure and opens the facet: it never calls a step (`reduce`, `arm`, `perform`) of a definition imported from `capabilities/` or `actions/` — read off it by a written or a string key, through a namespace import, a cast or a `const` alias of it or of the step, destructured (a default included), off the facet’s composition, or through `call`/`apply`, wherever in the file the alias is declared — nor builds with `new` a result imported from `results/`, by name or through a namespace import. A step reaching the constructor any other way — a function parameter, a `bind`, a value it computes — is beyond the rule’s reach.',
        facet: 'model',
        family: 'I',
        fix: 'Move the logic to the capability, the action or the seam that owns it; the facet file lists definitions and wires engines, the constructor opens it.',
        id: 'I6',
        rationale:
            'A setup is defined once and composed by every facet that offers it; logic written in one facet file is a second definition of it, which the next facet does not share and the matrix cannot see.',
        reach: 'all',
    },
} satisfies Record<string, RuleDoc>;

/** The **meta** rows: what `lint/architecture.test.ts` holds. */
export const ARCHITECTURE_META_ROWS: CatalogEntry[] = [
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'The chain kernel and every setup load in a page: no module the facet definer (`src/facets/define-facet.ts`) or a module of a capability folder (`src/capabilities/<name>/`) reaches — through its value imports, its re-exports and every `import()` of a string literal, at any depth — imports a node builtin, or a package at all: the walk cannot follow a package into its own imports, so none is reached. An `import type` is erased and loads nothing; an import whose every name is inline-typed (`import { type X }`) still loads its module under `verbatimModuleSyntax`.',
        facet: 'model',
        family: 'I',
        fix: 'Put what needs the builtin or the package behind the port of the engine that owns it — an adapter under `src/seams/`, handed in by the facet — or import only its type.',
        id: 'I7',
        name: 'i7-kernel-loads-in-a-page',
        rationale:
            'The component facet composes the same kernel and setups inside a browser page, and I1 cannot see a builtin: it judges declared edges between trees and skips `node:*`, so one reached at any depth — directly, or inside a package — is a component chain that stops bundling.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'A definition is its folder. The folders of `src/capabilities/` are exactly the setups `SetupSignatures` names, `with`, and the options a route action takes, and the layer map declares the same ones; the layer map\u2019s action folders are exactly those the actions `ActionSignatures` names are placed in, and `src/actions/` holds no other. Every setup a `<name>.capability.ts` exports is named `<name>` and every action an `*.action.ts` exports is one its folder holds; each is tested beside its module, or claimed by a kind of `lint/siblingless-kinds.ts` that says what proves it instead, and a setup has a `<name>.port.ts` exactly when it arms an engine.',
        facet: 'model',
        family: 'I',
        fix: 'Name the definition for its folder, write its test beside it (or declare its kind in `lint/siblingless-kinds.ts` when no test can run it where it lives), and declare the port its `arm` goes through (or drop the port it does not use).',
        id: 'I8',
        name: 'i8-definition-is-its-folder',
        rationale:
            'A facet composes a setup by its definition and the chain calls it by its name: a folder, a name and a signature that disagree are three places to look for one setup, and an engine reached without a port is an adapter the definition knows.',
        reach: 'module',
    },
];
