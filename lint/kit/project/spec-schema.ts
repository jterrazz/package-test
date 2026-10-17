import { GROUND_FIXTURES, GROUND_FOLDERS } from '@jterrazz/typescript/rules';

import { FILE_STATES, PRESENCE } from './spec-grammar.js';
import type { PresenceShape } from './spec-grammar.js';

const STRING_OR_LIST = {
    oneOf: [{ type: 'string' }, { items: { type: 'string' }, minItems: 1, type: 'array' }],
};

const NOT_GROUND_SEGMENT = String.raw`(?!(?:${GROUND_FOLDERS.join('|')})/)[^/]+/`;

function fixturePath(): SchemaNode {
    return {
        pattern: String.raw`^\.\.?/(?:${NOT_GROUND_SEGMENT})*?${GROUND_FIXTURES}/.*$`,
        type: 'string',
    };
}

function oneOrMany(item: SchemaNode): SchemaNode {
    return { oneOf: [item, { items: item, minItems: 1, type: 'array' }] };
}

function presenceOf(shape: PresenceShape): SchemaNode {
    const required: string[] = [];
    const allOf: SchemaNode[] = [];
    for (const law of PRESENCE[shape]) {
        if (law.law === 'each') {
            required.push(...law.keys);
        } else if (law.law === 'some') {
            allOf.push({ anyOf: law.keys.map((key) => ({ required: [key] })) });
        } else {
            allOf.push(...law.keys.map((key) => ({ not: { required: [law.with, key] } })));
        }
    }
    return {
        ...(allOf.length > 0 ? { allOf } : {}),
        ...(required.length > 0 ? { required } : {}),
    };
}

type SchemaNode = Record<string, unknown>;

export type SpecSchema = {
    $defs: SchemaNode & {
        run: SchemaNode & { additionalProperties: boolean; properties: SchemaNode };
    };
    $id: string;
    $schema: string;
    additionalProperties: boolean;
    description: string;
    properties: SchemaNode;
    title: string;
    type: string;
};

export const SPEC_SCHEMA: SpecSchema = {
    $defs: {
        fileAssertion: {
            oneOf: [
                { enum: FILE_STATES as readonly string[], type: 'string' },
                {
                    ...presenceOf('files'),
                    additionalProperties: false,
                    properties: {
                        contains: STRING_OR_LIST,
                        equals: { type: 'string' },
                    },
                    type: 'object',
                },
            ],
        },
        run: {
            ...presenceOf('run'),
            additionalProperties: false,
            properties: {
                command: { description: 'The argv line, run through the shell.', type: 'string' },
                exit: { description: 'The exit code the command must return.', type: 'integer' },
                files: {
                    additionalProperties: { $ref: '#/$defs/fileAssertion' },
                    description: 'On-disk assertions, keyed by a path under the working directory.',
                    type: 'object',
                },
                stderr: {
                    description: 'Expected stderr, byte-exact. Absent asserts an empty stream.',
                    type: 'string',
                },
                stdin: { description: 'Written to the child, then closed.', type: 'string' },
                stdout: {
                    description: 'Expected stdout, byte-exact. Absent asserts an empty stream.',
                    type: 'string',
                },
                timeout: { description: 'Milliseconds before the run is killed.', type: 'integer' },
                waitFor: {
                    description: 'Resolve when this text appears. Only on the last run.',
                    type: 'string',
                },
            },
            type: 'object',
        },
        serveEntry: {
            oneOf: [
                { type: 'string' },
                {
                    additionalProperties: {
                        additionalProperties: { type: 'string' },
                        type: 'object',
                    },
                    maxProperties: 1,
                    minProperties: 1,
                    type: 'object',
                },
            ],
        },
    },
    $id: 'https://jterrazz.com/schema/jterrazz-test/spec.schema.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    additionalProperties: false,
    description:
        'One case of the @jterrazz/test literate format, one file per test: the ground it stands on, what it does, and what came back.',
    properties: {
        description: {
            description: 'The vitest test title: one lowercase line, no trailing period.',
            type: 'string',
        },
        env: {
            ...STRING_OR_LIST,
            description:
                'A bare word names an env set registered in code; KEY=value is inline. $WORKDIR expands.',
        },
        fixture: {
            description:
                "Fixture paths copied into the working directory, layering in order, each relative to this document (`./...`, `../...`) and in the two forms the chain's `file()` and `directory()` take: a trailing `/` names a directory whose contents are spread, without it one file is copied under its own name. The first ground folder a path passes through is __fixtures__/: ./__fixtures__/ beside the document, or specs/__fixtures__/ reached by the path that climbs to it.",
            ...oneOrMany(fixturePath()),
        },
        runs: {
            // invariant: only the last run may wait; no keyword addresses the last item, so the schema holds that one run at most does.
            contains: { required: ['waitFor'] },
            description:
                'The session: one or more runs, sequential, sharing one working directory.',
            items: { $ref: '#/$defs/run' },
            maxContains: 1,
            minContains: 0,
            minItems: 1,
            type: 'array',
        },
        serve: {
            description: 'Servers registered in code, started once per file.',
            oneOf: [
                { type: 'string' },
                { items: { $ref: '#/$defs/serveEntry' }, minItems: 1, type: 'array' },
            ],
        },
    },
    ...presenceOf('document'),
    title: '@jterrazz/test spec document',
    type: 'object',
} as const;

export function renderSchema(): string {
    return `${JSON.stringify(SPEC_SCHEMA, null, 4)}\n`;
}
