import { describe, expect, test } from 'vitest';

import {
    DOCUMENT_KEYS,
    documentPaths,
    jsonPathSegments,
    KIND_KEYS,
    parseSpecDocument,
    readSpecFile,
    RUN_KEYS,
    SPEC_KINDS,
    SPEC_SCHEMA,
    STEP_KEYS,
    updateSpecFile,
    updateSpecResponses,
} from './spec-document.js';
import type { SpecSyntaxError } from './spec-document.js';

/**
 * The grammar, read on its own — no runner, no filesystem. Everything here is
 * text in, structure out (or a refusal naming a key and a line).
 */

const MINIMAL = [
    'description: does the thing',
    'runs:',
    '  - command: help',
    '    exit: 0',
    '',
].join('\n');

/** The same scenario at each of the two steps a formatter writes YAML with. */
const TWO_SPACE_DOCUMENT = [
    'description: reads back as it was written',
    'runs:',
    '  - command: check',
    '    exit: 0',
    '',
].join('\n');

const FOUR_SPACE_DOCUMENT = [
    'description: reads back as it was written',
    'runs:',
    '    - command: check',
    '      exit: 0',
    '',
].join('\n');

/** The text a rewritten document gives back when it is read again. */
function streamOf(written: string, key: 'stderr' | 'stdout'): string {
    return parseSpecDocument(written, 'case.spec.yaml').runs[0]?.[key]?.text ?? '';
}

function refusalOf(content: string): SpecSyntaxError {
    try {
        parseSpecDocument(content, 'case.spec.yaml');
    } catch (error) {
        return error as SpecSyntaxError;
    }
    throw new Error('expected the document to be refused, but it parsed');
}

describe('spec document — reading', () => {
    test('a minimal document defaults its kind and asserts empty streams', () => {
        // Given - the smallest document the grammar accepts
        const document = parseSpecDocument(MINIMAL, 'case.spec.yaml');

        // Then - kind defaults to cli, and an absent stream is `null` (= empty)
        expect(document.kind).toBe('cli');
        expect(document.description).toBe('does the thing');
        expect(document.runs).toHaveLength(1);
        expect(document.runs[0]?.stdout).toBeNull();
        expect(document.runs[0]?.stderr).toBeNull();
        expect(document.runs[0]?.files).toStrictEqual([]);
    });

    test('a block scalar keeps its final newline; `|-` drops it', () => {
        // Given - the two chomping forms, side by side
        const document = parseSpecDocument(
            [
                'description: two chomping forms',
                'runs:',
                '  - command: a',
                '    exit: 0',
                '    stdout: |',
                '      kept',
                '  - command: b',
                '    exit: 0',
                '    stdout: |-',
                '      dropped',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - the comparison text is byte-exact, trailing newline included
        expect(document.runs[0]?.stdout?.text).toBe('kept\n');
        expect(document.runs[1]?.stdout?.text).toBe('dropped');
    });

    test('a stream reports the line its CONTENT starts on, not the key line', () => {
        // Given - `stdout: |` on line 5, its first content line on line 6
        const document = parseSpecDocument(
            [
                'description: locates its streams',
                'runs:',
                '  - command: a',
                '    exit: 0',
                '    stdout: |',
                '      first',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - a defect inside the stream is reported where the reader sees it
        expect(document.runs[0]?.stdout?.line).toBe(6);
        expect(document.runs[0]?.commandLine).toBe(3);
    });

    test.each(['$FIXTURES/stub/', 'stub/', '/abs/stub/'])(
        'a fixture that is not a relative path is refused on its line: %s',
        (path) => {
            // Given - the 16 spellings: a marker, a bare name, an absolute path
            const source = [
                'description: states its ground',
                'fixture:',
                `  - ${path}`,
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n');

            // Then - refused by the grammar, where the path is written
            expect(() => parseSpecDocument(source, 'case.spec.yaml')).toThrow(
                /^case\.spec\.yaml:3: fixture: ".*" is not a relative path — name it from this document/u,
            );
        },
    );

    test.each([
        ['./expected/tree/', 'names expected/'],
        ['./tree/', 'names no fixtures/ folder'],
        ['./seeds/fixtures/tree/', 'names seeds/'],
    ])(
        'a fixture whose first ground folder is not fixtures/ is refused on its line (C24): %s',
        (path, names) => {
            // Given - a path whose first ground folder is another role's, or none
            const source = [
                'description: states its ground',
                `fixture: ${path}`,
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n');

            // Then - the first ground folder is the one judged, as for every other path key
            expect(() => parseSpecDocument(source, 'case.spec.yaml')).toThrow(
                `case.spec.yaml:2: fixture: reads fixtures/, and "${path}" ${names} — put the file in ./fixtures/ beside the document, or in specs/fixtures/ if several leaves share it (C24)`,
            );
        },
    );

    test.each(['./fixtures/', './fixtures/tree/', '../../fixtures/seeds/one.sql'])(
        'a fixture whose first ground folder is fixtures/ is read: %s',
        (path) => {
            // Given - file state named through fixtures/, whatever it holds below
            const source = [
                'description: states its ground',
                `fixture: ${path}`,
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n');

            // Then - the path is kept as written
            expect(parseSpecDocument(source, 'case.spec.yaml').fixtures).toMatchObject([{ path }]);
        },
    );

    test('env and fixture take a bare string or a list, and serve carries extra env', () => {
        // Given - the three ground keys in both their forms
        const document = parseSpecDocument(
            [
                'description: states its ground',
                'fixture: ../../fixtures/stub/',
                'env:',
                '  - frozen',
                '  - ORIGIN=http://127.0.0.1:9',
                'serve:',
                '  - dashboard',
                '  - mcp: { MCP_STUB_WITHHOLD: get-article }',
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - a bare word is a registered set, KEY=value is inline, and a mapping entry names one server plus the env it is started with
        expect(document.fixtures.map((fixture) => fixture.path)).toStrictEqual([
            '../../fixtures/stub/',
        ]);
        expect(document.env).toStrictEqual([
            { kind: 'set', line: 4, name: 'frozen' },
            { key: 'ORIGIN', kind: 'pair', line: 5, value: 'http://127.0.0.1:9' },
        ]);
        expect(document.serve).toStrictEqual([
            { env: {}, line: 7, name: 'dashboard' },
            { env: { MCP_STUB_WITHHOLD: 'get-article' }, line: 8, name: 'mcp' },
        ]);
    });

    test('files: reads all four forms of an on-disk assertion', () => {
        // Given - contains (one and many), equals, and the two bare states
        const document = parseSpecDocument(
            [
                'description: reads what was written',
                'runs:',
                '  - command: build',
                '    exit: 0',
                '    files:',
                '      one.txt: { contains: hi }',
                '      many.txt: { contains: [a, b] }',
                '      exact.txt: { equals: "x" }',
                '      gone: absent',
                '      here: exists',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - each entry keeps its path and its kind
        expect(document.runs[0]?.files.map((file) => [file.path, file.kind])).toStrictEqual([
            ['one.txt', 'content'],
            ['many.txt', 'content'],
            ['exact.txt', 'content'],
            ['gone', 'absent'],
            ['here', 'exists'],
        ]);
    });
});

describe('spec document — refusals', () => {
    test('an unknown top-level key names the key and its line', () => {
        // Given - a `given:` line, which this grammar does not know
        const refusal = refusalOf(
            `description: x\ngiven: something\nruns:\n  - command: a\n    exit: 0\n`,
        );

        // Then - the closed vocabulary is spelled out, on the offending line
        expect(refusal.line).toBe(2);
        expect(refusal.message).toContain('unknown key "given:"');
        expect(refusal.message).toContain(KIND_KEYS.cli.join(', '));
    });

    test('an unknown run key names the run vocabulary', () => {
        // Given - a run carrying `stdouts:`
        const refusal = refusalOf(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    stdouts: y\n`,
        );

        // Then - the run's own closed set is named
        expect(refusal.line).toBe(5);
        expect(refusal.message).toContain('unknown key "stdouts:" in a run');
        expect(refusal.message).toContain(RUN_KEYS.join(', '));
    });

    test('a missing description is refused, and so is a missing exit', () => {
        // Given - each mandatory key removed in turn
        // Then - the refusal names what the grammar demands
        expect(refusalOf('runs:\n  - command: a\n    exit: 0\n').message).toContain(
            'missing "description:"',
        );
        expect(refusalOf('description: x\nruns:\n  - command: a\n').message).toContain(
            'missing "exit:"',
        );
    });

    test('exit must be a literal integer', () => {
        // Given - a quoted exit code
        const refusal = refusalOf(`description: x\nruns:\n  - command: a\n    exit: "0"\n`);

        // Then - the grammar refuses the string form rather than coercing it
        expect(refusal.message).toContain('exit: must be a literal integer');
    });

    test('waitFor is refused on any run but the last', () => {
        // Given - a long-running first run followed by a second
        const refusal = refusalOf(
            `description: x\nruns:\n  - command: serve\n    exit: 0\n    waitFor: listening\n  - command: b\n    exit: 0\n`,
        );

        // Then - the run after it would never start
        expect(refusal.message).toContain('waitFor: is only allowed on the LAST run');
    });

    test('an unknown kind names the facets that exist', () => {
        // Given - a document claiming a facet nobody implemented
        const refusal = refusalOf(
            `kind: http\ndescription: x\nruns:\n  - command: a\n    exit: 0\n`,
        );

        // Then - the refusal lists the known kinds
        expect(refusal.message).toContain('kind: "http" is not a facet');
    });

    test('malformed YAML is refused with the parser’s own line', () => {
        // Given - a document that is not YAML at all
        const refusal = refusalOf('description: x\n  runs: [\n');

        // Then - the refusal carries a line, not a stack
        expect(refusal.line).toBeGreaterThan(0);
        expect(refusal.name).toBe('SpecSyntaxError');
    });
});

describe('spec document — update', () => {
    test('rewrites exit and streams, keeping comments, key order and everything else', () => {
        // Given - a document with a comment, a files: block and a stale golden
        const source = [
            '# the comment a rewrite must keep',
            'description: keeps its shape',
            'runs:',
            '  - command: build',
            '    exit: 9',
            '    stdout: |',
            '      stale',
            '    files:',
            '      out.txt: { contains: hi }',
            '',
        ].join('\n');
        const file = readSpecFile(source, 'case.spec.yaml');

        // Given - one update carrying the truth
        const written = updateSpecFile(file, [
            { exitCode: 0, stderr: '', stdout: 'fresh\nlines\n' },
        ]);

        // Then - only exit and stdout moved; the comment, the command and the files: block came back untouched, in the order they were written
        expect(written).toBe(
            [
                '# the comment a rewrite must keep',
                'description: keeps its shape',
                'runs:',
                '  - command: build',
                '    exit: 0',
                '    stdout: |',
                '      fresh',
                '      lines',
                '    files:',
                '      out.txt: { contains: hi }',
                '',
            ].join('\n'),
        );
    });

    test('a stream without a trailing newline is written `|-`, an empty one is removed', () => {
        // Given - a document whose stderr is about to become empty
        const file = readSpecFile(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    stderr: |\n      was here\n`,
            'case.spec.yaml',
        );

        // Given - an update with output that ends mid-line and no stderr at all
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout: 'no newline' }]);

        // Then - `|-` states the missing newline; the empty stream drops its key
        expect(written).toContain('stdout: |-\n      no newline');
        expect(written).not.toContain('stderr');
    });

    test('an inserted stream lands at its canonical position, not at the end', () => {
        // Given - a run with no streams and a files: block after the exit
        const file = readSpecFile(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    files:\n      out.txt: exists\n`,
            'case.spec.yaml',
        );

        // Given - an update that has stdout to write
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout: 'hello\n' }]);

        // Then - stdout sits between exit and files, where the canonical order puts it
        expect(written.indexOf('stdout')).toBeGreaterThan(written.indexOf('exit'));
        expect(written.indexOf('stdout')).toBeLessThan(written.indexOf('files'));
    });
});

describe('spec document — update at the document’s own indentation', () => {
    test('a stdout opening on a space reads back byte for byte in a four-space document', () => {
        // Given - a document formatted at four spaces, the step oxfmt writes YAML at
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');

        // Given - a run whose stdout opens on a space
        const stdout = ' TYPESCRIPT  src/index.ts\n2 files\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - the indicator names the four spaces the content sits at, and the golden reads back as the bytes the command printed
        expect(written).toContain('stdout: |4\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('the same stdout reads back byte for byte in a two-space document', () => {
        // Given - a two-space document, YAML's own default step
        const file = readSpecFile(TWO_SPACE_DOCUMENT, 'case.spec.yaml');

        // Given - the same leading space
        const stdout = ' TYPESCRIPT  src/index.ts\n2 files\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - two is what the indicator names there
        expect(written).toContain('stdout: |2\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('a stdout opening on several spaces keeps every one of them', () => {
        // Given - a four-space document and a stream indented on its own
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');

        // Given - four spaces of the command's own making
        const stdout = '    indented by the command\nback\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - the indicator names the document's step; the command's spaces are content
        expect(written).toContain('stdout: |4\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('a stdout opening on a tab survives without an indicator', () => {
        // Given - a four-space document and a tab-started stream, which YAML never reads as indentation
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');
        const stdout = '\tTABBED\nback\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - no indicator is stated, and the tab comes back
        expect(written).toContain('stdout: |\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('stderr states its indentation as stdout does', () => {
        // Given - a four-space document and a warning that opens on a space
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');
        const stderr = ' WARN  deprecated flag\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr, stdout: 'done\n' }]);

        // Then - the same digit, and the same byte-exact round trip
        expect(written).toContain('stderr: |4\n');
        expect(streamOf(written, 'stderr')).toBe(stderr);
    });

    test('the stdin and files: blocks an author wrote survive the rewrite unchanged', () => {
        // Given - a four-space document whose stdin and files.equals both open on A space, each stating the four spaces it is written at
        const source = [
            'description: keeps what it did not write',
            'runs:',
            '    - command: format',
            '      stdin: |4',
            '           piped in',
            '      exit: 0',
            '      files:',
            '          out.txt:',
            '              equals: |4',
            '                   written out',
            '',
        ].join('\n');
        const file = readSpecFile(source, 'case.spec.yaml');

        // Given - an update that touches the streams only
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout: 'done\n' }]);

        // Then - the two blocks the writer never wrote still read as their own bytes
        const run = parseSpecDocument(written, 'case.spec.yaml').runs[0];
        expect(run?.stdin).toBe(' piped in\n');
        const assertion = run?.files[0];
        expect(assertion?.kind === 'content' ? assertion.equals?.text : null).toBe(
            ' written out\n',
        );
    });
});

describe('spec document — the published schema', () => {
    test('describes exactly the keys the parser reads', () => {
        // Given - the schema shipped for editors
        // Then - its closed sets are the parser's own, so the two cannot drift
        expect(Object.keys(SPEC_SCHEMA.properties).sort()).toStrictEqual([...DOCUMENT_KEYS].sort());
        expect(Object.keys(SPEC_SCHEMA.$defs.run.properties).sort()).toStrictEqual(
            [...RUN_KEYS].sort(),
        );
        expect(SPEC_SCHEMA.additionalProperties).toBeFalsy();
        expect(SPEC_SCHEMA.$defs.run.additionalProperties).toBeFalsy();
    });

    test('describes exactly the keys an api step reads, and no other', () => {
        // Given - the step the schema shares between the one-step form and a journey
        // Then - its closed set is the parser's own
        expect(Object.keys(SPEC_SCHEMA.$defs.step.properties).toSorted()).toStrictEqual(
            [...STEP_KEYS].toSorted(),
        );
        expect(SPEC_SCHEMA.$defs.step.additionalProperties).toBe(false);
    });

    test('refuses, per kind, every key that kind does not read', () => {
        // Given - the schema's one if/then per kind
        // Then - each closes its document on exactly the keys the parser reads for that kind
        expect(SPEC_SCHEMA.allOf.map((rule) => rule.then.propertyNames.enum)).toStrictEqual(
            SPEC_KINDS.map((kind) => KIND_KEYS[kind]),
        );
    });
});

/** A document of `kind`, from its lines. */
function documentOf(...lines: string[]): string {
    return [...lines, ''].join('\n');
}

describe('spec document — an api case', () => {
    test('reads the given, one request and what came back, and names every path it stands on', () => {
        // Given - a one-step document stating every given key and a file response
        const document = parseSpecDocument(
            documentOf(
                'kind: api',
                'description: creates a user',
                'seed:',
                '  - ./seeds/one-user.sql',
                '  - { file: ./seeds/one-event.sql, database: analyticsDb }',
                'intercept: ./contracts/news.contracts.ts',
                'clock: 2026-03-04T09:30:00Z',
                'headers:',
                '  x-tenant: acme',
                'request: ./requests/create-user.http',
                'response: ./expected/user-created.http',
                'tables:',
                '  users:',
                '    database: db',
                '    columns: [name]',
                '    rows:',
                '      - [Charlie]',
            ),
            'case.spec.yaml',
        );

        // Then - the given reads in order, the top-level request is the one step, and every path is listed with its key
        expect(document).toMatchObject({
            clock: { iso: '2026-03-04T09:30:00Z' },
            headers: { 'x-tenant': 'acme' },
            seeds: [
                { database: null, path: './seeds/one-user.sql' },
                { database: 'analyticsDb', path: './seeds/one-event.sql' },
            ],
            steps: [
                {
                    headers: {},
                    tables: [
                        { columns: ['name'], database: 'db', name: 'users', rows: [['Charlie']] },
                    ],
                },
            ],
        });
        expect(documentPaths(document).map(({ key, path }) => `${key} ${path}`)).toStrictEqual([
            'seed ./seeds/one-user.sql',
            'seed ./seeds/one-event.sql',
            'intercept ./contracts/news.contracts.ts',
            'request ./requests/create-user.http',
            'response ./expected/user-created.http',
        ]);
    });

    test("reads a seed the specs root shares, then the leaf's own delta, in order", () => {
        // Given - the pool's base and the leaf's delta, both listed
        const document = parseSpecDocument(
            documentOf(
                'kind: api',
                'description: x',
                'seed:',
                '  - ../../seeds/catalog.sql',
                '  - ./seeds/delta.sql',
                'request: GET /users',
                'response: { status: 200 }',
            ),
            'case.spec.yaml',
        );

        // Then - both are seeds, applied in the order written
        expect(document.seeds.map(({ path }) => path)).toStrictEqual([
            '../../seeds/catalog.sql',
            './seeds/delta.sql',
        ]);
    });

    test('reads a journey: inline requests, bodies, captures sent by later steps, inline responses', () => {
        // Given - two steps, the second sending what the first captured
        const document = parseSpecDocument(
            documentOf(
                'kind: api',
                'description: an order created is the order read back',
                'steps:',
                '  - request: POST /orders',
                '    body: { item: book, count: 2 }',
                '    capture:',
                "      orderId: $.items[0]['the id']",
                '    response:',
                '      status: 201',
                '      headers: { content-type: application/json }',
                '      body: { id: "{{uuid}}" }',
                '  - request: GET /orders/{{orderId}}',
                '    headers: { x-order: "{{orderId}}" }',
                '    response: { status: "{{number}}" }',
            ),
            'case.spec.yaml',
        );

        // Then - each step keeps its shape, and the capture reads as segments
        expect(document.steps).toMatchObject([
            {
                body: { kind: 'value', value: { count: 2, item: 'book' } },
                capture: [{ name: 'orderId', segments: ['items', 0, 'the id'] }],
                request: { kind: 'inline', method: 'POST', target: '/orders' },
                response: { kind: 'inline', status: 201 },
            },
            {
                request: { target: '/orders/{{orderId}}' },
                response: { status: '{{number}}' },
            },
        ]);
    });

    test.each([
        [
            'seed: ./expected/one-user.sql',
            'seed: reads seeds/, and "./expected/one-user.sql" names expected/',
        ],
        ['seed: ./one-user.sql', 'seed: reads seeds/, and "./one-user.sql" names no seeds/ folder'],
        [
            'seed: ../../fixtures/seeds/catalog.sql',
            'seed: reads seeds/, and "../../fixtures/seeds/catalog.sql" names fixtures/ — put the file in ./seeds/ beside the document, or in specs/seeds/ if several leaves share it (C24)',
        ],
        ['seed: seeds/one-user.sql', 'seed: "seeds/one-user.sql" is not a relative path'],
        ['seed: ./seeds/users/', 'seed: "./seeds/users/" names a directory'],
        ['seed: ./seeds/one-user.txt', 'seed: "./seeds/one-user.txt" is not a .sql file'],
        [
            'intercept: ./fixtures/news.ts',
            'intercept: reads contracts/, and "./fixtures/news.ts" names fixtures/',
        ],
        ['clock: tomorrow', 'clock: "tomorrow" is not an ISO instant'],
    ])('refuses a given key naming the wrong thing: %s', (line, message) => {
        // Given - a one-step document whose given names what its key does not read
        const refusal = refusalOf(
            documentOf(
                'kind: api',
                'description: x',
                line,
                'request: GET /users',
                'response: { status: 200 }',
            ),
        );

        // Then - refused on the key's line, naming the folder the key reads (C24 for documents)
        expect(refusal.line).toBe(3);
        expect(refusal.message).toContain(message);
    });

    test.each([
        [
            'request: ./expected/create.http',
            'request: reads requests/, and "./expected/create.http" names expected/',
        ],
        ['request: FETCH /users', 'request: "FETCH /users" is neither a path'],
        [
            'response: ./requests/created.http',
            'response: reads expected/, and "./requests/created.http" names requests/',
        ],
    ])('refuses a step key naming the wrong thing: %s', (line, message) => {
        // Given - the action or the outcome in the wrong form
        const [request, response] = line.startsWith('response')
            ? ['request: GET /users', line]
            : [line, 'response: { status: 200 }'];
        const refusal = refusalOf(documentOf('kind: api', 'description: x', request, response));

        // Then - the refusal names the form the key takes
        expect(refusal.message).toContain(message);
    });

    test('a capture sent before a step named it is refused on the line that sends it', () => {
        // Given - the first step sends {{orderId}}, which only the second captures
        const refusal = refusalOf(
            documentOf(
                'kind: api',
                'description: x',
                'steps:',
                '  - request: GET /orders/{{orderId}}',
                '    response: { status: 200 }',
                '  - request: POST /orders',
                '    capture: { orderId: $.id }',
                '    response: { status: 201 }',
            ),
        );

        // Then - refused where it is sent, naming the rule
        expect(refusal.line).toBe(4);
        expect(refusal.message).toContain('"{{orderId}}" is referenced before it exists');
    });

    test('a token sent in a request is refused, naming why an input takes values', () => {
        // Given - a body carrying a {{uuid}} token
        const refusal = refusalOf(
            documentOf(
                'kind: api',
                'description: x',
                'request: POST /users',
                'body: { id: "{{uuid}}" }',
                'response: { status: 201 }',
            ),
        );

        // Then - a token matches what comes back; a request sends values
        expect(refusal.message).toContain('{{uuid}} is a token: it matches what comes back');
    });

    test.each([
        [['capture: { uuid: $.id }'], 'capture: "uuid" is a {{token}} of the grammar'],
        [['capture: { orderId: id }'], 'is not a JSONPath into the response body'],
    ])('refuses a capture the journey could not read: %s', (lines, message) => {
        // Given - a step capturing under a token's name, or by a path that is not one
        const refusal = refusalOf(
            documentOf(
                'kind: api',
                'description: x',
                'steps:',
                '  - request: POST /orders',
                ...lines.map((l) => `    ${l}`),
                '    response: { status: 201 }',
            ),
        );

        // Then - refused before any request is sent
        expect(refusal.message).toContain(message);
    });

    test.each([
        [
            ['fixture: ./fixtures/shop/', 'request: GET /users', 'response: { status: 200 }'],
            '"fixture:" is a key of a cli document, not of an api one — it lays files into a working directory',
        ],
        [
            ['cases: []', 'request: GET /users', 'response: { status: 200 }'],
            'unknown key "cases:" in an api document',
        ],
        [
            ['extends: ./base.spec.yaml', 'request: GET /users', 'response: { status: 200 }'],
            'unknown key "extends:"',
        ],
        [['request: GET /users'], 'a step asserts what came back'],
        [
            ['request: ./requests/one.http', 'body: { a: 1 }', 'response: { status: 200 }'],
            'body: goes with an inline request',
        ],
        [['response: { status: 200 }'], 'an api document sends a request:'],
        [
            [
                'request: GET /users',
                'steps:',
                '  - request: GET /users',
                '    response: { status: 200 }',
            ],
            '"request:" belongs to a step when the document states steps:',
        ],
    ])('refuses a document that is not one test of one shape: %j', (lines, message) => {
        // Given - a key of another facet, a list of cases, an inherited given, or a missing half
        const refusal = refusalOf(documentOf('kind: api', 'description: x', ...lines));

        // Then - each refusal names what the grammar holds instead
        expect(refusal.message).toContain(message);
    });

    test('reads a JSONPath into segments, and refuses what is not one', () => {
        // Given - the three segment forms, and two strings that are not paths
        // Then - segments below the root, or undefined
        expect(jsonPathSegments("$.a[2]['b c']")).toStrictEqual(['a', 2, 'b c']);
        expect(jsonPathSegments('$')).toStrictEqual([]);
        expect(jsonPathSegments('a.b')).toBeUndefined();
        expect(jsonPathSegments('$.a..b')).toBeUndefined();
    });

    test('update rewrites an inline response and keeps everything else', () => {
        // Given - a two-step journey whose second response is stale
        const file = readSpecFile(
            documentOf(
                '# kept',
                'kind: api',
                'description: x',
                'steps:',
                '  - request: GET /a',
                '    response: ./expected/a.http',
                '  - request: GET /b',
                '    response:',
                '      status: 500',
                '      body: { stale: true }',
            ),
            'case.spec.yaml',
        );

        // When - the second step's response is rewritten from what came back
        const written = updateSpecResponses(file, [
            { body: { ok: true }, hasBody: true, headers: {}, status: '200', step: 1 },
        ]);

        // Then - the new response reads back, the file-form one and the comment untouched
        const document = parseSpecDocument(written, 'case.spec.yaml');
        expect(document.steps[1]?.response).toMatchObject({
            body: { value: { ok: true } },
            status: 200,
        });
        expect(document.steps[0]?.response).toMatchObject({
            kind: 'file',
            path: './expected/a.http',
        });
        expect(written.startsWith('# kept\n')).toBe(true);
    });
});

describe('spec document — a jobs case', () => {
    test('reads the job, the error it ends on and the tables it leaves', () => {
        // Given - a jobs document stating both outcomes
        const document = parseSpecDocument(
            documentOf(
                'kind: jobs',
                'description: a crash keeps what it wrote',
                'seed: ./seeds/two-users.sql',
                'trigger: crash-after-insert',
                'error: "crash-after-insert: {{string}}"',
                'tables:',
                '  events:',
                '    columns: [type]',
                '    rows: []',
            ),
            'case.spec.yaml',
        );

        // Then - the trigger, the token-aware error and an empty table
        expect(document.trigger?.name).toBe('crash-after-insert');
        expect(document.error?.text).toBe('crash-after-insert: {{string}}');
        expect(document.tables[0]?.rows).toStrictEqual([]);
    });

    test.each([
        [
            ['tables: { events: { columns: [type], rows: [] } }'],
            'names the job it runs — trigger: <name>',
        ],
        [['trigger: sync'], 'asserts what the job did'],
        [
            ['trigger: sync', 'request: GET /x', 'error: boom'],
            '"request:" is a key of an api document, not of a jobs one',
        ],
        [
            ['trigger: sync', 'tables: { events: { columns: [type, payload], rows: [[a]] } }'],
            'each row holds one cell per column (2)',
        ],
    ])('refuses a jobs document that cannot be run as one: %j', (lines, message) => {
        // Given - a missing trigger, a missing outcome, a key of the api, a ragged row
        const refusal = refusalOf(documentOf('kind: jobs', 'description: x', ...lines));

        // Then - the refusal names what is missing or misplaced
        expect(refusal.message).toContain(message);
    });
});
