import type { RuleDoc } from './types.js';

/**
 * The rule manifest — the single source of truth for the mechanized conventions
 * catalogue (docs-as-code inversion, phase 2).
 *
 * The constitution (`docs/12-conventions.md`) holds only principles, the
 * enforcement channels, process rules and design rationales. Every per-rule
 * normative sentence lives HERE, next to (or on) the code that enforces it. Four
 * channels are assembled into one {@link catalog}:
 *
 * - **statique** — the `jterrazz/*` oxlint rules (`RULE_DOCS`, attached to each
 *   rule's `meta.docs`);
 * - **checker** — the non-oxlint static passes bundled as `dist/checker.js`
 *   (`CHECKER_PASSES`);
 * - **runtime** — refusals/behaviours the framework enforces at execution time
 *   (`RUNTIME_RULES`);
 * - **process** — review-borne rules no channel can fully mechanize
 *   (`PROCESS_RULES`).
 *
 * The catalogue generator (`catalog.ts` / `dist/catalog.js`) reads this manifest
 * to (re)write the full four-channel catalogue in `docs/13-linting.md` and the
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
            'A runner is created only in a `*.specification.ts` file under `specs/`: calling `specification.*` anywhere else is an error.',
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
            'A marker is exactly one line: a `//` comment directly under one, at the same indentation, is a wrapped marker and an error.',
        family: 'B',
        fix: 'Fold the continuation into the sentence, or separate it with a blank line.',
        id: 'B11',
        rationale:
            'The narration is a sentence about the subject; a paragraph hides its second half from every reader that only looks at the marker line.',
        reach: 'tests',
    },
    'b12-marker-between-statements': {
        channel: 'statique',
        convention:
            'A marker sits between statements: one inside a `const a = …, b = …` declarator chain is an error.',
        family: 'B',
        fix: 'Split the declaration so the marker sits between two statements.',
        id: 'B12',
        rationale:
            'A marker inside a statement opens a section with no body, and the offsets that judge the order read a narrative the reader cannot see.',
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
            'Every test carries `// Given -` then `// Then -` (both, in that order); a Given declared after a Then is an error. A `<case>.spec.yaml` document has no comments: its narration is its `description:`.',
        family: 'B',
        fix: 'Write the two markers, in order, as sentences about the subject — not about the code.',
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
            "`toMatch`'s argument carries its extension (`'help.txt'`), except for tree snapshots (directories); a file subject with no extension is an error.",
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
            "No sampled value under an oracle: `new Date()` (no argument), `Date.now()`, `performance.now()`, `Math.random()` and `randomUUID()` are an error as a direct argument of `expect` or of its matcher, and anywhere inside a structural matcher's expected shape. A `*.specification.ts(x)` is out of reach — a runner legitimately samples at startup.",
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
            'A module test whose every assertion reads the call log of a double it built itself (`mockOf`, `vi.fn`, `vi.spyOn`) is a warning. The reach is the `module` role: on a component a callback prop IS the contract with its parent.',
        family: 'D',
        fix: 'Assert the returned value or the resulting state — something the subject produced.',
        id: 'D17',
        rationale:
            'The subject can return anything, raise anything, or return nothing at all, and every assertion still passes.',
        reach: 'module',
    },
    'd18w-existence-only-oracle': {
        channel: 'statique',
        convention:
            'A test whose ONE assertion is an existence check (`toBeDefined`, `toBeTruthy`, `not.toBeNull`, `not.toBeUndefined`, a bare `not.toThrow` or a bare `toHaveBeenCalled`) is a warning. Beside a real assertion the same check is a precondition and stays silent.',
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
            "Three probes (`threshold`, default 3) on one goldenable subject — `stdout`, `stderr`, `content`, `head`, `meta()`, `canonical`, `alternates`, `tree`, `html`, `value`, `error` — with no `toMatch('<file>')` on it is a warning.",
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
            'A `vitest.config.*` default-exports `defineSpecConfig(...)`; the call is resolved through an `export default <Identifier>` declarator and through a `satisfies`/`as` annotation.',
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
            'A project literal collecting `specs/<facet>/` is named `<facet>`, and one named for a facet is rooted there; `unit` collects outside `specs/`. Any other name is out of reach — a repository suite names its projects as it likes.',
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
    'e5b-no-simulated-dom-config': {
        channel: 'statique',
        convention:
            "A vitest config declares no simulated DOM: `environment: 'happy-dom'|'jsdom'` is an error; `'node'` and `'edge-runtime'` name a real runtime and stay out of reach.",
        facet: 'component',
        family: 'E',
        fix: 'Remove `environment` and collect the rendered tests with `component()`; module tests stay under node.',
        id: 'E5b',
        rationale:
            'The pragma (E5) binds one file; the config binds everything the project collects — which is how a repository inherits a simulated DOM nobody chose test by test.',
        reach: 'config',
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
            'An `include` glob whose static prefix (the segments before the first wildcard), resolved from the config, is not a directory is a warning.',
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
            '`literate.specification`, resolved from the config directory, names a file that exists.',
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
            'A raw assignment onto a variable of the process environment — named or computed — in a test is a warning; a `*.specification.ts(x)` is out of reach by role.',
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
            "Everything is imported from `@jterrazz/test`; an import of `@jterrazz/test/<subpath>` is an error, except the subpaths the package's `exports` map publishes — `@jterrazz/test/oxlint` (the lint plugin) and `@jterrazz/test/vitest` (the runner configuration surface) — exempt everywhere. The list is READ from the manifest, never copied into the rule.",
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
            'A test file imports no second test runtime: `@testing-library/*`, `happy-dom`, `jsdom`, `vitest/browser`, `vitest-browser-*` and `@vitest/browser*` are errors. Reach: the roles that RUN a test (`module`, `component`, `specification`) — a fixture project’s config and a providers module under `specs/` legitimately name the adapter.',
        facet: 'component',
        family: 'F',
        fix: 'Go through the facet that replaces the seam: `component.render()`, the element vocabulary and the visitor.',
        id: 'F6',
        rationale:
            "A test importing the adapter speaks the adapter's dialect: a repository ends up with as many vocabularies as it has seams. The groups shipped are the ones the component facet REPLACES; the rest of the family follows the rule wave.",
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
            "The test of `<file>.ts` is `<file>.test.ts` beside it; a misnamed `.test.ts`, a `__tests__/` directory or a package's `tests/` root is an error. A RENDERED unit answers to the same law wherever it lives: a `.test.tsx` is the neighbour of the `.tsx` it renders, or of the `.ts` of the hook or DOM function whose Host it carries. A `module`-role file under a `specs/` tree is a repository suite — it covers a tree, so it has no neighbour to miss.",
        family: 'I',
        fix: 'Put the test beside the unit it covers, under the same basename.',
        id: 'I2',
        rationale:
            "Neighbouring tests (parity with Go's `foo_test.go`) keep a test and its code together and discoverable.",
        reach: 'tests',
    },
    'i4-no-vi-mock-in-src': {
        channel: 'statique',
        convention:
            'In a test, mocks and data are CODE: `vi.mock`, a `__mocks__/` or `__fixtures__/` directory, and — in a `module`-role test — importing a data asset (`.json`, `.sql`, `.yaml`, …) are all forbidden. A dotted specifier (`./dashboard.post`) is still code.',
        family: 'I',
        fix: 'Use `mockOf<Port>()` for a double, a `*.fixtures.ts` neighbour for a payload, and a spec under `specs/` for a test that needs a real file.',
        id: 'I4',
        rationale:
            'A module test that reaches for a real file or a module mock is describing an assembled product, and that has a facet of its own.',
        reach: 'tests',
    },
    'j2-no-sleep-in-specs': {
        channel: 'statique',
        convention:
            'No arbitrary sleep (`setTimeout`/`setInterval`/`Atomics.wait`, or a `node:timers/promises` import) in any test file — synchronisation is `see()`/`gone()` inside a scenario and `waitUntil()` everywhere else.',
        family: 'J',
        fix: 'Wait for the condition, not for a duration.',
        id: 'J2',
        rationale:
            'A fixed sleep makes tests slow and flaky; waiting on a condition is deterministic.',
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
            "A scenario's elements are user-facing (`button`, `link`, `field`, `heading`, `content`; on mobile `button`, `field`, `content`). `testId()` is the one escape hatch, and the line STATES what the element lacks: a `// testId: <what is missing>` comment on the call's own line or the one directly above. It is an invariant, not a rationale.",
        facet: 'shared',
        family: 'W',
        fix: 'Write `// testId: <no accessible name | no role | …>` on the call’s line or the one above — or name the element with `button()`/`link()`/`field()`/`heading()`/`content()`.',
        id: 'W2',
        rationale:
            'Testing what the user sees (roles, labels) keeps specs robust to DOM rewrites; a test id sidesteps that guarantee, and without the invariant written down nobody can tell whether the hatch is still needed.',
        reach: 'tests',
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
            "The MEMBER pass re-reads rule E5b where oxlint may not reach a member's config: `environment: 'happy-dom'|'jsdom'` in a `vitest.config.*` is an error.",
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
            'A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`). The optional peers — `playwright`, `vite`, `react`, `better-sqlite3`, `pg`, `redis`, `testcontainers`… — are declared by the consumer, by design.',
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
        fix: 'Run `node dist/checker.js <root> --fix`; it rewrites the order.',
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
        fix: 'Run `node dist/checker.js <root> --fix`; it rewrites the scalar.',
        id: 'D4b',
        name: 'd4b-spec-block-scalar',
        rationale:
            'Expected output has to look like output — a golden on one line is unreadable and no diff can show it.',
        reach: 'document',
    },
    {
        channel: 'checker',
        convention:
            'The suffix says the kind, and the tree agrees with it. A `.spec.ts` — the ASSEMBLED product — lives under `specs/<facet>/`; anywhere else is an error. A `.test.ts` — the UNIT — lives beside its module; under a facet folder (`api`, `cli`, `integration`, `jobs`, `mobile`, `website`) it is an error, fixable by `--fix` (a `git mv`). A first level that is NOT a facet is a repository suite: it covers a tree, keeps `.test.ts`, and C1’s declared depth is what judges it. A document is named `<case>.spec.yaml`: `<case>` in kebab-case, without the words `test`/`spec`/`cli` the suffix already carries, and never the bare name of its directory.',
        facet: 'shared',
        family: 'C',
        fix: 'Move the `.spec.ts` under `specs/<facet>/` (or rename it `.test.ts` beside its module); rename the facet `.test.ts` to `.spec.ts` — `node dist/checker.js <root> --fix` does it with `git mv`.',
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
            'An expected stream carries no literal volatile value: a loopback origin with a port (`127.0.0.1:8080`, `localhost:3000`), an absolute temporary path (`/tmp/`, `/private/tmp/`, `/var/folders/`) or a home path (`/Users/…`, `/home/…`). The message names the token to write.',
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
            'A literal ISO-8601 timestamp or uuid in an expected stream → warning, unless the same value appears in a `fixture:` or a `stdin:` of the same document (it is then pinned, not volatile).',
        family: 'D',
        fix: 'Token it, or seed it — a value the document pins is a value it may assert.',
        id: 'D5',
        name: 'd5w-spec-pinned-value',
        rationale: 'The defect is not the literal: it is the literal nothing pinned.',
        reach: 'ground',
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
        fix: 'Run `node dist/checker.js <root> --fix`; it moves the directory and rewrites what named it.',
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
 * The **runtime** channel — refusals and behaviours the framework enforces at
 * execution time, where static analysis abstains (non-literal arguments) or
 * cannot reach (network, container lifecycle). Several double a static pass.
 */
export const RUNTIME_RULES: CatalogEntry[] = [
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
