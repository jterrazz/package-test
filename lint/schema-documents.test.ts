import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

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
            'jobs',
            'a key another kind reads',
            'kind: jobs\ndescription: x\ntrigger: sync\nrequest: GET /users\n',
        ],
        ['jobs', 'no trigger', 'kind: jobs\ndescription: x\nseed: ./seeds/one.sql\n'],
    ])('%s: %s', (_kind, _case, text) => {
        // Given - the document's data
        const data = documentData(text);

        // Then - the schema names at least one error
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
