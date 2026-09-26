import { REFUSAL_WHY } from '../../src/kernel/refusals/refusal.js';
import type { RuleDoc } from './row.js';

/** The `consumer` rows, one list per channel: the one source the catalogue, the plugin's messages and the checker's findings read. `self` rows are `self-manifest.ts`'s, which no published bundle imports. Pure data, so the lint layer stays free of the runtime (`import-within-declared-layers`). */

export type CatalogEntry = RuleDoc & {
    /** Unique across the catalogue. */
    name: string;
};

/** Each rule file attaches its entry as `meta.docs`. A convention oxlint's own `vitest` plugin enforces belongs there, not here. The one warn tier is the row's `severity`. */
export const STATIQUE_RULES: CatalogEntry[] = [
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A runner is created only in a `*.specification.ts(x)` file under `specs/`: calling `specification.*` anywhere else is an error. The `.tsx` spelling is the same file with a `wrap` written in JSX. A `component`-role file is out of reach: a rendered unit starts nothing.',
        facet: 'model',
        family: 'setup',
        fix: 'Move the call into `specs/<facet>/<facet>.specification.ts` and export the handle from there.',
        name: 'runner-in-specification-file',
        rationale:
            'Anchoring runners to a recognisable filename makes the entry point discoverable and keeps tests declarative.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'Six constructors and only six: `specification.api()`, `specification.job()`, `specification.cli(bin)`, `specification.integration()`, `specification.website()`, `specification.mobile()`. Any other member (`.app`, `.http`, `.stack`…) is an error. A rendered component starts nothing: it is a chain, not a member of this record.',
        facet: 'model',
        family: 'setup',
        fix: 'Name one of the six, or reach for the `component` chain — a seventh subject is a decision before it is a constructor.',
        name: 'no-unknown-constructor',
        rationale:
            'A closed surface stops parallel constructors being invented and keeps the API memorable.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "The return is destructured under the constructor's canonical name, unaliased (`{ api, cleanup, docker }`); renaming (`{ api: myApi }`) is an error.",
        facet: 'model',
        family: 'setup',
        fix: 'Drop the alias and keep the canonical name.',
        name: 'no-runner-alias',
        rationale: 'One instance name per facet makes every spec readable with no local context.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'The specification file passes `cleanup` to `afterAll`; a `cleanup` destructured but never handed over is an error.',
        facet: 'model',
        family: 'setup',
        fix: 'Add `afterAll(cleanup)` at the end of the specification file.',
        name: 'cleanup-passed-to-after-all',
        rationale: 'Guaranteeing teardown stops containers and connections leaking between files.',
        reach: 'specification',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A `root` pointing at the directory the automatic walk would have found is redundant → warning.',
        facet: 'model',
        family: 'setup',
        fix: 'Drop the option: the walk finds the nearest `package.json` by itself.',
        name: 'no-redundant-root',
        rationale:
            'Detection by convention has to stay the default; an explicit `root` is only justified where it fails.',
        reach: 'all',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A `// When -` marker is optional; written, it sits after `// Given -` and before `// Then -`.',
        facet: 'model',
        family: 'chain',
        fix: 'Move it to the action it narrates, or drop it when the chain is the action.',
        name: 'when-between-given-and-then',
        rationale:
            'The optional marker is the one the order slips on: a `When` above the Given or below the Then tells a story the code does not follow.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A marker is exactly one line: a `//` comment directly under one, at the same indentation, is a wrapped marker and an error. A tool’s directive is not a sentence — a linter’s `-disable`/`-enable`, a formatter’s `-ignore`, a `@ts-` pragma and a coverage line stand where they are.',
        facet: 'model',
        family: 'chain',
        fix: 'Fold the continuation into the sentence, or separate it with a blank line.',
        name: 'marker-on-one-line',
        rationale:
            'The narration is a sentence about the subject; a paragraph hides its second half from every reader that only looks at the marker line.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A setting every chain of a spec file states alike — the same `.clock(…)`, the same `.headers(…)`, the same `.env(…)`, per runner handle — is the file’s, stated once on a view of the facet: `const events = api.with({ clock: '…' })` → warning at the first chain. A file of one chain is not judged; a seed and a stub are a test’s Given, never a setting.",
        facet: 'model',
        family: 'chain',
        fix: 'Declare the view once after the imports, `const <view> = <handle>.with({ … })`, and start every chain from it — `make fix` writes it, named for the file’s subject so every file of one folder names it alike (`events/list/` → `events`, a job → its name, a command → its first word; `<subject>View` when the file already holds the name, `<handle>InFile` for no named subject), and drops the setting from each chain.',
        name: 'no-repeated-chain-setting',
        rationale:
            'A setting repeated on every chain reads as a choice each test made; stated once, it reads as what it is — the condition of the whole file — and the next test cannot forget it.',
        reach: 'spec',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'Every test carries `// Given -` then `// Then -` (both, in that order); a Given declared after a Then is an error. A `test.each` table is judged ONCE, on the table, not once per row. A `<case>.spec.yaml` document has no comments: its narration is its `description:`.',
        facet: 'model',
        family: 'chain',
        fix: 'Write the two markers, in order, as sentences about the subject — not about the code (chapter 18 § The narration).',
        name: 'given-and-then-markers-present',
        rationale:
            "Given/Then narration makes a test's intent readable without reading its assertions.",
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "`.env({ <SERVICE>_URL: ….connectionString })` repeats the framework's own injection → warning.",
        facet: 'cli',
        family: 'chain',
        fix: 'Drop the line: the record key already injects `<KEY>_URL` into the child process.',
        name: 'no-redundant-service-url',
        rationale:
            'The injection already covers service URLs; rewriting them by hand invites drift.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            '`.trigger(name)` takes a stable kebab-case identifier; a non-kebab-case `name` is an error.',
        facet: 'job',
        family: 'chain',
        fix: 'Write the job name in kebab-case, the same spelling the application registers it under.',
        name: 'trigger-name-is-kebab-case',
        rationale:
            'The job name is a contract between the app and its tests — a stable identifier forbids divergent translations.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A `specification.cli(bin)` whose binary resolves inside a dependency's `node_modules/.bin` tests the third-party tool, not the product command → warning (a suppression with a reason is accepted). Reach: a specification file — a runner created anywhere else is `runner-in-specification-file`'s.",
        facet: 'cli',
        family: 'chain',
        fix: "Point the runner at the product's own binary; assert on a tool's output through `result.grep`.",
        name: 'cli-runs-the-product-binary',
        rationale:
            "A spec has to exercise the product's real command; per-tool assertions go through `result.grep`.",
        reach: 'specification',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A specs tree DECLARES its shape through the `depth` option: `facet-domain` (the default — a test at facet/domain depth, a `*.specification.ts` at the facet root), `facet` (a test at the facet root OR one domain folder down, never deeper), `mirror` (a test at any depth ≥ 1, named after its directory), `off`. Under `facet-domain` and `facet`, a `.spec.ts` of the api or cli facet sits as deep as its subject’s standard name — a route’s resource and action (`events/list/`), a command’s words (`db/migrate/`) — which `spec-in-subject-folder` judges. A first-level folder that is no facet — a repository suite, `surface/` or `lint/` — is judged by the same depth as a facet is. In every mode, `off` included: a directory named `fixtures/`, `expected/`, `requests/` or `seeds/` is GROUND, never a facet, domain or suite folder — no spec lives inside one, so a domain named with a reserved word is refused. One exception, and only one: ground may be CODE, and a `<module>.test.ts` sitting BESIDE the `<module>.ts` it tests is legal there (that is `test-beside-its-module`). A test with no neighbouring module, or a `*.specification.ts`, is still a violation. `shared` is reserved beside the four: `specs/shared/` is the one folder the specs root keeps beside its facets, holding the ground several leaves share, so a spec or a specification under it is refused in every mode. The word is reserved only there: deeper, a domain or a route’s segment takes it (`<specs>/api/shared/get/` for `GET /shared`). A first-level folder is a facet, `shared/`, or a repository suite, which holds tests of its own — one test is enough: a module in one that is none of the three (a `support/` of helpers and mocks), a runner included, is refused in every mode, `off` included — a runner lives at the root of the facet it builds, a test helper beside the tests it serves, a fixture under `specs/shared/fixtures/`. A `.test.tsx` is out of reach: a rendered unit is specified beside its component, never in a facet/domain tree — `test-beside-its-module` holds its neighbourhood.',
        facet: 'model',
        family: 'layout',
        fix: 'Move the file to the depth the tree declares, or declare the depth the tree actually has; move a runner out of a first-level folder holding no test to its facet root, and a helper to the tests it serves.',
        name: 'specs-at-declared-depth',
        rationale: "A fixed depth makes every file's place predictable and statically checkable.",
        reach: 'specs',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'Outside `specs/**/stubs/`, an import resolving into a kind folder (`stubs/<kind>/…`, `<kind>` a stub builder the package exports: `http`, `openai`, `anthropic`) is an error: a test imports only the `*.stubs.ts` facades.',
        facet: 'model',
        family: 'world',
        fix: 'Add a named scenario export to the facade and import that instead.',
        name: 'stubs-imported-through-facade',
        rationale:
            'Unit stubs are composition details; going through the facade keeps each scenario named in the same place as the world it derives from.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'Inside a kind folder, every `*.response.json` and every `*.request.ts` has a `<stem>.ts` sibling — the stem is the name up to the FIRST dot (`events.fr.response.json` → `events.ts`). Orphan data is an error.',
        facet: 'model',
        family: 'world',
        fix: 'Write the stub that serves the payload, or delete the payload.',
        name: 'stub-data-has-a-builder',
        rationale:
            'Data exists only as served by a stub — a file with no owner is dead weight no test ever loads.',
        reach: 'stub',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "The ground a test stands on carries a bare, reserved name: `fixtures/`, `expected/`, `requests/`, `seeds/` — a spec's under `specs/`, and a module test's beside its module. An `_fixtures/`, `_expected/`, `_requests/` or `_seeds/` directory beside a test (or as the pool, `<specs>/_fixtures/`, whose 17 place is `<specs>/shared/fixtures/`) is the 16.x name — an error naming the rename — and so is a `contracts/` folder beside a test, the 16.x name of `stubs/`: any one under `specs/`, and beside a module test one holding a `*.contracts.ts` facade. The rule and its mover are the 16 → 17 migration: they retire in 17.1. The mover (`--fix`) walks every `specs/` tree and every member's module tests — a module test's relative literal naming a folder it renames under `specs/` follows the rename — and moves only a file the rule still finds 16.x-shaped — a 16 folder beside it, or a 16 pool it names by `$FIXTURES/`; a 17 file is left as it is, whatever its tree holds, and only a directive naming a renamed rule, and the stub vocabulary, are moved on every file: a `contracts/` folder — any one in a `specs/` tree, one holding a `*.contracts.ts` facade beside a module test — is `stubs/`, its facades `*.stubs.ts`, and a 16 name imported from the entry (`defineContract(s)`, `Contract`, `Contracts`, the `Contract…` types) its 17 one.",
        facet: 'model',
        family: 'layout',
        fix: 'Rename the directory to its bare name, and the paths that name it (`jterrazz-test-check --fix` does both).',
        name: 'ground-uses-reserved-name',
        rationale:
            'Every path names its folder in full, so the old name still runs — and a repository that keeps it speaks two dialects of one law. The rule names the rename instead of letting the two drift.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            '`requests/` holds what a spec SENDS: a whole request as a `.http` (`request()`), or a body a verb sends (`post`/`put`/`patch` with a `file()`) — a `.json`, a `.txt`, any format the app reads. Every file there carries its extension; a file with none is an error.',
        facet: 'api',
        family: 'layout',
        fix: "Name the file with its extension: `.http` for a whole request, the body's own format otherwise.",
        name: 'request-file-extension-known',
        rationale:
            'The extension is how the file is sent — a `.http` whole, a `.json` parsed, anything else verbatim — so a file without one says nothing about what the app will receive.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'Under `specs/**/stubs/`: the ROOT carries only `*.stubs.ts` facades and one folder per stub KIND — a stub builder the package exports: `http` | `openai` | `anthropic`, the closed list its exports decide. A facade exports its builders and sets BY NAME — the world and its scenarios — and one that exports nothing is an error; a default export is not required, and when a facade has one it is a composition: built by `defineStubs(...)`, a composition re-export, a scenario of a sibling facade — a name imported from a `*.stubs` module, or a call to it — or a call to a builder of the file declared to return `Stubs` (no type is read, so a builder is judged by where it comes from or what it declares). A unit stub is `<kind>/<kebab-name>.ts` with an `export default defineStub(...)` (or a factory returning one), and it calls only its own folder’s builder: a `<kind>.…` of another kind the file imports from the package — by name, or through a namespace import (`t.<kind>.…`), in its request, its reply or anywhere else — is an error. A kind folder is flat and holds only `*.ts` and `*.response.json`.',
        facet: 'model',
        family: 'world',
        fix: 'Move the file to the half it belongs to: a facade at the root, a unit under the folder of the builder it calls.',
        name: 'stubs-root-holds-facades-and-kinds',
        rationale:
            'A fixed tree separates the public facade from the internal units and makes the FOLDER carry the kind — filenames go back to being domain words, a unit reads as one kind of outside world, and bulky data sits beside the stub that serves it. A test imports the builder it calls by name, so a required default no test reads would be dead code the unused-export pass reports.',
        reach: 'stub',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A golden `file()`'s path carries its extension (`toMatch(file('./expected/help.txt'))`, `'./expected/<case>.aria.yaml'` for an ARIA tree); a golden file with no extension is an error. A tree golden is `toMatch(directory(…))`, whose path ends in `/`.",
        facet: 'model',
        family: 'layout',
        fix: "Write the fixture's full name, extension included.",
        name: 'golden-path-has-extension',
        rationale:
            "The extension is part of the golden's path — the path IS the file, and a file without its extension is another file.",
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention: '`seeds/` holds `*.sql` files only; any other file is an error.',
        facet: 'model',
        family: 'world',
        fix: 'Write the seed as SQL, or move the file to `fixtures/` as the material it is.',
        name: 'seeds-are-sql',
        rationale: '`.seed()` carries database state only — no seed handlers, no prefix dispatch.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "The verb and the ground folder agree: `seed()` reads `seeds/`, `request()` and a request body (`post`/`put`) read `requests/`, `fixture()` reads `fixtures/`, a golden `toMatch(file|directory(…))` reads `expected/`, and `run()` reads a document beside the test, under no ground folder — or under `fixtures/` for a document that is an input a negative spec runs. The same four folders under the specs root's `shared/` hold what several leaves share, so a shared seed is `<specs>/shared/seeds/x.sql` (`../../shared/seeds/x.sql`), never `<specs>/shared/fixtures/seeds/x.sql` — the role folder under `shared/` is the first ground folder the path passes through, and it is the one judged. The first ground folder a literal path passes through is the one judged, whether the `file()`/`directory()` is handed to the verb inline or bound first to a `const` of the same file (the nearest declaration of the name, as the language resolves it); a `let`, a parameter or a computed path is out of reach, and a document's `fixture:` is held to `fixtures/` by its grammar (`document-follows-its-grammar`).",
        facet: 'model',
        family: 'layout',
        fix: "Move the file into the folder its verb reads — the leaf's own, or the specs root's under `shared/` when several leaves share it — and spell the path through it.",
        name: 'verb-reads-its-ground-folder',
        rationale:
            'Four reserved names are a vocabulary only if each means one thing: a seed parked in `fixtures/` or a golden in `requests/` makes the folder lie about what it holds, and the next reader trusts the folder.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "`file()` and `directory()` are called in a test or spec file — a `.test.ts(x)`, a `.spec.ts`, a type test — and nowhere else: a shared helper module, a specification file or a stub takes a `file()` as a parameter and never builds one. The call is recognised by its import from the framework's entry, an alias included.",
        facet: 'model',
        family: 'layout',
        fix: 'Take the `file()`/`directory()` as a parameter of the helper, and build it in the test that calls it.',
        name: 'paths-named-in-the-test',
        rationale:
            'A path resolves against the spec that starts the chain, so one built in a helper resolves per caller: the same line names a different file for every spec that reaches it, and the file it names is visible on no line of the test that stands on it.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A test file — a `.spec.ts`, a `.test.ts`, a `.test.tsx` — holds one top-level `describe`, titled with what the file is about, and every test inside it. A spec file's title is its aspect: `pagination.spec.ts` → `describe('pagination', …)`. A colocated test's is its subject, read from the module beside it (`<base>.ts`, `<base>.tsx`): the name its default export declares; else its one value export; else the value export spelling the base name in camelCase or PascalCase, or the base less its role suffix (`request.action` → `request`); else the base name — `locale-note.test.tsx` beside `export function LocaleNote` → `describe('LocaleNote', …)`. A `describe.each` names its rows, so its title starts with that name, `'pagination — page %s'`; a subject keeps its case, the `testing` fragment exempting the top-level `describe` from `vitest/prefer-lowercase-title` (`ignoreTopLevelDescribe`). A file with no `describe` is refused at its first test, a second `describe` or a test beside the one at itself, a title naming anything else at the title; a file that declares no test through `describe`/`test`/`it` (a rule tester's cases, a type test) is out of reach.",
        facet: 'model',
        family: 'layout',
        fix: "Title the file's one `describe` with its aspect or its subject, and put every test inside it — `make fix` renames a title (the title it said kept on each test, `<title> — <test>`, when the group holds tests alone; a table's by prefixing the name), wraps a file that has none, and merges several groups into one, each test titled `<group> — <test>`, when every group holds tests alone; what stands between the tests stays at module scope.",
        name: 'one-describe-per-file',
        rationale:
            'The runner reports a failure under the describe it stands in, so a title that is the aspect or the subject names the file the failure came from; a second group, or a stray test, is a second question the file answers.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A spec file is named for its aspect: kebab-case (`not-found.spec.ts`), and never a name that says the file holds what fit nowhere else — `misc`, `other`, `basic`, `general`, `more`, `edge-cases`, `tests`, `main`.',
        facet: 'model',
        family: 'layout',
        fix: 'Rename the file for the question its tests ask of the subject — `pagination`, `filters`, `sorting`, `language`, `validation`, `not-found`, `auth`, `shape` are the api vocabulary chapter 18 advises.',
        name: 'spec-named-for-its-aspect',
        rationale:
            'The folder names the subject; the file name is the only place the question asked of it is written, and a catch-all name answers none — the next test lands there because it fits nowhere, and the file grows until it holds everything.',
        reach: 'spec',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A spec file holds at most 400 lines; a longer one is refused at its first line, the message grouping its tests by the prefix of their titles — where the cut usually goes. A file already past it is recorded on the ratchet and may only shrink.',
        facet: 'model',
        family: 'layout',
        fix: 'Cut the file along the groups the message names, one aspect per file, in the same folder.',
        name: 'spec-file-within-line-limit',
        rationale:
            'A file past a few hundred lines asks several questions of its subject, and a reader looking for one scrolls through the others; a cap written as a number is the one a reviewer does not have to argue.',
        reach: 'spec',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A test body spans at most 60 lines of gestures — the function a `test(…)`/`it(…)` runs, from the line it opens on to the line it closes on, blank lines and comments included, less the lines a `toMatch(<value>)` argument holds past the one it opens on: the claim is capped by `ground-shared-or-inline`, not here; a longer one is refused at the function. A body already past it is recorded on the ratchet and may only shrink.',
        facet: 'model',
        family: 'layout',
        fix: 'Split it into one test per behaviour, or move a long Given into a function the test calls.',
        name: 'test-body-within-line-limit',
        rationale:
            "A test past a screen asks several things of its subject, and the one that fails is the one a reader has to find; the toolchain's function cap leaves a test file alone, because a file's one `describe` is a function as long as the file, so this cap is the test's own.",
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "No sampled value under an oracle: `new Date()` (no argument), `Date.now()`, `performance.now()`, `Math.random()` and `randomUUID()` are an error as a direct argument of `expect` or of its matcher, and anywhere inside a structural matcher's expected shape. A test that pins the clock (`clock.at`, `clock.advance`) is out of reach — the reading is then the constant it chose — and so is a `*.specification.ts(x)`, where a runner legitimately samples at startup.",
        facet: 'model',
        family: 'expectations',
        fix: 'Pin it with `clock.at()`, or match it with `{{iso8601}}`/`match.uuid`.',
        name: 'no-sampled-value-in-expectation',
        rationale:
            'An assertion that reads the machine twice holds whatever the subject does, and the day it fails it fails for the clock.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A sampled value anywhere in a test callback is a warning — the wider net around `no-sampled-value-in-expectation`, silent where `no-sampled-value-in-expectation` already refuses and on a name built in a template literal. A `*.specification.ts(x)` is out of reach.',
        facet: 'model',
        family: 'world',
        fix: 'Reach for `clock.at()`, `clock.advance()`, or a token in the golden.',
        name: 'no-sampled-value-in-test',
        rationale:
            'A value sampled into the Given travels into the subject, and the assertion that reads it back is the same tautology one step removed.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A module test whose every assertion reads the call log of a double it built itself (`mockOf`, `vi.fn`, `vi.spyOn`) is a warning. The reach is the `module` role: on a component a callback prop IS the contract with its parent. It is a warning, and not an error, because one subject answers this way honestly — one whose PRODUCT is a call it was handed (a listener, an output port) — and the shape is the same one either way.',
        facet: 'model',
        family: 'expectations',
        fix: 'Assert the returned value or the resulting state — or say in a line that the call IS the product.',
        name: 'no-double-only-assertion',
        rationale:
            'The subject can return anything, raise anything, or return nothing at all, and every assertion still passes.',
        reach: 'module',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A test whose ONE assertion is an existence check (`toBeDefined`, `toBeTruthy`, `not.toBeNull`, `not.toBeUndefined`, a bare `toThrow` or a bare `toHaveBeenCalled`) is a warning. Beside a real assertion the same check is a precondition and stays silent, `expect.soft` counts as an assertion, and a NEGATED bare matcher (`not.toHaveBeenCalled`) is a precise proof rather than a loose one.',
        facet: 'model',
        family: 'expectations',
        fix: 'Assert the value, a golden, or a row.',
        name: 'no-existence-only-assertion',
        rationale:
            '`toBeDefined()` passes for `0`, `[]`, the wrong object and the right one: as a whole proof it records that the call returned, not what it answered.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'Three probes (`threshold`, default 3) on one goldenable subject — `stdout`, `stderr`, `content`, `head`, `meta()`, `canonical`, `alternates`, `tree`, `html` — with no `toMatch(file(…))` on it is a warning. A negated probe states an absence no golden can carry and is not counted; `value` and `error` are single readings and are not goldenable subjects.',
        facet: 'model',
        family: 'expectations',
        fix: "Golden the subject: `expect(result.stdout).toMatch(file('./expected/<case>.txt'))`, tokens for what moves.",
        name: 'no-probe-cluster',
        rationale:
            'Three greps state three lines, leave everything between them unstated, and still have to be rewritten one by one the day the output changes.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A test that reads a response, a json or a table — `<result>.response`, `<result>.json`, `<result>.table('<name>')` of a result it awaited — compares it WHOLE, once: `toMatch` handed the whole result written in place or its golden, or a table's `toBeEmpty()`. A precise assertion on one of its properties (`expect(result.json.value.total).toBe(1)`) is allowed only IN ADDITION → error on the first read of a result no whole comparison reaches. A negation, a RegExp and a read through a helper are no whole comparison; a result read through a helper, a computed table name, or a comparison made in a helper is out of reach, and the rule stays silent. A read whose value is only CARRIED into a later request of the same test — every use of it, through the names and helpers it passes, ends in the arguments of a chain off a handle the test awaits, in place or through the name that holds it (a path, `params`, a body, a header), as the cursor a page hands back — claims nothing and owes no comparison; one `expect(…)` of that value makes it a read again, and the result the test does claim is still compared whole.",
        facet: 'model',
        family: 'expectations',
        fix: "Write `expect(<result>.<subject>).toMatch('')` and run `TEST_UPDATE=1` — the whole result is written in place; keep the precise assertion beside it if one property IS the subject.",
        name: 'result-compared-whole',
        rationale:
            'Probes are a partial oracle: what they do not name is free to regress unseen. The whole result, written where the test reads it, is the default oracle — approval testing — and a precise assertion states what the test is about on top of it. It is the retired warning on body-probe clusters, grown into the rule it stood in for.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A file-level `const` a spec hands to a matcher as the expected value serves two tests or more; read by one test, it is an error at its declaration. A constant read outside every test (by a helper) counts as shared, and an exported one is out of reach.',
        facet: 'model',
        family: 'expectations',
        fix: 'Write the value in place, in the matcher the one test hands it to, and delete the constant — `make fix` inlines one read.',
        name: 'expected-constant-is-shared',
        rationale:
            'A test is read where it is written: an expectation parked at the top of the file makes its one reader scroll to know what it asserts, and buys no sharing for the price.',
        reach: 'spec',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A spec imports no expectation: a name imported from another module of its specs tree — neither its `*.specification` runner nor a module under `stubs/` — and handed to a matcher as the expected value, itself or a member of it, is an error at the argument. A helper is CALLED, and what it builds is the test’s own; a module outside the specs tree is the product’s, and a spec may compare against its data (`package.json`’s version, a constant the product exports); `no-test-to-test-import` already refuses importing a test file at all.',
        facet: 'model',
        family: 'expectations',
        fix: 'Write the expected value in the test — in place, or `file(…)` when several tests of the leaf share it — and drop the import.',
        name: 'no-imported-expectation',
        rationale:
            'An expectation written in another module asserts what nobody reviewing the test reads, and a change to that module moves the assertions of every spec that imports it without one of them changing.',
        reach: 'spec',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A `toMatch` that is IO — a table compared whole, `toMatch(<rows>)`, or a tree, `toMatch(directory(…))` — must be awaited or returned; otherwise the assertion never runs → error. `toBeEmpty` and `toBeRunning`, typed `Promise<void>` whatever their argument, are refused dropped by the type-aware `typescript/no-floating-promises` every profile of `@jterrazz/typescript` turns on.',
        facet: 'model',
        family: 'expectations',
        fix: 'Put `await` in front of the `expect(...)`.',
        name: 'io-matcher-awaited',
        rationale:
            'An un-awaited IO assertion passes silently — the worst failure mode a test has.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            '`await` on an always-synchronous matcher (`toBe`/`toEqual`/`toContain`/`toHaveLength`) is redundant → warning.',
        facet: 'model',
        family: 'expectations',
        fix: 'Drop the `await`.',
        name: 'no-await-on-sync-matcher',
        rationale: 'A pointless await hides the signal that marks the real IO matchers.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A `transform` that only rewrites into equivalents of the standard tokens duplicates the grammar → warning.',
        facet: 'model',
        family: 'expectations',
        fix: 'Delete the transform and write the token the grammar already has.',
        name: 'no-transform-duplicating-tokens',
        rationale:
            '`transform` is the escape hatch for noise the tokens do not cover — not a second copy of them.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "`expect(x.raw).toContain` compares the stream as it was captured → warning. A stream compared as a value reads `x.text` — ANSI stripped, the runner's `transform` applied, the text a golden compares. A RegExp argument is exempt: a pattern carries no token grammar to lose.",
        facet: 'model',
        family: 'expectations',
        fix: 'Compare `x.text`; keep `.raw` for a test that proves what the comparison strips, with the suppression saying so.',
        name: 'no-raw-bypass',
        rationale:
            "`.raw` keeps the colour codes and skips the runner's transform, so a substring found there is not the text any golden of the same stream would be compared against.",
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A capture ref (`match.ref`, `{{kind#ref}}`) appearing exactly once in the whole file (code plus the golden files it references) is named for nothing → warning.',
        facet: 'model',
        family: 'expectations',
        fix: 'Drop the ref name and keep the bare token.',
        name: 'no-single-use-ref',
        rationale:
            'A ref only earns its name when it asserts equality across at least two occurrences.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A golden `toMatch(file(…))`/`toMatch(directory(…))`, or a `toMatch(<value>)` on a result (the value written in place, rewritten in the test), whose FAILURE is the subject of the test must carry `{ frozen: true }` → otherwise `TEST_UPDATE=1` silently rewrites the deliberately-wrong expectation instead of throwing → warning. Two shapes: the exact wrapper (`expect(() => …).toThrow()` / `expect(…).rejects.toThrow()`) and the bounded heuristic — a golden inside a helper whose body also asserts a throw, which is where a helper owning the try/catch puts it.',
        facet: 'model',
        family: 'expectations',
        fix: 'Pass `{ frozen: true }` so update mode never overwrites the fixture the test is about.',
        name: 'negative-golden-frozen',
        rationale:
            'In update mode an unfrozen matcher writes instead of throwing: the negative fixture is corrupted by its own real output and the assertion stops testing anything. `frozen` pins it.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A test whose ONLY assertions are HTTP status probes (`expect(X.status).toBe(N)` / `.toEqual(N)`, N a numeric literal 100–599) → warning: this case wants a full golden (`expect(result.response).toMatch(file('./expected/case.http'))`). A status probe BESIDE a real assertion (a whole-result `toMatch`, a table's rows, `toContain`…) stays silent (a legitimate scalpel).",
        facet: 'api',
        family: 'expectations',
        fix: 'Assert what the response carries, not only the code it came back with.',
        name: 'no-status-only-test',
        rationale:
            'A lone status pins the response code and throws away the whole payload; a full golden captures the shape and its token grammar (it completes `result-compared-whole`, which reads the response the probe stands beside).',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A `vitest.config.*` default-exports `defineSpecConfig(...)`; the call is resolved through an `export default <Identifier>` declarator, through a `satisfies`/`as` annotation, and through one `mergeConfig(defineSpecConfig(…), …)` — vitest’s own way of layering over the preset.',
        facet: 'model',
        family: 'setup',
        fix: "Start from `defineSpecConfig()` — budgets, the artefact dir and the ground exclusion are the preset's.",
        name: 'vitest-config-from-define-spec-config',
        rationale:
            "A config off the preset runs on vitest's five-second budget, writes artefacts at the repository root and collects `fixtures/` as specs — none of it visible in the file that caused it.",
        reach: 'config',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A project literal collecting `specs/<facet>/` is named `<facet>`, and one named for a facet is rooted there; `unit` collects outside `specs/`. What an include collects is read from the GLOB and the config’s own place in its package, never from the absolute path. Any other name is out of reach — a repository suite names its projects as it likes.',
        facet: 'model',
        family: 'setup',
        fix: 'Name the project after the facet it collects; `{ include, exclude }` stay yours.',
        name: 'project-named-for-its-facet',
        rationale:
            '`--project component` has to mean the same thing in every repository: it is the one word a CI job, a Makefile target and an agent all type.',
        reach: 'config',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A test file declares no simulated DOM: the `@vitest-environment happy-dom|jsdom` pragma is an error. Reach: the roles that RUN a test (`module`, `component`, `specification`) — a project config is `no-simulated-dom-in-config`’s.',
        facet: 'component',
        family: 'setup',
        fix: 'A rendered thing is a `.test.tsx` beside its component, collected by the `component()` project.',
        name: 'no-simulated-dom',
        rationale:
            'A simulated DOM behaves ALMOST like a browser, and what ships is judged by a real one: the component facet renders in the Chromium the website facet already drives.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A browser project comes from `component()`: in a vitest config, a `browser` key under `test` that is not inside a `component(...)` call is an error. A `browser` key elsewhere (a `define`, an env registration) is not a project block and stays out of reach.',
        facet: 'component',
        family: 'setup',
        fix: 'Replace the block with `component({ vite })` and keep only what belongs to the project.',
        name: 'browser-project-from-component',
        rationale:
            "The provider pinned to the runner's exact version, the service worker served from the framework's own install, the JSX transform the current Vite uses, a cold cache's pre-bundling and the artefact directories are all runs that pass here and fail on the next machine.",
        reach: 'config',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'An `include` glob of a PROJECT — an object under `test` or in `projects`, never `optimizeDeps.include` and its kin — whose static prefix (the segments before the first wildcard, brace or bracket), resolved from the config, is not a directory is a warning.',
        facet: 'model',
        family: 'setup',
        fix: 'Point the glob at the folder that exists, or delete the project that collects nothing.',
        name: 'include-points-at-a-folder',
        rationale:
            'A project that collects nothing passes: the suite never ran, and the only trace is a zero nobody reads.',
        reach: 'config',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            '`literate.specification`, resolved from the config directory, names a file that exists. The config directory is what the path is read against; a project that moves Vite’s `root` states its door relative to the config all the same.',
        facet: 'cli',
        family: 'setup',
        fix: 'Point it at the `*.specification.ts` that exports the `cli` its documents run through.',
        name: 'literate-specification-exists',
        rationale:
            'A path that resolves to nothing fails at collection time with a message about an import, several layers from the line that caused it.',
        reach: 'config',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A test writes the process environment through `vi.stubEnv` alone: a raw assignment onto a variable of it (named or computed), a replacement of `process.env` itself, and a `delete` of one of its variables are each a warning; a `*.specification.ts(x)` is out of reach by role.',
        facet: 'model',
        family: 'setup',
        fix: "Use `vi.stubEnv('X', 'y')`, which restores itself; a CLI default belongs to `specification.cli({ defaults })`.",
        name: 'no-raw-env-write',
        rationale:
            'The assignment outlasts the test: the next file in the same worker inherits it, and the failure lands somewhere else.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "Everything is imported from `@jterrazz/test`; an import of `@jterrazz/test/<subpath>` is an error, except the subpaths the package's `exports` map publishes — the entries are `.`, `./vitest`, `./oxlint` and `./schema`, and the three named ones are exempt everywhere. The list is READ from the manifest, never copied into the rule, so a published entry is exempt the day it ships.",
        facet: 'model',
        family: 'imports',
        fix: 'Import the name from `@jterrazz/test`; it is re-exported there by design.',
        name: 'no-unpublished-subpath',
        rationale:
            'A single entry point keeps the public API explicit and the internal subpaths invisible.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A production module never reaches test material. A production module is every source module that is no test material itself — `src/`, `lint/`, `bin/`, `scripts/` and a project's root modules alike — but a tool's config (`*.config.*`) and a module under a retired test root (`__tests__/`, a root `test/` or `tests/`, `test-beside-its-module`'s); test material is a test package (`@jterrazz/test`, `vitest`, `@vitest/*`, `vitest-mock-extended`, `vitest-browser-*`, `msw`, `@testing-library/*`, `playwright`, `playwright-core`, `@playwright/test`), a `*.test.*`, `*.test-d.*`, `*.spec.*`, `*.specification.*` or `*.fixtures.*` module, anything under a `fixtures/`, `expected/`, `requests/` or `seeds/` folder or under `specs/`, and a stub — a `*.stubs.ts` facade and the `stubs/` folder that holds one. Every form reaches: an import, `import type`, a re-export (`export *` included), `import()`, `require()`, `require.resolve()`, `import.meta.resolve()`, a type's `import('…')`; a specifier resolving there through a tsconfig `paths` alias (its `extends` chain followed) or a `#…` entry of the package's `imports`; a path the module builds from where it sits (`new URL('…', import.meta.url)`, `join(import.meta.dirname, …)`, a template opening on `__dirname`) or reads (`readFileSync('./…')`); and a module that is not production reaching it in turn, in any of these forms, read from its parsed program — a production module on the way is judged for its own references. The four ground names mean ground wherever a test stands on a file, beside a module as much as under `specs/`. Two exceptions: `@jterrazz/test/oxlint`, the zero-runtime lint entry; and a test package the unit's `jterrazz.config.ts` names under `test.production.allow`, each with the reason its product runs it (`{ playwright: 'the gate drives a browser in production' }`) — an entry with no reason leaves the list unread.",
        facet: 'model',
        family: 'imports',
        fix: 'Move the code that needs the reference into a test, move what production needs out of the test material, or inject it as a port.',
        name: 'no-test-code-in-production',
        rationale:
            "Keeping test artefacts out of production protects the consumer's application bundle.",
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention: 'A test file never imports another test file.',
        facet: 'model',
        family: 'imports',
        fix: 'Move what the two share into a `*.fixtures.ts` neighbour.',
        name: 'no-test-to-test-import',
        rationale:
            'Sharing between tests goes through `*.fixtures.ts`, not through test-to-test imports that couple the files.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention: 'A `*.fixtures.ts` is importable only from a test file.',
        facet: 'model',
        family: 'imports',
        fix: 'Move the value into production code if production needs it; otherwise import it from a test.',
        name: 'fixtures-imported-by-tests-only',
        rationale: 'Confining fixtures to tests stops test data leaking into production code.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A test file imports no second test runtime: `@testing-library/*`, `happy-dom`, `jsdom`, `vitest/browser`, `vitest-browser-*`, `@vitest/browser*`, `msw`, `msw/*`, `nock`, `sinon`, `vitest-mock-extended`, `jest`, `@jest/*`, `mockdate`, `playwright`, `playwright-core`, `@playwright/test`, `webdriverio` and `appium` are errors, each named with what replaces it; `react-dom/server` is one too, in the `module` role alone. Reach: the roles that RUN a test (`module`, `component`, `spec`, `specification`) — a fixture project’s config and a providers module under `specs/` legitimately name the adapter.',
        facet: 'model',
        family: 'imports',
        fix: 'Go through what replaces the seam: a facet, the element vocabulary, `intercept()`, `clock` or `mockOf`.',
        name: 'no-second-test-runtime',
        rationale:
            "A test importing the adapter speaks the adapter's dialect: a repository ends up with as many vocabularies as it has seams. Every group names the seam this vocabulary already owns — the runner, the browser, the simulator, the network, the clock and the doubles.",
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A module test touches no DOM global: `document`, `window`, `navigator`, `HTMLElement` referenced in VALUE position in a `module`-role file OUTSIDE `specs/` is an error. A name in type position (`x as HTMLElement`) and a `typeof window` guard reach no document and stay out of reach.',
        facet: 'component',
        family: 'setup',
        fix: 'A rendered thing is a `.test.tsx` beside its component, collected by `component()`.',
        name: 'no-dom-in-module-test',
        rationale:
            'A module test runs under node, where `document` does not exist: a test asking for one is not testing a module, it is rendering something — and it now has somewhere to go.',
        reach: 'module',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A project DECLARES its layers under `src/` through the `layers` option (allowed packages, internal imports, one folder per dependency, seams); any import outside the declared edges is an error. With no layer map the rule is inert.',
        facet: 'model',
        family: 'architecture',
        fix: 'Declare the edge in the layer map, or route the import through the layer that owns it.',
        name: 'import-within-declared-layers',
        rationale:
            'An architecture belongs to the project: declared boundaries are checkable, an assumed one is worked around.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "The test of `<file>.ts` is `<file>.test.ts` beside it; a misnamed `.test.ts`, a `__tests__/` directory or a package's `tests/` or `test/` root is an error. A RENDERED unit answers to the same law wherever it lives: a `.test.tsx` is the neighbour of the `.tsx` it renders, or of the `.ts` of the hook or DOM function whose Host it carries. A `module`-role file under a `specs/` tree is a repository suite — it covers a tree, so it has no neighbour to miss.",
        facet: 'model',
        family: 'layout',
        fix: 'Put the test beside the unit it covers, under the same basename.',
        name: 'test-beside-its-module',
        rationale:
            "Neighbouring tests (parity with Go's `foo_test.go`) keep a test and its code together and discoverable.",
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A test doubles a PORT, never a module: `vi.mock`/`vi.doMock` of a specifier outside the `modules` allow-list (a config comment states why each entry is there), a `__mocks__/` or `__fixtures__/` directory, and — in a `module`-role test — importing a data asset (`.json`, `.sql`, `.yaml`, …) are all errors. The specifier is read in BOTH spellings — `vi.mock('<spec>')` and the `vi.mock(import('<spec>'))` form `vitest/prefer-import-in-mock` requires — so an allow-listed module has a green spelling under both rules. A dotted specifier (`./dashboard.post`) is still code. The `vi.stubGlobal` clause moved to `no-vitest-time-or-global-stub` in 16.0: one owner per convention.",
        facet: 'model',
        family: 'world',
        fix: 'Double the port with `mockOf<Port>()`, keep a payload in a `*.fixtures.ts` neighbour, and allow-list a native module with its reason (chapter 05 § Doubles).',
        name: 'no-module-mock',
        rationale:
            'A module test that reaches for a real file or a module mock is describing an assembled product, and that has a facet of its own.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "No arbitrary sleep (`setTimeout`/`setInterval`/`Atomics.wait`, or a `node:timers/promises` import) in any test file — synchronisation is `see()`/`gone()` inside a scenario and `waitUntil(predicate)` everywhere else. A timer inside a test DOUBLE's implementation is out of reach: the double is staging the world, not the test waiting on it. A double is a factory call (`vi.fn(…)`, `mockImplementation(…)`, a `mockOf` handler) or a function-valued PROPERTY of an object literal, which is the plainest double there is — `const git: GitGateway = { cloneRepository: async () => … }`, where the object itself is the double.",
        facet: 'model',
        family: 'world',
        fix: 'Wait for the condition, not for a duration.',
        name: 'no-sleep',
        rationale:
            'A fixed sleep makes tests slow and flaky; waiting on a condition is deterministic.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "A `beforeEach`/`beforeAll` in a test file is a warning, and so is an `afterEach`/`afterAll` whose body does more than restore (`cleanup`, `vi.useRealTimers`, `vi.restoreAllMocks`, `vi.resetAllMocks`, `vi.unstubAllGlobals`, `vi.unstubAllEnvs`) — handed over by name (`afterEach(vi.restoreAllMocks)`) or called in the body. `afterAll(cleanup)` in a `*.specification.ts` is `cleanup-passed-to-after-all`'s own idiom and out of reach by role.",
        facet: 'model',
        family: 'chain',
        fix: 'Call a function from each test instead of a hook; `clock.at()` and `intercept()` restore themselves.',
        name: 'given-in-the-test',
        rationale:
            'A hook moves the setup out of the only place a reader looks, shares it with every test in the file, and half of them come to depend on it quietly.',
        reach: 'tests',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A scenario (`.visit()` on website, `.open()` on mobile, `.render()` on component) is the When: the visitor acts and the capture reflects the settled state; no `expect()` in the callback — assertions live in the Then, on the returned result.',
        facet: 'model',
        family: 'elements',
        fix: 'Move the assertion out of the callback, onto the result the terminal action resolves to.',
        name: 'no-expect-in-scenario',
        rationale:
            'Separating interaction from assertion keeps the setup → action → result grammar intact and the scenarios replayable.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            "In a test file, a scenario's elements are user-facing (`button`, `link`, `field`, `heading`, `content`; on mobile `button`, `field`, `content`). `testId()` is the one escape hatch, and the line STATES what the element lacks: a `// testId: <what is missing>` comment on the call's own line or the one directly above. It is an invariant, not a rationale.",
        facet: 'model',
        family: 'elements',
        fix: 'Write `// testId: <no accessible name | no role | …>` on the call’s line or the one above — or name the element with `button()`/`link()`/`field()`/`heading()`/`content()`.',
        name: 'test-id-states-what-is-missing',
        rationale:
            'Testing what the user sees (roles, labels) keeps specs robust to DOM rewrites; a test id sidesteps that guarantee, and without the invariant written down nobody can tell whether the hatch is still needed.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'statique',
        convention:
            'A scenario under `specs/` that ACTS (`click`, `fill`, `select`, `check`, `press`, `tap`, `rerender`) on the visitor it was handed ends on `visitor.see(…)`, `visitor.gone(…)` or `visitor.unmount()` — through the block, branch, loop or `.then()` it ends in. A scenario that only reads is out of reach, and so is a component test, whose action often produces a CALL rather than a screen.',
        facet: 'model',
        family: 'elements',
        fix: 'End on `visitor.see(<what the action produced>)` or `visitor.gone(<what it removed>)`.',
        name: 'scenario-ends-settled',
        rationale:
            'The capture is taken when the callback returns: a scenario ending on a click hands the golden whatever was on the screen at that instant, and the failure reads as flakiness rather than as a missing wait.',
        reach: 'specs',
        severity: 'warn',
    },
];

/** Oxlint never visits data fixtures nor reads two files at once. */
export const CHECKER_PASSES: CatalogEntry[] = [
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A `<case>.spec.yaml` is a SPEC, not ground: a document under `expected/`, `requests/`, `seeds/` or `fixtures/` is an error.',
        facet: 'cli',
        family: 'layout',
        fix: 'Move the document beside the test that runs it.',
        name: 'no-document-in-ground',
        rationale:
            'A document IS the scenario; filed under ground it reads as material a scenario stands on, and the reader cannot tell which files are run.',
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A test under `specs/<facet>/`, where the facet root holds a `*.specification.ts(x)`, imports that module or constructs a runner itself. Ground is out of reach — nothing under a `fixtures/`, `expected/`, `requests/` or `seeds/` folder is a spec, a `.test.ts` under `expected/` being the GOLDEN a fixer writes. So is any first-level folder that is not a facet: a specification with no module to sit beside and no runner to reach lives in a repository suite there.',
        facet: 'model',
        family: 'layout',
        fix: 'Import `{ <facet> }` from `<facet>.specification.js`, move a module test beside its module, or move a repository suite to a first-level folder of its own under `specs/`.',
        name: 'facet-test-uses-its-runner',
        rationale:
            "A test reaching no runner under a facet is a module test paying the facet's budget and services to prove something that belongs beside its module.",
        reach: 'specs',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A first-level folder named for one of the six facets holds a `*.specification.ts(x)` calling `specification.<facet>(`. Positive-only: any other first-level name is a repository suite, judged by `specs-at-declared-depth`'s declared depth alone.",
        facet: 'model',
        family: 'layout',
        fix: 'Create the specification the folder promises, or rename the folder.',
        name: 'facet-folder-has-specification',
        rationale:
            'Folder = constructor is the law the fork rests on; a facet folder with no runner tells the reader something false before they open a file.',
        reach: 'specs',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A `seeds/**/*.sql` states absolute timestamps: `CURRENT_TIMESTAMP`/`CURRENT_DATE`/`CURRENT_TIME`, `NOW()` and the quoted `'now'` SQLite's date functions take (`datetime('now')`, `strftime(…, 'now')`, `date('now', '-1 day')`) are refused. A comment is not state, so a clock read inside one is not a finding.",
        facet: 'model',
        family: 'world',
        fix: "Write the instant the case is about, and pin the run's clock with `.clock()` on the chain.",
        name: 'seeds-state-absolute-time',
        rationale:
            "A seed that reads the clock makes the row's date the date the suite happened to run: a case about \"published yesterday\" proves something different every day, and under SQLite `datetime('now')` writes a space-separated text where an ORM writes ISO `T`, so the two misorder across a calendar day. The R8 dry run counts 36, every one of them signews-api's.",
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'Ground in a leaf holding ≥ 2 node tests (`.test.ts`, `.spec.ts`) that a single one of them reads is a warning. A `.test.tsx` tree is out of reach, as it is for `specs-at-declared-depth`, and so are the api, cli and job facets: there a leaf is its subject’s standard name (`spec-in-subject-folder`), its aspect files share it by design, and a folder of one spec’s own is one `spec-in-subject-folder` moves the spec back out of.',
        facet: 'model',
        family: 'layout',
        fix: 'Give that spec its own domain folder, with the ground beside it.',
        name: 'ground-beside-its-only-reader',
        rationale:
            'Ground one spec reads, parked where several sit, reads as shared: everyone assumes someone else depends on it and nobody dares touch it.',
        reach: 'ground',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'Every `checker-disable-next-line` / `checker-disable-line` directive carries ` -- <reason>`, wherever a checker pass can be silenced: a test, a document, a fixture under ground. The word inside a string is prose, not a directive.',
        facet: 'model',
        family: 'setup',
        fix: 'Write `checker-disable-next-line <name> -- <reason>`.',
        name: 'checker-suppression-states-a-reason',
        rationale:
            "A suppression with no reason is a rule turned off by someone no longer here: the next reader cannot tell whether the pass was wrong or simply in the way, so the line survives every review. The toolchain's own gate reads `oxlint-disable*` and nothing else.",
        reach: 'specs',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'Every workspace member with tests OF ITS OWN (a `test` script that does not delegate to members, or a `*.test.ts(x)` outside another package’s tree) declares a vitest config (`vitest.config.*`). The MEMBER pass judges the member itself, with or without a `specs/` root; a root that only delegates owes nothing.',
        facet: 'model',
        family: 'setup',
        fix: 'Write `export default defineSpecConfig()` in the member — the preset carries the budgets, the artefact directory and the ground exclusion.',
        name: 'member-has-vitest-config',
        rationale:
            "Without a config, vitest's 5 s budget and unexcluded ground folders are running the member's tests: the default is not chosen, it is inherited.",
        reach: 'member',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "`environment: 'happy-dom'|'jsdom'` in a `vitest.config.*` is an error. The MEMBER pass is the one channel that holds it: a config is not always a file the repository's oxlint configuration collects, while the member pass starts from the root manifest and reaches every declared member — and one finding is one line in one report.",
        facet: 'component',
        family: 'setup',
        fix: 'Remove `environment` and collect the rendered tests with `component()`.',
        name: 'no-simulated-dom-in-config',
        rationale:
            "The static pass sees only what the repository's oxlint configuration hands it; the member pass starts from the root manifest and reaches every declared member.",
        reach: 'member',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`) — except `@testing-library/react-native` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands. Jest runs them when the member DECLARES it (a `jest`/`jest-expo` dependency, a `jest` field, a `test` script calling it) or when a `jest.config.*` elsewhere in the workspace ROOTS into the member, which is the shape a library co-locating its render tests takes when the app beside it owns the only working toolchain. The optional peers — `playwright`, `vite`, `react`, `better-sqlite3`, `pg`, `redis`, `testcontainers`… — are declared by the consumer, by design.',
        facet: 'model',
        family: 'imports',
        fix: 'Remove the declaration: a transitive is already resolved by the package; a retired seam has a facet that replaces it (`component()`, `website()`, `clock`, `intercept()`). The diagnostic carries a sentence for each case.',
        name: 'no-redundant-test-dependency',
        rationale:
            'A duplicate declaration lets two versions of one seam coexist, and a retired seam keeps a vocabulary the framework has replaced.',
        reach: 'member',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'Every `{{token}}` in an `expected/` fixture — or in an expected stream of a `<case>.spec.yaml` document — belongs to the frozen vocabulary; an unknown token is an error.',
        facet: 'model',
        family: 'expectations',
        fix: 'Write a token the grammar knows; the message prints the full list.',
        name: 'no-unknown-token',
        rationale:
            'A closed grammar shared with the runtime matcher stops the two channels drifting.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A malformed ref of a known kind (`{{iso8601#}}`, `{{uuid #id}}`) in a text file under `expected/` is an error.',
        facet: 'model',
        family: 'expectations',
        fix: 'Write `{{kind#name}}` with no space, and a name for the ref.',
        name: 'no-malformed-ref',
        rationale: 'A malformed capture would fail silently — naming it makes it visible early.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'The first line of a depth-1 `.http` follows its grammar: a request line (`METHOD /path`) under `requests/`, a status line (`HTTP/1.1 <status>`) under `expected/`.',
        facet: 'api',
        family: 'expectations',
        fix: 'Write the opening line the folder calls for, or move the file to the other one.',
        name: 'http-first-line-follows-its-grammar',
        rationale:
            'The opening line is what tells a request from a response — constraining it catches misplaced files.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A `<case>.spec.yaml` document follows its grammar: closed keys — `description`, `fixture`, `env`, `serve`, `runs` — and closed keys inside a run; `description:` and `runs:` required; `command:` and `exit:` required in every run, `exit:` an integer literal, `waitFor:` only on the last run and never with `stdin:`, a `files:` path relative and under the workdir; every `fixture:` path relative, reaching `fixtures/`.',
        facet: 'cli',
        family: 'expectations',
        fix: 'Write the key the grammar names; the message prints the accepted set.',
        name: 'document-follows-its-grammar',
        rationale:
            "The grammar is read by the runner's own parser: the document lint accepts is exactly the one the runner runs.",
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'The keys of a `<case>.spec.yaml` follow the canonical order — `description, fixture, env, serve, runs` at document level, `command, stdin, timeout, waitFor, exit, stdout, stderr, files` inside a run. Fixable (`--fix`).',
        facet: 'cli',
        family: 'expectations',
        fix: 'Run `jterrazz-test-check <root> --fix`; it rewrites the order.',
        name: 'document-keys-in-canonical-order',
        rationale:
            'The setting before the session, the input before the output: one order makes documents comparable and removes the diffs that change nothing.',
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            '`stdout`, `stderr`, `stdin` and `files.*.equals` of a `<case>.spec.yaml` are written as block scalars (`|` keeps the trailing newline, `|-` drops it), never as a quoted string carrying `\\n`. Fixable (`--fix`).',
        facet: 'cli',
        family: 'expectations',
        fix: 'Run `jterrazz-test-check <root> --fix`; it rewrites the scalar.',
        name: 'document-streams-written-as-block-scalars',
        rationale:
            'Expected output has to look like output — a golden on one line is unreadable and no diff can show it.',
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'The suffix says the kind, and the tree agrees with it. A `.spec.ts` — the ASSEMBLED product — lives under `specs/<facet>/`; anywhere else is an error. A `.test.ts` — the UNIT — lives beside its module; under a facet folder (`api`, `cli`, `integration`, `job`, `mobile`, `website`) it is an error, fixable by `--fix` (a `git mv`). A `.test.ts` that reaches no runner is `facet-test-uses-its-runner`’s, whose fix is the opposite move, and the mover leaves it alone. A first level that is NOT a facet is a repository suite: it covers a tree, keeps `.test.ts`, and `specs-at-declared-depth`’s declared depth is what judges it — unless the tree carries its `*.specification.ts` at its own ROOT, which makes the whole tree one facet’s and every `.test.ts` below it a spec. A document is named `<case>.spec.yaml`: `<case>` in kebab-case, without the words `test`/`spec`/`cli` the suffix already carries, and never the bare name of its directory.',
        facet: 'model',
        family: 'layout',
        fix: 'Move the `.spec.ts` under `specs/<facet>/` (or rename it `.test.ts` beside its module); rename the facet `.test.ts` to `.spec.ts` — `jterrazz-test-check <root> --fix` does it with `git mv`, and names every `include`/`exclude` entry of the member the rename broke.',
        name: 'file-suffix-matches-place',
        rationale:
            'With no agreement between the suffix and the tree, a reader cannot say what a test proves without opening it; and the filename is the first sentence they read — `rm/rm.spec.yaml` says nothing twice.',
        reach: 'specs',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A document's `description:` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters.",
        facet: 'cli',
        family: 'layout',
        fix: 'Write it as a title, not as a sentence.',
        name: 'document-description-is-a-title',
        rationale:
            "The description IS the vitest title — a title's rules apply to it, not a paragraph's.",
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'Two `<case>.spec.yaml` documents in one directory do not share a `description:`.',
        facet: 'cli',
        family: 'layout',
        fix: 'Name what each case proves; two titles that read alike leave two files to open.',
        name: 'document-description-unique',
        rationale: 'The reporter names the title: two identical titles leave two files to open.',
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'No expected output carries a literal volatile value: a loopback origin with a port (`127.0.0.1:8080`, `localhost:3000`), an absolute temporary path (`/tmp/`, `/private/tmp/`, `/var/folders/`) or a home path (`/Users/…`, `/home/…`). Both halves of the ground are judged by the one list — an expected stream of a `<case>.spec.yaml`, and every text file under `expected/`. A `{{token}}` is not a literal, and neither is a value the DOCUMENT pinned: in a stream, a word the same document states in a command argument, an `env:`/`serve:` value, a `stdin:`, a `fixture:` it names or its own sibling `fixtures/` is excluded before it is judged.',
        facet: 'cli',
        family: 'expectations',
        fix: 'Write the token the message names — `{{workdir}}`, `{{url}}` — in place of the literal.',
        name: 'no-volatile-literal',
        rationale:
            'This is exactly the shape a `TEST_UPDATE` run would have tokenised: finding one means a token was overwritten by hand.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A literal ISO-8601 timestamp or uuid in an expected stream of a `<case>.spec.yaml` → warning, unless the same value appears in a `fixture:`, the document's sibling `fixtures/`, a `stdin:`, a command argument or an `env:`/`serve:` value of the same document (it is then pinned, not volatile). Under `expected/` the same class waits for `no-unseeded-value-in-golden`, whose criterion chapter 18 carries.",
        facet: 'cli',
        family: 'expectations',
        fix: 'Token it, or seed it — a value the document pins is a value it may assert.',
        name: 'pinned-value-from-the-input',
        rationale: 'The defect is not the literal: it is the literal nothing pinned.',
        reach: 'document',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'An expected stream whose whole content is `{{any}}` → warning: the run executes and proves nothing.',
        facet: 'cli',
        family: 'expectations',
        fix: 'Regenerate with `TEST_UPDATE=1` and keep tokens only for the parts that move.',
        name: 'no-empty-expected-stream',
        rationale:
            'The `no-empty-expected-stream` mirror for documents — an assertion that accepts anything is an absent assertion.',
        reach: 'document',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A run whose `exit:` is non-zero with neither `stdout:` nor `stderr:` → warning: the document does not say why the command refused.',
        facet: 'cli',
        family: 'expectations',
        fix: 'Write the refusal the command prints — that is what the case proves.',
        name: 'no-silent-refusal',
        rationale:
            'A silent refusal is either a defect in the product, or a golden that forgot the words went to stderr.',
        reach: 'document',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A document's bare `env:` words and `serve:` names are keys of the `env`/`serve` objects of a `specification.cli(…)` in the nearest directory carrying `*.specification.ts` files (literals read statically; ignored otherwise).",
        facet: 'cli',
        family: 'setup',
        fix: 'Register the name in the specification, or fix the spelling.',
        name: 'document-env-and-serve-registered',
        rationale:
            'A typo (`serve: dashbord`) fails at run time today, a test file later; here it is one lint line.',
        reach: 'document',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'A known token in a file under `requests/` → warning: requests are inputs, never matched.',
        facet: 'api',
        family: 'expectations',
        fix: 'Write the literal value the request actually sends.',
        name: 'no-token-in-request',
        rationale:
            'A token in an input is neither validated nor substituted — it is almost always a mistake.',
        reach: 'ground',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "No dead fixtures: every file under `seeds/`/`requests/`/`fixtures/` and every top-level entry of `expected/` must be referenced — a leaf's, and the specs root's shared four under `<specs>/shared/`; a feature directory with no test file and no `*.spec.yaml` is an orphan (a warning when the argument is not a literal). A reference is a path RESOLVED to the entry, never a name: a document's keys and a `file()`/`directory()` argument from the file that writes them, the words of any other literal from that file and from the project root, a template literal's table from the folders written before its hole — so `./seeds/x.sql` in a leaf vouches for that leaf's `seeds/x.sql`, and not for `<specs>/shared/seeds/x.sql`. A `<case>.spec.yaml` references the files every path key of it names.",
        facet: 'model',
        family: 'layout',
        fix: 'Reference it from the spec it stands under, or delete it.',
        name: 'no-unused-ground',
        rationale:
            'The `named-path-exists` mirror — a fixture nothing references is dead weight that misleads the reader.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A ground file exists only if it is shared, and a value lives in a test only while it stays short. The checker counts the TESTS that read each file of the specs trees — a `test()`/`it()` whose body names it with a literal `file()`/`directory()`, a document — and judges its level. Read by ONE test, and named by no module test of the member, a file of `expected/` or `requests/` is an error where the test names it: it belongs in the test, written in place — a golden as the value `toMatch` compares, a request as its text or its body value — unless it is a directory tree, a binary file, or longer than its role's cap: 30 lines for `requests/`, 150 for `expected/` (a JSON file counted as the value it becomes). The caps hold the other way too: a request or a body written in the test past 30 lines, an expectation past 150, is an error where it is written, and belongs in a file beside the test. `seeds/` has no form in place — SQL is never written in a test, and SQL tagged in one is an error where the tag stands: a seed is a `.sql` file, beside its test in `./seeds/` when one test reads it, never an error for being unshared. `fixtures/` is file state a program reads, never a value, and stays a file. Read by several tests of ONE leaf, a file lives beside them: an entry of the specs root's shared ground (`<specs>/shared/seeds/`, …) one leaf alone reaches is an error where it sits, and belongs in the leaf's folder of the same role — unless a module test of the member names it — by a relative literal, or by the literal pieces `named-path-exists` reads: a module test reads from outside every leaf, so the entry is shared. Read from several leaves, it lives in the specs root's shared ground — `no-reach-into-sibling-ground` refuses the path that leaves a leaf for a sibling's, and `no-duplicate-ground` finds copies — unless one of them encloses the others: a route and the routes under it (`map/pois/` and `map/pois/detail/`) share it in the route's own folder of that role, which each reaches. A reference outside every test — a `const` of the file, a specification, a helper — counts as shared, and zero references is `no-unused-ground`'s. Fixed by `--fix`: SQL a test holds is written to `./seeds/<name>.sql` beside it — named by its first `--` comment, kebab-cased, else by the first four meaningful words of its test's title — and named with `file()`; a value past its cap is written to `./requests/` or `./expected/` beside its test, named by the test's title, and named with `file()` — never one a plain value is compared to (`expect(message).toMatch(…)`, a name or a string literal as the subject): a string has no golden, and the finding names `text()` to wrap it with; a single-use file whose one reference is a literal `file()` handed to `.request(`, `.post(`/`.put(` or `toMatch(` is written in place and deleted (a `file` import no longer used dropped, an emptied ground folder removed); an entry of the shared ground one leaf alone reaches — or one leaf and the leaves inside it — is moved into that leaf's ground (a `git mv` in a work tree) and the literals rewritten from each referrer.",
        facet: 'model',
        family: 'layout',
        fix: 'Run `jterrazz-test-check <root> --fix`: it writes SQL and a value past its cap to a file beside the test, writes a single-use file into its one test and deletes it, and moves a specs-root entry one leaf reaches beside that leaf. A test whose subject IS the file form keeps it, with a reasoned `checker-disable-next-line ground-shared-or-inline`.',
        name: 'ground-shared-or-inline',
        rationale:
            "A file a test reads is read at a distance: the reader opens a second file to know what the test stands on or expects, and a file one test reads pays that price for nothing — until the value is too long to read in the test, where the file is the clearer page. SQL is the exception at any length: a seed is database state a reader opens as a file, and SQL in a TypeScript string is checked by nothing. A single scenario's file parked in the pool is worse still — it reads as shared, so nobody dares change it.",
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (`GET /events/:id`, the request line of a `.http` a `.request(file())` sends), a job chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens. A file reaching several is an error at the first chain that reaches a second. Fixed by `--fix`: each test goes to the file of its subject — the subject’s standard folder under the facet, as `spec-in-subject-folder` names it, the file keeping its aspect’s name; beside the file, named for the subject, where the subject has none — keeping the imports and the file-level declarations it reads, and a hook (`beforeEach`, `afterEach`, …) only where the file’s tests read what it sets or clears — a declaration two of the new files read, and every declaration it reads in turn — a type alias or an interface among them — moves once into the fixtures module of the folder they share (`<folder>/<folder>.fixtures.ts`), exported and imported by each, unless it builds a `file()` or a `directory()` (`paths-named-in-the-test`) or the module already exists, and then it stays copied; the paths the code names keep pointing where they pointed, and the old leaf’s ground another leaf reads goes up to the specs root’s shared ground (`<specs>/shared/<role>/`), a module test’s relative literal naming it following, where `ground-shared-or-inline` moves it down to the one leaf that reads it when no module test reads it too. A test whose own chains reach two subjects is reported and left. A spec of a SPECIMEN is out of reach — one whose runner drives an app under `<specs>/shared/fixtures/`, its specification module (or the one that module imports a runner from) naming the shared fixtures in a literal: its routes, jobs and commands are no subject of the project.',
        facet: 'model',
        family: 'layout',
        fix: 'Run `make fix`: it splits the file, one per subject. A test reaching two subjects states what it stands on with a seed instead of a second action.',
        name: 'one-subject-per-spec',
        rationale:
            'A file about one subject is found by its subject: the reader of `GET /events/:id` opens one folder and reads every question asked of it, and a change to that route touches one file.',
        reach: 'spec',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A spec file about one subject sits in the subject’s standard folder, derived and never listed: `GET /events` → `events/list/`, `GET /events/:id` → `events/get/`, `POST /events` → `events/create/`, `PUT|PATCH /events/:id` → `events/update/`, `DELETE /events/:id` → `events/delete/`, a route under an item (`GET /events/:id/timeline`) its literal segments (`events/timeline/`), a singleton (`GET /health`) `health/get/`, a method-less route — one `jterrazz.config.ts` names so (`test: { methodless: ['/mcp'] }`), reached by whatever verb a test sends, and never split by it (`one-subject-per-spec`) — its segments (`mcp/`); a job its name (`specs/job/<job>/`), a cli command its first word (`specs/cli/<word>/`), or every leading word the `commands` list of the runner its chain's handle came from holds (`specification.cli(bin, { commands: ['db', 'migrate'] })` files `db migrate` under `db/migrate/`; the list written in the call or bound to a `const` of the runner's file). A GET on one segment lists a plural noun, or a collection `jterrazz.config.ts` names (`test: { collections: ['data'] }`), and gets anything else; a segment is a parameter when the chain writes the route's template (a `:name` segment, or `{ params }` beside the path, `route-written-as-template`), or when it is a template hole or anything but lowercase words. A filled path whose word sits right after a collection with more path after it (`btc` in `/indicators/btc/chart`) reads two ways: it is reported at its chain, naming the template to write — or `{ params: {} }` when the word is the route's own — and never moved; a `.http` request line is read as the route. A page, a journey and the root route have no standard name, and are not judged, and neither is a spec of a specimen (`one-subject-per-spec`). An error at the file’s first line; fixed by `--fix`, which moves the file as `one-subject-per-spec` does and removes the folders the move leaves empty.",
        facet: 'model',
        family: 'layout',
        fix: 'Run `make fix`: it moves the file to its subject’s folder, and the ground it stands on with it.',
        name: 'spec-in-subject-folder',
        rationale:
            'A name derived from the subject is the same in every repository: nobody lists the folders, nobody argues them, and a reader who knows the route knows the path.',
        reach: 'spec',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "Ground several leaves share lives once: an entry of a leaf's ground — a file, or a tree compared file by file — that another leaf holds byte for byte under the same role, whatever either is called, is a warning on every copy; it belongs in the specs root's shared folder of its role (`<specs>/shared/seeds/<name>`), named by the path that climbs to it. Fixed by `--fix` when the copies share one name: one copy is moved there — a `git mv` in a work tree — the others deleted, and every whole relative literal that named a copy rewritten — a literal of the specs tree's sources, a key of its documents, a literal of the member's module tests; a path built from pieces, or spelled into a command, is the author's to rewrite — `named-path-exists` names one built from literal pieces once the copy has moved. Copies of several names, and a shared folder already holding the name with other content, are left to the author.",
        facet: 'model',
        family: 'layout',
        fix: 'Run `jterrazz-test-check <root> --fix`, or keep the copies apart on purpose and record them in the ratchet.',
        name: 'no-duplicate-ground',
        rationale:
            "Copies drift: one leaf's seed gains a column, the other's does not, and the reader of either cannot tell a difference meant from one forgotten.",
        reach: 'ground',
        severity: 'warn',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "A path leaves its leaf only into the specs root's shared ground, `<specs>/shared/<role>/`, or into the ground of a leaf that encloses it: a path a `file()`, a `directory()` or any path key of a document names, whose target is neither under the spec's own directory, nor under one of `<specs>/shared/fixtures/`, `<specs>/shared/seeds/`, `<specs>/shared/requests/`, `<specs>/shared/expected/` — the four roles under the one folder the specs root keeps beside its facets — nor under the four of a folder above it that holds tests of its own (a route's, reached from a route under it: `map/pois/detail/` reads `../seeds/` of `map/pois/`), is an error; ground shared by several leaves goes there, in the folder of its role (`verb-reads-its-ground-folder` judges which). A leaf's ground reached from a sibling leaf is one such path, so this row holds the sibling case too. A role folder at the specs root itself (`<specs>/seeds/`) is shared ground outside `shared/`, an error at the folder; fixed by `--fix`, which moves each entry into `<specs>/shared/<role>/` — a `git mv` in a work tree — and rewrites every whole relative literal that named it: a literal of the specs tree's sources, a key of its documents, a literal of the member's module tests; a path built from pieces, or spelled into a command, is the author's to rewrite — `named-path-exists` names one built from literal pieces once the entry has moved (an entry `shared/` already holds by that name stays, for the author).",
        facet: 'model',
        family: 'layout',
        fix: "Copy it under this leaf's own ground, or promote it to the specs root's shared folder of its role — `<specs>/shared/seeds/` for a seed, `<specs>/shared/fixtures/` for file state; `make fix` moves a role folder at the specs root into `<specs>/shared/`.",
        name: 'no-reach-into-sibling-ground',
        rationale:
            "A leaf reaching into a neighbour's fixtures is the pool through another door, without the pool's visibility: the neighbour breaks a spec two folders away without knowing.",
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "Every `file()` and `directory()` a test names with a literal path — a spec under `specs/` and a module test beside its module alike — and every path a document's `fixture:` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a `file()` naming a directory or a `directory()` naming a file is an error, reported where the path is written. So does a path a test resolves from its own directory with literal pieces alone — `resolve(import.meta.dirname, …)`, `join(…)` alike, `__dirname` alike, `new URL('…', import.meta.url)` — of either kind: several pieces are read joined (`resolve(import.meta.dirname, '..', 'fixtures', 'gone')`), one piece only when it is spelled `./` or `../`, as a `file()` is — a lone bare piece (`resolve(import.meta.dirname, 'expected')`) is an output folder a test makes as often as a path it reads, and is not read. The tree pass reads the `specs/` trees, the member pass every other test of the member. A computed piece leaves its whole path out of reach, as a computed path is, a path spelled into a command a process runs is the author's, and the runtime refuses it with the path it resolved to; a call written inside a string is text, and is not read.",
        facet: 'model',
        family: 'layout',
        fix: 'Create the entry (out of `.gitignore`), or fix the path — the message names what it resolved to.',
        name: 'named-path-exists',
        rationale:
            'A typo in a path fails a run, a test later, far from the line that made it; statically it is one report line at the path.',
        reach: 'ground',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'One word per meaning: a folder named `snapshots/`, `__snapshots__/`, `golden/` or `goldens/` is an error anywhere in a member when a test would stand on it — any such folder under `specs/`, and elsewhere one that holds no module of code (a `goldens/` folder of matcher source is named for what its code does). What it would hold is what a test asserts, and that is `expected/`. Ground is not entered: a fixture project may carry the word on purpose.',
        facet: 'model',
        family: 'layout',
        fix: 'Rename the folder `expected/`, and the paths that name it.',
        name: 'no-snapshot-folder',
        rationale:
            'Four reserved names are a vocabulary only while nobody adds a fifth: a second word for the goldens is a second place a reader has to look, and the rules that read `expected/` never see it.',
        reach: 'all',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            "`docker-exec-bound-with-await-using`'s one channel: docker-aware runners are inferred from the `docker:` option of the imported specification file, and every `.exec()` result bound without `await using` is reported.",
        facet: 'model',
        family: 'chain',
        fix: 'Bind the result with `await using`, so the containers the run spawned are disposed with the scope.',
        name: 'docker-exec-bound-with-await-using',
        rationale:
            'Inferring the runners removes the hand-maintained list an oxlint rule would need.',
        reach: 'tests',
        severity: 'error',
    },
    {
        audience: 'consumer',
        channel: 'checker',
        convention:
            'With ≥ 2 databases, `database:` is required on every `.seed()`/`.table()`; with exactly one it is forbidden — checked by crossing the `services:` record with the calls in the tests.',
        facet: 'model',
        family: 'setup',
        fix: 'State `database:` everywhere or nowhere, whichever the record calls for.',
        name: 'database-named-only-when-several',
        rationale:
            'The number of databases fixes the call API; the cross-file analysis catches the omission before run time.',
        reach: 'tests',
        severity: 'error',
    },
];

/** Each row is proven by an `@ts-expect-error` in `src/type-channel.test-d.ts`, naming the words of its error, which `lint/self/corpus/type-channel.test.ts` holds it to. */
export const TYPE_ROWS: CatalogEntry[] = [
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            "A request to a route with parameters is written as the route's template, its values beside it — `api.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })` — and the template types them: every `:name` it holds takes a value, and no other name does. `get` and `delete` take the options second, `post` and `put` third, after the body; a path with no parameter takes none, or `{ params: {} }` to state that it is the route itself.",
        facet: 'api',
        family: 'chain',
        fix: "Write the route as the app declares it and hand its values: `.get('/events/:id', { params: { id } })`.",
        name: 'route-written-as-template',
        rationale:
            'A filled path hides which of its segments are values: the reader, the subject reader and route coverage all have to guess that `btc` in `/indicators/btc/chart` is a symbol. The template says it, and the compiler holds the values to it.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            "A string is a value and the disk is `file()` or `directory()`: `seed('./seeds/x.sql')` (a bare string where a file is meant), `seed(file('./seeds/x.json'))` (the wrong extension), `file('x.sql')` (not a relative path), `directory('./fixtures/shop')` (a directory without its `/`), `get(file(…))` (a file where a value is meant) and `toMatch(directory(…))` on a stream do not compile.",
        facet: 'model',
        family: 'chain',
        fix: "Name the disk from the spec file: `file('./seeds/users.sql')`, `file('./expected/help.txt')`, `directory('../../shared/fixtures/shop/')`.",
        name: 'disk-named-by-relative-path',
        rationale:
            'A bare name resolved against a hidden folder is a convention the reader has to know; a relative path is read where it is written, and the compiler refuses the other form at the call.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            'The `services` record types the factory argument: `server: (services) => …` sees exactly the keys the record declares.',
        facet: 'model',
        family: 'setup',
        fix: 'Declare the service in the record, or read the key that is there.',
        name: 'server-sees-declared-services',
        rationale:
            'A service read by a name nothing started is a startup failure with no line to blame; the compiler has the record in hand and can say so at the call.',
        reach: 'specification',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            '`server` and `url` are mutually exclusive on `specification.website()` — the pair is inexpressible, not runtime-checked.',
        facet: 'model',
        family: 'setup',
        fix: 'State `server` for a site this run starts, `url` for one already running.',
        name: 'no-server-with-url',
        rationale:
            'They name two different subjects, and a specification that states both leaves the reader to guess which site the spec is about.',
        reach: 'specification',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            'Exactly ONE terminal action closes a chain: what it answers is a result, and a result carries no verbs to continue with.',
        facet: 'model',
        family: 'chain',
        fix: 'Open a second chain for a second action.',
        name: 'one-terminal-action-per-chain',
        rationale:
            'Two actions in one chain make a test with two Whens, and the reader cannot tell which one the Then is about.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention: 'A chain carries no label: the test name is the sentence.',
        facet: 'model',
        family: 'chain',
        fix: 'Name the test; the chain states what it does, not what it is called.',
        name: 'no-chain-label',
        rationale: 'A second place to read the intent is a second place for it to be stale.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention: 'A result accessor is read-only.',
        facet: 'model',
        family: 'expectations',
        fix: 'Assert on what the run produced; change the Given if the answer is wrong.',
        name: 'result-accessor-is-read-only',
        rationale:
            'The answer a run produced is evidence, and a test that can rewrite its own evidence proves nothing.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            '`mockOf<Port>()` needs its port: `T` is constrained to `object` with no default, so a double built without one has no surface and every call on it is refused.',
        facet: 'model',
        family: 'world',
        fix: 'State the port: `mockOf<PaymentGateway>()`.',
        name: 'mock-of-needs-a-port',
        rationale:
            'The type argument IS the contract the double stands for; without it the double agrees with anything.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'type',
        convention:
            "The verb set is the boundary between the facets: `goto` is the page's, `rerender`/`unmount` the component's, `tap` the screen's, and `focused`/`disabled`/`selected`/`valued` reach only where `see` and `gone` do.",
        facet: 'model',
        family: 'elements',
        fix: 'Reach for the verb the facet offers; a missing one is a decision, not an omission.',
        name: 'verb-belongs-to-its-facet',
        rationale:
            'One vocabulary across three facets is memorable only while each facet refuses the words it cannot mean.',
        reach: 'tests',
    },
];

/** One owner per convention (ADR-005); a core rule whose options other owners already set is the exception, since an override replaces options rather than merging them. */
export const UPSTREAM_RULES: CatalogEntry[] = [
    {
        audience: 'consumer',
        channel: 'upstream',
        convention:
            'No vitest snapshot matcher: `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`, `toMatchAriaSnapshot`, `toMatchScreenshot`, `toThrowErrorMatchingSnapshot` and `toThrowErrorMatchingInlineSnapshot` are refused by `vitest/no-restricted-matchers`, whose option the `testing` fragment sets (ADR-005).',
        facet: 'model',
        family: 'expectations',
        fix: "Write the golden: `expect(subject).toMatch(file('./expected/<name>.<ext>'))`; under `src/` compare to a literal with `toStrictEqual`.",
        name: 'no-vitest-snapshot',
        rationale:
            'A snapshot is written by the run that was supposed to be judged by it: nobody reads the diff, and a wrong answer becomes the expectation the moment someone re-records.',
        reach: 'tests',
        upstream: 'vitest/no-restricted-matchers',
    },
    {
        audience: 'consumer',
        channel: 'upstream',
        convention:
            'At most one level of `describe` — `vitest/max-nested-describe` with `{ max: 1 }`, set by the `testing` fragment.',
        facet: 'model',
        family: 'layout',
        fix: 'Flatten the nesting: the test name is the sentence, and one level groups the file.',
        name: 'one-describe-level',
        rationale:
            'A tree of contexts is state a reader has to hold in their head to know what a test is about, and the name of the test stops being the sentence it was.',
        reach: 'tests',
        upstream: 'vitest/max-nested-describe',
    },
    {
        audience: 'consumer',
        channel: 'upstream',
        convention:
            '`vi.stubGlobal`, `vi.useFakeTimers`, `vi.setSystemTime` and `vi.useRealTimers` are refused by `vitest/no-restricted-vi-methods`, each with the primitive that replaces it — a subject that fetches a relative URL states its base with `intercept(stubs, { origin })`. `vi.stubEnv` is sanctioned; `vi.mock`/`vi.doMock` stay on `no-module-mock`, whose allow-list the option cannot express.',
        facet: 'model',
        family: 'world',
        fix: 'Reach for `intercept()` and `clock` — both give back what they took at the end of the scope.',
        name: 'no-vitest-time-or-global-stub',
        rationale:
            'A stubbed global is the network replaced by a function the test wrote, and a fake timer taken without `using` outlasts the test that took it.',
        reach: 'tests',
        upstream: 'vitest/no-restricted-vi-methods',
    },
];

/** Where static analysis abstains (non-literal arguments) or cannot reach (network, container lifecycle). */
export const RUNTIME_RULES: CatalogEntry[] = [
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['route-written-as-template-at-runtime']} The chain fills each \`:name\` segment with its value, URI-encoded, the query kept, and sends the filled path; route coverage reads the request by its template — a parameter where the route declares one, each literal segment as itself. A template handed no params, a parameter with no value and a value no parameter takes are refused before a request is sent, naming the call to write.`,
        facet: 'api',
        family: 'chain',
        fix: "Hand exactly the template's parameters: `.get('/events/:id', { params: { id } })`.",
        name: 'route-written-as-template-at-runtime',
        rationale:
            'The compiler holds a typed spec to its template; a cast or a JavaScript spec is held here, before a request the app would answer 404 is taken for a finding about the app.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            'A sequence is expressed by SEEDING the state the second run would have found: every chain starts on databases the framework has reset.',
        facet: 'model',
        family: 'chain',
        fix: 'Seed the state the earlier step would have left, and open one chain per action.',
        name: 'sequence-expressed-by-seeding',
        rationale:
            'A spec that depends on a previous one passes alone, passes in order, and fails the day the runner reorders them.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            'An `expected/*.http` starts with a status line, and its headers are matched as a SUBSET: the ones listed must match, unlisted response headers are unconstrained.',
        facet: 'api',
        family: 'expectations',
        fix: 'List the headers the case is about; leave the rest out.',
        name: 'expected-headers-are-a-subset',
        rationale:
            'A response carries headers no test is about (dates, lengths, proxies); matching them all would make every golden a record of the machine that wrote it.',
        reach: 'ground',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            "A golden's path may name a subfolder (`./expected/build/verbose.txt`): the path is the file, and update mode creates the folders it names.",
        facet: 'model',
        family: 'layout',
        fix: 'Name the subfolder in the path.',
        name: 'golden-path-creates-folders',
        rationale:
            'A flat folder stops being readable at a dozen files, and a path that names its subfolder is read where it is written — no second option says where a golden lives.',
        reach: 'ground',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            "Every golden reads the `file()` or `directory()` it is given, from the spec file's directory — response, stream, json, tree alike — and `request()` reads a request the same way. Nothing resolves against a folder the line does not name.",
        facet: 'model',
        family: 'expectations',
        fix: "Name the golden from the spec: `file('./expected/<case>.<ext>')`.",
        name: 'golden-read-from-its-path',
        rationale:
            'One resolution rule, written on the line, means a reader knows where a golden lives without knowing any convention or which accessor produced it.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            'Isolation is per WORKER: each worker takes its own schema, database index or file copy, so two workers never share state.',
        facet: 'model',
        family: 'setup',
        fix: 'Take the handle the runner gives the chain; a client opened at the default index talks to another worker.',
        name: 'state-isolated-per-worker',
        rationale:
            'Parallelism is the default, and a shared database turns it into a source of failures that never reproduce alone.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            'The capture is docker-aware: every container a run spawned carries that run label, and the scope exit removes them whether the test asked about them or not.',
        facet: 'model',
        family: 'setup',
        fix: 'Bind the result with `await using`, and declare `docker` on the runner.',
        name: 'containers-removed-with-the-run',
        rationale:
            'A container that outlives its run is a machine filling up quietly, and the next run inherits its state.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['database-named-only-when-several-at-runtime']} The framework throws at run time if \`database:\` is absent with ≥ 2 databases, or present with exactly one (it doubles the checker channel).`,
        facet: 'model',
        family: 'setup',
        fix: 'State `database:` everywhere or nowhere, whichever the record calls for.',
        name: 'database-named-only-when-several-at-runtime',
        rationale: 'The runtime keeps the guarantee even where static analysis abstains.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['disk-named-by-relative-path-at-runtime']} The framework refuses at run time a verb that reads the disk (\`seed\`, \`request\`, \`fixture\`, \`run\`) handed anything but a \`file()\`/\`directory()\` — a bare string names the wrapper to write — and a \`file()\`, \`directory()\` or document \`fixture:\` whose path does not start with \`./\` or \`../\`. The trailing \`/\` says which of the two a path is, and the disk must agree: a directory named without it, or a file named with it, is refused, and so is a path that names nothing, with the path it resolved to.`,
        facet: 'model',
        family: 'chain',
        fix: "Name the disk from the spec file: `file('./seeds/users.sql')`, `directory('../../shared/fixtures/shop/')`.",
        name: 'disk-named-by-relative-path-at-runtime',
        rationale:
            'The type refuses a bare name at the call; the runtime keeps the law for a caller the compiler does not see — a JavaScript spec, a cast, a document.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention:
            'In `cli` mode with `services`, the framework injects `<KEY>_URL` (camel-aware CONSTANT_CASE) plus the unambiguous aliases `DATABASE_URL`/`REDIS_URL`; `.env()` overrides (`null` unsets).',
        facet: 'cli',
        family: 'chain',
        fix: 'Read the variable the record key injects; state `.env()` only to override or unset it.',
        name: 'service-urls-injected',
        rationale:
            'Injecting the URLs avoids the repeated hand-wiring and its drift (see `no-redundant-service-url`).',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['network-strict-after-first-stub']} As soon as an \`api\`/\`job\` chain declares an intercept, any unmatched outgoing request (an exhausted queue included) fails the spec with an explicit error.`,
        facet: 'model',
        family: 'world',
        fix: 'Declare the stub the request needs, or stop making the request.',
        name: 'network-strict-after-first-stub',
        rationale: 'A guarded network makes external interactions exhaustive and intentional.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['one-verb-per-meaning']} Its argument says where the expectation lives: a value written in place — a stream's text, a response's \`.http\` text, a json's value, a table's rows (awaited) — or a \`file()\`/\`directory()\` golden. On a plain string it is vitest's own — a string or a RegExp — and a \`file()\` or a \`directory()\` handed to it is refused, a runner started or none (the path object would otherwise read as the pattern \`[object Object]\`); a string is goldened wrapped, \`expect(text(value)).toMatch(file(…))\`, and a stream's text is \`result.stdout.text\`. A value of the wrong shape — a RegExp on a stream, a response or a json, anything but rows on a table — does not compile, and past the compiler it is refused in both builds, naming the form that takes it; a directory, the working directory and a container take no value, and are refused naming \`directory()\` or \`toBeRunning()\`; a golden handed a subject that has none of its kind is refused, naming the wrapper the subject takes. An empty stream is an empty text: \`toBeEmpty\` is a table's matcher, and handed a stream it is refused in both builds, naming \`expect(<stream>.text).toBe('')\`.`,
        facet: 'model',
        family: 'expectations',
        fix: "Write the whole result in place, ``toMatch(`…`)``, or `toMatch(file('./expected/<case>.<ext>'))` when it lives on disk; a part of a text is vitest's, on `.text`.",
        name: 'one-verb-per-meaning',
        rationale:
            "A result is not a string, so vitest's substring meaning never applied to it: one verb compares it whole, the value in place when the test is its only reader, a branded `file()` when the expectation lives on disk — and the runtime refuses the crossed form a type cannot see (a cast, a JavaScript spec).",
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['descriptor-matches-one-element']} An element descriptor must designate exactly ONE element when a verb ACTS on it (\`click\`/\`tap\`/\`fill\`): if several match, the action is refused with an error enumerating the candidates and offering the rewrites (\`within(...)\`, another descriptor). The framework never acts on "the first". A name designates the WHOLE accessible name — \`{ exact: false }\` is the opt-out — and a descriptor that finds nothing whole is not found, whatever a substring would have matched. It holds on both scenario facets, website and mobile; on mobile, \`see()\` — which acts on nothing — is satisfied by any visible match (the XCUITest tree legitimately duplicates a label between a container and its child).`,
        facet: 'model',
        family: 'elements',
        fix: 'Scope it with `within(<landmark>, …)`, or name the element with a descriptor that designates one thing.',
        name: 'descriptor-matches-one-element',
        rationale:
            'Acting on the first match makes a spec green while the visitor clicks something else, and nothing ever says so — an ambiguity is a writing fault, not a case to be settled by DOM order. The counting exists only at run time: no static analysis can do it, which is why the channel is runtime.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        convention: `${REFUSAL_WHY['no-landmark-on-mobile']} The element vocabulary is ONE between the website and mobile facets; an ARIA landmark (\`main()\`, \`navigation()\`…) passed to a mobile verb is refused at run time.`,
        facet: 'mobile',
        family: 'elements',
        fix: 'Scope with `within(testId(…), …)`: a screen has no landmarks, and any descriptor works as the scope.',
        name: 'no-landmark-on-mobile',
        rationale:
            'One vocabulary keeps the API memorable; refusing the part with no iOS equivalent outright avoids a silent approximation.',
        reach: 'tests',
    },
];

/** Review-borne; listed so the catalogue is complete, the constitution keeps their rationale. */
export const PROCESS_RULES: CatalogEntry[] = [
    {
        audience: 'consumer',
        channel: 'process',
        convention:
            'The folder follows the assets: a test with asset directories of its own gets its own domain; tests with no local assets group as sibling `<aspect>` files. The static rule only checks the depth.',
        facet: 'model',
        family: 'layout',
        fix: 'Read what the assets say: a test that stands on its own ground earns a folder.',
        name: 'folder-follows-assets',
        rationale:
            'It is the assets that settle the grouping — a criterion no channel can decide alone.',
        reach: 'specs',
    },
    {
        audience: 'consumer',
        channel: 'process',
        convention:
            "A tool's output is asserted as a full golden per scoped use case, not as a cluster of greps; `.grep()` stays the scalpel for targeted probes.",
        facet: 'model',
        family: 'expectations',
        fix: 'Golden the stream, and keep `.grep()` for the one line a case is genuinely about.',
        name: 'output-asserted-as-a-golden',
        rationale:
            'A review judgement — the static channel cannot tell a legitimate grep from a lazy one.',
        reach: 'tests',
    },
];

/** Sorted so a generated chapter is byte-identical from one run to the next. */
export function ordered(rows: CatalogEntry[]): CatalogEntry[] {
    return rows.toSorted((a, b) => a.name.localeCompare(b.name));
}

export const consumerCatalog: CatalogEntry[] = ordered([
    ...STATIQUE_RULES,
    ...UPSTREAM_RULES,
    ...TYPE_ROWS,
    ...CHECKER_PASSES,
    ...RUNTIME_RULES,
    ...PROCESS_RULES,
]);
