import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { PRESENCE } from '../src/model/literate/spec-document.js';
import type { PresenceShape } from '../src/model/literate/spec-document.js';
import { documentData, parserRefusal, schemaVerdicts, specDocuments } from './schema-documents.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

/** The schema `npm run docs` commits and the package publishes. */
const SCHEMA = resolve(ROOT, 'schema/spec.schema.json');

/** The committed schema, compiled once: a data value in, its errors out. */
function schemaValidator(): (data: unknown) => string[] {
    const validate = new Ajv2020({ allErrors: true }).compile(
        JSON.parse(readFileSync(SCHEMA, 'utf8')) as object,
    );
    return (data) =>
        validate(data)
            ? []
            : (validate.errors ?? []).map(
                  (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
              );
}

/**
 * The refusals a schema cannot state, each with the reason: the parser holds
 * them, and an editor validating against the schema does not see them.
 */
const BEYOND_A_SCHEMA = new Map([
    [
        'specs/api/literate/fixtures/capture-before-it-exists.spec.yaml',
        'a name sent before the step that captures it: an order across steps, which no keyword compares',
    ],
]);

/** Is this document an input a negative spec runs — under a `fixtures/` folder? */
function isFixture(file: string): boolean {
    return file.split('/').includes('fixtures');
}

describe('the published schema validates every document of the tree (meta-test)', () => {
    test('every document the parser reads, the schema validates', () => {
        // Given - every `.spec.yaml` of the repository, the ones the parser reads
        const read = schemaVerdicts(ROOT, schemaValidator()).filter(
            ({ parser }) => parser === null,
        );

        // Then - none carries a schema error: an editor never flags what the runner runs
        expect(read.length).toBeGreaterThan(200);
        expect(read.filter(({ schema }) => schema.length > 0)).toStrictEqual([]);
    });

    test('a document the parser refuses is an input, kept under fixtures/', () => {
        // Given - every document the parser refuses
        const refused = schemaVerdicts(ROOT, schemaValidator()).filter(
            ({ parser }) => parser !== null,
        );

        // Then - each is deliberately invalid: no live document is one
        expect(refused.length).toBeGreaterThan(0);
        expect(refused.filter(({ file }) => !isFixture(file))).toStrictEqual([]);
    });

    test('a document the parser refuses, the schema refuses — but for what no schema can state', () => {
        // Given - every document the parser refuses, less the refusals no JSON Schema keyword can express
        const refused = schemaVerdicts(ROOT, schemaValidator()).filter(
            ({ file, parser }) => parser !== null && !BEYOND_A_SCHEMA.has(file),
        );

        // Then - the schema refuses each of them too: an editor flags what the runner refuses
        expect(refused.filter(({ schema }) => schema.length === 0)).toStrictEqual([]);
    });

    test('the walk reads the documents git keeps, and nothing it ignores', () => {
        // Given - the documents the walk found
        const documents = specDocuments(ROOT);

        // Then - the facets' documents are there, and no dependency's is
        expect(documents).toContain('specs/api/seeding/seeded-in-order.spec.yaml');
        expect(documents).toContain('specs/jobs/triggering/synced-events.spec.yaml');
        expect(documents.some((file) => file.startsWith('specs/cli/'))).toBe(true);
        expect(documents.some((file) => file.includes('node_modules/'))).toBe(false);
    });
});

describe('the published schema refuses a wrong document of every kind', () => {
    const validate = schemaValidator();

    test.each([
        ['cli', 'a document with no runs', 'description: x\nfixture: ./fixtures/shop/\n'],
        [
            'cli',
            'a fixture whose first ground folder is seeds/',
            'description: x\nfixture: ./seeds/fixtures/shop/\nruns:\n    - command: build\n      exit: 0\n',
        ],
        [
            'cli',
            'a key another kind reads',
            'description: x\nseed: ./seeds/one.sql\nruns:\n    - command: build\n      exit: 0\n',
        ],
        [
            'api',
            'a key another kind reads',
            'kind: api\ndescription: x\ntrigger: sync\nrequest: GET /users\n',
        ],
        [
            'api',
            'neither a request nor steps',
            'kind: api\ndescription: x\nseed: ./seeds/one.sql\n',
        ],
        [
            'api',
            'a seed under seeds/ inside the fixtures pool',
            'kind: api\ndescription: x\nseed: ../../fixtures/seeds/one.sql\nrequest: GET /users\n',
        ],
        [
            'api',
            'a seed outside seeds/',
            'kind: api\ndescription: x\nseed: ./expected/one.sql\nrequest: GET /users\n',
        ],
        [
            'api',
            'a request with neither a response nor tables',
            'kind: api\ndescription: x\nrequest: GET /users\n',
        ],
        [
            'api',
            'a response beside the steps',
            'kind: api\ndescription: x\nresponse: { status: 200 }\nsteps:\n    - request: GET /users\n      response: { status: 200 }\n',
        ],
        [
            'api',
            'a body beside a request file',
            'kind: api\ndescription: x\nrequest: ./requests/one.http\nbody: { a: 1 }\nresponse: { status: 200 }\n',
        ],
        [
            'cli',
            'a run that waits and writes stdin',
            'description: x\nruns:\n    - command: serve\n      stdin: x\n      waitFor: ready\n      exit: 0\n',
        ],
        [
            'jobs',
            'a key another kind reads',
            'kind: jobs\ndescription: x\ntrigger: sync\nrequest: GET /users\n',
        ],
        ['jobs', 'no trigger', 'kind: jobs\ndescription: x\nseed: ./seeds/one.sql\n'],
    ])('%s: %s', (_kind, _case, text) => {
        // Given - the document's data
        const data = documentData(text);

        // Then - the parser refuses it, and the schema names at least one error
        expect(parserRefusal(text, 'case.spec.yaml')).not.toBeNull();
        expect(validate(data).length).toBeGreaterThan(0);
    });

    test.each([
        ['cli', 'description: x\nruns:\n    - command: build\n      exit: 0\n'],
        [
            'api',
            'kind: api\ndescription: x\nseed: ./seeds/one.sql\nrequest: GET /users\nresponse:\n    status: 200\n',
        ],
        [
            'jobs',
            'kind: jobs\ndescription: x\ntrigger: sync\ntables:\n    users:\n        columns: [name]\n        rows: []\n',
        ],
        [
            'cli',
            'description: x\nfixture: [./fixtures/, ../../fixtures/shop/]\nruns:\n    - command: build\n      exit: 0\n',
        ],
    ])('%s: the well-formed twin validates', (_kind, text) => {
        // Given - the document's data
        const data = documentData(text);

        // Then - the parser reads it and the schema finds no error: each refusal above is the case, not the kind
        expect(parserRefusal(text, 'twin.spec.yaml')).toBeNull();
        expect(validate(data)).toStrictEqual([]);
    });
});

/** A mapping of the grammar, as data. */
type Mapping = Record<string, unknown>;

/** What a value of each key a presence law names may be, when a case adds it. */
const SAMPLES: Mapping = {
    body: { a: 1 },
    request: 'GET /users',
    response: { status: 200 },
    tables: { users: { columns: ['name'], rows: [] } },
    waitFor: 'ready',
};

/**
 * Each shape a presence law governs: well-formed instances of it, the
 * document one is set in, and the name a refusal calls it by.
 */
const SHAPES: Record<
    PresenceShape,
    { embed: (mapping: Mapping) => Mapping; instances: Mapping[]; subject?: string }
> = {
    api: {
        embed: (mapping) => mapping,
        instances: [
            { description: 'x', kind: 'api', request: 'GET /users', response: { status: 200 } },
            {
                description: 'x',
                kind: 'api',
                steps: [{ request: 'GET /users', response: { status: 200 } }],
            },
        ],
    },
    cli: {
        embed: (mapping) => mapping,
        instances: [{ description: 'x', runs: [{ command: 'build', exit: 0 }] }],
    },
    document: {
        embed: (mapping) => mapping,
        instances: [
            { description: 'x', runs: [{ command: 'build', exit: 0 }] },
            { description: 'x', kind: 'api', request: 'GET /users', tables: SAMPLES.tables },
            { description: 'x', error: 'boom', kind: 'jobs', trigger: 'sync' },
        ],
    },
    files: {
        embed: (mapping) => ({
            description: 'x',
            runs: [{ command: 'build', exit: 0, files: { 'a.txt': mapping } }],
        }),
        instances: [{ contains: 'x' }, { equals: 'x' }],
        subject: 'a.txt',
    },
    jobs: {
        embed: (mapping) => mapping,
        instances: [
            { description: 'x', kind: 'jobs', tables: SAMPLES.tables, trigger: 'sync' },
            { description: 'x', error: 'boom', kind: 'jobs', trigger: 'sync' },
        ],
    },
    response: {
        embed: (mapping) => ({
            description: 'x',
            kind: 'api',
            request: 'GET /users',
            response: mapping,
        }),
        instances: [{ status: 200 }, { body: { a: 1 }, headers: { 'x-a': 'b' } }],
    },
    run: {
        embed: (mapping) => ({ description: 'x', runs: [mapping] }),
        instances: [
            { command: 'build', exit: 0 },
            { command: 'build', exit: 0, stdin: 'x' },
        ],
    },
    seed: {
        embed: (mapping) => ({
            description: 'x',
            kind: 'api',
            request: 'GET /users',
            response: { status: 200 },
            seed: mapping,
        }),
        instances: [{ database: 'db', file: './seeds/one.sql' }],
    },
    step: {
        embed: (mapping) => ({ description: 'x', kind: 'api', steps: [mapping] }),
        instances: [
            { request: 'GET /users', response: { status: 200 } },
            { body: { a: 1 }, request: 'POST /users', tables: SAMPLES.tables },
        ],
    },
    table: {
        embed: (mapping) => ({
            description: 'x',
            kind: 'jobs',
            tables: { users: mapping },
            trigger: 'sync',
        }),
        instances: [{ columns: ['name'], rows: [['a']] }],
        subject: 'users',
    },
};

/** One mapping that breaks a law: what it is, and the refusal the parser must give. */
type Breach = { case: string; mapping: Mapping; refusal: string };

/** The mapping, less `keys`. */
function without(mapping: Mapping, keys: readonly string[]): Mapping {
    return Object.fromEntries(Object.entries(mapping).filter(([key]) => !keys.includes(key)));
}

/** Every breach of a law the instances of its shape can be turned into. */
function breachesOf(shape: PresenceShape, lawIndex: number): Breach[] {
    const law = PRESENCE[shape][lawIndex];
    const { instances, subject = '' } = SHAPES[shape];
    if (law === undefined) {
        return [];
    }
    return instances.flatMap((instance): Breach[] => {
        if (law.law === 'each') {
            return law.keys.map((key) => ({
                case: `without ${key}`,
                mapping: without(instance, [key]),
                refusal: law.refusal(subject, key),
            }));
        }
        if (law.law === 'some') {
            return law.keys.some((key) => key in instance)
                ? [
                      {
                          case: `without ${law.keys.join(', ')}`,
                          mapping: without(instance, law.keys),
                          refusal: law.refusal(subject),
                      },
                  ]
                : [];
        }
        return law.with in instance
            ? law.keys.map((key) => ({
                  case: `${key} beside ${law.with}`,
                  mapping: { ...instance, [key]: SAMPLES[key] },
                  refusal: law.refusal(subject, key),
              }))
            : [];
    });
}

/** The shapes, each with its laws by index — what `test.each` walks. */
const LAWS = (Object.keys(PRESENCE) as PresenceShape[]).flatMap((shape) =>
    PRESENCE[shape].map((law, index) => [shape, law.law, index] as const),
);

describe('the schema holds every presence law the parser holds (meta-test)', () => {
    const validate = schemaValidator();

    test.each(Object.keys(SHAPES) as PresenceShape[])(
        '%s: every well-formed instance, the parser reads and the schema validates',
        (shape) => {
            // Given - each instance of the shape, set in its document
            const { embed, instances } = SHAPES[shape];

            // Then - both readers accept it: the breaches below are the law, not the shape
            for (const instance of instances) {
                const text = JSON.stringify(embed(instance));
                expect(parserRefusal(text, 'case.spec.yaml')).toBeNull();
                expect(validate(documentData(text))).toStrictEqual([]);
            }
        },
    );

    test.each(LAWS)(
        '%s: the %s law #%i is broken the same for both readers',
        (shape, _law, index) => {
            // Given - every way the shape's instances break the law
            const breaches = breachesOf(shape, index);

            // Then - there is one at least, and each is refused by the parser with the law's sentence, and by the schema
            expect(breaches.length).toBeGreaterThan(0);
            const disagreements: string[] = [];
            for (const breach of breaches) {
                const text = JSON.stringify(SHAPES[shape].embed(breach.mapping));
                const parser = parserRefusal(text, 'case.spec.yaml');
                if (parser?.includes(breach.refusal) !== true) {
                    disagreements.push(`${breach.case}: the parser said ${String(parser)}`);
                }
                if (validate(documentData(text)).length === 0) {
                    disagreements.push(`${breach.case}: the schema validates it`);
                }
            }
            expect(disagreements).toStrictEqual([]);
        },
    );
});
