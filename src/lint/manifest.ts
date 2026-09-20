import type { RuleDoc } from './types.js';

/**
 * The rule manifest — the single source of truth for the mechanized conventions
 * catalogue (docs-as-code inversion, phase 2).
 *
 * The constitution (`docs/12-conventions.md`) holds only principles, the
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
 * to (re)write the full seven-channel catalogue in `docs/13-linting.md` and the
 * agent-facing `skills/jterrazz-test/references/rules.md`. `plugin.test.ts`
 * guards freshness and completeness.
 *
 * This module is pure data — it imports NOTHING but a type, so the lint layer
 * stays free of the framework runtime (CONVENTIONS I1) and the oxlint bundle
 * stays light.
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
        family: 'A',
        fix: 'Name one of the six, or reach for the `component` chain — a seventh subject is a decision before it is a constructor.',
        id: 'A2',
        rationale:
            'A closed surface stops parallel constructors being invented and keeps the API memorable.',
        reach: 'specification',
    },
    'a3-no-destructure-alias': {
        channel: 'statique',
        convention:
            "The return is destructured under the constructor's canonical name, unaliased (`{ api, cleanup, docker }`); renaming (`{ api: myApi }`) is an error.",
        family: 'A',
        fix: 'Drop the alias and keep the canonical name.',
        id: 'A3',
        rationale: 'One instance name per facet makes every spec readable with no local context.',
        reach: 'specification',
    },
    'a4-cleanup-afterall': {
        channel: 'statique',
        convention:
            'The specification file passes `cleanup` to `afterAll`; a `cleanup` destructured but never handed over is an error.',
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
        family: 'A',
        fix: 'Drop the option: the walk finds the nearest `package.json` by itself.',
        id: 'A9',
        rationale:
            'Detection by convention has to stay the default; an explicit `root` is only justified where it fails.',
        reach: 'specification',
    },
    'b10-when-between-markers': {
        channel: 'statique',
        convention:
            'A `// When -` marker is optional; written, it sits after `// Given -` and before `// Then -`.',
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
        family: 'B',
        fix: 'Fold the continuation into the sentence, or separate it with a blank line.',
        id: 'B11',
        rationale:
            'The narration is a sentence about the subject; a paragraph hides its second half from every reader that only looks at the marker line.',
        reach: 'tests',
    },
    'b2-known-fixture-marker': {
        channel: 'statique',
        convention:
            'An unknown `$…` marker in a literal passed to `.fixture()` is an error (`$FIXTURES` is the only one).',
        family: 'B',
        fix: 'Write `$FIXTURES/<name>` for the shared pool, or a path relative to the spec for local ground.',
        id: 'B2',
        rationale:
            'Catching a wrong marker statically avoids a fixture path resolved at random at run time.',
        reach: 'tests',
    },
    'b4-given-then': {
        channel: 'statique',
        convention:
            'Every test carries `// Given -` then `// Then -` (both, in that order); a Given declared after a Then is an error. A `test.each` table is judged ONCE, on the table, not once per row. A `<case>.spec.yaml` document has no comments: its narration is its `description:`.',
        family: 'B',
        fix: 'Write the two markers, in order, as sentences about the subject — not about the code (chapter 12 § The narration).',
        id: 'B4',
        rationale:
            "Given/Then narration makes a test's intent readable without reading its assertions.",
        reach: 'tests',
    },
    'b6w-redundant-env-url': {
        channel: 'statique',
        convention:
            "`.env({ <SERVICE>_URL: ….connectionString })` repeats the framework's own injection → warning.",
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
            "A `specification.cli(bin)` whose binary resolves inside a dependency's `node_modules/.bin` tests the third-party tool, not the product command → warning (a suppression with a reason is accepted).",
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
            'A specs tree DECLARES its shape through the `depth` option: `facet-domain` (the default — a test at facet/domain depth, a `*.specification.ts` at the facet root), `facet` (a test at the facet root OR one domain folder down, never deeper), `mirror` (a test at any depth ≥ 1, named after its directory), `off`. In every mode, `off` included: a directory with a leading underscore is GROUND, never a domain — no spec lives inside one. One exception, and only one: ground may be CODE, and a `<module>.test.ts` sitting BESIDE the `<module>.ts` it tests is legal there (that is I2). A test with no neighbouring module, or a `*.specification.ts`, is still a violation. A `.test.tsx` is out of reach: a rendered unit is specified beside its component, never in a facet/domain tree — I2 holds its neighbourhood.',
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
        family: 'C',
        fix: 'Write the contract that serves the payload, or delete the payload.',
        id: 'C11',
        rationale:
            'Data exists only as served by a contract — a file with no owner is dead weight no test ever loads.',
        reach: 'contract',
    },
    'c13-underscored-ground': {
        channel: 'statique',
        convention:
            "Under `specs/`, a spec's ground carries a leading underscore: `_fixtures/`, `_expected/`, `_requests/`, `_seeds/`. A `fixtures/`, `expected/`, `requests/` or `seeds/` directory is a pre-14 name — an error naming the rename.",
        family: 'C',
        fix: 'Rename the directory with the leading underscore the resolvers read.',
        id: 'C13',
        rationale:
            'No resolver reads the underscore-less name any more: left as is, the tree goes invisible rather than wrong, and the failure lands one step past its cause.',
        reach: 'specs',
    },
    'c2-http-only-requests': {
        channel: 'statique',
        convention: '`_requests/` holds `.http` files only; any other extension is an error.',
        family: 'C',
        fix: 'Write the request as a complete `.http` document, or move the file to `_fixtures/`.',
        id: 'C2',
        rationale:
            'A request input is a complete `.http` — one format per folder forbids ad-hoc ones.',
        reach: 'ground',
    },
    'c4-contract-shape': {
        channel: 'statique',
        convention:
            'Under `specs/**/contracts/`: the ROOT carries only `*.contracts.ts` facades (a default export built by `defineContracts(...)` or a composition re-export; named exports are scenarios) and the provider folders `http` | `openai` | `anthropic`. A unit contract is `<provider>/<kebab-name>.ts` with an `export default defineContract(...)` (or a factory returning one), and its `request` builder must name the provider of its own folder. A provider folder is flat and holds only `*.ts` and `*.response.json`.',
        family: 'C',
        fix: 'Move the file to the half it belongs to: a facade at the root, a unit under its provider.',
        id: 'C4',
        rationale:
            'A fixed tree separates the public facade from the internal units and makes the FOLDER carry the provider — filenames go back to being domain words, and bulky data sits beside the contract that serves it.',
        reach: 'contract',
    },
    'c6-tomatch-extension': {
        channel: 'statique',
        convention:
            "`toMatch`'s argument carries its extension (`'help.txt'`, `'<case>.aria.yaml'` for a tree golden), except for a directory snapshot; a file subject with no extension is an error.",
        family: 'C',
        fix: "Write the fixture's full name, extension included.",
        id: 'C6',
        rationale:
            "The extension is part of the expected file's name — dropping it breaks `_expected/` resolution.",
        reach: 'tests',
    },
    'c7-seeds-sql-only': {
        channel: 'statique',
        convention: '`_seeds/` holds `*.sql` files only; any other file is an error.',
        family: 'C',
        fix: 'Write the seed as SQL, or move the file to `_fixtures/` as the material it is.',
        id: 'C7',
        rationale: '`.seed()` carries database state only — no seed handlers, no prefix dispatch.',
        reach: 'ground',
    },
    'c8-referenced-fixture-exists': {
        channel: 'statique',
        convention:
            'A literal passed to `.request`/`.seed`/`.fixture`/`toMatch` must exist on disk under its conventional root; a missing path is an error.',
        family: 'C',
        fix: 'Create the file, or fix the name — the message prints the path it looked for.',
        id: 'C8',
        rationale:
            'Catching a typo statically avoids a failure that would only surface at run time.',
        reach: 'tests',
    },
    'd16-sampled-oracle': {
        channel: 'statique',
        convention:
            "No sampled value under an oracle: `new Date()` (no argument), `Date.now()`, `performance.now()`, `Math.random()` and `randomUUID()` are an error as a direct argument of `expect` or of its matcher, and anywhere inside a structural matcher's expected shape. A test that pins the clock (`clock.at`, `clock.advance`) is out of reach — the reading is then the constant it chose — and so is a `*.specification.ts(x)`, where a runner legitimately samples at startup.",
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
            "Three probes (`threshold`, default 3) on one goldenable subject — `stdout`, `stderr`, `content`, `head`, `meta()`, `canonical`, `alternates`, `tree`, `html` — with no `toMatch('<file>')` on it is a warning. A negated probe states an absence no golden can carry and is not counted; `value` and `error` are single readings and are not goldenable subjects.",
        family: 'D',
        fix: "Golden the subject: `expect(result.stdout).toMatch('<case>.txt')`, tokens for what moves.",
        id: 'D19',
        rationale:
            'Three greps state three lines, leave everything between them unstated, and still have to be rewritten one by one the day the output changes.',
        reach: 'tests',
    },
    'd2-await-io-matcher': {
        channel: 'statique',
        convention:
            'An IO matcher (`toMatchRows`/`toBeEmpty`/`toBeRunning`) must be awaited or returned; otherwise the assertion never runs → error.',
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
        family: 'D',
        fix: 'Delete the transform and write the token the grammar already has.',
        id: 'D6',
        rationale:
            '`transform` is the escape hatch for noise the tokens do not cover — not a second copy of them.',
        reach: 'tests',
    },
    'd8w-text-bypass': {
        channel: 'statique',
        convention:
            '`expect(x.text).toContain/toMatch` short-circuits the typed accessor subject → warning.',
        family: 'D',
        fix: 'Assert on the accessor itself (`expect(x)`), which carries the tokens and the fixture resolution.',
        id: 'D8',
        rationale:
            "Asserting on `.text` throws away the token grammar and the subject's `toMatch('file')` resolution.",
        reach: 'tests',
    },
    'd9w-single-use-ref': {
        channel: 'statique',
        convention:
            'A capture ref (`match.ref`, `{{kind#ref}}`) appearing exactly once in the whole file (code plus the referenced `_expected/` fixtures) is named for nothing → warning.',
        family: 'D',
        fix: 'Drop the ref name and keep the bare token.',
        id: 'D9',
        rationale:
            'A ref only earns its name when it asserts equality across at least two occurrences.',
        reach: 'tests',
    },
    'd12w-response-body-probe': {
        channel: 'statique',
        convention:
            "A test accumulating a CLUSTER of raw probes on `.response.body` (≥ `threshold`, default 3; a variable cast from `.response.body` counts its reads) → warning: this case wants a full golden (`expect(result.response).toMatch('case.http')`). One or two probes stay silent (a legitimate scalpel).",
        family: 'D',
        fix: "Golden the response: `expect(result.response).toMatch('<case>.http')`, with tokens for the parts that move.",
        id: 'D12',
        rationale:
            'A full golden captures the whole shape and its token grammar; a cluster of raw probes replaces it with ad-hoc checks that drift (it mechanises the D11 boundary for API responses).',
        reach: 'tests',
    },
    'd13w-unfrozen-negative-fixture': {
        channel: 'statique',
        convention:
            'A `toMatch` whose FAILURE is the subject of the test must carry `{ frozen: true }` → otherwise `TEST_UPDATE=1` silently rewrites the deliberately-wrong fixture instead of throwing → warning. Two shapes: the exact wrapper (`expect(() => …).toThrow()` / `expect(…).rejects.toThrow()`) and the bounded heuristic — a golden inside a helper whose body also asserts a throw, which is where a helper owning the try/catch puts it.',
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
            "A test whose ONLY assertions are HTTP status probes (`expect(X.status).toBe(N)` / `.toEqual(N)`, N a numeric literal 100–599) → warning: this case wants a full golden (`expect(result.response).toMatch('case.http')`). A status probe BESIDE a real assertion (a golden, `toMatchRows`, `toContain`…) stays silent (a legitimate scalpel).",
        family: 'D',
        fix: 'Assert what the response carries, not only the code it came back with.',
        id: 'D15',
        rationale:
            'A lone status pins the response code and throws away the whole payload; a full golden captures the shape and its token grammar (it completes d12w, which needs a cluster of body probes and misses the solitary status probe).',
        reach: 'tests',
    },
    'e2-preset-config': {
        channel: 'statique',
        convention:
            'A `vitest.config.*` default-exports `defineSpecConfig(...)`; the call is resolved through an `export default <Identifier>` declarator, through a `satisfies`/`as` annotation, and through one `mergeConfig(defineSpecConfig(…), …)` — vitest’s own way of layering over the preset.',
        family: 'E',
        fix: "Start from `defineSpecConfig()` — budgets, the artefact dir and the `_fixtures` exclusion are the preset's.",
        id: 'E2',
        rationale:
            "A config off the preset runs on vitest's five-second budget, writes artefacts at the repository root and collects `_fixtures/` as specs — none of it visible in the file that caused it.",
        reach: 'config',
    },
    'e4w-project-binding': {
        channel: 'statique',
        convention:
            'A project literal collecting `specs/<facet>/` is named `<facet>`, and one named for a facet is rooted there; `unit` collects outside `specs/`. What an include collects is read from the GLOB and the config’s own place in its package, never from the absolute path. Any other name is out of reach — a repository suite names its projects as it likes.',
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
        family: 'E',
        fix: 'Point it at the `*.specification.ts` that exports `cli`.',
        id: 'E8',
        rationale:
            'A path that resolves to nothing fails at collection time with a message about an import, several layers from the line that caused it.',
        reach: 'config',
    },
    'e9w-env-assignment-in-test': {
        channel: 'statique',
        convention:
            'A test writes the process environment through `vi.stubEnv` alone: a raw assignment onto a variable of it (named or computed), a replacement of `process.env` itself, and a `delete` of one of its variables are each a warning; a `*.specification.ts(x)` is out of reach by role.',
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
            'A production file never imports `vitest`, `@jterrazz/test`, a `*.test.*`, a `*.fixtures.*` or `mockOf` (one exception: `@jterrazz/test/oxlint`).',
        family: 'F',
        fix: 'Move the code that needs the import into a test, or inject what it needs as a port.',
        id: 'F2',
        rationale:
            "Keeping test artefacts out of production protects the consumer's application bundle.",
        reach: 'all',
    },
    'f3-specs-public-entry': {
        channel: 'statique',
        convention:
            "From `specs/`, only a deep import of the framework's INTERNALS is forbidden: a relative path resolving into the framework repository's `src/{specification,integrations,vitest,lint}/`, or any `@jterrazz/test/<subpath>` the package's `exports` map does not publish — the published subpaths are exempt, READ from the manifest as in F1, which holds the list. A consumer importing ITS OWN app's source is always allowed (that is the documented pattern). No folder exception: a probe that cannot reach its subject through the public entry is a module test beside its module, not a spec.",
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
        facet: 'shared',
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
            'A test doubles a PORT, never a module: `vi.mock`/`vi.doMock` of a specifier outside the `modules` allow-list (a config comment states why each entry is there), a `__mocks__/` or `__fixtures__/` directory, and — in a `module`-role test — importing a data asset (`.json`, `.sql`, `.yaml`, …) are all errors. A dotted specifier (`./dashboard.post`) is still code. The `vi.stubGlobal` clause moved to M3 in 16.0: one owner per convention.',
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
            'No arbitrary sleep (`setTimeout`/`setInterval`/`Atomics.wait`, or a `node:timers/promises` import) in any test file — synchronisation is `see()`/`gone()` inside a scenario and `waitUntil(predicate)` everywhere else.',
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
        facet: 'shared',
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
        facet: 'shared',
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
            'A `.spec.ts` scenario that ACTS (`click`, `fill`, `select`, `check`, `press`, `tap`, `rerender`) on the visitor it was handed ends on `visitor.see(…)`, `visitor.gone(…)` or `visitor.unmount()` — through the block, branch, loop or `.then()` it ends in. A scenario that only reads is out of reach, and so is a component test, whose action often produces a CALL rather than a screen.',
        facet: 'shared',
        family: 'W',
        fix: 'End on `visitor.see(<what the action produced>)` or `visitor.gone(<what it removed>)`.',
        id: 'W5',
        rationale:
            'The capture is taken when the callback returns: a scenario ending on a click hands the golden whatever was on the screen at that instant, and the failure reads as flakiness rather than as a missing wait.',
        reach: 'spec',
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
            'A `<case>.spec.yaml` is a SPEC, not ground: a document under `_expected/`, `_requests/`, `_seeds/` or `_fixtures/` is an error.',
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
            'A test under `specs/<facet>/`, where the facet root holds a `*.specification.ts(x)`, imports that module or constructs a runner itself.',
        family: 'C',
        fix: 'Import `{ <facet> }` from `<facet>.specification.js`, or move a module test beside its module.',
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
            'Ground in a leaf holding ≥ 2 node tests (`.test.ts`, `.spec.ts`) that a single one of them reads is a warning. A `.test.tsx` tree is out of reach, as it is for C1.',
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
        facet: 'shared',
        family: 'E',
        fix: 'Write `export default defineSpecConfig()` in the member — the preset carries the budgets, the artefact directory and the `_fixtures/` exclusion.',
        id: 'E3',
        name: 'e3-config-present',
        rationale:
            "Without a config, vitest's 5 s budget and an unexcluded `_fixtures/` are running the member's tests: the default is not chosen, it is inherited.",
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
            'A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`) — except `@testing-library/react-native` in a member that runs jest, where it is the only vocabulary the runtime has until the React Native answer lands. The optional peers — `playwright`, `vite`, `react`, `better-sqlite3`, `pg`, `redis`, `testcontainers`… — are declared by the consumer, by design.',
        facet: 'shared',
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
            'Every `{{token}}` in an `_expected/` fixture — or in an expected stream of a `<case>.spec.yaml` document — belongs to the frozen vocabulary; an unknown token is an error.',
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
            'A malformed ref of a known kind (`{{iso8601#}}`, `{{uuid #id}}`) in a text file under `_expected/` is an error.',
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
            'The first line of a depth-1 `.http` follows its grammar: a request line (`METHOD /path`) under `_requests/`, a status line (`HTTP/1.1 <status>`) under `_expected/`.',
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
            'A `<case>.spec.yaml` document follows its grammar: closed keys at document level (`kind`, `description`, `fixture`, `env`, `serve`, `runs`) and inside a run (`command`, `stdin`, `timeout`, `waitFor`, `exit`, `stdout`, `stderr`, `files`), `description:` and `runs:` required, `command:` and `exit:` required in every run, `exit:` an integer literal, `waitFor:` only on the last run and never with `stdin:`, a `files:` path relative and under the workdir.',
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
            'The keys of a `<case>.spec.yaml` follow the canonical order — `kind, description, fixture, env, serve, runs` at document level, `command, stdin, timeout, waitFor, exit, stdout, stderr, files` inside a run. Fixable (`--fix`).',
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
            'The suffix says the kind, and the tree agrees with it. A `.spec.ts` — the ASSEMBLED product — lives under `specs/<facet>/`; anywhere else is an error. A `.test.ts` — the UNIT — lives beside its module; under a facet folder (`api`, `cli`, `integration`, `jobs`, `mobile`, `website`) it is an error, fixable by `--fix` (a `git mv`). A `.test.ts` that reaches no runner is C18’s, whose fix is the opposite move, and the mover leaves it alone. A first level that is NOT a facet is a repository suite: it covers a tree, keeps `.test.ts`, and C1’s declared depth is what judges it. A document is named `<case>.spec.yaml`: `<case>` in kebab-case, without the words `test`/`spec`/`cli` the suffix already carries, and never the bare name of its directory.',
        facet: 'shared',
        family: 'C',
        fix: 'Move the `.spec.ts` under `specs/<facet>/` (or rename it `.test.ts` beside its module); rename the facet `.test.ts` to `.spec.ts` — `jterrazz-test-check <root> --fix` does it with `git mv`, and names every include glob of the member that still says `.test.ts`.',
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
            'No expected output carries a literal volatile value: a loopback origin with a port (`127.0.0.1:8080`, `localhost:3000`), an absolute temporary path (`/tmp/`, `/private/tmp/`, `/var/folders/`) or a home path (`/Users/…`, `/home/…`). Both halves of the ground are judged by the one list — an expected stream of a `<case>.spec.yaml`, and every text file under `_expected/`. A `{{token}}` is not a literal.',
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
            'A literal ISO-8601 timestamp or uuid in an expected stream of a `<case>.spec.yaml` → warning, unless the same value appears in a `fixture:`, a `stdin:`, a command argument or an `env:`/`serve:` value of the same document (it is then pinned, not volatile). Under `_expected/` the same class waits for D21w, whose criterion chapter 12 carries.',
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
            'A known token in a file under `_requests/` → warning: requests are inputs, never matched.',
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
            'No dead fixtures: every file under `_seeds/`/`_requests/`/`_fixtures/` and every top-level entry of `_expected/` must be referenced; a feature directory with no test file and no `*.spec.yaml` is an orphan (a warning when the argument is not a literal). A `<case>.spec.yaml` references the fixtures its `fixture:` entries name.',
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
            'A pool fixture is SHARED, or it is local: a directory of `<specs>/_fixtures/` referenced (`$FIXTURES/<name>`) from a single spec directory — two documents of one leaf count as one — must live beside that leaf, at `<leaf>/_fixtures/<name>/`, referenced by the relative form. Zero references is the dead-fixture error (C9). Fixed by `--fix`: the directory is moved and the literals rewritten.',
        family: 'C',
        fix: 'Run `jterrazz-test-check <root> --fix`; it moves the directory and rewrites what named it.',
        id: 'C14',
        name: 'c14-pool-fixture-shared',
        rationale:
            "A single scenario's fixture parked in the pool reads as shared ground: everyone assumes someone else depends on it and nobody dares touch it.",
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            'A local fixture is read only from its own directory: a `fixture:`/`.fixture()` path containing `..`, or whose target leaves the `_fixtures/` of the spec naming it, is an error — ground shared by several leaves goes in the `$FIXTURES` pool.',
        family: 'C',
        fix: "Copy it under this leaf's own `_fixtures/`, or promote it to the pool.",
        id: 'C15',
        name: 'c15-local-fixture-reach',
        rationale:
            "A leaf reaching into a neighbour's fixtures is the pool through another door, without the pool's visibility: the neighbour breaks a spec two folders away without knowing.",
        reach: 'ground',
    },
    {
        channel: 'checker',
        convention:
            "B5's one channel: docker-aware runners are inferred from the `docker:` option of the imported specification file, and every `.exec()` result bound without `await using` is reported.",
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
            'Every diagnostic ends with its own generated anchor, and the anchor exists in the generated chapter.',
        family: 'K',
        fix: 'Let `withAnchors()` generate the tail; never type one.',
        id: 'K3',
        name: 'k3-message-anchors',
        rationale:
            'The anchor is the only route most readers ever take into the catalogue, and forty hand-written tails drifted the first time a heading moved.',
        reach: 'all',
    },
    {
        channel: 'meta',
        convention:
            'The REACH of every row is proven on one fixture project laid out with every path role, judged by a single oxlint run.',
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
            'Every constructor has a `specs/<facet>/` tree in this package; `mobile` is the one exception, with its reason stated.',
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
 * the day the line it marks starts compiling.
 */
export const TYPE_ROWS: CatalogEntry[] = [
    {
        channel: 'type',
        convention:
            'The `services` record types the factory argument: `server: (services) => …` sees exactly the keys the record declares.',
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
        facet: 'shared',
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
        family: 'D',
        fix: "Write the golden: `expect(subject).toMatch('<name>.<ext>')` under `_expected/`; under `src/` compare to a literal with `toStrictEqual`.",
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
            '`vi.stubGlobal`, `vi.useFakeTimers`, `vi.setSystemTime` and `vi.useRealTimers` are refused by `vitest/no-restricted-vi-methods`, each with the primitive that replaces it — a subject that fetches a relative URL states its base with `intercept(contracts, { origin })`. `vi.stubEnv` is sanctioned; `vi.mock`/`vi.doMock` stay on I4, whose allow-list the option cannot express.',
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
        convention:
            'A sequence is expressed by SEEDING the state the second run would have found: every chain starts on databases the framework has reset.',
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
            'An `_expected/*.http` starts with a status line, and its headers are matched as a SUBSET: the ones listed must match, unlisted response headers are unconstrained.',
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
            "A slash in a fixture name is a SUBFOLDER of `_expected/`: `toMatch('build/verbose.txt')` resolves to `_expected/build/verbose.txt`.",
        family: 'C',
        fix: 'Name the subfolder in the fixture name; the resolver creates it under `_expected/`.',
        id: 'C5',
        name: 'c5-slash-is-a-subfolder',
        rationale:
            'A flat `_expected/` stops being readable at a dozen files, and the alternative — a second option naming a directory — would be a second way to say where a golden lives.',
        reach: 'ground',
    },
    {
        channel: 'runtime',
        convention:
            'Every `toMatch` subject resolves against `_expected/` — response, stream, json, directory, tree. Only `.request()` reads `_requests/`.',
        family: 'D',
        fix: 'Put the golden under `_expected/` and name it with its extension.',
        id: 'D3',
        name: 'd3-tomatch-resolves-under-expected',
        rationale:
            'One resolution rule for every subject means a reader knows where a golden lives without knowing which accessor produced it.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'Isolation is per WORKER: each worker takes its own schema, database index or file copy, so two workers never share state.',
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
        convention:
            'The framework throws at run time if `database:` is absent with ≥ 2 databases, or present with exactly one (it doubles the checker channel).',
        family: 'A',
        fix: 'State `database:` everywhere or nowhere, whichever the record calls for.',
        id: 'A7',
        name: 'a7-database-runtime',
        rationale: 'The runtime keeps the guarantee even where static analysis abstains.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'The framework refuses at run time an unknown `$…` marker, or a `$FIXTURES` with no ancestor `specs` directory (with a guiding message).',
        family: 'B',
        fix: 'Write `$FIXTURES/<name>`, from a spec that sits under a `specs/` tree.',
        id: 'B2',
        name: 'b2-unknown-marker-runtime',
        rationale:
            'A runtime message guides the author where the fault escapes the static channel (a non-literal argument).',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'In `cli` mode with `services`, the framework injects `<KEY>_URL` (camel-aware CONSTANT_CASE) plus the unambiguous aliases `DATABASE_URL`/`REDIS_URL`; `.env()` overrides (`null` unsets).',
        family: 'B',
        fix: 'Read the variable the record key injects; state `.env()` only to override or unset it.',
        id: 'B6',
        name: 'b6-url-injection',
        rationale: 'Injecting the URLs avoids the repeated hand-wiring and its drift (see b6w).',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'As soon as an `api`/`jobs` chain declares an intercept, any unmatched outgoing request (an exhausted queue included) fails the spec with an explicit error.',
        family: 'D',
        fix: 'Declare the contract the request needs, or stop making the request.',
        id: 'D7',
        name: 'd7-strict-intercepts',
        rationale: 'A guarded network makes external interactions exhaustive and intentional.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            '`toMatch` on an accessor subject (`stream`/`json`/`response`/tree) expects a fixture NAME (extension included): passing a `RegExp` (or any non-string) throws immediately, naming the subject and the `expect(x.text).toMatch(/re/)` escape hatch.',
        family: 'D',
        fix: "Write the fixture's name, or assert on `.text` when a pattern is genuinely what you mean.",
        id: 'D14',
        name: 'd14-tomatch-fixture-name',
        rationale:
            'The instinct inherited from vitest (`toMatch(/re/)`) would otherwise hit the extension error or coerce the regex into `"/re/"`. The accessor argument is never a value-side literal, and a static heuristic would confuse the legitimate `expect(string).toMatch(/re/)` (D3/D8) — only the runtime channel refuses it cleanly, with no false positives.',
        reach: 'tests',
    },
    {
        channel: 'runtime',
        convention:
            'An element descriptor must designate exactly ONE element when a verb ACTS on it (`click`/`tap`/`fill`): if several match, the action is refused with an error enumerating the candidates and offering the rewrites (`within(...)`, another descriptor). The framework never acts on "the first". A name designates the WHOLE accessible name since 16.0 — `{ exact: false }` is the opt-out — and a descriptor that finds nothing whole but would have found something as a substring raises a runtime warning, once per descriptor, through 16.0 and 16.1. It holds on both scenario facets, website and mobile; on mobile, `see()` — which acts on nothing — is satisfied by any visible match (the XCUITest tree legitimately duplicates a label between a container and its child).',
        facet: 'shared',
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
        convention:
            'The element vocabulary is ONE between the website and mobile facets; an ARIA landmark (`main()`, `navigation()`…) passed to a mobile verb is refused at run time — an iOS screen has no ARIA regions; scope with `within(testId(…), …)`.',
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
