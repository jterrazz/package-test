import { consumerCatalog, ordered, statiqueRows } from './manifest.js';
import type { CatalogEntry } from './manifest.js';
import type { RuleDoc } from './rule-shape.js';
import { ARCHITECTURE_META_ROWS, ARCHITECTURE_RULE_DOCS } from './self/architecture-rows.js';

/**
 * The `self` rows — the rules only this package is held to: its own suite,
 * its catalogue, its capability matrix, its specimens, its own sources.
 *
 * No published entry imports this module. The rules they describe run in
 * `dist/self-oxlint.js`, `dist/self-checker.js` and this repository's
 * meta-tests, which `files` leaves out of the tarball; the published bundles
 * read `consumerCatalog` alone, so none of them carries a row of this module.
 */

/**
 * The chapter a `self` row is read at — where the package says how it tests
 * itself. A rule only this package is held to has no row in the public
 * catalogue, so its message routes here instead.
 */
export const SELF_CHAPTER = 'docs/03-testing.md';

/**
 * The **statique** `self` rows — each the `meta.docs` of a rule of the
 * `jterrazz-self` plugin (`self-plugin.ts`).
 */
export const SELF_RULE_DOCS = {
    'f7-no-framework-internals': {
        audience: 'self',
        channel: 'statique',
        convention:
            "From `specs/`, a relative import resolving into the framework's INTERNALS — this repository's `src/{model,capabilities,actions,stubs,results,facets,seams,runner,lint}/` — is an error: a spec of the framework reaches it through `@jterrazz/test`, as a consumer does. A spec importing its own app's source is allowed (the documented pattern), and a `@jterrazz/test/<subpath>` import is F1's. No folder exception: a probe that cannot reach its subject through the public entry is a module test beside its module, not a spec.",
        facet: 'model',
        family: 'F',
        fix: 'Reach the framework through `@jterrazz/test` (`src/index.js`), or move the probe beside the module it covers.',
        id: 'F7',
        rationale:
            'Specifying the framework through its public surface keeps its specs decoupled from its internal paths; those folder names are its layers in this repository alone, so the rule holds this package and nobody else.',
        reach: 'specs',
    },
    ...ARCHITECTURE_RULE_DOCS,
} satisfies Record<string, RuleDoc>;

/** The **checker** `self` rows — each a pass `dist/self-checker.js` runs (`self-checker.ts`). */
export const SELF_CHECKER_PASSES: CatalogEntry[] = [
    {
        audience: 'self',
        channel: 'checker',
        convention:
            'A spec of a SPECIMEN is filed by the capability it specifies. A `.spec.ts` whose runner drives an app under `<specs>/shared/fixtures/` — a specification module it imports a runner from, one that module imports a runner from, or the spec itself when it builds its runner inline, names the shared fixtures in a literal: a file inside a specimen’s folder — the app module, the binary, the script a command runs — or the folder itself as the root a `server: { command }` of the runner it feeds runs from, whether the literal is written in the call or in a `const` the call names (a root alone is where the services read their ground, and no app) — or an integration spec importing the module of the shared fixtures its chains call, specifies the framework, not that app, and sits one folder below its facet, in a folder the capability matrix names for that facet’s column (`<specs>/api/seed/<aspect>.spec.ts`), one file per aspect of the capability. The vocabulary is closed: each capability the matrix declares for the column, the words before its first parenthesis kebab-cased (`.seed()` → `seed`, `toMatch(file())` → `to-match`, `.exitCode` → `exit-code`); a capability of another column is no folder of this facet (`appium` is mobile’s, never `cli/appium/`). A first-level folder that is no facet has no column, and takes a capability of any. C29 and C30 leave such a spec alone. The component facet’s own tree is the fixture app its tests render, and it is filed the same way: every `.ts` and `.tsx` under `<specs>/component/` — a rendered unit, the hook or DOM function a test hosts, the `.test.tsx` beside it, the project’s frame — sits one folder below it, in a folder the matrix names for the `component` column, the capability its test specifies (`<specs>/component/intercept/post-table.tsx`). An error at the file’s first line of code, where a reasoned `checker-disable-next-line c35` above it silences it.',
        facet: 'model',
        family: 'C',
        fix: 'Move the file to `<specs>/<facet>/<capability>/<aspect>.spec.ts`, the capability it asks about, named as the matrix names it in that facet’s column — a component and its test together to `<specs>/component/<capability>/`.',
        id: 'C35',
        name: 'c35-capability-folder',
        rationale:
            'A specimen exists to exercise the framework, and its routes are nobody’s product: filed by the route, the framework’s own specs read as an app’s, and the reader looking for what `.seed()` promises opens a folder named for a URL. The component tree is a specimen too, and flat it answers the same question only by opening every test.',
        reach: 'specs',
    },
];

/**
 * The **meta** channel — what the package's own tests hold about the catalogue
 * and about itself.
 *
 * These rows never reach a consumer: they are the guards that keep the other
 * six channels honest. A rule with no fixture, a message linking to a heading
 * that moved, an id cited in a chapter that resolves to nothing, a reach a
 * reader could only learn by reading the implementation — each is a way the
 * catalogue stops being true without anything failing, and each has a test
 * here that fails instead.
 */
export const META_ROWS: CatalogEntry[] = [
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every environment variable the framework reads is on the allow-list, and a dynamic read carries its sanction comment.',
        facet: 'model',
        family: 'E',
        fix: 'Add the variable to `env-allowlist.ts`, or read it through the option that already exists.',
        id: 'E1',
        name: 'e1-env-allowlist',
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
        family: 'K',
        fix: 'Cite a row that exists, or write the row.',
        id: 'K2',
        name: 'k2-cited-ids-resolve',
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
        family: 'K',
        fix: 'Let `lessons()` write the `read:` part; never type one.',
        id: 'K3',
        name: 'k3-message-anchors',
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
        family: 'K',
        fix: "Write the message as its `found` and its `fix` — `lessons()` in a rule, the finding's two fields in a checker pass, `refusal()` in the runtime — and let the row give the `why` and the `read`.",
        id: 'K11',
        name: 'k11-messages-teach',
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
        family: 'K',
        fix: 'Add the path to the reach fixture and state what each rule says about it.',
        id: 'K4',
        name: 'k4-reach-per-path',
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
        family: 'K',
        fix: 'Write the row in English, like every sentence the catalogue publishes.',
        id: 'K5',
        name: 'k5-english-catalogue',
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
        family: 'K',
        fix: 'Write the sibling test, or write the kind that claims it and the one line saying what covers it.',
        id: 'K7',
        name: 'k7-siblingless-module-declared',
        rationale:
            'I2 says a module test lives beside its module; it never said every module has one. What was missing is the list of the ones that do not, and why.',
        reach: 'module',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every capability a facet DECLARES — a constructor option, a setup, a terminal action, a verb, a result accessor, a golden kind, a `{{token}}` family — is exercised by at least one of the package\u2019s own test files in that facet, or its row names the reason it is not.',
        facet: 'model',
        family: 'K',
        fix: 'Write the spec, or state the reason on the capability row — a blank cell says nothing and a zero with no reason is a surface nobody holds.',
        id: 'K6',
        name: 'k6-matrix-no-empty-cell',
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
        family: 'K',
        fix: 'Point the link at the heading as it is now written, or restore the heading it named.',
        id: 'K8',
        name: 'k8-corpus-coordinates-resolve',
        rationale:
            'A renamed heading leaves a link that scrolls nowhere and a renumbered chapter one that 404s; the 16.0 renumbering left the map pointing at a heading the same commit had replaced.',
        reach: 'all',
    },
    {
        audience: 'self',
        channel: 'meta',
        convention:
            "No spec, module test or fixture server of this package reads a port it was handed (`process.env.PORT`, `$PORT`): a server a spec starts binds port 0 and announces the port it got, which the process reads through its `ready` banner. A server a container image runs (a folder holding a `Dockerfile`) owns its container's ports and is out of reach, and so is `src/seams/process/serve.adapter.test.ts`, the proof of the framework's PORT form, whose children report the port they were handed and never bind it.",
        facet: 'model',
        family: 'K',
        fix: 'Bind port 0, print the port the OS gave, and declare `ready: /listening on port (\\d+)/`.',
        id: 'K9',
        name: 'k9-spec-server-port-zero',
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
        family: 'K',
        fix: 'Golden the run’s report beside its `exit:`.',
        id: 'K10',
        name: 'k10-lint-document-goldens-report',
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
        family: 'K',
        fix: 'State the audience on the row, and wire a self rule in `lint/self-plugin.ts` or `lint/self-checker.ts` — never in `lint/plugin.ts` or `lint/checker.ts`.',
        id: 'K12',
        name: 'k12-rule-audience',
        rationale:
            'A rule only this package is held to, once shipped, runs in every consumer’s tree: C35 filed their specs by a capability matrix they do not have, and F3 refused a consumer’s own `src/model/` until its self half left it as F7.',
        reach: 'all',
    },
    ...ARCHITECTURE_META_ROWS,
    {
        audience: 'self',
        channel: 'meta',
        convention:
            'Every constructor has a `specs/<facet>/` tree in this package. Two subjects are proven differently, each with its reason stated: `component` is a CHAIN, not a constructor, and is proven beside its fixture app under `specs/component/`; `mobile` is proven against a double of the Appium protocol in every run, because CI provisions no simulator, and the same specs against a real one by `make test-mobile`.',
        facet: 'model',
        family: 'M',
        fix: 'Specify the facet on the package itself before a rule presumes it.',
        id: 'M1',
        name: 'm1-constructor-has-a-tree',
        rationale:
            'A facet the framework never ran against itself is a surface nobody has met, and P10 says the seam is proven before the rule wave.',
        reach: 'all',
    },
];

/** The **process** `self` rows — the review discipline of this package's own catalogue. */
export const SELF_PROCESS_RULES: CatalogEntry[] = [
    {
        audience: 'self',
        channel: 'process',
        convention:
            'Every defect class discovered produces, in the same change, the guard that stops it coming back (a static rule, a meta-test or a runtime error) — or documents why no channel can hold it.',
        facet: 'model',
        family: 'K',
        fix: 'Write the guard in the same change, or write down why no channel can hold it.',
        id: 'K1',
        name: 'k1-retro-propagation',
        rationale: 'This is the rule that grows the other channels instead of letting them rot.',
        reach: 'all',
    },
];

/** The `self` catalogue, in catalogue order. */
export const selfCatalog: CatalogEntry[] = ordered([
    ...statiqueRows(SELF_RULE_DOCS),
    ...SELF_CHECKER_PASSES,
    ...META_ROWS,
    ...SELF_PROCESS_RULES,
]);

/** The `self` row a name designates. */
export function selfRowOf(name: string): CatalogEntry {
    const row = selfCatalog.find((entry) => entry.name === name);
    if (row === undefined) {
        throw new Error(`no self row is named ${name}`);
    }
    return row;
}

/**
 * Every row of both audiences, in catalogue order — what the generator and
 * the meta-tests read.
 */
export const catalog: CatalogEntry[] = ordered([...consumerCatalog, ...selfCatalog]);
