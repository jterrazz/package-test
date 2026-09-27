import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { PRESENCE } from '../../engine/project/spec-document.js';
import type { PresenceShape } from '../../engine/project/spec-document.js';
import { documentData, isFixture, specDocuments } from '../../engine/project/spec-documents.js';
import { parserRefusal, schemaVerdicts } from './schema-documents.js';

const ROOT = resolve(import.meta.dirname, '../../..');

const SCHEMA = resolve(ROOT, 'schema/spec.schema.json');

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

/** The parser holds these; an editor validating against the schema does not see them. */
const BEYOND_A_SCHEMA = new Map<string, string>();

const validate = schemaValidator();

type Mapping = Record<string, unknown>;

const SAMPLES: Mapping = {
    waitFor: 'ready',
};

const SHAPES: Record<
    PresenceShape,
    { embed: (mapping: Mapping) => Mapping; instances: Mapping[]; subject?: string }
> = {
    document: {
        embed: (mapping) => mapping,
        instances: [{ description: 'x', runs: [{ command: 'build', exit: 0 }] }],
    },
    files: {
        embed: (mapping) => ({
            description: 'x',
            runs: [{ command: 'build', exit: 0, files: { 'a.txt': mapping } }],
        }),
        instances: [{ contains: 'x' }, { equals: 'x' }],
        subject: 'a.txt',
    },
    run: {
        embed: (mapping) => ({ description: 'x', runs: [mapping] }),
        instances: [
            { command: 'build', exit: 0 },
            { command: 'build', exit: 0, stdin: 'x' },
        ],
    },
};

type Breach = { case: string; mapping: Mapping; refusal: string };

function without(mapping: Mapping, keys: readonly string[]): Mapping {
    return Object.fromEntries(Object.entries(mapping).filter(([key]) => !keys.includes(key)));
}

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

const LAWS = (Object.keys(PRESENCE) as PresenceShape[]).flatMap((shape) =>
    PRESENCE[shape].map((law, index) => [shape, law.law, index] as const),
);

describe('schema-documents', () => {
    test('the published schema validates every document of the tree (meta-test) — every document the parser reads, the schema validates', () => {
        // Given - every `.spec.yaml` of the repository, the ones the parser reads
        const read = schemaVerdicts(ROOT, schemaValidator()).filter(
            ({ parser }) => parser === null,
        );

        // Then - none carries a schema error: an editor never flags what the runner runs
        expect(read.length).toBeGreaterThan(30);
        expect(read.filter(({ schema }) => schema.length > 0)).toStrictEqual([]);
    });

    test('the published schema validates every document of the tree (meta-test) — a document the parser refuses is an input, kept under _fixtures/', () => {
        // Given - every document the parser refuses
        const refused = schemaVerdicts(ROOT, schemaValidator()).filter(
            ({ parser }) => parser !== null,
        );

        // Then - each is deliberately invalid: no live document is one
        expect(refused.length).toBeGreaterThan(0);
        expect(refused.filter(({ file }) => !isFixture(file))).toStrictEqual([]);
    });

    test('the published schema validates every document of the tree (meta-test) — a document the parser refuses, the schema refuses — but for what no schema can state', () => {
        // Given - every document the parser refuses, less the refusals no JSON Schema keyword can express
        const refused = schemaVerdicts(ROOT, schemaValidator()).filter(
            ({ file, parser }) => parser !== null && !BEYOND_A_SCHEMA.has(file),
        );

        // Then - the schema refuses each of them too: an editor flags what the runner refuses
        expect(refused.filter(({ schema }) => schema.length === 0)).toStrictEqual([]);
    });

    test('the published schema validates every document of the tree (meta-test) — the walk reads the documents git keeps, and nothing it ignores', () => {
        // Given - the documents the walk found
        const documents = specDocuments(ROOT);

        // Then - the cli's and the lint rules' documents are there, and no dependency's is
        expect(documents.some((file) => file.startsWith('specs/cli/'))).toBe(true);
        expect(documents.some((file) => file.startsWith('specs/lint/'))).toBe(true);
        expect(documents.some((file) => file.includes('node_modules/'))).toBe(false);
    });

    test('what no keyword states, the parser alone refuses — a waitFor on a run before the last: no keyword addresses the last item of a list', () => {
        // Given - one run that waits, followed by another; the schema holds only that at most one run waits
        const text =
            'description: x\nruns:\n    - command: serve\n      waitFor: ready\n      exit: 0\n    - command: ping\n      exit: 0\n';

        // Then - the parser refuses it, and the schema cannot
        expect(parserRefusal(text, 'case.spec.yaml')).toContain(
            'waitFor: is only allowed on the LAST run',
        );
        expect(validate(documentData(text))).toStrictEqual([]);
    });

    test.each([
        ['cli', 'a document with no runs', 'description: x\nfixture: ./_fixtures/shop/\n'],
        [
            'cli',
            'a fixture whose first ground folder is _seeds/',
            'description: x\nfixture: ./_seeds/_fixtures/shop/\nruns:\n    - command: build\n      exit: 0\n',
        ],
        [
            'cli',
            'a key no document reads',
            'description: x\nseed: ./_seeds/one.sql\nruns:\n    - command: build\n      exit: 0\n',
        ],
        [
            'cli',
            'a kind, which no document states',
            'kind: api\ndescription: x\nruns:\n    - command: build\n      exit: 0\n',
        ],
        [
            'cli',
            'two runs that wait',
            'description: x\nruns:\n    - command: serve\n      waitFor: ready\n      exit: 0\n    - command: serve\n      waitFor: ready\n      exit: 0\n',
        ],
        [
            'cli',
            'a run that waits and writes stdin',
            'description: x\nruns:\n    - command: serve\n      stdin: x\n      waitFor: ready\n      exit: 0\n',
        ],
    ])('the published schema refuses a wrong document — %s: %s', (_kind, _case, text) => {
        // Given - the document's data
        const data = documentData(text);

        // Then - the parser refuses it, and the schema names at least one error
        expect(parserRefusal(text, 'case.spec.yaml')).not.toBeNull();
        expect(validate(data).length).toBeGreaterThan(0);
    });

    test.each([
        ['cli', 'description: x\nruns:\n    - command: build\n      exit: 0\n'],
        [
            'cli',
            'description: x\nfixture: [./_fixtures/, ../../_fixtures/shop/]\nruns:\n    - command: build\n      exit: 0\n',
        ],
    ])(
        'the published schema refuses a wrong document — %s: the well-formed twin validates',
        (_kind, text) => {
            // Given - the document's data
            const data = documentData(text);

            // Then - the parser reads it and the schema finds no error: each refusal above is the case, not the kind
            expect(parserRefusal(text, 'twin.spec.yaml')).toBeNull();
            expect(validate(data)).toStrictEqual([]);
        },
    );

    test.each(Object.keys(SHAPES) as PresenceShape[])(
        'the schema holds every presence law the parser holds (meta-test) — %s: every well-formed instance, the parser reads and the schema validates',
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
        'the schema holds every presence law the parser holds (meta-test) — %s: the %s law #%i is broken the same for both readers',
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
