import type { Row } from '../../../lint/kit/catalogue/row.js';

export const REFUSAL_WHY = {
    'database-named-only-when-several-at-runtime':
        'With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
    'route-written-as-template-at-runtime':
        'A request written as its route template is handed exactly the parameters the template names.',
    'disk-named-by-relative-path-at-runtime':
        'A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
    'one-verb-per-meaning':
        '`toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.',
    'network-strict-after-first-stub':
        'From its first stub, a chain’s network is strict: every outgoing request matches a declared stub.',
    'target-matches-one-element':
        'A verb acts on exactly ONE element: a target that matches several is refused, never settled by the first.',
    'seam-is-an-optional-peer':
        'Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.',
    'no-landmark-on-mobile':
        'An iOS screen has no ARIA landmark: a mobile verb is scoped with `within(testId(…), …)`.',
} as const;

export type RefusalRow = keyof typeof REFUSAL_WHY;

/** Where static analysis abstains (non-literal arguments) or cannot reach (network, container lifecycle). */
export const RUNTIME_RULES: Row[] = [
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence: `${REFUSAL_WHY['route-written-as-template-at-runtime']} The chain fills each \`:name\` segment with its value, URI-encoded, the query kept, and sends the filled path; route coverage reads the request by its template — a parameter where the route declares one, each literal segment as itself. A template handed no params, a parameter with no value and a value no parameter takes are refused before a request is sent, naming the call to write.`,
        specification: 'api',
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
        sentence:
            'A sequence is expressed by SEEDING the state the second run would have found: every chain starts on databases the framework has reset.',
        specification: 'model',
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
        sentence:
            'An `_expected/*.http` starts with a status line, and its headers are matched as a SUBSET: the ones listed must match, unlisted response headers are unconstrained.',
        specification: 'api',
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
        sentence:
            "A golden's path may name a subfolder (`./_expected/build/verbose.txt`): the path is the file, and update mode creates the folders it names.",
        specification: 'model',
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
        sentence:
            "Every golden reads the `file()` or `directory()` it is given, from the spec file's directory — response, stream, json, tree alike — and `request()` reads a request the same way. Nothing resolves against a folder the line does not name.",
        specification: 'model',
        family: 'expectations',
        fix: "Name the golden from the spec: `file('./_expected/<case>.<ext>')`.",
        name: 'golden-read-from-its-path',
        rationale:
            'One resolution rule, written on the line, means a reader knows where a golden lives without knowing any convention or which accessor produced it.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence:
            'Isolation is per WORKER: each worker takes its own schema, database index or file copy, so two workers never share state.',
        specification: 'model',
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
        sentence:
            'The capture is docker-aware: every container a run spawned carries that run label, and the scope exit removes them whether the test asked about them or not.',
        specification: 'model',
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
        sentence: `${REFUSAL_WHY['database-named-only-when-several-at-runtime']} The framework throws at run time if \`database:\` is absent with ≥ 2 databases, or present with exactly one (it doubles the checker channel).`,
        specification: 'model',
        family: 'setup',
        fix: 'State `database:` everywhere or nowhere, whichever the record calls for.',
        name: 'database-named-only-when-several-at-runtime',
        rationale: 'The runtime keeps the guarantee even where static analysis abstains.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence: `${REFUSAL_WHY['disk-named-by-relative-path-at-runtime']} The framework refuses at run time a verb that reads the disk (\`seed\`, \`request\`, \`fixture\`, \`run\`) handed anything but a \`file()\`/\`directory()\` — a bare string names the wrapper to write — and a \`file()\`, \`directory()\` or document \`fixture:\` whose path does not start with \`./\` or \`../\`. The trailing \`/\` says which of the two a path is, and the disk must agree: a directory named without it, or a file named with it, is refused, and so is a path that names nothing, with the path it resolved to.`,
        specification: 'model',
        family: 'chain',
        fix: "Name the disk from the spec file: `file('./_seeds/users.sql')`, `directory('../../_shared/_fixtures/shop/')`.",
        name: 'disk-named-by-relative-path-at-runtime',
        rationale:
            'The type refuses a bare name at the call; the runtime keeps the law for a caller the compiler does not see — a JavaScript spec, a cast, a document.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence:
            'In `cli` mode with `services`, the framework injects `<KEY>_URL` (camel-aware CONSTANT_CASE) plus the unambiguous aliases `DATABASE_URL`/`REDIS_URL`; `.env()` overrides (`null` unsets).',
        specification: 'cli',
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
        sentence: `${REFUSAL_WHY['network-strict-after-first-stub']} As soon as an \`api\`/\`job\` chain declares an intercept, any unmatched outgoing request (an exhausted queue included) fails the spec with an explicit error.`,
        specification: 'model',
        family: 'stubs',
        fix: 'Declare the stub the request needs, or stop making the request.',
        name: 'network-strict-after-first-stub',
        rationale: 'A guarded network makes external interactions exhaustive and intentional.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence: `${REFUSAL_WHY['one-verb-per-meaning']} Its argument says where the expectation lives: a value written in place — a stream's text, a response's \`.http\` text, a json's value, a table's rows (awaited) — or a \`file()\`/\`directory()\` golden. On a plain string it is vitest's own — a string or a RegExp — and a \`file()\` or a \`directory()\` handed to it is refused, a runner started or none (the path object would otherwise read as the pattern \`[object Object]\`); a string is goldened wrapped, \`expect(text(value)).toMatch(file(…))\`, and a stream's text is \`result.stdout.text\`. A value of the wrong shape — a RegExp on a stream, a response or a json, anything but rows on a table — does not compile, and past the compiler it is refused in both builds, naming the form that takes it; a directory, the working directory and a container take no value, and are refused naming \`directory()\` or \`toBeRunning()\`; a golden handed a subject that has none of its kind is refused, naming the wrapper the subject takes. An empty stream is an empty text: \`toBeEmpty\` is a table's matcher, and handed a stream it is refused in both builds, naming \`expect(<stream>.text).toBe('')\`.`,
        specification: 'model',
        family: 'expectations',
        fix: "Write the whole result in place, ``toMatch(`…`)``, or `toMatch(file('./_expected/<case>.<ext>'))` when it lives on disk; a part of a text is vitest's, on `.text`.",
        name: 'one-verb-per-meaning',
        rationale:
            "A result is not a string, so vitest's substring meaning never applied to it: one verb compares it whole, the value in place when the test is its only reader, a branded `file()` when the expectation lives on disk — and the runtime refuses the crossed form a type cannot see (a cast, a JavaScript spec).",
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence: `${REFUSAL_WHY['target-matches-one-element']} An element target must designate exactly ONE element when a verb ACTS on it (\`click\`/\`tap\`/\`fill\`): if several match, the action is refused with an error enumerating the candidates and offering the rewrites (\`within(...)\`, another target). The framework never acts on "the first". A name designates the WHOLE accessible name — \`{ exact: false }\` is the opt-out — and a target that finds nothing whole is not found, whatever a substring would have matched. It holds on both scenario specifications, website and mobile; on mobile, \`see()\` — which acts on nothing — is satisfied by any visible match (the XCUITest tree legitimately duplicates a label between a container and its child).`,
        specification: 'model',
        family: 'visitor',
        fix: 'Scope it with `within(<landmark>, …)`, or name the element with a target that designates one thing.',
        name: 'target-matches-one-element',
        rationale:
            'Acting on the first match makes a spec green while the visitor clicks something else, and nothing ever says so — an ambiguity is a writing fault, not a case to be settled by DOM order. The counting exists only at run time: no static analysis can do it, which is why the channel is runtime.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence: `${REFUSAL_WHY['no-landmark-on-mobile']} The visitor's vocabulary is ONE between the website and mobile specifications; an ARIA landmark (\`main()\`, \`navigation()\`…) passed to a mobile verb is refused at run time.`,
        specification: 'mobile',
        family: 'visitor',
        fix: 'Scope with `within(testId(…), …)`: a screen has no landmarks, and any target works as the scope.',
        name: 'no-landmark-on-mobile',
        rationale:
            'One vocabulary keeps the API memorable; refusing the part with no iOS equivalent outright avoids a silent approximation.',
        reach: 'tests',
    },
    {
        audience: 'consumer',
        channel: 'runtime',
        sentence: `${REFUSAL_WHY['seam-is-an-optional-peer']} A page, a screen, a component and each service load theirs lazily, the first time a spec needs it, and a missing one is refused where it was needed, naming the peer and the install command — the package manager the project's lockfile names, for a service ([Set up a project](../start/set-up-a-project.md#what-to-install)).`,
        specification: 'model',
        family: 'setup',
        fix: 'Install the peer the refusal names, with the command it gives.',
        name: 'seam-is-an-optional-peer',
        rationale:
            'A project that specifies no page, screen or database installs no browser, no simulator driver and no database client: the cost of a seam is paid by the project that uses it, and the refusal names it at the moment it is needed.',
        reach: 'tests',
    },
];
