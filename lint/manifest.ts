import { REFUSAL_WHY } from '../src/model/lesson/refusal.js';
import type { RuleDoc } from './rule-shape.js';

/**
 * The rule manifest — the single source of truth for the mechanized conventions
 * catalogue (docs-as-code inversion, phase 2).
 *
 * The constitution (`docs/18-conventions.md`) holds only principles, the
 * enforcement channels, process rules and design rationales. Every per-rule
 * normative sentence lives HERE, next to (or on) the code that enforces it. Seven
 * channels are assembled into one {@link catalog}:
 *
 * - **statique** — the `jterrazz/*` oxlint rules (`RULE_DOCS`, attached to each
 *   rule's `meta.docs`);
 * - **upstream** — the options this vocabulary sets on rules the `vitest`
 *   plugin owns (`UPSTREAM_RULES`, ADR-005);
 * - **checker** — the non-oxlint static passes bundled as `dist/checker.js`
 *   (`CHECKER_PASSES`);
 * - **runtime** — refusals/behaviours the framework enforces at execution time
 *   (`RUNTIME_RULES`);
 * - **type** — what the compiler refuses, proven by `src/type-channel.test-d.ts`
 *   (`TYPE_ROWS`);
 * - **meta** — what this package's own tests hold about the catalogue and about
 *   itself (`META_ROWS`);
 * - **process** — review-borne rules no channel can fully mechanize
 *   (`PROCESS_RULES`).
 *
 * The catalogue generator (`catalog.ts` / `dist/catalog.js`) reads this manifest
 * to (re)write the full seven-channel catalogue in `docs/19-linting.md`.
 * `plugin.test.ts` guards freshness and completeness.
 *
 * This module is pure data — it imports a type and the sentences the runtime's
 * refusals open on (`REFUSAL_WHY`, whose rows begin with them), so the lint
 * layer stays free of the framework runtime (CONVENTIONS I1) and the oxlint
 * bundle stays light.
 */

/** A catalogue row: a {@link RuleDoc} plus the implementation name it maps to. */
export type CatalogEntry = {
    /** The rule id, checker-pass id, or process id — unique across the catalogue. */
    name: string;
} & RuleDoc;

/**
 * Family letter → its section title.
 *
 * English, like every sentence the catalogue publishes. The rows were written
 * in French while the catalogue had one reader; a message a consumer's CI
 * prints, and a chapter their agent reads, are not that — and a half-French
 * catalogue is worse than either, because a reader cannot tell which half they
 * are in. K5 holds the line with a deny-list of the tokens that were here.
 */
export const FAMILIES: Record<string, string> = {
    A: 'Creating runners',
    B: 'Spec chains',
    C: 'Files & folders',
    D: 'Assertions',
    E: 'Environment & runner configuration',
    F: 'Imports & protecting production',
    G: 'Infrastructure',
    W: 'Website & mobile specs',
    I: 'Source architecture',
    J: 'Hygiene',
    K: 'Retro-propagation',
    M: 'Doubles, time & the proof of a seam',
};

/**
 * The **statique** channel — one entry per shipped `jterrazz/*` rule. Each rule
 * file attaches its entry as `meta.docs`, so a rule and its normative text can
 * never drift (the completeness meta-test asserts every rule carries one).
 *
 * **What this channel does NOT own.** A convention oxlint's own `vitest` plugin
 * already enforces belongs to that plugin, not here — `@jterrazz/typescript` v10
 * turns the plugin on over the test globs in every profile, so a consumer of the
 * preset gets it without wiring. Four hygiene rules left the channel on that
 * ground (J1, J3, J4, J5 → `vitest/no-focused-tests` + `vitest/no-disabled-tests`,
 * `vitest/expect-expect`, `vitest/no-identical-title`, `vitest/prefer-lowercase-title`).
 * `prefer-lowercase-title` is stricter than J5 was: a title opening on an all-caps
 * identifier (`HTTP 404 …`, `DI …`) now fails, and the rulebook carries no
 * `allowedPrefixes` — a title starts lowercase, whatever its first word. The
 * rest are behaviour-identical on this package's own fixtures. Only J2 (the
 * arbitrary-sleep ban, which has no upstream counterpart) stays statique.
 *
 * **Severity.** The estate's rulebook has no warn tier: a rule is on at `error`
 * or off with a recorded reason, and that law binds `@jterrazz/typescript`'s
 * rulebook. This channel is its one documented exception, and it is narrow — an
 * id shaped `<family><n>w-…` is a REDUNDANCY heuristic (a `root` the walk would
 * have found, a probe cluster that wants a golden), a reading of taste that
 * would block a legitimate shape if it failed the build. Every hard convention
 * here is an `error`; `plugin.test.ts` holds the split.
 */
export const RULE_DOCS = {
    'a1-specification-file': {
        channel: 'statique',
        convention:
            'A runner is created only in a `*.specification.ts(x)` file under `specs/`: calling `specification.*` anywhere else is an error. The `.tsx` spelling is the same file with a `wrap` written in JSX. A `component`-role file is out of reach: a rendered unit starts nothing.',
        facet: 'model',
        family: 'A',
        fix: 'Move the call into `specs/<facet>/<facet>.specification.ts` and export the handle from there.',
        id: 'A1',
        rationale:
            'Anchoring runners to a recognisable filename makes the entry point discoverable and keeps tests declarative.',
        reach: 'tests',
    },
    'a2-known-constructors': {
        channel: 'statique',
        convention:
            'Six constructors and only six: `specification.api()`, `specification.jobs()`, `specification.cli(bin)`, `specification.integration()`, `specification.website()`, `specification.mobile()`. Any other member (`.app`, `.http`, `.stack`…) is an error. A rendered component starts nothing: it is a chain, not a member of this record.',
        facet: 'model',
        family: 'A',
        fix: 'Name one of the six, or reach for the `component` chain — a seventh subject is a decision before it is a constructor.',
        id: 'A2',
        rationale:
            'A closed surface stops parallel constructors being invented and keeps the API memorable.',
        reach: 'all',
    },
    'a3-no-destructure-alias': {
        channel: 'statique',
        convention:
            "The return is destructured under the constructor's canonical name, unaliased (`{ api, cleanup, docker }`); renaming (`{ api: myApi }`) is an error.",
        facet: 'model',
        family: 'A',
        fix: 'Drop the alias and keep the canonical name.',
        id: 'A3',
        rationale: 'One instance name per facet makes every spec readable with no local context.',
        reach: 'all',
    },
    'a4-cleanup-afterall': {
        channel: 'statique',
        convention:
            'The specification file passes `cleanup` to `afterAll`; a `cleanup` destructured but never handed over is an error.',
        facet: 'model',
        family: 'A',
        fix: 'Add `afterAll(cleanup)` at the end of the specification file.',
        id: 'A4',
        rationale: 'Guaranteeing teardown stops containers and connections leaking between files.',
        reach: 'specification',
    },
    'a9w-redundant-root': {
        channel: 'statique',
        convention:
            'A `root` pointing at the directory the automatic walk would have found is redundant → warning.',
        facet: 'model',
        family: 'A',
        fix: 'Drop the option: the walk finds the nearest `package.json` by itself.',
        id: 'A9',
        rationale:
            'Detection by convention has to stay the default; an explicit `root` is only justified where it fails.',
        reach: 'all',
    },
    'b10-when-between-markers': {
        channel: 'statique',
        convention:
            'A `// When -` marker is optional; written, it sits after `// Given -` and before `// Then -`.',
        facet: 'model',
        family: 'B',
        fix: 'Move it to the action it narrates, or drop it when the chain is the action.',
        id: 'B10',
        rationale:
            'The optional marker is the one the order slips on: a `When` above the Given or below the Then tells a story the code does not follow.',
        reach: 'tests',
    },
    'b11-marker-one-line': {
        channel: 'statique',
        convention:
            'A marker is exactly one line: a `//` comment directly under one, at the same indentation, is a wrapped marker and an error. A tool’s directive is not a sentence — a linter’s `-disable`/`-enable`, a formatter’s `-ignore`, a `@ts-` pragma and a coverage line stand where they are.',
        facet: 'model',
        family: 'B',
        fix: 'Fold the continuation into the sentence, or separate it with a blank line.',
        id: 'B11',
        rationale:
            'The narration is a sentence about the subject; a paragraph hides its second half from every reader that only looks at the marker line.',
        reach: 'tests',
    },
    'b16w-file-context': {
        channel: 'statique',
        convention:
            "A setting every chain of a spec file states alike — the same `.clock(…)`, the same `.headers(…)`, the same `.env(…)`, per runner handle — is the file’s, stated once on a view of the facet: `const events = api.with({ clock: '…' })` → warning at the first chain. A file of one chain is not judged; a seed and a contract are a test’s Given, never a setting.",
        facet: 'model',
        family: 'B',
        fix: 'Declare the view once after the imports, `const <view> = <handle>.with({ … })`, and start every chain from it — `make fix` writes it, named for the file’s subject so every file of one folder names it alike (`events/list/` → `events`, a job → its name, a command → its first word; `<subject>View` when the file already holds the name, `<handle>InFile` for no named subject), and drops the setting from each chain.',
        id: 'B16',
        rationale:
            'A setting repeated on every chain reads as a choice each test made; stated once, it reads as what it is — the condition of the whole file — and the next test cannot forget it.',
        reach: 'spec',
    },
    'b4-given-then': {
        channel: 'statique',
        convention:
            'Every test carries `// Given -` then `// Then -` (both, in that order); a Given declared after a Then is an error. A `test.each` table is judged ONCE, on the table, not once per row. A `<case>.spec.yaml` document has no comments: its narration is its `description:`.',
        facet: 'model',
        family: 'B',
        fix: 'Write the two markers, in order, as sentences about the subject — not about the code (chapter 18 § The narration).',
        id: 'B4',
        rationale:
            "Given/Then narration makes a test's intent readable without reading its assertions.",
        reach: 'tests',
    },
    'b6w-redundant-env-url': {
        channel: 'statique',
        convention:
            "`.env({ <SERVICE>_URL: ….connectionString })` repeats the framework's own injection → warning.",
        facet: 'cli',
        family: 'B',
        fix: 'Drop the line: the record key already injects `<KEY>_URL` into the child process.',
        id: 'B6',
        rationale:
            'The injection already covers service URLs; rewriting them by hand invites drift.',
        reach: 'tests',
    },
    'b8-kebab-trigger': {
        channel: 'statique',
        convention:
            '`.trigger(name)` takes a stable kebab-case identifier; a non-kebab-case `name` is an error.',
        facet: 'jobs',
        family: 'B',
        fix: 'Write the job name in kebab-case, the same spelling the application registers it under.',
        id: 'B8',
        rationale:
            'The job name is a contract between the app and its tests — a stable identifier forbids divergent translations.',
        reach: 'tests',
    },
    'b9w-product-command': {
        channel: 'statique',
        convention:
            "A `specification.cli(bin)` whose binary resolves inside a dependency's `node_modules/.bin` tests the third-party tool, not the product command → warning (a suppression with a reason is accepted). Reach: a specification file — a runner created anywhere else is A1's.",
        facet: 'cli',
        family: 'B',
        fix: "Point the runner at the product's own binary; assert on a tool's output through `result.grep`.",
        id: 'B9',
        rationale:
            "A spec has to exercise the product's real command; per-tool assertions go through `result.grep`.",
        reach: 'specification',
    },
    'c1-domain-structure': {
        channel: 'statique',
        convention:
            'A specs tree DECLARES its shape through the `depth` option: `facet-domain` (the default — a test at facet/domain depth, a `*.specification.ts` at the facet root), `facet` (a test at the facet root OR one domain folder down, never deeper), `mirror` (a test at any depth ≥ 1, named after its directory), `off`. Under `facet-domain` and `facet`, a `.spec.ts` of the api or cli facet sits as deep as its subject’s standard name — a route’s resource and action (`events/list/`), a command’s words (`db/migrate/`) — which C30 judges. A first-level folder that is no facet — a repository suite, `surface/` or `lint/` — is judged by the same depth as a facet is. In every mode, `off` included: a directory named `fixtures/`, `expected/`, `requests/` or `seeds/` is GROUND, never a facet, domain or suite folder — no spec lives inside one, so a domain named with a reserved word is refused. One exception, and only one: ground may be CODE, and a `<module>.test.ts` sitting BESIDE the `<module>.ts` it tests is legal there (that is I2). A test with no neighbouring module, or a `*.specification.ts`, is still a violation. A `.test.tsx` is out of reach: a rendered unit is specified beside its component, never in a facet/domain tree — I2 holds its neighbourhood.',
        facet: 'model',
        family: 'C',
        fix: 'Move the file to the depth the tree declares, or declare the depth the tree actually has.',
        id: 'C1',
        rationale: "A fixed depth makes every file's place predictable and statically checkable.",
        reach: 'specs',
    },
    'c10-contracts-boundary': {
        channel: 'statique',
        convention:
            'Outside `specs/**/contracts/`, an import resolving into a provider folder (`contracts/{http,openai,anthropic}/…`) is an error: a test imports only the `*.contracts.ts` facades.',
        facet: 'model',
        family: 'C',
        fix: 'Add a named scenario export to the facade and import that instead.',
        id: 'C10',
        rationale:
            'Unit contracts are composition details; going through the facade keeps each scenario named in the same place as the world it derives from.',
        reach: 'tests',
    },
    'c11-contract-data-pairing': {
        channel: 'statique',
        convention:
            'Inside a provider folder, every `*.response.json` and every `*.request.ts` has a `<stem>.ts` sibling — the stem is the name up to the FIRST dot (`events.fr.response.json` → `events.ts`). Orphan data is an error.',
        facet: 'model',
        family: 'C',
        fix: 'Write the contract that serves the payload, or delete the payload.',
        id: 'C11',
        rationale:
            'Data exists only as served by a contract — a file with no owner is dead weight no test ever loads.',
        reach: 'contract',
    },
    'c13-bare-ground': {
        channel: 'statique',
        convention:
            "The ground a test stands on carries a bare, reserved name: `fixtures/`, `expected/`, `requests/`, `seeds/` — a spec's under `specs/`, and a module test's beside its module. An `_fixtures/`, `_expected/`, `_requests/` or `_seeds/` directory beside a test (or as the pool) is the 16.x name — an error naming the rename. The rule and its mover are the 16 → 17 migration: they retire in 17.1. The mover (`--fix`) walks every `specs/` tree and every member's module tests, and moves only a file the rule still finds 16.x-shaped — a 16 folder beside it, or a 16 pool it names by `$FIXTURES/`; a 17 file is left as it is, whatever its tree holds, and only a directive naming a renamed rule is renamed on every file.",
        facet: 'model',
        family: 'C',
        fix: 'Rename the directory to its bare name, and the paths that name it (`jterrazz-test-check --fix` does both).',
        id: 'C13',
        rationale:
            'Every path names its folder in full, so the old name still runs — and a repository that keeps it speaks two dialects of one law. The rule names the rename instead of letting the two drift.',
        reach: 'tests',
    },
    'c2-request-extension': {
        channel: 'statique',
        convention:
            '`requests/` holds what a spec SENDS: a whole request as a `.http` (`request()`), or a body a verb sends (`post`/`put`/`patch` with a `file()`) — a `.json`, a `.txt`, any format the app reads. Every file there carries its extension; a file with none is an error.',
        facet: 'api',
        family: 'C',
        fix: "Name the file with its extension: `.http` for a whole request, the body's own format otherwise.",
        id: 'C2',
        rationale:
            'The extension is how the file is sent — a `.http` whole, a `.json` parsed, anything else verbatim — so a file without one says nothing about what the app will receive.',
        reach: 'ground',
    },
    'c4-contract-shape': {
        channel: 'statique',
        convention:
            'Under `specs/**/contracts/`: the ROOT carries only `*.contracts.ts` facades and the provider folders `http` | `openai` | `anthropic`. A facade exports its builders and sets BY NAME — the world and its scenarios — and one that exports nothing is an error; a default export is not required, and when a facade has one it is a composition: built by `defineContracts(...)`, a composition re-export, a scenario of a sibling facade — a name imported from a `*.contracts` module, or a call to it — or a call to a builder of the file declared to return `Contracts` (no type is read, so a builder is judged by where it comes from or what it declares). A unit contract is `<provider>/<kebab-name>.ts` with an `export default defineContract(...)` (or a factory returning one), and its `request` builder must name the provider of its own folder. A provider folder is flat and holds only `*.ts` and `*.response.json`.',
        facet: 'model',
        family: 'C',
        fix: 'Move the file to the half it belongs to: a facade at the root, a unit under its provider.',
        id: 'C4',
        rationale:
            'A fixed tree separates the public facade from the internal units and makes the FOLDER carry the provider — filenames go back to being domain words, and bulky data sits beside the contract that serves it. A test imports the builder it calls by name, so a required default no test reads would be dead code the unused-export pass reports.',
        reach: 'contract',
    },
    'c6-tomatch-extension': {
        channel: 'statique',
        convention:
            "A golden `file()`'s path carries its extension (`toMatch(file('./expected/help.txt'))`, `'./expected/<case>.aria.yaml'` for an ARIA tree); a golden file with no extension is an error. A tree golden is `toMatch(directory(…))`, whose path ends in `/`.",
        facet: 'model',
        family: 'C',
        fix: "Write the fixture's full name, extension included.",
        id: 'C6',
        rationale:
            "The extension is part of the golden's path — the path IS the file, and a file without its extension is another file.",
        reach: 'tests',
    },
    'c7-seeds-sql-only': {
        channel: 'statique',
        convention: '`seeds/` holds `*.sql` files only; any other file is an error.',
        facet: 'model',
        family: 'C',
        fix: 'Write the seed as SQL, or move the file to `fixtures/` as the material it is.',
        id: 'C7',
        rationale: '`.seed()` carries database state only — no seed handlers, no prefix dispatch.',
        reach: 'ground',
    },
    'c24-ground-role': {
        channel: 'statique',
        convention:
            "The verb and the ground folder agree: `seed()` reads `seeds/`, `request()` and a request body (`post`/`put`) read `requests/`, `fixture()` reads `fixtures/`, a golden `toMatch(file|directory(…))` reads `expected/`, and `run()` reads a document beside the test, under no ground folder — or under `fixtures/` for a document that is an input a negative spec runs. The same four folders at the specs root hold what several leaves share, so a shared seed is `<specs>/seeds/x.sql` (`../../seeds/x.sql`), never `<specs>/fixtures/seeds/x.sql`. The first ground folder a literal path passes through is the one judged, whether the `file()`/`directory()` is handed to the verb inline or bound first to a `const` of the same file (the nearest declaration of the name, as the language resolves it); a `let`, a parameter or a computed path is out of reach, and a document's `fixture:` is held to `fixtures/` by its grammar (`d4b-spec-shape`).",
        facet: 'model',
        family: 'C',
        fix: "Move the file into the folder its verb reads — the leaf's own, or the specs root's when several leaves share it — and spell the path through it.",
        id: 'C24',
        rationale:
            'Four reserved names are a vocabulary only if each means one thing: a seed parked in `fixtures/` or a golden in `requests/` makes the folder lie about what it holds, and the next reader trusts the folder.',
        reach: 'tests',
    },
    'c26-disk-named-in-the-test': {
        channel: 'statique',
        convention:
            "`file()` and `directory()` are called in a test or spec file — a `.test.ts(x)`, a `.spec.ts`, a type test — and nowhere else: a shared helper module, a specification file or a contract takes a `file()` as a parameter and never builds one. The call is recognised by its import from the framework's entry, an alias included.",
        facet: 'model',
        family: 'C',
        fix: 'Take the `file()`/`directory()` as a parameter of the helper, and build it in the test that calls it.',
        id: 'C26',
        rationale:
            'A path resolves against the spec that starts the chain, so one built in a helper resolves per caller: the same line names a different file for every spec that reaches it, and the file it names is visible on no line of the test that stands on it.',
        reach: 'all',
    },
    'c31-describe-names-file': {
        channel: 'statique',
        convention:
            "A spec file holds one top-level `describe`, titled with the file's aspect — `pagination.spec.ts` → `describe('pagination', …)` — and every test inside it; a `describe.each` names its rows, so its title starts with the aspect, `'pagination — page %s'`. A file with no `describe` is refused at its first test, a second `describe` or a test beside the one at itself, a title naming anything but the aspect at the title.",
        facet: 'model',
        family: 'C',
        fix: "Title the file's one `describe` with its aspect, and put every test inside it — `make fix` renames a title (a table's by prefixing the aspect), wraps a file that has none, and merges several groups into one, each test titled `<group> — <test>`, when every group holds tests alone; what stands between the tests stays at module scope.",
        id: 'C31',
        rationale:
            'The runner reports a failure under the describe it stands in, so a title that is the aspect names the file the failure came from; a second group, or a stray test, is a second question the file answers.',
        reach: 'spec',
    },
    'c32-aspect-name': {
        channel: 'statique',
        convention:
            'A spec file is named for its aspect: kebab-case (`not-found.spec.ts`), and never a name that says the file holds what fit nowhere else — `misc`, `other`, `basic`, `general`, `more`, `edge-cases`, `tests`, `main`.',
        facet: 'model',
        family: 'C',
        fix: 'Rename the file for the question its tests ask of the subject — `pagination`, `filters`, `sorting`, `language`, `validation`, `not-found`, `auth`, `shape` are the api vocabulary chapter 18 advises.',
        id: 'C32',
        rationale:
            'The folder names the subject; the file name is the only place the question asked of it is written, and a catch-all name answers none — the next test lands there because it fits nowhere, and the file grows until it holds everything.',
        reach: 'spec',
    },
    'c33-file-size': {
        channel: 'statique',
        convention:
            'A spec file holds at most 400 lines; a longer one is refused at its first line, the message grouping its tests by the prefix of their titles — where the cut usually goes. A file already past it is recorded on the ratchet and may only shrink.',
        facet: 'model',
        family: 'C',
        fix: 'Cut the file along the groups the message names, one aspect per file, in the same folder.',
        id: 'C33',
        rationale:
            'A file past a few hundred lines asks several questions of its subject, and a reader looking for one scrolls through the others; a cap written as a number is the one a reviewer does not have to argue.',
        reach: 'spec',
    },
    'c34-test-body-size': {
        channel: 'statique',
        convention:
            'A test body spans at most 60 lines — the function a `test(…)`/`it(…)` runs, from the line it opens on to the line it closes on, blank lines and comments included; a longer one is refused at the function. A body already past it is recorded on the ratchet and may only shrink.',
        facet: 'model',
        family: 'C',
        fix: 'Split it into one test per behaviour, or move a long Given into a function the test calls.',
        id: 'C34',
        rationale:
            "A test past a screen asks several things of its subject, and the one that fails is the one a reader has to find; the toolchain's function cap leaves a test file alone, because a file's one `describe` is a function as long as the file, so this cap is the test's own.",
        reach: 'tests',
    },
    'd16-sampled-oracle': {
        channel: 'statique',
        convention:
            "No sampled value under an oracle: `new Date()` (no argument), `Date.now()`, `performance.now()`, `Math.random()` and `randomUUID()` are an error as a direct argument of `expect` or of its matcher, and anywhere inside a structural matcher's expected shape. A test that pins the clock (`clock.at`, `clock.advance`) is out of reach — the reading is then the constant it chose — and so is a `*.specification.ts(x)`, where a runner legitimately samples at startup.",
        facet: 'model',
        family: 'D',
        fix: 'Pin it with `clock.at()`, or match it with `{{iso8601}}`/`match.uuid`.',
        id: 'D16',
        rationale:
            'An assertion that reads the machine twice holds whatever the subject does, and the day it fails it fails for the clock.',
        reach: 'tests',
    },
    'd16w-ambient-value': {
        channel: 'statique',
        convention:
            'A sampled value anywhere in a test callback is a warning — the wider net around D16, silent where D16 already refuses and on a name built in a template literal. A `*.specification.ts(x)` is out of reach.',
        facet: 'model',
        family: 'D',
        fix: 'Reach for `clock.at()`, `clock.advance()`, or a token in the golden.',
        id: 'D16',
        rationale:
            'A value sampled into the Given travels into the subject, and the assertion that reads it back is the same tautology one step removed.',
        reach: 'tests',
    },
    'd17w-double-only-oracle': {
        channel: 'statique',
        convention:
            'A module test whose every assertion reads the call log of a double it built itself (`mockOf`, `vi.fn`, `vi.spyOn`) is a warning. The reach is the `module` role: on a component a callback prop IS the contract with its parent. It is a warning, and not an error, because one subject answers this way honestly — one whose PRODUCT is a call it was handed (a listener, an output port) — and the shape is the same one either way.',
        facet: 'model',
        family: 'D',
        fix: 'Assert the returned value or the resulting state — or say in a line that the call IS the product.',
        id: 'D17',
        rationale:
            'The subject can return anything, raise anything, or return nothing at all, and every assertion still passes.',
        reach: 'module',
    },
    'd18w-existence-only-oracle': {
        channel: 'statique',
        convention:
            'A test whose ONE assertion is an existence check (`toBeDefined`, `toBeTruthy`, `not.toBeNull`, `not.toBeUndefined`, a bare `toThrow` or a bare `toHaveBeenCalled`) is a warning. Beside a real assertion the same check is a precondition and stays silent, `expect.soft` counts as an assertion, and a NEGATED bare matcher (`not.toHaveBeenCalled`) is a precise proof rather than a loose one.',
        facet: 'model',
        family: 'D',
        fix: 'Assert the value, a golden, or a row.',
        id: 'D18',
        rationale:
            '`toBeDefined()` passes for `0`, `[]`, the wrong object and the right one: as a whole proof it records that the call returned, not what it answered.',
        reach: 'tests',
    },
    'd19w-probe-cluster': {
        channel: 'statique',
        convention:
            'Three probes (`threshold`, default 3) on one goldenable subject — `stdout`, `stderr`, `content`, `head`, `meta()`, `canonical`, `alternates`, `tree`, `html` — with no `toMatch(file(…))` on it is a warning. A negated probe states an absence no golden can carry and is not counted; `value` and `error` are single readings and are not goldenable subjects.',
        facet: 'model',
        family: 'D',
        fix: "Golden the subject: `expect(result.stdout).toMatch(file('./expected/<case>.txt'))`, tokens for what moves.",
        id: 'D19',
        rationale:
            'Three greps state three lines, leave everything between them unstated, and still have to be rewritten one by one the day the output changes.',
        reach: 'tests',
    },
    'd20-whole-result': {
        channel: 'statique',
        convention:
            "A test that reads a response, a json or a table — `<result>.response`, `<result>.json`, `<result>.table('<name>')` of a result it awaited — compares it WHOLE, once: `toMatch` handed the whole result written in place or its golden, or a table's `toBeEmpty()`. A precise assertion on one of its properties (`expect(result.json.value.total).toBe(1)`) is allowed only IN ADDITION → error on the first read of a result no whole comparison reaches. A negation, a RegExp and a read through a helper are no whole comparison; a result read through a helper, a computed table name, or a comparison made in a helper is out of reach, and the rule stays silent. A read whose value is only CARRIED into a later request of the same test — every use of it, through the names and helpers it passes, ends in the arguments of an awaited chain off a handle (a path, `params`, a body, a header), as the cursor a page hands back — claims nothing and owes no comparison; one `expect(…)` of that value makes it a read again, and the result the test does claim is still compared whole.",
        facet: 'model',
        family: 'D',
        fix: "Write `expect(<result>.<subject>).toMatch('')` and run `TEST_UPDATE=1` — the whole result is written in place; keep the precise assertion beside it if one property IS the subject.",
        id: 'D20',
        rationale:
            'Probes are a partial oracle: what they do not name is free to regress unseen. The whole result, written where the test reads it, is the default oracle — approval testing — and a precise assertion states what the test is about on top of it. It is the retired warning on body-probe clusters, grown into the rule it stood in for.',
        reach: 'tests',
    },
    'd28-shared-expectation': {
        channel: 'statique',
        convention:
            'A file-level `const` a spec hands to a matcher as the expected value serves two tests or more; read by one test, it is an error at its declaration. A constant read outside every test (by a helper) counts as shared, and an exported one is out of reach.',
        facet: 'model',
        family: 'D',
        fix: 'Write the value in place, in the matcher the one test hands it to, and delete the constant — `make fix` inlines one read.',
        id: 'D28',
        rationale:
            'A test is read where it is written: an expectation parked at the top of the file makes its one reader scroll to know what it asserts, and buys no sharing for the price.',
        reach: 'spec',
    },
    'd29-no-foreign-expectation': {
        channel: 'statique',
        convention:
            'A spec imports no expectation: a name imported from another module of its specs tree — neither its `*.specification` runner nor a module under `contracts/` — and handed to a matcher as the expected value, itself or a member of it, is an error at the argument. A helper is CALLED, and what it builds is the test’s own; a module outside the specs tree is the product’s, and a spec may compare against its data (`package.json`’s version, a constant the product exports); F4 already refuses importing a test file at all.',
        facet: 'model',
        family: 'D',
        fix: 'Write the expected value in the test — in place, or `file(…)` when several tests of the leaf share it — and drop the import.',
        id: 'D29',
        rationale:
            'An expectation written in another module asserts what nobody reviewing the test reads, and a change to that module moves the assertions of every spec that imports it without one of them changing.',
        reach: 'spec',
    },
    'd2-await-io-matcher': {
        channel: 'statique',
        convention:
            'A `toMatch` that is IO — a table compared whole, `toMatch(<rows>)`, or a tree, `toMatch(directory(…))` — must be awaited or returned; otherwise the assertion never runs → error. `toBeEmpty` and `toBeRunning`, typed `Promise<void>` whatever their argument, are refused dropped by the type-aware `typescript/no-floating-promises` every profile of `@jterrazz/typescript` turns on.',
        facet: 'model',
        family: 'D',
        fix: 'Put `await` in front of the `expect(...)`.',
        id: 'D2',
        rationale:
            'An un-awaited IO assertion passes silently — the worst failure mode a test has.',
        reach: 'tests',
    },
    'd2w-await-sync-matcher': {
        channel: 'statique',
        convention:
            '`await` on an always-synchronous matcher (`toBe`/`toEqual`/`toContain`/`toHaveLength`) is redundant → warning.',
        facet: 'model',
        family: 'D',
        fix: 'Drop the `await`.',
        id: 'D2',
        rationale: 'A pointless await hides the signal that marks the real IO matchers.',
        reach: 'tests',
    },
    'd6w-transform-token-equivalent': {
        channel: 'statique',
        convention:
            'A `transform` that only rewrites into equivalents of the standard tokens duplicates the grammar → warning.',
        facet: 'model',
        family: 'D',
        fix: 'Delete the transform and write the token the grammar already has.',
        id: 'D6',
        rationale:
            '`transform` is the escape hatch for noise the tokens do not cover — not a second copy of them.',
        reach: 'tests',
    },
    'd8w-raw-bypass': {
        channel: 'statique',
        convention:
            "`expect(x.raw).toContain` compares the stream as it was captured → warning. A stream compared as a value reads `x.text` — ANSI stripped, the runner's `transform` applied, the text a golden compares. A RegExp argument is exempt: a pattern carries no token grammar to lose.",
        facet: 'model',
        family: 'D',
        fix: 'Compare `x.text`; keep `.raw` for a test that proves what the comparison strips, with the suppression saying so.',
        id: 'D8',
        rationale:
            "`.raw` keeps the colour codes and skips the runner's transform, so a substring found there is not the text any golden of the same stream would be compared against.",
        reach: 'tests',
    },
    'd9w-single-use-ref': {
        channel: 'statique',
        convention:
            'A capture ref (`match.ref`, `{{kind#ref}}`) appearing exactly once in the whole file (code plus the golden files it references) is named for nothing → warning.',
        facet: 'model',
        family: 'D',
        fix: 'Drop the ref name and keep the bare token.',
        id: 'D9',
        rationale:
            'A ref only earns its name when it asserts equality across at least two occurrences.',
        reach: 'tests',
    },
    'd13w-unfrozen-negative-fixture': {
        channel: 'statique',
        convention:
            'A golden `toMatch(file(…))`/`toMatch(directory(…))`, or a `toMatch(<value>)` on a result (the value written in place, rewritten in the test), whose FAILURE is the subject of the test must carry `{ frozen: true }` → otherwise `TEST_UPDATE=1` silently rewrites the deliberately-wrong expectation instead of throwing → warning. Two shapes: the exact wrapper (`expect(() => …).toThrow()` / `expect(…).rejects.toThrow()`) and the bounded heuristic — a golden inside a helper whose body also asserts a throw, which is where a helper owning the try/catch puts it.',
        facet: 'model',
        family: 'D',
        fix: 'Pass `{ frozen: true }` so update mode never overwrites the fixture the test is about.',
        id: 'D13',
        rationale:
            'In update mode an unfrozen matcher writes instead of throwing: the negative fixture is corrupted by its own real output and the assertion stops testing anything. `frozen` pins it.',
        reach: 'tests',
    },
    'd15w-status-only-probe': {
        channel: 'statique',
        convention:
            "A test whose ONLY assertions are HTTP status probes (`expect(X.status).toBe(N)` / `.toEqual(N)`, N a numeric literal 100–599) → warning: this case wants a full golden (`expect(result.response).toMatch(file('./expected/case.http'))`). A status probe BESIDE a real assertion (a whole-result `toMatch`, a table's rows, `toContain`…) stays silent (a legitimate scalpel).",
        facet: 'api',
        family: 'D',
        fix: 'Assert what the response carries, not only the code it came back with.',
        id: 'D15',
        rationale:
            'A lone status pins the response code and throws away the whole payload; a full golden captures the shape and its token grammar (it completes D20, which reads the response the probe stands beside).',
        reach: 'tests',
    },
    'e2-preset-config': {
        channel: 'statique',
        convention:
            'A `vitest.config.*` default-exports `defineSpecConfig(...)`; the call is resolved through an `export default <Identifier>` declarator, through a `satisfies`/`as` annotation, and through one `mergeConfig(defineSpecConfig(…), …)` — vitest’s own way of layering over the preset.',
        facet: 'model',
        family: 'E',
        fix: "Start from `defineSpecConfig()` — budgets, the artefact dir and the ground exclusion are the preset's.",
        id: 'E2',
        rationale:
            "A config off the preset runs on vitest's five-second budget, writes artefacts at the repository root and collects `fixtures/` as specs — none of it visible in the file that caused it.",
        reach: 'config',
    },
    'e4w-project-binding': {
        channel: 'statique',
        convention:
            'A project literal collecting `specs/<facet>/` is named `<facet>`, and one named for a facet is rooted there; `unit` collects outside `specs/`. What an include collects is read from the GLOB and the config’s own place in its package, never from the absolute path. Any other name is out of reach — a repository suite names its projects as it likes.',
        facet: 'model',
        family: 'E',
        fix: 'Name the project after the facet it collects; `{ include, exclude }` stay yours.',
        id: 'E4',
        rationale:
            '`--project component` has to mean the same thing in every repository: it is the one word a CI job, a Makefile target and an agent all type.',
        reach: 'config',
    },
    'e5-no-simulated-dom': {
        channel: 'statique',
        convention:
            'A test file declares no simulated DOM: the `@vitest-environment happy-dom|jsdom` pragma is an error. Reach: the roles that RUN a test (`module`, `component`, `specification`) — a project config is E5b’s.',
        facet: 'component',
        family: 'E',
        fix: 'A rendered thing is a `.test.tsx` beside its component, collected by the `component()` project.',
        id: 'E5',
        rationale:
            'A simulated DOM behaves ALMOST like a browser, and what ships is judged by a real one: the component facet renders in the Chromium the website facet already drives.',
        reach: 'tests',
    },
    'e6-component-project-helper': {
        channel: 'statique',
        convention:
            'A browser project comes from `component()`: in a vitest config, a `browser` key under `test` that is not inside a `component(...)` call is an error. A `browser` key elsewhere (a `define`, an env registration) is not a project block and stays out of reach.',
        facet: 'component',
        family: 'E',
        fix: 'Replace the block with `component({ vite })` and keep only what belongs to the project.',
        id: 'E6',
        rationale:
            "The provider pinned to the runner's exact version, the service worker served from the framework's own install, the JSX transform the current Vite uses, a cold cache's pre-bundling and the artefact directories are all runs that pass here and fail on the next machine.",
        reach: 'config',
    },
    'e7w-include-prefix-exists': {
        channel: 'statique',
        convention:
            'An `include` glob of a PROJECT — an object under `test` or in `projects`, never `optimizeDeps.include` and its kin — whose static prefix (the segments before the first wildcard, brace or bracket), resolved from the config, is not a directory is a warning.',
        facet: 'model',
        family: 'E',
        fix: 'Point the glob at the folder that exists, or delete the project that collects nothing.',
        id: 'E7',
        rationale:
            'A project that collects nothing passes: the suite never ran, and the only trace is a zero nobody reads.',
        reach: 'config',
    },
    'e8-literate-specification-exists': {
        channel: 'statique',
        convention:
            '`literate.specification`, resolved from the config directory, names a file that exists. The config directory is what the path is read against; a project that moves Vite’s `root` states its door relative to the config all the same.',
        facet: 'cli',
        family: 'E',
        fix: 'Point it at the `*.specification.ts` that exports the `cli` its documents run through.',
        id: 'E8',
        rationale:
            'A path that resolves to nothing fails at collection time with a message about an import, several layers from the line that caused it.',
        reach: 'config',
    },
    'e9w-env-assignment-in-test': {
        channel: 'statique',
        convention:
            'A test writes the process environment through `vi.stubEnv` alone: a raw assignment onto a variable of it (named or computed), a replacement of `process.env` itself, and a `delete` of one of its variables are each a warning; a `*.specification.ts(x)` is out of reach by role.',
        facet: 'model',
        family: 'E',
        fix: "Use `vi.stubEnv('X', 'y')`, which restores itself; a CLI default belongs to `specification.cli({ defaults })`.",
        id: 'E9',
        rationale:
            'The assignment outlasts the test: the next file in the same worker inherits it, and the failure lands somewhere else.',
        reach: 'tests',
    },
    'f1-no-subpath-import': {
        channel: 'statique',
        convention:
            "Everything is imported from `@jterrazz/test`; an import of `@jterrazz/test/<subpath>` is an error, except the subpaths the package's `exports` map publishes — the entries are `.`, `./vitest`, `./oxlint` and `./schema`, and the three named ones are exempt everywhere. The list is READ from the manifest, never copied into the rule, so a published entry is exempt the day it ships.",
        facet: 'model',
        family: 'F',
        fix: 'Import the name from `@jterrazz/test`; it is re-exported there by design.',
        id: 'F1',
        rationale:
            'A single entry point keeps the public API explicit and the internal subpaths invisible.',
        reach: 'all',
    },
    'f2-no-test-imports-in-prod': {
        channel: 'statique',
        convention:
            "A production module never reaches test material. A production module is every source module that is no test material itself — `src/`, `lint/`, `bin/`, `scripts/` and a project's root modules alike — but a tool's config (`*.config.*`) and a module under a retired test root (`__tests__/`, a root `test/` or `tests/`, I2's); test material is a test package (`@jterrazz/test`, `vitest`, `@vitest/*`, `vitest-mock-extended`, `vitest-browser-*`, `msw`, `@testing-library/*`, `playwright`, `playwright-core`, `@playwright/test`), a `*.test.*`, `*.test-d.*`, `*.spec.*`, `*.specification.*` or `*.fixtures.*` module, anything under a `fixtures/`, `expected/`, `requests/` or `seeds/` folder or under `specs/`, and a contract — a `*.contracts.ts` facade and the `contracts/` folder that holds one. Every form reaches: an import, `import type`, a re-export (`export *` included), `import()`, `require()`, `require.resolve()`, `import.meta.resolve()`, a type's `import('…')`; a specifier resolving there through a tsconfig `paths` alias (its `extends` chain followed) or a `#…` entry of the package's `imports`; a path the module builds from where it sits (`new URL('…', import.meta.url)`, `join(import.meta.dirname, …)`, a template opening on `__dirname`) or reads (`readFileSync('./…')`); and a module that is not production reaching it in turn, in any of these forms, read from its parsed program — a production module on the way is judged for its own references. The four ground names mean ground wherever a test stands on a file, beside a module as much as under `specs/`. Two exceptions: `@jterrazz/test/oxlint`, the zero-runtime lint entry; and a test package the unit's `jterrazz.config.ts` names under `test.production.allow`, each with the reason its product runs it (`{ playwright: 'the gate drives a browser in production' }`) — an entry with no reason leaves the list unread.",
        facet: 'model',
        family: 'F',
        fix: 'Move the code that needs the reference into a test, move what production needs out of the test material, or inject it as a port.',
        id: 'F2',
        rationale:
            "Keeping test artefacts out of production protects the consumer's application bundle.",
        reach: 'all',
    },
    'f3-specs-public-entry': {
        channel: 'statique',
        convention:
            "From `specs/`, only a deep import of the framework's INTERNALS is forbidden: a relative path resolving into the framework repository's `src/{model,facets,seams,runner,lint}/`, or any `@jterrazz/test/<subpath>` the package's `exports` map does not publish — the published subpaths are exempt, READ from the manifest as in F1, which holds the list. A consumer importing ITS OWN app's source is always allowed (that is the documented pattern). No folder exception: a probe that cannot reach its subject through the public entry is a module test beside its module, not a spec.",
        facet: 'model',
        family: 'F',
        fix: 'Reach the framework through `@jterrazz/test`, or move the probe beside the module it covers.',
        id: 'F3',
        rationale:
            "Testing through the public surface keeps specs decoupled from the framework's internal paths, without getting in the way of a consumer importing its own app.",
        reach: 'specs',
    },
    'f4-no-test-to-test-import': {
        channel: 'statique',
        convention: 'A test file never imports another test file.',
        facet: 'model',
        family: 'F',
        fix: 'Move what the two share into a `*.fixtures.ts` neighbour.',
        id: 'F4',
        rationale:
            'Sharing between tests goes through `*.fixtures.ts`, not through test-to-test imports that couple the files.',
        reach: 'tests',
    },
    'f5-fixtures-only-from-tests': {
        channel: 'statique',
        convention: 'A `*.fixtures.ts` is importable only from a test file.',
        facet: 'model',
        family: 'F',
        fix: 'Move the value into production code if production needs it; otherwise import it from a test.',
        id: 'F5',
        rationale: 'Confining fixtures to tests stops test data leaking into production code.',
        reach: 'all',
    },
    'f6-no-foreign-test-runtime': {
        channel: 'statique',
        convention:
            'A test file imports no second test runtime: `@testing-library/*`, `happy-dom`, `jsdom`, `vitest/browser`, `vitest-browser-*`, `@vitest/browser*`, `msw`, `msw/*`, `nock`, `sinon`, `vitest-mock-extended`, `jest`, `@jest/*`, `mockdate`, `playwright`, `playwright-core`, `@playwright/test`, `webdriverio` and `appium` are errors, each named with what replaces it; `react-dom/server` is one too, in the `module` role alone. Reach: the roles that RUN a test (`module`, `component`, `spec`, `specification`) — a fixture project’s config and a providers module under `specs/` legitimately name the adapter.',
        facet: 'model',
        family: 'F',
        fix: 'Go through what replaces the seam: a facet, the element vocabulary, `intercept()`, `clock` or `mockOf`.',
        id: 'F6',
        rationale:
            "A test importing the adapter speaks the adapter's dialect: a repository ends up with as many vocabularies as it has seams. Every group names the seam this vocabulary already owns — the runner, the browser, the simulator, the network, the clock and the doubles.",
        reach: 'tests',
    },
    'g4-no-dom-in-module-test': {
        channel: 'statique',
        convention:
            'A module test touches no DOM global: `document`, `window`, `navigator`, `HTMLElement` referenced in VALUE position in a `module`-role file OUTSIDE `specs/` is an error. A name in type position (`x as HTMLElement`) and a `typeof window` guard reach no document and stay out of reach.',
        facet: 'component',
        family: 'G',
        fix: 'A rendered thing is a `.test.tsx` beside its component, collected by `component()`.',
        id: 'G4',
        rationale:
            'A module test runs under node, where `document` does not exist: a test asking for one is not testing a module, it is rendering something — and it now has somewhere to go.',
        reach: 'module',
    },
    'i1-layer-boundaries': {
        channel: 'statique',
        convention:
            'A project DECLARES its layers under `src/` through the `layers` option (allowed packages, internal imports, one folder per dependency, seams); any import outside the declared edges is an error. With no layer map the rule is inert.',
        facet: 'model',
        family: 'I',
        fix: 'Declare the edge in the layer map, or route the import through the layer that owns it.',
        id: 'I1',
        rationale:
            'An architecture belongs to the project: declared boundaries are checkable, an assumed one is worked around.',
        reach: 'all',
    },
    'i2-sibling-test-naming': {
        channel: 'statique',
        convention:
            "The test of `<file>.ts` is `<file>.test.ts` beside it; a misnamed `.test.ts`, a `__tests__/` directory or a package's `tests/` or `test/` root is an error. A RENDERED unit answers to the same law wherever it lives: a `.test.tsx` is the neighbour of the `.tsx` it renders, or of the `.ts` of the hook or DOM function whose Host it carries. A `module`-role file under a `specs/` tree is a repository suite — it covers a tree, so it has no neighbour to miss.",
        facet: 'model',
        family: 'I',
        fix: 'Put the test beside the unit it covers, under the same basename.',
        id: 'I2',
        rationale:
            "Neighbouring tests (parity with Go's `foo_test.go`) keep a test and its code together and discoverable.",
        reach: 'tests',
    },
    'i4-no-module-doubles': {
        channel: 'statique',
        convention:
            "A test doubles a PORT, never a module: `vi.mock`/`vi.doMock` of a specifier outside the `modules` allow-list (a config comment states why each entry is there), a `__mocks__/` or `__fixtures__/` directory, and — in a `module`-role test — importing a data asset (`.json`, `.sql`, `.yaml`, …) are all errors. The specifier is read in BOTH spellings — `vi.mock('<spec>')` and the `vi.mock(import('<spec>'))` form `vitest/prefer-import-in-mock` requires — so an allow-listed module has a green spelling under both rules. A dotted specifier (`./dashboard.post`) is still code. The `vi.stubGlobal` clause moved to M3 in 16.0: one owner per convention.",
        facet: 'model',
        family: 'I',
        fix: 'Double the port with `mockOf<Port>()`, keep a payload in a `*.fixtures.ts` neighbour, and allow-list a native module with its reason (chapter 05 § Doubles).',
        id: 'I4',
        rationale:
            'A module test that reaches for a real file or a module mock is describing an assembled product, and that has a facet of its own.',
        reach: 'tests',
    },
    'j2-no-sleep': {
        channel: 'statique',
        convention:
            "No arbitrary sleep (`setTimeout`/`setInterval`/`Atomics.wait`, or a `node:timers/promises` import) in any test file — synchronisation is `see()`/`gone()` inside a scenario and `waitUntil(predicate)` everywhere else. A timer inside a test DOUBLE's implementation is out of reach: the double is staging the world, not the test waiting on it. A double is a factory call (`vi.fn(…)`, `mockImplementation(…)`, a `mockOf` handler) or a function-valued PROPERTY of an object literal, which is the plainest double there is — `const git: GitGateway = { cloneRepository: async () => … }`, where the object itself is the double.",
        facet: 'model',
        family: 'J',
        fix: 'Wait for the condition, not for a duration.',
        id: 'J2',
        rationale:
            'A fixed sleep makes tests slow and flaky; waiting on a condition is deterministic.',
        reach: 'tests',
    },
    'j6w-given-in-the-test': {
        channel: 'statique',
        convention:
            "A `beforeEach`/`beforeAll` in a test file is a warning, and so is an `afterEach`/`afterAll` whose body does more than restore (`cleanup`, `vi.useRealTimers`, `vi.restoreAllMocks`, `vi.resetAllMocks`, `vi.unstubAllGlobals`, `vi.unstubAllEnvs`) — handed over by name (`afterEach(vi.restoreAllMocks)`) or called in the body. `afterAll(cleanup)` in a `*.specification.ts` is A4's own idiom and out of reach by role.",
        facet: 'model',
        family: 'J',
        fix: 'Call a function from each test instead of a hook; `clock.at()` and `intercept()` restore themselves.',
        id: 'J6',
        rationale:
            'A hook moves the setup out of the only place a reader looks, shares it with every test in the file, and half of them come to depend on it quietly.',
        reach: 'tests',
    },
    'w1-scenario-pure': {
        channel: 'statique',
        convention:
            'A scenario (`.visit()` on website, `.open()` on mobile, `.render()` on component) is the When: the visitor acts and the capture reflects the settled state; no `expect()` in the callback — assertions live in the Then, on the returned result.',
        facet: 'model',
        family: 'W',
        fix: 'Move the assertion out of the callback, onto the result the terminal action resolves to.',
        id: 'W1',
        rationale:
            'Separating interaction from assertion keeps the setup → action → result grammar intact and the scenarios replayable.',
        reach: 'tests',
    },
    'w2-testid-states-what-is-missing': {
        channel: 'statique',
        convention:
            "In a test file, a scenario's elements are user-facing (`button`, `link`, `field`, `heading`, `content`; on mobile `button`, `field`, `content`). `testId()` is the one escape hatch, and the line STATES what the element lacks: a `// testId: <what is missing>` comment on the call's own line or the one directly above. It is an invariant, not a rationale.",
        facet: 'model',
        family: 'W',
        fix: 'Write `// testId: <no accessible name | no role | …>` on the call’s line or the one above — or name the element with `button()`/`link()`/`field()`/`heading()`/`content()`.',
        id: 'W2',
        rationale:
            'Testing what the user sees (roles, labels) keeps specs robust to DOM rewrites; a test id sidesteps that guarantee, and without the invariant written down nobody can tell whether the hatch is still needed.',
        reach: 'tests',
    },
    'w5w-scenario-settles': {
        channel: 'statique',
        convention:
            'A scenario under `specs/` that ACTS (`click`, `fill`, `select`, `check`, `press`, `tap`, `rerender`) on the visitor it was handed ends on `visitor.see(…)`, `visitor.gone(…)` or `visitor.unmount()` — through the block, branch, loop or `.then()` it ends in. A scenario that only reads is out of reach, and so is a component test, whose action often produces a CALL rather than a screen.',
        facet: 'model',
        family: 'W',
        fix: 'End on `visitor.see(<what the action produced>)` or `visitor.gone(<what it removed>)`.',
        id: 'W5',
        rationale:
            'The capture is taken when the callback returns: a scenario ending on a click hands the golden whatever was on the screen at that instant, and the failure reads as flakiness rather than as a missing wait.',
        reach: 'specs',
    },
} satisfies Record<string, RuleDoc>;

/**
 * The **checker** channel — the non-oxlint static passes bundled as
 * `dist/checker.js` (token/HTTP grammar + cross-file analyses). Oxlint never
 * visits data fixtures nor reads two files at once, so these ship separately.
 */
export const CHECKER_PASSES: CatalogEntry[] = [
    {
        channel: 'checker',
        convention:
            'A `<case>.spec.yaml` is a SPEC, not ground: a document under `expected/`, `requests/`, `seeds/` or `fixtures/` is an error.',
        facet: 'cli',
        family: 'C',
        fix: 'Move the document beside the test that runs it.',
        id: 'C16',
        name: 'c16-document-outside-ground',
        rationale:
            'A document IS the scenario; filed under ground it reads as material a scenario stands on, and the reader cannot tell which files are run.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'A test under `specs/<facet>/`, where the facet root holds a `*.specification.ts(x)`, imports that module or constructs a runner itself. Ground is out of reach — nothing under a `fixtures/`, `expected/`, `requests/` or `seeds/` folder is a spec, a `.test.ts` under `expected/` being the GOLDEN a fixer writes. So is any first-level folder that is not a facet: a specification with no module to sit beside and no runner to reach lives in a repository suite there.',
        facet: 'model',
        family: 'C',
        fix: 'Import `{ <facet> }` from `<facet>.specification.js`, move a module test beside its module, or move a repository suite to a first-level folder of its own under `specs/`.',
        id: 'C18',
        name: 'c18-module-test-under-facet',
        rationale:
            "A test reaching no runner under a facet is a module test paying the facet's budget and services to prove something that belongs beside its module.",
        reach: 'specs',
    },
    {
        channel: 'checker',
        convention:
            "A first-level folder named for one of the six facets holds a `*.specification.ts(x)` calling `specification.<facet>(`. Positive-only: any other first-level name is a repository suite, judged by C1's declared depth alone.",
        facet: 'model',
        family: 'C',
        fix: 'Create the specification the folder promises, or rename the folder.',
        id: 'C20',
        name: 'c20-facet-folder',
        rationale:
            'Folder = constructor is the law the fork rests on; a facet folder with no runner tells the reader something false before they open a file.',
        reach: 'specs',
    },
    {
        channel: 'checker',
        convention:
            "A `seeds/**/*.sql` states absolute timestamps: `CURRENT_TIMESTAMP`/`CURRENT_DATE`/`CURRENT_TIME`, `NOW()` and the quoted `'now'` SQLite's date functions take (`datetime('now')`, `strftime(…, 'now')`, `date('now', '-1 day')`) are refused. A comment is not state, so a clock read inside one is not a finding.",
        facet: 'model',
        family: 'C',
        fix: "Write the instant the case is about, and pin the run's clock with `.clock()` on the chain.",
        id: 'C23',
        name: 'c23-seed-no-clock-read',
        rationale:
            "A seed that reads the clock makes the row's date the date the suite happened to run: a case about \"published yesterday\" proves something different every day, and under SQLite `datetime('now')` writes a space-separated text where an ORM writes ISO `T`, so the two misorder across a calendar day. The R8 dry run counts 36, every one of them signews-api's.",
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'Ground in a leaf holding ≥ 2 node tests (`.test.ts`, `.spec.ts`) that a single one of them reads is a warning. A `.test.tsx` tree is out of reach, as it is for C1, and so are the api, cli and jobs facets: there a leaf is its subject’s standard name (C30), its aspect files share it by design, and a folder of one spec’s own is one C30 moves the spec back out of.',
        facet: 'model',
        family: 'C',
        fix: 'Give that spec its own domain folder, with the ground beside it.',
        id: 'C21',
        name: 'c21w-ground-owned-by-one',
        rationale:
            'Ground one spec reads, parked where several sit, reads as shared: everyone assumes someone else depends on it and nobody dares touch it.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'Every `checker-disable-next-line` / `checker-disable-line` directive carries ` -- <reason>`, wherever a checker pass can be silenced: a test, a document, a fixture under ground. The word inside a string is prose, not a directive.',
        facet: 'model',
        family: 'J',
        fix: 'Write `checker-disable-next-line <id> -- <reason>`.',
        id: 'J9',
        name: 'j9-checker-suppression-reason',
        rationale:
            "A suppression with no reason is a rule turned off by someone no longer here: the next reader cannot tell whether the pass was wrong or simply in the way, so the line survives every review. The toolchain's own gate reads `oxlint-disable*` and nothing else.",
        reach: 'specs',
    },
    {
        channel: 'checker',
        convention:
            'Every workspace member with tests OF ITS OWN (a `test` script that does not delegate to members, or a `*.test.ts(x)` outside another package’s tree) declares a vitest config (`vitest.config.*`). The MEMBER pass judges the member itself, with or without a `specs/` root; a root that only delegates owes nothing.',
        facet: 'model',
        family: 'E',
        fix: 'Write `export default defineSpecConfig()` in the member — the preset carries the budgets, the artefact directory and the ground exclusion.',
        id: 'E3',
        name: 'e3-config-present',
        rationale:
            "Without a config, vitest's 5 s budget and unexcluded ground folders are running the member's tests: the default is not chosen, it is inherited.",
        reach: 'member',
    },
    {
        channel: 'checker',
        convention:
            "`environment: 'happy-dom'|'jsdom'` in a `vitest.config.*` is an error. The MEMBER pass is the one channel that holds it: a config is not always a file the repository's oxlint configuration collects, while the member pass starts from the root manifest and reaches every declared member — and one finding is one line in one report.",
        facet: 'component',
        family: 'E',
        fix: 'Remove `environment` and collect the rendered tests with `component()`.',
        id: 'E5b',
        name: 'e5b-no-simulated-dom-config-member',
        rationale:
            "The static pass sees only what the repository's oxlint configuration hands it; the member pass starts from the root manifest and reaches every declared member.",
        reach: 'member',
    },
    {
        channel: 'checker',
        convention:
            'A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`) — except `@testing-library/react-native` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands. Jest runs them when the member DECLARES it (a `jest`/`jest-expo` dependency, a `jest` field, a `test` script calling it) or when a `jest.config.*` elsewhere in the workspace ROOTS into the member, which is the shape a library co-locating its render tests takes when the app beside it owns the only working toolchain. The optional peers — `playwright`, `vite`, `react`, `better-sqlite3`, `pg`, `redis`, `testcontainers`… — are declared by the consumer, by design.',
        facet: 'model',
        family: 'F',
        fix: 'Remove the declaration: a transitive is already resolved by the package; a retired seam has a facet that replaces it (`component()`, `website()`, `clock`, `intercept()`). The diagnostic carries a sentence for each case.',
        id: 'F8',
        name: 'f8-no-seam-dependency',
        rationale:
            'A duplicate declaration lets two versions of one seam coexist, and a retired seam keeps a vocabulary the framework has replaced.',
        reach: 'member',
    },
    {
        channel: 'checker',
        convention:
            'Every `{{token}}` in an `expected/` fixture — or in an expected stream of a `<case>.spec.yaml` document — belongs to the frozen vocabulary; an unknown token is an error.',
        facet: 'model',
        family: 'D',
        fix: 'Write a token the grammar knows; the message prints the full list.',
        id: 'D4',
        name: 'd4-unknown-token',
        rationale:
            'A closed grammar shared with the runtime matcher stops the two channels drifting.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'A malformed ref of a known kind (`{{iso8601#}}`, `{{uuid #id}}`) in a text file under `expected/` is an error.',
        facet: 'model',
        family: 'D',
        fix: 'Write `{{kind#name}}` with no space, and a name for the ref.',
        id: 'D4',
        name: 'd4-malformed-ref',
        rationale: 'A malformed capture would fail silently — naming it makes it visible early.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'The first line of a depth-1 `.http` follows its grammar: a request line (`METHOD /path`) under `requests/`, a status line (`HTTP/1.1 <status>`) under `expected/`.',
        facet: 'api',
        family: 'D',
        fix: 'Write the opening line the folder calls for, or move the file to the other one.',
        id: 'D4b',
        name: 'd4b-http-first-line',
        rationale:
            'The opening line is what tells a request from a response — constraining it catches misplaced files.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'A `<case>.spec.yaml` document follows its grammar: closed keys — `description`, `fixture`, `env`, `serve`, `runs` — and closed keys inside a run; `description:` and `runs:` required; `command:` and `exit:` required in every run, `exit:` an integer literal, `waitFor:` only on the last run and never with `stdin:`, a `files:` path relative and under the workdir; every `fixture:` path relative, reaching `fixtures/`.',
        facet: 'cli',
        family: 'D',
        fix: 'Write the key the grammar names; the message prints the accepted set.',
        id: 'D4b',
        name: 'd4b-spec-shape',
        rationale:
            "The grammar is read by the runner's own parser: the document lint accepts is exactly the one the runner runs.",
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'The keys of a `<case>.spec.yaml` follow the canonical order — `description, fixture, env, serve, runs` at document level, `command, stdin, timeout, waitFor, exit, stdout, stderr, files` inside a run. Fixable (`--fix`).',
        facet: 'cli',
        family: 'D',
        fix: 'Run `jterrazz-test-check <root> --fix`; it rewrites the order.',
        id: 'D4b',
        name: 'd4b-spec-key-order',
        rationale:
            'The setting before the session, the input before the output: one order makes documents comparable and removes the diffs that change nothing.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            '`stdout`, `stderr`, `stdin` and `files.*.equals` of a `<case>.spec.yaml` are written as block scalars (`|` keeps the trailing newline, `|-` drops it), never as a quoted string carrying `\\n`. Fixable (`--fix`).',
        facet: 'cli',
        family: 'D',
        fix: 'Run `jterrazz-test-check <root> --fix`; it rewrites the scalar.',
        id: 'D4b',
        name: 'd4b-spec-block-scalar',
        rationale:
            'Expected output has to look like output — a golden on one line is unreadable and no diff can show it.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'The suffix says the kind, and the tree agrees with it. A `.spec.ts` — the ASSEMBLED product — lives under `specs/<facet>/`; anywhere else is an error. A `.test.ts` — the UNIT — lives beside its module; under a facet folder (`api`, `cli`, `integration`, `jobs`, `mobile`, `website`) it is an error, fixable by `--fix` (a `git mv`). A `.test.ts` that reaches no runner is C18’s, whose fix is the opposite move, and the mover leaves it alone. A first level that is NOT a facet is a repository suite: it covers a tree, keeps `.test.ts`, and C1’s declared depth is what judges it — unless the tree carries its `*.specification.ts` at its own ROOT, which makes the whole tree one facet’s and every `.test.ts` below it a spec. A document is named `<case>.spec.yaml`: `<case>` in kebab-case, without the words `test`/`spec`/`cli` the suffix already carries, and never the bare name of its directory.',
        facet: 'model',
        family: 'C',
        fix: 'Move the `.spec.ts` under `specs/<facet>/` (or rename it `.test.ts` beside its module); rename the facet `.test.ts` to `.spec.ts` — `jterrazz-test-check <root> --fix` does it with `git mv`, and names every `include`/`exclude` entry of the member the rename broke.',
        id: 'C12',
        name: 'c12-spec-file-name',
        rationale:
            'With no agreement between the suffix and the tree, a reader cannot say what a test proves without opening it; and the filename is the first sentence they read — `rm/rm.spec.yaml` says nothing twice.',
        reach: 'specs',
    },
    {
        channel: 'checker',
        convention:
            "A document's `description:` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters.",
        facet: 'cli',
        family: 'J',
        fix: 'Write it as a title, not as a sentence.',
        id: 'J5',
        name: 'j5-spec-description',
        rationale:
            "The description IS the vitest title — a title's rules apply to it, not a paragraph's.",
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'Two `<case>.spec.yaml` documents in one directory do not share a `description:`.',
        facet: 'cli',
        family: 'J',
        fix: 'Name what each case proves; two titles that read alike leave two files to open.',
        id: 'J4',
        name: 'j4-spec-description-unique',
        rationale: 'The reporter names the title: two identical titles leave two files to open.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'No expected output carries a literal volatile value: a loopback origin with a port (`127.0.0.1:8080`, `localhost:3000`), an absolute temporary path (`/tmp/`, `/private/tmp/`, `/var/folders/`) or a home path (`/Users/…`, `/home/…`). Both halves of the ground are judged by the one list — an expected stream of a `<case>.spec.yaml`, and every text file under `expected/`. A `{{token}}` is not a literal, and neither is a value the DOCUMENT pinned: in a stream, a word the same document states in a command argument, an `env:`/`serve:` value, a `stdin:`, a `fixture:` it names or its own sibling `fixtures/` is excluded before it is judged.',
        facet: 'cli',
        family: 'D',
        fix: 'Write the token the message names — `{{workdir}}`, `{{url}}` — in place of the literal.',
        id: 'D5',
        name: 'd5-spec-volatile-literal',
        rationale:
            'This is exactly the shape a `TEST_UPDATE` run would have tokenised: finding one means a token was overwritten by hand.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            "A literal ISO-8601 timestamp or uuid in an expected stream of a `<case>.spec.yaml` → warning, unless the same value appears in a `fixture:`, the document's sibling `fixtures/`, a `stdin:`, a command argument or an `env:`/`serve:` value of the same document (it is then pinned, not volatile). Under `expected/` the same class waits for D21w, whose criterion chapter 18 carries.",
        facet: 'cli',
        family: 'D',
        fix: 'Token it, or seed it — a value the document pins is a value it may assert.',
        id: 'D5',
        name: 'd5w-spec-pinned-value',
        rationale: 'The defect is not the literal: it is the literal nothing pinned.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'An expected stream whose whole content is `{{any}}` → warning: the run executes and proves nothing.',
        facet: 'cli',
        family: 'J',
        fix: 'Regenerate with `TEST_UPDATE=1` and keep tokens only for the parts that move.',
        id: 'J3',
        name: 'j3w-spec-empty-assertion',
        rationale:
            'The J3 mirror for documents — an assertion that accepts anything is an absent assertion.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'A run whose `exit:` is non-zero with neither `stdout:` nor `stderr:` → warning: the document does not say why the command refused.',
        facet: 'cli',
        family: 'D',
        fix: 'Write the refusal the command prints — that is what the case proves.',
        id: 'D11',
        name: 'd11w-spec-silent-refusal',
        rationale:
            'A silent refusal is either a defect in the product, or a golden that forgot the words went to stderr.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            "A document's bare `env:` words and `serve:` names are keys of the `env`/`serve` objects of a `specification.cli(…)` in the nearest directory carrying `*.specification.ts` files (literals read statically; ignored otherwise).",
        facet: 'cli',
        family: 'C',
        fix: 'Register the name in the specification, or fix the spelling.',
        id: 'C8',
        name: 'c8-spec-registered-name',
        rationale:
            'A typo (`serve: dashbord`) fails at run time today, a test file later; here it is one lint line.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'A known token in a file under `requests/` → warning: requests are inputs, never matched.',
        facet: 'api',
        family: 'D',
        fix: 'Write the literal value the request actually sends.',
        id: 'D10',
        name: 'd10w-tokens-in-requests',
        rationale:
            'A token in an input is neither validated nor substituted — it is almost always a mistake.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            "No dead fixtures: every file under `seeds/`/`requests/`/`fixtures/` and every top-level entry of `expected/` must be referenced — a leaf's, and the specs root's own four; a feature directory with no test file and no `*.spec.yaml` is an orphan (a warning when the argument is not a literal). A reference is a path RESOLVED to the entry, never a name: a document's keys and a `file()`/`directory()` argument from the file that writes them, the words of any other literal from that file and from the project root, a template literal's table from the folders written before its hole — so `./seeds/x.sql` in a leaf vouches for that leaf's `seeds/x.sql`, and not for `<specs>/seeds/x.sql`. A `<case>.spec.yaml` references the files every path key of it names.",
        facet: 'model',
        family: 'C',
        fix: 'Reference it from the spec it stands under, or delete it.',
        id: 'C9',
        name: 'c9-dead-fixtures',
        rationale:
            'The C8 mirror — a fixture nothing references is dead weight that misleads the reader.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            "A ground file exists only if it is shared, and a value lives in a test only while it stays short. The checker counts the TESTS that read each file of the specs trees — a `test()`/`it()` whose body names it with a literal `file()`/`directory()`, a document — and judges its level. Read by ONE test, a file of `expected/` or `requests/` is an error where the test names it: it belongs in the test, written in place — a golden as the value `toMatch` compares, a request as its text or its body value — unless it is a directory tree, a binary file, or longer than its role's cap: 30 lines for `requests/`, 150 for `expected/` (a JSON file counted as the value it becomes). The caps hold the other way too: a request or a body written in the test past 30 lines, an expectation past 150, is an error where it is written, and belongs in a file beside the test. `seeds/` has no form in place — SQL is never written in a test, and SQL tagged in one is an error where the tag stands: a seed is a `.sql` file, beside its test in `./seeds/` when one test reads it, never an error for being unshared. `fixtures/` is file state a program reads, never a value, and stays a file. Read by several tests of ONE leaf, a file lives beside them: an entry of the specs root's own ground (`<specs>/seeds/`, …) one leaf alone reaches is an error where it sits, and belongs in the leaf's folder of the same role. Read from several leaves, it lives in the specs root's ground — C15 refuses the path that leaves a leaf for a sibling's, and C27 finds copies — unless one of them encloses the others: a route and the routes under it (`map/pois/` and `map/pois/detail/`) share it in the route's own folder of that role, which each reaches. A reference outside every test — a `const` of the file, a specification, a helper — counts as shared, and zero references is C9's. Fixed by `--fix`: SQL a test holds is written to `./seeds/<name>.sql` beside it — named by its first `--` comment, kebab-cased, else by the first four meaningful words of its test's title — and named with `file()`; a value past its cap is written to `./requests/` or `./expected/` beside its test, named by the test's title, and named with `file()` — never one a plain value is compared to (`expect(message).toMatch(…)`, a name or a string literal as the subject): a string has no golden, and the finding names `text()` to wrap it with; a single-use file whose one reference is a literal `file()` handed to `.request(`, `.post(`/`.put(` or `toMatch(` is written in place and deleted (a `file` import no longer used dropped, an emptied ground folder removed); an entry of the specs root one leaf alone reaches — or one leaf and the leaves inside it — is moved into that leaf's ground (a `git mv` in a work tree) and the literals rewritten, from each referrer.",
        facet: 'model',
        family: 'C',
        fix: 'Run `jterrazz-test-check <root> --fix`: it writes SQL and a value past its cap to a file beside the test, writes a single-use file into its one test and deletes it, and moves a specs-root entry one leaf reaches beside that leaf. A test whose subject IS the file form keeps it, with a reasoned `checker-disable-next-line c28`.',
        id: 'C28',
        name: 'c28-ground-shared-or-inline',
        rationale:
            "A file a test reads is read at a distance: the reader opens a second file to know what the test stands on or expects, and a file one test reads pays that price for nothing — until the value is too long to read in the test, where the file is the clearer page. SQL is the exception at any length: a seed is database state a reader opens as a file, and SQL in a TypeScript string is checked by nothing. A single scenario's file parked in the pool is worse still — it reads as shared, so nobody dares change it.",
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'Every chain of a spec file reaches ONE subject, read statically: an api chain its method and route template (`GET /events/:id`, the request line of a `.http` a `.request(file())` sends), a jobs chain the job it triggers, a cli chain its command words, a website chain the page it visits, a mobile chain the journey it opens. A file reaching several is an error at the first chain that reaches a second. Fixed by `--fix`: each test goes to the file of its subject — the subject’s standard folder under the facet, as C30 names it, the file keeping its aspect’s name; beside the file, named for the subject, where the subject has none — keeping the imports and the file-level declarations it reads, and a hook (`beforeEach`, `afterEach`, …) only where the file’s tests read what it sets or clears — a declaration two of the new files read, and every declaration it reads in turn — a type alias or an interface among them — moves once into the fixtures module of the folder they share (`<folder>/<folder>.fixtures.ts`), exported and imported by each, unless it builds a `file()` or a `directory()` (C26) or the module already exists, and then it stays copied; the paths the code names keep pointing where they pointed, and the old leaf’s ground another leaf reads goes up to the specs root’s own ground, where C28 moves it down to the one leaf that reads it. A test whose own chains reach two subjects is reported and left.',
        facet: 'model',
        family: 'C',
        fix: 'Run `make fix`: it splits the file, one per subject. A test reaching two subjects states what it stands on with a seed instead of a second action.',
        id: 'C29',
        name: 'c29-one-subject',
        rationale:
            'A file about one subject is found by its subject: the reader of `GET /events/:id` opens one folder and reads every question asked of it, and a change to that route touches one file.',
        reach: 'spec',
    },
    {
        channel: 'checker',
        convention:
            "A spec file about one subject sits in the subject’s standard folder, derived and never listed: `GET /events` → `events/list/`, `GET /events/:id` → `events/get/`, `POST /events` → `events/create/`, `PUT|PATCH /events/:id` → `events/update/`, `DELETE /events/:id` → `events/delete/`, a route under an item (`GET /events/:id/timeline`) its literal segments (`events/timeline/`), a singleton (`GET /health`) `health/get/`, a method-less route its segments; a job its name (`specs/jobs/<job>/`), a cli command its first word (`specs/cli/<word>/`), or every leading word the `commands` list of the runner its chain's handle came from holds (`specification.cli(bin, { commands: ['db', 'migrate'] })` files `db migrate` under `db/migrate/`; the list written in the call or bound to a `const` of the runner's file). A GET on one segment lists a plural noun, or a collection `jterrazz.config.ts` names (`test: { collections: ['data'] }`), and gets anything else; a segment is a parameter when the chain writes the route's template (a `:name` segment, or `{ params }` beside the path, B12), or when it is a template hole or anything but lowercase words. A filled path whose word sits right after a collection with more path after it (`btc` in `/indicators/btc/chart`) reads two ways: it is reported at its chain, naming the template to write — or `{ params: {} }` when the word is the route's own — and never moved; a `.http` request line is read as the route. A page, a journey and the root route have no standard name, and are not judged. An error at the file’s first line; fixed by `--fix`, which moves the file as C29 does and removes the folders the move leaves empty.",
        facet: 'model',
        family: 'C',
        fix: 'Run `make fix`: it moves the file to its subject’s folder, and the ground it stands on with it.',
        id: 'C30',
        name: 'c30-subject-folder',
        rationale:
            'A name derived from the subject is the same in every repository: nobody lists the folders, nobody argues them, and a reader who knows the route knows the path.',
        reach: 'spec',
    },
    {
        channel: 'checker',
        convention:
            "Ground several leaves share lives once: an entry of a leaf's ground — a file, or a tree compared file by file — that another leaf holds byte for byte under the same role, whatever either is called, is a warning on every copy; it belongs in the specs root's folder of its role (`<specs>/seeds/<name>`), named by the path that climbs to it. Fixed by `--fix` when the copies share one name: one copy is moved there — a `git mv` in a work tree — the others deleted, and every path of the specs tree that named a copy rewritten. Copies of several names, and a specs root already holding the name with other content, are left to the author.",
        facet: 'model',
        family: 'C',
        fix: 'Run `jterrazz-test-check <root> --fix`, or keep the copies apart on purpose and record them in the ratchet.',
        id: 'C27',
        name: 'c27w-duplicate-ground',
        rationale:
            "Copies drift: one leaf's seed gains a column, the other's does not, and the reader of either cannot tell a difference meant from one forgotten.",
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            "A path leaves its leaf only into the specs root's own ground, or into the ground of a leaf that encloses it: a path a `file()`, a `directory()` or any path key of a document names, whose target is neither under the spec's own directory, nor under one of `<specs>/fixtures/`, `<specs>/seeds/`, `<specs>/requests/`, `<specs>/expected/` — the four roles, one level up — nor under the four of a folder above it that holds tests of its own (a route's, reached from a route under it: `map/pois/detail/` reads `../seeds/` of `map/pois/`), is an error; ground shared by several leaves goes there, in the folder of its role (C24 judges which). A leaf's ground reached from a sibling leaf is one such path, so this row holds the sibling case too.",
        facet: 'model',
        family: 'C',
        fix: "Copy it under this leaf's own ground, or promote it to the specs root's folder of its role — `<specs>/seeds/` for a seed, `<specs>/fixtures/` for file state.",
        id: 'C15',
        name: 'c15-local-fixture-reach',
        rationale:
            "A leaf reaching into a neighbour's fixtures is the pool through another door, without the pool's visibility: the neighbour breaks a spec two folders away without knowing.",
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            "Every `file()` and `directory()` a test names with a literal path — a spec under `specs/` and a module test beside its module alike — and every path a document's `fixture:` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a `file()` naming a directory or a `directory()` naming a file is an error, reported where the path is written. The tree pass reads the `specs/` trees, the member pass every other test of the member. A computed path is out of reach, and the runtime refuses it with the path it resolved to; a call written inside a string is text, and is not read.",
        facet: 'model',
        family: 'C',
        fix: 'Create the entry (out of `.gitignore`), or fix the path — the message names what it resolved to.',
        id: 'C8',
        name: 'c8-disk-target-exists',
        rationale:
            'A typo in a path fails a run, a test later, far from the line that made it; statically it is one report line at the path.',
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'One word per meaning: a folder named `snapshots/`, `__snapshots__/`, `golden/` or `goldens/` is an error anywhere in a member when a test would stand on it — any such folder under `specs/`, and elsewhere one that holds no module of code (a `goldens/` folder of matcher source is named for what its code does). What it would hold is what a test asserts, and that is `expected/`. Ground is not entered: a fixture project may carry the word on purpose.',
        facet: 'model',
        family: 'C',
        fix: 'Rename the folder `expected/`, and the paths that name it.',
        id: 'C25',
        name: 'c25-no-ground-synonym',
        rationale:
            'Four reserved names are a vocabulary only while nobody adds a fifth: a second word for the goldens is a second place a reader has to look, and the rules that read `expected/` never see it.',
        reach: 'all',
    },
    {
        channel: 'checker',
        convention:
            "B5's one channel: docker-aware runners are inferred from the `docker:` option of the imported specification file, and every `.exec()` result bound without `await using` is reported.",
        facet: 'model',
        family: 'B',
        fix: 'Bind the result with `await using`, so the containers the run spawned are disposed with the scope.',
        id: 'B5',
        name: 'b5-await-using-inference',
        rationale:
            'Inferring the runners removes the hand-maintained list an oxlint rule would need.',
        reach: 'tests',
    },
    {
        channel: 'checker',
        convention:
            'With ≥ 2 databases, `database:` is required on every `.seed()`/`.table()`; with exactly one it is forbidden — checked by crossing the `services:` record with the calls in the tests.',
        facet: 'model',
        family: 'A',
        fix: 'State `database:` everywhere or nowhere, whichever the record calls for.',
        id: 'A7',
        name: 'a7-database-property',
        rationale:
            'The number of databases fixes the call API; the cross-file analysis catches the omission before run time.',
        reach: 'tests',
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
        channel: 'meta',
        convention:
            'Every constructor has a `specs/<facet>/` tree in this package. Two subjects answer differently, each with its reason stated: `component` is a CHAIN, not a constructor, and is proven beside its fixture app under `specs/component-app/`; `mobile` has no tree at all, because CI provisions no simulator.',
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

/**
 * The **type** channel — what the COMPILER refuses.
 *
 * No rule sees these and no pass walks them: the call they describe does not
 * compile, so the framework never gets the chance to refuse it at run time.
 * Each row is proven by an `@ts-expect-error` in `src/type-channel.test-d.ts`
 * (the W6 verb rows have a fuller set in the component facet's own type test),
 * which `typescript check` runs over the whole repository — the assertion fails
 * the day the line it marks starts compiling — and each marker names the words
 * of the error it is written for, which `lint/type-channel.test.ts` holds it
 * to: a line refused for another reason fails too.
 */
export const TYPE_ROWS: CatalogEntry[] = [
    {
        channel: 'type',
        convention:
            "A request to a route with parameters is written as the route's template, its values beside it — `api.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })` — and the template types them: every `:name` it holds takes a value, and no other name does. `get` and `delete` take the options second, `post` and `put` third, after the body; a path with no parameter takes none, or `{ params: {} }` to state that it is the route itself.",
        facet: 'api',
        family: 'B',
        fix: "Write the route as the app declares it and hand its values: `.get('/events/:id', { params: { id } })`.",
        id: 'B12',
        name: 'b12-route-template',
        rationale:
            'A filled path hides which of its segments are values: the reader, the subject reader and route coverage all have to guess that `btc` in `/indicators/btc/chart` is a symbol. The template says it, and the compiler holds the values to it.',
        reach: 'tests',
    },
    {
        channel: 'type',
        convention:
            "A string is a value and the disk is `file()` or `directory()`: `seed('./seeds/x.sql')` (a bare string where a file is meant), `seed(file('./seeds/x.json'))` (the wrong extension), `file('x.sql')` (not a relative path), `directory('./fixtures/shop')` (a directory without its `/`), `get(file(…))` (a file where a value is meant) and `toMatch(directory(…))` on a stream do not compile.",
        facet: 'model',
        family: 'B',
        fix: "Name the disk from the spec file: `file('./seeds/users.sql')`, `file('./expected/help.txt')`, `directory('../../fixtures/shop/')`.",
        id: 'B2',
        name: 'b2-a-file-is-named-by-its-path',
        rationale:
            'A bare name resolved against a hidden folder is a convention the reader has to know; a relative path is read where it is written, and the compiler refuses the other form at the call.',
        reach: 'tests',
    },
    {
        channel: 'type',
        convention:
            'The `services` record types the factory argument: `server: (services) => …` sees exactly the keys the record declares.',
        facet: 'model',
        family: 'A',
        fix: 'Declare the service in the record, or read the key that is there.',
        id: 'A8',
        name: 'a8-services-type-the-factory',
        rationale:
            'A service read by a name nothing started is a startup failure with no line to blame; the compiler has the record in hand and can say so at the call.',
        reach: 'specification',
    },
    {
        channel: 'type',
        convention:
            '`server` and `url` are mutually exclusive on `specification.website()` — the pair is inexpressible, not runtime-checked.',
        facet: 'model',
        family: 'A',
        fix: 'State `server` for a site this run starts, `url` for one already running.',
        id: 'A11',
        name: 'a11-server-xor-url',
        rationale:
            'They name two different subjects, and a specification that states both leaves the reader to guess which site the spec is about.',
        reach: 'specification',
    },
    {
        channel: 'type',
        convention:
            'Exactly ONE terminal action closes a chain: what it answers is a result, and a result carries no verbs to continue with.',
        facet: 'model',
        family: 'B',
        fix: 'Open a second chain for a second action.',
        id: 'B1',
        name: 'b1-one-terminal-action',
        rationale:
            'Two actions in one chain make a test with two Whens, and the reader cannot tell which one the Then is about.',
        reach: 'tests',
    },
    {
        channel: 'type',
        convention: 'A chain carries no label: the test name is the sentence.',
        facet: 'model',
        family: 'B',
        fix: 'Name the test; the chain states what it does, not what it is called.',
        id: 'B3',
        name: 'b3-no-label-on-a-chain',
        rationale: 'A second place to read the intent is a second place for it to be stale.',
        reach: 'tests',
    },
    {
        channel: 'type',
        convention: 'A result accessor is read-only.',
        facet: 'model',
        family: 'D',
        fix: 'Assert on what the run produced; change the Given if the answer is wrong.',
        id: 'D1',
        name: 'd1-read-only-accessors',
        rationale:
            'The answer a run produced is evidence, and a test that can rewrite its own evidence proves nothing.',
        reach: 'tests',
    },
    {
        channel: 'type',
        convention:
            '`mockOf<Port>()` needs its port: `T` is constrained to `object` with no default, so a double built without one has no surface and every call on it is refused.',
        facet: 'model',
        family: 'M',
        fix: 'State the port: `mockOf<PaymentGateway>()`.',
        id: 'M2',
        name: 'm2-mockof-requires-the-port',
        rationale:
            'The type argument IS the contract the double stands for; without it the double agrees with anything.',
        reach: 'tests',
    },
    {
        channel: 'type',
        convention:
            "The verb set is the boundary between the facets: `goto` is the page's, `rerender`/`unmount` the component's, `tap` the screen's, and `focused`/`disabled`/`selected`/`valued` reach only where `see` and `gone` do.",
        facet: 'model',
        family: 'W',
        fix: 'Reach for the verb the facet offers; a missing one is a decision, not an omission.',
        id: 'W6',
        name: 'w6-verb-subset-per-facet',
        rationale:
            'One vocabulary across three facets is memorable only while each facet refuses the words it cannot mean.',
        reach: 'tests',
    },
];

/**
 * The **upstream** channel — a convention an oxlint plugin rule ALREADY knows
 * how to enforce, turned on with the option that states it (ADR-005).
 *
 * One owner per convention: a ban a `vitest/*` rule can carry as an option is
 * set from the `testing` fragment rather than rewritten as a `jterrazz/*` rule,
 * and the fragment is where a reader finds the option. A core rule whose
 * options OTHER owners already set (`no-restricted-imports`,
 * `no-restricted-globals`) is the exception: an override replaces options
 * rather than merging them, so F6 and G4 are this plugin's own.
 */
export const UPSTREAM_RULES: CatalogEntry[] = [
    {
        channel: 'upstream',
        convention:
            'No vitest snapshot matcher: `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`, `toMatchAriaSnapshot`, `toMatchScreenshot`, `toThrowErrorMatchingSnapshot` and `toThrowErrorMatchingInlineSnapshot` are refused by `vitest/no-restricted-matchers`, whose option the `testing` fragment sets (ADR-005).',
        facet: 'model',
        family: 'D',
        fix: "Write the golden: `expect(subject).toMatch(file('./expected/<name>.<ext>'))`; under `src/` compare to a literal with `toStrictEqual`.",
        id: 'D20',
        name: 'd20-golden-not-snapshot',
        rationale:
            'A snapshot is written by the run that was supposed to be judged by it: nobody reads the diff, and a wrong answer becomes the expectation the moment someone re-records.',
        reach: 'tests',
        upstream: 'vitest/no-restricted-matchers',
    },
    {
        channel: 'upstream',
        convention:
            'At most one level of `describe` — `vitest/max-nested-describe` with `{ max: 1 }`, set by the `testing` fragment.',
        facet: 'model',
        family: 'J',
        fix: 'Flatten the nesting: the test name is the sentence, and one level groups the file.',
        id: 'J10',
        name: 'j10-one-describe-level',
        rationale:
            'A tree of contexts is state a reader has to hold in their head to know what a test is about, and the name of the test stops being the sentence it was.',
        reach: 'tests',
        upstream: 'vitest/max-nested-describe',
    },
    {
        channel: 'upstream',
        convention:
            "`vi.stubGlobal`, `vi.useFakeTimers`, `vi.setSystemTime` and `vi.useRealTimers` are refused by `vitest/no-restricted-vi-methods`, each with the primitive that replaces it — a subject that fetches a relative URL states its base with `intercept(contracts, { origin })`. `vi.stubEnv` is sanctioned; `vi.mock`/`vi.doMock` stay on I4, whose allow-list the option cannot express. One escape is sanctioned, because the option carries no allow-list and the seam does not answer yet: a subject whose OWN code calls `response.body.cancel()` on an intercepted reply hangs under msw's node interceptor, so that one test keeps `vi.stubGlobal('fetch')` behind an `oxlint-disable-next-line vitest/no-restricted-vi-methods` written on the call, naming the defect (chapter 16, § A cancelled body does not settle). It leaves with the seam fix.",
        facet: 'model',
        family: 'M',
        fix: 'Reach for `intercept()` and `clock` — both give back what they took at the end of the scope.',
        id: 'M3',
        name: 'm3-no-vi-time-or-global-stub',
        rationale:
            'A stubbed global is the network replaced by a function the test wrote, and a fake timer taken without `using` outlasts the test that took it.',
        reach: 'tests',
        upstream: 'vitest/no-restricted-vi-methods',
    },
];

/**
 * The **runtime** channel — refusals and behaviours the framework enforces at
 * execution time, where static analysis abstains (non-literal arguments) or
 * cannot reach (network, container lifecycle). Several double a static pass.
 */
export const RUNTIME_RULES: CatalogEntry[] = [
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['b12-route-params-runtime']} The chain fills each \`:name\` segment with its value, URI-encoded, the query kept, and sends the filled path; route coverage reads the request by its template — a parameter where the route declares one, each literal segment as itself. A template handed no params, a parameter with no value and a value no parameter takes are refused before a request is sent, naming the call to write.`,
        facet: 'api',
        family: 'B',
        fix: "Hand exactly the template's parameters: `.get('/events/:id', { params: { id } })`.",
        id: 'B12',
        name: 'b12-route-params-runtime',
        rationale:
            'The compiler holds a typed spec to its template; a cast or a JavaScript spec is held here, before a request the app would answer 404 is taken for a finding about the app.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'A sequence is expressed by SEEDING the state the second run would have found: every chain starts on databases the framework has reset.',
        facet: 'model',
        family: 'B',
        fix: 'Seed the state the earlier step would have left, and open one chain per action.',
        id: 'B7',
        name: 'b7-sequence-by-seed',
        rationale:
            'A spec that depends on a previous one passes alone, passes in order, and fails the day the runner reorders them.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'An `expected/*.http` starts with a status line, and its headers are matched as a SUBSET: the ones listed must match, unlisted response headers are unconstrained.',
        facet: 'api',
        family: 'C',
        fix: 'List the headers the case is about; leave the rest out.',
        id: 'C3',
        name: 'c3-expected-http-shape',
        rationale:
            'A response carries headers no test is about (dates, lengths, proxies); matching them all would make every golden a record of the machine that wrote it.',
        reach: 'ground',
    },
    {
        channel: 'runtime',
        convention:
            "A golden's path may name a subfolder (`./expected/build/verbose.txt`): the path is the file, and update mode creates the folders it names.",
        facet: 'model',
        family: 'C',
        fix: 'Name the subfolder in the path.',
        id: 'C5',
        name: 'c5-a-path-names-its-subfolder',
        rationale:
            'A flat folder stops being readable at a dozen files, and a path that names its subfolder is read where it is written — no second option says where a golden lives.',
        reach: 'ground',
    },
    {
        channel: 'runtime',
        convention:
            "Every golden reads the `file()` or `directory()` it is given, from the spec file's directory — response, stream, json, tree alike — and `request()` reads a request the same way. Nothing resolves against a folder the line does not name.",
        facet: 'model',
        family: 'D',
        fix: "Name the golden from the spec: `file('./expected/<case>.<ext>')`.",
        id: 'D3',
        name: 'd3-a-golden-is-read-where-its-path-says',
        rationale:
            'One resolution rule, written on the line, means a reader knows where a golden lives without knowing any convention or which accessor produced it.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'Isolation is per WORKER: each worker takes its own schema, database index or file copy, so two workers never share state.',
        facet: 'model',
        family: 'G',
        fix: 'Take the handle the runner gives the chain; a client opened at the default index talks to another worker.',
        id: 'G2',
        name: 'g2-per-worker-isolation',
        rationale:
            'Parallelism is the default, and a shared database turns it into a source of failures that never reproduce alone.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'The capture is docker-aware: every container a run spawned carries that run label, and the scope exit removes them whether the test asked about them or not.',
        facet: 'model',
        family: 'G',
        fix: 'Bind the result with `await using`, and declare `docker` on the runner.',
        id: 'G3',
        name: 'g3-docker-aware-capture',
        rationale:
            'A container that outlives its run is a machine filling up quietly, and the next run inherits its state.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['a7-database-runtime']} The framework throws at run time if \`database:\` is absent with ≥ 2 databases, or present with exactly one (it doubles the checker channel).`,
        facet: 'model',
        family: 'A',
        fix: 'State `database:` everywhere or nowhere, whichever the record calls for.',
        id: 'A7',
        name: 'a7-database-runtime',
        rationale: 'The runtime keeps the guarantee even where static analysis abstains.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['b2-relative-path-runtime']} The framework refuses at run time a verb that reads the disk (\`seed\`, \`request\`, \`fixture\`, \`run\`) handed anything but a \`file()\`/\`directory()\` — a bare string names the wrapper to write — and a \`file()\`, \`directory()\` or document \`fixture:\` whose path does not start with \`./\` or \`../\`. The trailing \`/\` says which of the two a path is, and the disk must agree: a directory named without it, or a file named with it, is refused, and so is a path that names nothing, with the path it resolved to.`,
        facet: 'model',
        family: 'B',
        fix: "Name the disk from the spec file: `file('./seeds/users.sql')`, `directory('../../fixtures/shop/')`.",
        id: 'B2',
        name: 'b2-relative-path-runtime',
        rationale:
            'The type refuses a bare name at the call; the runtime keeps the law for a caller the compiler does not see — a JavaScript spec, a cast, a document.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'In `cli` mode with `services`, the framework injects `<KEY>_URL` (camel-aware CONSTANT_CASE) plus the unambiguous aliases `DATABASE_URL`/`REDIS_URL`; `.env()` overrides (`null` unsets).',
        facet: 'cli',
        family: 'B',
        fix: 'Read the variable the record key injects; state `.env()` only to override or unset it.',
        id: 'B6',
        name: 'b6-url-injection',
        rationale: 'Injecting the URLs avoids the repeated hand-wiring and its drift (see b6w).',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['d7-strict-intercepts']} As soon as an \`api\`/\`jobs\` chain declares an intercept, any unmatched outgoing request (an exhausted queue included) fails the spec with an explicit error.`,
        facet: 'model',
        family: 'D',
        fix: 'Declare the contract the request needs, or stop making the request.',
        id: 'D7',
        name: 'd7-strict-intercepts',
        rationale: 'A guarded network makes external interactions exhaustive and intentional.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['d14-one-verb-per-meaning']} Its argument says where the expectation lives: a value written in place — a stream's text, a response's \`.http\` text, a json's value, a table's rows (awaited) — or a \`file()\`/\`directory()\` golden. On a plain string it is vitest's own — a string or a RegExp — and a \`file()\` or a \`directory()\` handed to it is refused, a runner started or none (the path object would otherwise read as the pattern \`[object Object]\`); a string is goldened wrapped, \`expect(text(value)).toMatch(file(…))\`, and a stream's text is \`result.stdout.text\`. A value of the wrong shape — a RegExp on a stream, a response or a json, anything but rows on a table — does not compile, and past the compiler it is refused in both builds, naming the form that takes it; a directory, the working directory and a container take no value, and are refused naming \`directory()\` or \`toBeRunning()\`; a golden handed a subject that has none of its kind is refused, naming the wrapper the subject takes. An empty stream is an empty text: \`toBeEmpty\` is a table's matcher, and handed a stream it is refused in both builds, naming \`expect(<stream>.text).toBe('')\`.`,
        facet: 'model',
        family: 'D',
        fix: "Write the whole result in place, ``toMatch(`…`)``, or `toMatch(file('./expected/<case>.<ext>'))` when it lives on disk; a part of a text is vitest's, on `.text`.",
        id: 'D14',
        name: 'd14-one-verb-per-meaning',
        rationale:
            "A result is not a string, so vitest's substring meaning never applied to it: one verb compares it whole, the value in place when the test is its only reader, a branded `file()` when the expectation lives on disk — and the runtime refuses the crossed form a type cannot see (a cast, a JavaScript spec).",
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['w3-unambiguous-element']} An element descriptor must designate exactly ONE element when a verb ACTS on it (\`click\`/\`tap\`/\`fill\`): if several match, the action is refused with an error enumerating the candidates and offering the rewrites (\`within(...)\`, another descriptor). The framework never acts on "the first". A name designates the WHOLE accessible name — \`{ exact: false }\` is the opt-out — and a descriptor that finds nothing whole is not found, whatever a substring would have matched. It holds on both scenario facets, website and mobile; on mobile, \`see()\` — which acts on nothing — is satisfied by any visible match (the XCUITest tree legitimately duplicates a label between a container and its child).`,
        facet: 'model',
        family: 'W',
        fix: 'Scope it with `within(<landmark>, …)`, or name the element with a descriptor that designates one thing.',
        id: 'W3',
        name: 'w3-unambiguous-element',
        rationale:
            'Acting on the first match makes a spec green while the visitor clicks something else, and nothing ever says so — an ambiguity is a writing fault, not a case to be settled by DOM order. The counting exists only at run time: no static analysis can do it, which is why the channel is runtime.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention: `${REFUSAL_WHY['w4-no-landmarks-on-mobile']} The element vocabulary is ONE between the website and mobile facets; an ARIA landmark (\`main()\`, \`navigation()\`…) passed to a mobile verb is refused at run time.`,
        facet: 'mobile',
        family: 'W',
        fix: 'Scope with `within(testId(…), …)`: a screen has no landmarks, and any descriptor works as the scope.',
        id: 'W4',
        name: 'w4-no-landmarks-on-mobile',
        rationale:
            'One vocabulary keeps the API memorable; refusing the part with no iOS equivalent outright avoids a silent approximation.',
        reach: 'tests',
    },
];

/**
 * The **process** channel — rules no channel can fully mechanize: they are a
 * matter of review judgement. Listed here so the catalogue is complete across
 * all four faces; the constitution keeps their full rationale.
 */
export const PROCESS_RULES: CatalogEntry[] = [
    {
        channel: 'process',
        convention:
            'The folder follows the assets: a test with asset directories of its own gets its own domain; tests with no local assets group as sibling `<aspect>` files. The static rule only checks the depth.',
        facet: 'model',
        family: 'C',
        fix: 'Read what the assets say: a test that stands on its own ground earns a folder.',
        id: 'C1',
        name: 'c1-asset-grouping',
        rationale:
            'It is the assets that settle the grouping — a criterion no channel can decide alone.',
        reach: 'specs',
    },
    {
        channel: 'process',
        convention:
            "A tool's output is asserted as a full golden per scoped use case, not as a cluster of greps; `.grep()` stays the scalpel for targeted probes.",
        facet: 'model',
        family: 'D',
        fix: 'Golden the stream, and keep `.grep()` for the one line a case is genuinely about.',
        id: 'D11',
        name: 'd11-golden-file',
        rationale:
            'A review judgement — the static channel cannot tell a legitimate grep from a lazy one.',
        reach: 'tests',
    },
    {
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

/** Split an id into (family letter, numeric, variant) for natural ordering. */
function sortKey(entry: CatalogEntry): [string, number, string] {
    const match = /^(?<letter>[A-Z]+)(?<number>\d+)(?<variant>.*)$/u.exec(entry.id);
    return [
        match?.groups?.letter ?? entry.id,
        Number(match?.groups?.number ?? 0),
        `${match?.groups?.variant ?? ''}:${entry.name}`,
    ];
}

/**
 * The full catalogue, deterministically ordered — the statique rules (from
 * {@link RULE_DOCS}) plus every other channel, sorted by family, then convention
 * number, then variant/name. The generator and the freshness meta-test both
 * consume this, so a stable order keeps generated output byte-identical.
 */
const statiqueEntries: CatalogEntry[] = [];
for (const [name, doc] of Object.entries(RULE_DOCS)) {
    statiqueEntries.push({ name, ...doc });
}

export const catalog: CatalogEntry[] = [
    ...statiqueEntries,
    ...UPSTREAM_RULES,
    ...TYPE_ROWS,
    ...META_ROWS,
    ...CHECKER_PASSES,
    ...RUNTIME_RULES,
    ...PROCESS_RULES,
].sort((a, b) => {
    const [al, an, av] = sortKey(a);
    const [bl, bn, bv] = sortKey(b);
    if (al !== bl) {
        return al.localeCompare(bl);
    }
    if (an !== bn) {
        return an - bn;
    }
    return av.localeCompare(bv);
});
