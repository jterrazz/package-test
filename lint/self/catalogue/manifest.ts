import { consumerRows } from '../../consumer/catalogue/manifest.js';
import { ordered } from '../../engine/catalogue/row.js';
import type { Row as CatalogueRow } from '../../engine/catalogue/row.js';
import {
    ARCHITECTURE_META_ROWS,
    ARCHITECTURE_PASSES,
    ARCHITECTURE_STATIQUE_RULES,
} from './architecture.js';
import type { SelfFamily } from './families.js';

type Row = CatalogueRow<SelfFamily>;

/** No published entry imports this module: the published bundles read `consumerRows` alone. */

/** A self rule has no row in the public catalogue, so its message routes here. */
export const SELF_CHAPTER = 'docs/03-testing.md';

export const SELF_STATIQUE_RULES: Row[] = [
    {
        audience: 'self',
        channel: 'statique',
        convention:
            "From `specs/`, a relative import resolving into the framework's INTERNALS — this repository's `src/{kernel,world,elements,expectations,facets,vitest}/` — is an error: a spec of the framework reaches it through `@jterrazz/test`, as a consumer does. A spec importing its own app's source is allowed (the documented pattern), and a `@jterrazz/test/<subpath>` import is `no-unpublished-subpath`'s. No folder exception: a probe that cannot reach its subject through the public entry is a module test beside its module, not a spec.",
        facet: 'model',
        family: 'imports',
        fix: 'Reach the framework through `@jterrazz/test` (`src/index.js`), or move the probe beside the module it covers.',
        name: 'no-framework-internals',
        rationale:
            'Specifying the framework through its public surface keeps its specs decoupled from its internal paths; those folder names are its layers in this repository alone, so the rule holds this package and nobody else.',
        reach: 'specs',
        severity: 'error',
    },
    ...ARCHITECTURE_STATIQUE_RULES,
];

export const SELF_CHECKER_PASSES: Row[] = [
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'A spec of a SPECIMEN, and every file of the component tree, is filed by the capability it specifies. A `.spec.ts` whose runner drives an app under `<specs>/_shared/_fixtures/` — a specification module it imports a runner from, one that module imports a runner from, or the spec itself when it builds its runner inline, names the shared fixtures in a literal: a file inside a specimen’s folder — the app module, the binary, the script a command runs — or the folder itself as the root a `server: { command }` of the runner it feeds runs from, whether the literal is written in the call or in a `const` the call names (a root alone is where the services read their ground, and no app) — or an integration spec importing the module of the shared fixtures its chains call, specifies the framework, not that app, and sits one folder below its facet, in a folder the capability matrix names for that facet’s column (`<specs>/api/seed/<aspect>.spec.ts`), one file per aspect of the capability. The vocabulary is closed: each capability the matrix declares for the column, the words before its first parenthesis kebab-cased (`.seed()` → `seed`, `toMatch(file())` → `to-match`, `.exitCode` → `exit-code`); a capability of another column is no folder of this facet (`appium` is mobile’s, never `cli/appium/`). A first-level folder that is no facet has no column, and takes a capability of any. `one-subject-per-spec` and `spec-in-subject-folder` leave such a spec alone. The component facet’s own tree is the fixture app its tests render, and it is filed the same way: every `.ts` and `.tsx` under `<specs>/component/` — a rendered unit, the hook or DOM function a test hosts, the `.test.tsx` beside it, the project’s frame — sits one folder below it, in a folder the matrix names for the `component` column, the capability its test specifies (`<specs>/component/intercept/post-table.tsx`). An error at the file’s first line of code, where a reasoned `checker-disable-next-line specimen-filed-by-capability` above it silences it.',
        facet: 'model',
        family: 'layout',
        fix: 'Move the file to `<specs>/<facet>/<capability>/<aspect>.spec.ts`, the capability it asks about, named as the matrix names it in that facet’s column — a component and its test together to `<specs>/component/<capability>/`.',
        name: 'specimen-filed-by-capability',
        rationale:
            'A specimen exists to exercise the framework, and its routes are nobody’s product: filed by the route, the framework’s own specs read as an app’s, and the reader looking for what `.seed()` promises opens a folder named for a URL. The component tree is a specimen too, and flat it answers the same question only by opening every test.',
        reach: 'specs',
        severity: 'error',
    },
    ...ARCHITECTURE_PASSES,
];

/** The guards that keep the other six channels honest; none reaches a consumer. */
export const META_ROWS: Row[] = [
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every environment variable the framework reads is on the allow-list, and a dynamic read carries its sanction comment.',
        facet: 'model',
        family: 'setup',
        fix: 'Add the variable to `env-allowlist.ts`, or read it through the option that already exists.',
        name: 'environment-read-allow-listed',
        rationale:
            'An env read nobody declared is a behaviour a consumer cannot see, cannot set, and cannot turn off.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every rule id cited in `docs/**`, `skills/**`, `README.md` or a rule message resolves to a catalogue row.',
        facet: 'model',
        family: 'catalogue',
        fix: 'Cite a row that exists, or write the row.',
        name: 'cited-rules-exist',
        rationale:
            'A chapter citing "rule X" that resolves to nothing is worse than silence: the reader goes looking for a guard that was never written.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            "Every diagnostic's `read:` part is its own row's heading, generated from the row, and the heading exists in the generated chapter.",
        facet: 'model',
        family: 'catalogue',
        fix: 'Let `lessonsAt()` write the `read:` part; never type one.',
        name: 'message-reads-its-row',
        rationale:
            'The anchor is the only route most readers ever take into the catalogue, and forty hand-written tails drifted the first time a heading moved.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every message a static rule, a checker pass or a runtime refusal of the catalogue prints teaches in four parts, in this order — `found:` the finding located, `why:` the convention in one sentence, `fix:` the gesture for this case, `read:` the chapter anchor; a message that lacks a part, leaves one empty or garbles their order is refused.',
        facet: 'model',
        family: 'catalogue',
        fix: "Write the message as its `found` and its `fix` — `lessonsAt()` in a rule, the finding's two fields in a checker pass, `refusal()` in the runtime — and let the row give the `why` and the `read`.",
        name: 'message-has-four-parts',
        rationale:
            'A message is the only page of the catalogue most readers see: one that names the fault without its reason or its gesture sends the reader to the chapter for what the line could have said.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every REACH a row can state is proven on one fixture project laid out with every path role, by at least one rule of that reach, judged by a single oxlint run.',
        facet: 'model',
        family: 'catalogue',
        fix: 'Add the path to the reach fixture and state what each rule says about it.',
        name: 'every-reach-proven',
        rationale:
            'A stated reach nothing checks is a sentence: the gates that drifted from their rows were the ones no fixture ever put a file in front of.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'No catalogue sentence has gone back to French — a deny-list of the tokens the manifest actually carried.',
        facet: 'model',
        family: 'catalogue',
        fix: 'Write the row in English, like every sentence the catalogue publishes.',
        name: 'catalogue-in-english',
        rationale:
            "A message a consumer's CI prints and a chapter their agent reads are not a private notebook, and a half-translated catalogue is worse than either.",
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'A source module with no `<file>.test.ts` beside it falls into one declared kind, and the kind states where its proof is instead.',
        facet: 'model',
        family: 'layout',
        fix: 'Write the sibling test, or write the kind that claims it and the one line saying what covers it.',
        name: 'siblingless-module-declared',
        rationale:
            '`test-beside-its-module` says a module test lives beside its module; it never said every module has one. What was missing is the list of the ones that do not, and why.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every capability a facet DECLARES — a constructor option, a setup, a terminal action, a verb, a result accessor, a golden kind, a `{{token}}` family — is exercised by at least one of the package\u2019s own test files in that facet, or its row names the reason it is not.',
        facet: 'model',
        family: 'catalogue',
        fix: 'Write the spec, or state the reason on the capability row — a blank cell says nothing and a zero with no reason is a surface nobody holds.',
        name: 'every-capability-exercised',
        rationale:
            'A suite proves what it runs, never what it does not: a facet can grow a method and be green forever without one test touching it.',
        reach: 'specs',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every coordinate the corpus writes resolves: a relative link lands on a file and its anchor on a heading of that file, and every `docs/NN` a source comment cites names a chapter that exists.',
        facet: 'model',
        family: 'catalogue',
        fix: 'Point the link at the heading as it is now written, or restore the heading it named.',
        name: 'links-resolve',
        rationale:
            'A renamed heading leaves a link that scrolls nowhere and a renumbered chapter one that 404s.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            "No spec, module test or fixture server of this package reads a port it was handed (`process.env.PORT`, `$PORT`): a server a spec starts binds port 0 and announces the port it got, which the process reads through its `ready` banner. A server a container image runs (a folder holding a `Dockerfile`) owns its container's ports and is out of reach, and so is `src/world/services/process/serve.test.ts`, the proof of the framework's PORT form, whose children report the port they were handed and never bind it.",
        facet: 'model',
        family: 'world',
        fix: 'Bind port 0, print the port the OS gave, and declare `ready: /listening on port (\\d+)/`.',
        name: 'server-binds-port-zero',
        rationale:
            'A port picked, released, then bound is a window another server of the same run can take: `make check` failed twice on a spec reaching a stranger on the port it was handed, and passed on the rerun.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'A lint-rule document — under `specs/lint/`, less the fixtures another document feeds a violation through — that asserts a failing `exit:` also goldens `stdout:` or `stderr:`: the report that says WHICH rule fired, not only that one did.',
        facet: 'model',
        family: 'expectations',
        fix: 'Golden the run’s report beside its `exit:`.',
        name: 'lint-document-goldens-the-report',
        rationale:
            'An exit code alone proves a rule ended the run, never which one: a document pinned to it keeps passing once the wrong rule starts firing for the wrong reason.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every catalogue row declares its audience — `consumer`, what a project using the package meets, or `self`, this package’s own suite discipline — and lives in the manifest of its audience, and the tarball exposes no `self` rule, read as `npm pack` writes it and extracted: no byte of it — bundle, chunk, type, page, manifest — names a self row by its name or its code, nor the `jterrazz-self` plugin; every target the `exports` map publishes but a type and a JSON file is a `.js`, `.cjs` or `.mjs` module, so none is left unloaded; no module the `exports` map publishes, loaded under each condition node loads, carries at any depth a rule object whose `meta.docs` says `self` or a key or string naming a self row; no bin it publishes prints a self pass’s finding over that pass’s fixtures; no packed chunk is one only an unpacked bundle loads, no packed bundle imports a module the tarball lacks, and none cites a page the tarball leaves out; no row of the runtime, type or upstream channel is `self`, and no row of the meta channel is `consumer`, every refusal the runtime raises being a consumer row read at a heading of the catalogue.',
        facet: 'model',
        family: 'catalogue',
        fix: 'State the audience on the row, and wire a self rule in `lint/self/rules/plugin.ts` or `lint/self/checks/checker.ts` — never in `lint/consumer/rules/plugin.ts` or `lint/consumer/checks/checker.ts`.',
        name: 'rule-declares-its-audience',
        rationale:
            'A rule only this package is held to, once shipped, runs in every consumer’s tree: `specimen-filed-by-capability` would file their specs by a capability matrix they do not have, and `no-framework-internals` would refuse a consumer’s own `src/model/`.',
        reach: 'all',
    },
    ...ARCHITECTURE_META_ROWS,
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every constructor has a `specs/<facet>/` tree in this package. Two subjects are proven differently, each with its reason stated: `component` is a CHAIN, not a constructor, and is proven beside its fixture app under `specs/component/`; `mobile` is proven against a double of the Appium protocol in every run, because CI provisions no simulator, and the same specs against a real one by `make test-mobile`.',
        facet: 'model',
        family: 'setup',
        fix: 'Specify the facet on the package itself before a rule presumes it.',
        name: 'every-constructor-has-specs',
        rationale:
            'A facet the framework never ran against itself is a surface nobody has met, and a seam is proven before the rule that presumes it.',
        reach: 'all',
    },
];

export const SELF_PROCESS_RULES: Row[] = [
    {
        audience: 'self',
        channel: 'process',
        convention:
            'Every defect class discovered produces, in the same change, the guard that stops it coming back (a static rule, a meta-test or a runtime error) — or documents why no channel can hold it.',
        facet: 'model',
        family: 'catalogue',
        fix: 'Write the guard in the same change, or write down why no channel can hold it.',
        name: 'discovery-grows-a-guard',
        rationale: 'This is the rule that grows the other channels instead of letting them rot.',
        reach: 'all',
    },
];

export const selfRows: Row[] = ordered([
    ...SELF_STATIQUE_RULES,
    ...SELF_CHECKER_PASSES,
    ...META_ROWS,
    ...SELF_PROCESS_RULES,
]);

export const allRows: Row[] = ordered([...consumerRows, ...selfRows]);
