import { GROUND_FIXTURES, GROUND_FOLDERS, isGroundFolder } from '@jterrazz/typescript/rules';

import { isRelativePath } from './relative-path.js';
import {
    blockScalar,
    isMap,
    isScalar,
    isSeq,
    parseYamlSource,
    renderYamlSource,
    yamlSyntaxErrors,
} from './yaml-document.js';
import type { Node, Pair, YAMLMap, YAMLSeq, YamlSource } from './yaml-document.js';

/** The grammar alone: no path resolution, no command, no filesystem. The runner, the lint checker and the JSON Schema read the same constants. */

export const SPEC_EXTENSION = '.spec.yaml';

export const DOCUMENT_KEYS = ['description', 'fixture', 'env', 'serve', 'runs'] as const;

export const RUN_KEYS = [
    'command',
    'stdin',
    'timeout',
    'waitFor',
    'exit',
    'stdout',
    'stderr',
    'files',
] as const;

const FILE_CONTENT_KEYS = ['contains', 'equals'] as const;

const FILE_STATES = ['absent', 'exists'] as const;

/** Read by the parser and stated by the schema, so an editor refuses what the runner does. */
export type PresenceLaw =
    | {
          keys: readonly string[];
          law: 'apart';
          refusal: (subject: string, key: string) => string;
          with: string;
      }
    | {
          keys: readonly string[];
          law: 'each';
          refusal: (subject: string, key: string) => string;
      }
    | {
          keys: readonly string[];
          law: 'some';
          refusal: (subject: string) => string;
      };

export type PresenceShape = 'document' | 'files' | 'run';

export const PRESENCE: Readonly<Record<PresenceShape, readonly PresenceLaw[]>> = {
    document: [
        {
            keys: ['description'],
            law: 'each',
            refusal: () =>
                'missing "description:" — every document is one test, and this is its title',
        },
        {
            keys: ['runs'],
            law: 'each',
            refusal: () => 'missing "runs:" — description and runs are mandatory',
        },
    ],
    files: [
        {
            keys: FILE_CONTENT_KEYS,
            law: 'some',
            refusal: (path) => `files: ${path} asserts nothing — give it contains: or equals:`,
        },
    ],
    run: [
        {
            keys: ['command', 'exit'],
            law: 'each',
            refusal: (_subject, key) =>
                `a run is missing "${key}:" — command and exit are mandatory`,
        },
        {
            keys: ['waitFor'],
            law: 'apart',
            refusal: () =>
                'waitFor: and stdin: cannot share a run — the pattern is watched on a process nobody closed the input of',
            with: 'stdin',
        },
    ],
};

/** One `env:` entry — a bare word naming a registered set, or a `KEY=value` pair. */
export type SpecEnvToken =
    | { key: string; kind: 'pair'; line: number; value: string }
    | { kind: 'set'; line: number; name: string };

/** One `serve:` entry — a registered server plus the extra env it is started with. */
export type SpecServeEntry = {
    env: Record<string, string>;
    line: number;
    name: string;
};

/** One `fixture:` entry — a path with the line it was declared on. */
export type SpecFixture = {
    line: number;
    path: string;
};

/** An expected stream: its text, and the first line of that text in the file. */
export type SpecStream = {
    /** 1-based line the scalar's content starts on — where a token defect is reported. */
    line: number;
    text: string;
};

/** One `files:` assertion, keyed by a workdir-relative path. */
export type SpecFileAssertion =
    | {
          contains: SpecStream[];
          equals: null | SpecStream;
          kind: 'content';
          line: number;
          path: string;
      }
    | { kind: 'absent'; line: number; path: string }
    | { kind: 'exists'; line: number; path: string };

/** One run: a command, what it must exit with, and what it must have produced. */
export type SpecRun = {
    command: string;
    /** 1-based line of the `command:` key — the frame a failure points at. */
    commandLine: number;
    exitCode: number;
    files: SpecFileAssertion[];
    /** `null` when the key is absent, which asserts an empty stream. */
    stderr: null | SpecStream;
    /** Written to the child then closed; `null` keeps the empty-pipe EOF. */
    stdin: null | string;
    stdout: null | SpecStream;
    timeout: null | number;
    /** Only on the last run: a long-running command ends the session. */
    waitFor: null | string;
};

type SpecPath = {
    line: number;
    path: string;
};

/** A parsed `<case>.spec.yaml`. */
export type SpecDocument = {
    /** The vitest test title. */
    description: string;
    /** 1-based line of the `description:` key. */
    descriptionLine: number;
    env: SpecEnvToken[];
    fixtures: SpecFixture[];
    runs: SpecRun[];
    serve: SpecServeEntry[];
};

export type SpecFile = {
    document: SpecDocument;
    source: YamlSource;
};

export type SpecRunUpdate = {
    exitCode: number;
    stderr: string;
    stdout: string;
};

export class SpecSyntaxError extends Error {
    readonly line: number;
    readonly reason: string;

    constructor(fileName: string, line: number, message: string) {
        super(`${fileName}:${line}: ${message}`);
        this.line = line;
        this.reason = message;
        this.name = 'SpecSyntaxError';
    }
}

type Context = {
    fileName: string;
    source: YamlSource;
};

function fail(context: Context, node: Node | null | Pair | undefined, message: string): never {
    throw new SpecSyntaxError(context.fileName, lineOf(context, node), message);
}

function lineOf(context: Context, node: Node | null | Pair | undefined): number {
    const range = node === undefined || node === null ? undefined : nodeRange(node);
    return range === undefined ? 1 : context.source.lineAt(range[0]);
}

function nodeRange(node: Node | Pair): [number, number, number] | undefined {
    if ('range' in node && Array.isArray(node.range)) {
        return node.range;
    }
    const { key } = node as Pair;
    return key !== null && typeof key === 'object' && 'range' in key
        ? ((key as Node).range ?? undefined)
        : undefined;
}

function contentLine(context: Context, node: Node | null): number {
    const start = lineOf(context, node);
    return isScalar(node) && String(node.type ?? '').startsWith('BLOCK') ? start + 1 : start;
}

function requireMap(context: Context, node: Node | null, what: string): YAMLMap {
    if (!isMap(node)) {
        fail(context, node ?? undefined, `${what} must be a mapping of keys to values`);
    }
    return node;
}

function closedPairs(
    context: Context,
    map: YAMLMap,
    allowed: readonly string[],
    what: string,
): Pair<Node, Node>[] {
    const pairs: Pair<Node, Node>[] = [];
    for (const pair of pairsIn(map)) {
        const key = scalarString(pair.key);
        if (key === null) {
            fail(context, pair, `${what}: a key must be a plain word`);
        }
        if (!allowed.includes(key)) {
            fail(
                context,
                pair,
                `unknown key "${key}:" in ${what} — known keys: ${allowed.join(', ')}`,
            );
        }
        if (pairs.some((seen) => scalarString(seen.key) === key)) {
            fail(context, pair, `"${key}:" is declared twice in ${what}`);
        }
        pairs.push(pair);
    }
    return pairs;
}

/** The YAML library types pairs loosely: the one cast lives here. */
function pairsIn(map: YAMLMap): Pair<Node, Node>[] {
    return map.items as Pair<Node, Node>[];
}

function itemsIn(seq: YAMLSeq): Node[] {
    return seq.items as Node[];
}

function keyed(pairs: readonly Pair<Node, Node>[]): Map<string, Pair<Node, Node>> {
    return new Map(pairs.map((pair) => [scalarString(pair.key) ?? '', pair]));
}

function holdPresence(
    context: Context,
    found: ReadonlyMap<string, Pair<Node, Node>>,
    { line, shape, subject = '' }: { line: number; shape: PresenceShape; subject?: string },
): void {
    const at = (message: string, where = line): never => {
        throw new SpecSyntaxError(context.fileName, where, message);
    };
    for (const law of PRESENCE[shape]) {
        if (law.law === 'each') {
            const missing = law.keys.find((key) => !found.has(key));
            if (missing !== undefined) {
                at(law.refusal(subject, missing));
            }
        } else if (law.law === 'some') {
            if (!law.keys.some((key) => found.has(key))) {
                at(law.refusal(subject));
            }
        } else if (found.has(law.with)) {
            const beside = law.keys.find((key) => found.has(key));
            if (beside !== undefined) {
                at(law.refusal(subject, beside), lineOf(context, found.get(beside)));
            }
        }
    }
}

function held(found: ReadonlyMap<string, Pair<Node, Node>>, key: string): Pair<Node, Node> {
    const pair = found.get(key);
    if (pair === undefined) {
        throw new Error(`"${key}:" is required by a presence law and was not found`);
    }
    return pair;
}

function scalarString(node: unknown): null | string {
    return isScalar(node) && typeof node.value === 'string' ? node.value : null;
}

function requireString(context: Context, node: Node | null, what: string): string {
    const value = scalarString(node);
    if (value === null) {
        fail(context, node, `${what} must be text`);
    }
    return value;
}

function requireInteger(context: Context, node: Node | null, what: string): number {
    if (!isScalar(node) || typeof node.value !== 'number' || !Number.isInteger(node.value)) {
        fail(context, node, `${what} must be a literal integer`);
    }
    return node.value;
}

function stringList(
    context: Context,
    node: Node | null,
    what: string,
): { line: number; value: string }[] {
    if (isSeq(node)) {
        return itemsIn(node).map((item) => ({
            line: lineOf(context, item),
            value: requireString(context, item, `each entry of ${what}`),
        }));
    }
    return [{ line: lineOf(context, node), value: requireString(context, node, what) }];
}

function readStream(context: Context, node: Node | null, what: string): SpecStream {
    return { line: contentLine(context, node), text: requireString(context, node, what) };
}

function readEnv(context: Context, node: Node | null): SpecEnvToken[] {
    return stringList(context, node, 'env:').map(({ line, value }) => {
        const separator = value.indexOf('=');
        if (separator === -1) {
            return { kind: 'set', line, name: value } as const;
        }
        if (separator === 0) {
            throw new SpecSyntaxError(
                context.fileName,
                line,
                `env: "${value}" has no variable name before the "="`,
            );
        }
        return {
            key: value.slice(0, separator),
            kind: 'pair',
            line,
            value: value.slice(separator + 1),
        } as const;
    });
}

function readServeEntry(context: Context, node: Node | null): SpecServeEntry {
    const name = scalarString(node);
    if (name !== null) {
        return { env: {}, line: lineOf(context, node), name };
    }
    const map = requireMap(context, node, 'a serve: entry');
    if (map.items.length !== 1) {
        fail(context, node, 'a serve: entry names ONE server: `- <name>: { KEY: value }`');
    }
    const pair = map.items[0] as Pair<Node, Node>;
    const serverName = scalarString(pair.key);
    if (serverName === null) {
        fail(context, pair, 'a serve: entry must name its server with a plain word');
    }
    const env: Record<string, string> = {};
    const envMap = requireMap(context, pair.value, `serve: ${serverName}`);
    for (const entry of pairsIn(envMap)) {
        const key = scalarString(entry.key);
        if (key === null) {
            fail(context, entry, `serve: ${serverName} — a variable name must be a plain word`);
        }
        env[key] = requireString(context, entry.value, `serve: ${serverName}.${key}`);
    }
    return { env, line: lineOf(context, pair), name: serverName };
}

function readServe(context: Context, node: Node | null): SpecServeEntry[] {
    const items: (Node | null)[] = isSeq(node) ? itemsIn(node) : [node];
    return items.map((item) => readServeEntry(context, item));
}

function readFiles(context: Context, node: Node | null): SpecFileAssertion[] {
    const map = requireMap(context, node, 'files:');
    return pairsIn(map).map((pair) => {
        const path = scalarString(pair.key);
        if (path === null) {
            fail(context, pair, 'files: each key is a path relative to the working directory');
        }
        const line = lineOf(context, pair);
        const state = scalarString(pair.value);
        if (state !== null) {
            if (!FILE_STATES.includes(state as (typeof FILE_STATES)[number])) {
                fail(
                    context,
                    pair,
                    `files: "${path}: ${state}" is not a state — write ${FILE_STATES.join(' or ')}, or a { ${FILE_CONTENT_KEYS.join(', ')} } assertion`,
                );
            }
            return { kind: state as 'absent' | 'exists', line, path };
        }
        const assertion = requireMap(context, pair.value, `files: ${path}`);
        const pairs = closedPairs(context, assertion, FILE_CONTENT_KEYS, `files: ${path}`);
        holdPresence(context, keyed(pairs), { line, shape: 'files', subject: path });
        const contains: SpecStream[] = [];
        let equals: null | SpecStream = null;
        for (const entry of pairs) {
            if (scalarString(entry.key) === 'contains') {
                if (isSeq(entry.value)) {
                    for (const item of itemsIn(entry.value)) {
                        contains.push(readStream(context, item, `files: ${path}.contains`));
                    }
                } else {
                    contains.push(readStream(context, entry.value, `files: ${path}.contains`));
                }
                continue;
            }
            equals = readStream(context, entry.value, `files: ${path}.equals`);
        }
        return { contains, equals, kind: 'content', line, path };
    });
}

function readRun(context: Context, node: Node | null, isLast: boolean): SpecRun {
    const map = requireMap(context, node, 'each entry of runs:');
    const found = keyed(closedPairs(context, map, RUN_KEYS, 'a run'));
    holdPresence(context, found, { line: lineOf(context, node), shape: 'run' });

    const commandPair = found.get('command')!;
    const command = requireString(context, commandPair.value, 'command:');
    const waitForPair = found.get('waitFor');
    if (waitForPair !== undefined && !isLast) {
        fail(
            context,
            waitForPair,
            'waitFor: is only allowed on the LAST run — a long-running command ends the session',
        );
    }

    const stdout = found.get('stdout');
    const stderr = found.get('stderr');
    const stdin = found.get('stdin');
    const timeout = found.get('timeout');
    const files = found.get('files');
    return {
        command,
        commandLine: lineOf(context, commandPair),
        exitCode: requireInteger(context, found.get('exit')!.value, 'exit:'),
        files: files === undefined ? [] : readFiles(context, files.value),
        stderr: stderr === undefined ? null : readStream(context, stderr.value, 'stderr:'),
        stdin: stdin === undefined ? null : requireString(context, stdin.value, 'stdin:'),
        stdout: stdout === undefined ? null : readStream(context, stdout.value, 'stdout:'),
        timeout: timeout === undefined ? null : requireInteger(context, timeout.value, 'timeout:'),
        waitFor:
            waitForPair === undefined
                ? null
                : requireString(context, waitForPair.value, 'waitFor:'),
    };
}

function groundOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundFolder(segment));
}

type PathRole = {
    directories: boolean;
    extensions: readonly string[];
    folder: string;
    key: string;
};

function readPath(context: Context, line: number, value: string, role: PathRole): SpecPath {
    const at = (message: string): never => {
        throw new SpecSyntaxError(context.fileName, line, message);
    };
    if (!isRelativePath(value)) {
        at(
            `${role.key}: "${value}" is not a relative path — name it from this document (./… or ../…)`,
        );
    }
    if (value.endsWith('/') && !role.directories) {
        at(`${role.key}: "${value}" names a directory — ${role.key}: reads one file`);
    }
    const found = groundOf(value);
    if (found !== role.folder) {
        const where = `./${role.folder}/ beside the document, or in the ${role.folder}/ of the lowest folder the leaves share (specs/_shared/${role.folder}/ across facets)`;
        at(
            `${role.key}: reads ${role.folder}/, and "${value}" names ${found === undefined ? `no ${role.folder}/ folder` : `${found}/`} — put the file in ${where} (verb-reads-its-ground-folder)`,
        );
    }
    if (
        role.extensions.length > 0 &&
        !role.extensions.some((extension) => value.endsWith(extension))
    ) {
        at(`${role.key}: "${value}" is not a ${role.extensions.join(' or ')} file`);
    }
    return { line, path: value };
}

function readPaths(context: Context, node: Node | null, role: PathRole): SpecPath[] {
    return stringList(context, node, `${role.key}:`).map(({ line, value }) =>
        readPath(context, line, value, role),
    );
}

const FIXTURE_ROLE: PathRole = {
    directories: true,
    extensions: [],
    folder: GROUND_FIXTURES,
    key: 'fixture',
};
function readFixtures(context: Context, node: Node | null): SpecFixture[] {
    return readPaths(context, node, FIXTURE_ROLE);
}

/** `fileName` is used verbatim in refusals. Update mode rewrites the returned YAML source, never a re-serialisation. */
export function readSpecFile(content: string, fileName: string): SpecFile {
    const source = parseYamlSource(content);
    const [syntax] = yamlSyntaxErrors(source);
    if (syntax !== undefined) {
        throw new SpecSyntaxError(fileName, syntax.line, syntax.message);
    }
    const context: Context = { fileName, source };
    const root = source.document.contents;
    if (root === null || (isScalar(root) && root.value === null)) {
        throw new SpecSyntaxError(fileName, 1, 'the document is empty');
    }
    const map = requireMap(context, root, 'a spec document');
    const found = keyed(closedPairs(context, map, DOCUMENT_KEYS, 'a spec document'));
    holdPresence(context, found, { line: lineOf(context, map), shape: 'document' });
    const document: SpecDocument = {
        description: requireString(context, held(found, 'description').value, 'description:'),
        descriptionLine: lineOf(context, found.get('description')),
        ...readCliFields(context, found),
    };
    return { document, source };
}

function readCliFields(
    context: Context,
    found: ReadonlyMap<string, Pair<Node, Node>>,
): Pick<SpecDocument, 'env' | 'fixtures' | 'runs' | 'serve'> {
    const runsNode = held(found, 'runs');
    if (!isSeq(runsNode.value) || runsNode.value.items.length === 0) {
        fail(context, runsNode, 'runs: is a list of at least one run');
    }
    const runItems = itemsIn(runsNode.value);
    const fixturePair = found.get('fixture');
    const envPair = found.get('env');
    const servePair = found.get('serve');
    return {
        env: envPair === undefined ? [] : readEnv(context, envPair.value),
        fixtures: fixturePair === undefined ? [] : readFixtures(context, fixturePair.value),
        runs: runItems.map((item, index) => readRun(context, item, index === runItems.length - 1)),
        serve: servePair === undefined ? [] : readServe(context, servePair.value),
    };
}

/** `stdin:` is an input and a description or command is prose: none appears here. */
export function assertedStreams(document: SpecDocument): SpecStream[] {
    const streams: SpecStream[] = [];
    for (const run of document.runs) {
        if (run.stdout !== null) {
            streams.push(run.stdout);
        }
        if (run.stderr !== null) {
            streams.push(run.stderr);
        }
        for (const assertion of run.files) {
            if (assertion.kind !== 'content') {
                continue;
            }
            streams.push(...assertion.contains);
            if (assertion.equals !== null) {
                streams.push(assertion.equals);
            }
        }
    }
    return streams;
}

export type DocumentPath = {
    key: 'fixture';
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

export function documentPaths(document: SpecDocument): DocumentPath[] {
    return document.fixtures.map(({ line, path }) => ({
        key: 'fixture',
        kind: path.endsWith('/') ? 'directory' : 'file',
        line,
        path,
    }));
}

export function parseSpecDocument(content: string, fileName: string): SpecDocument {
    return readSpecFile(content, fileName).document;
}

function setOrdered(map: YAMLMap, key: string, value: unknown, order: readonly string[]): void {
    const items = map.items as Pair<Node, Node>[];
    const existing = items.findIndex((pair) => scalarString(pair.key) === key);
    if (existing !== -1) {
        map.set(key, value);
        return;
    }
    const rank = order.indexOf(key);
    const at = items.findIndex((pair) => {
        const seen = scalarString(pair.key);
        return seen !== null && order.indexOf(seen) > rank;
    });
    map.set(key, value);
    if (at !== -1) {
        // invariant: `set` appended: move the new pair to its canonical place.
        const added = (map.items as Pair<Node, Node>[]).pop()!;
        map.items.splice(at, 0, added);
    }
}

/** The YAML document is edited, not re-emitted, so everything but exit codes and streams comes back byte-identical. */
export function updateSpecFile(file: SpecFile, updates: SpecRunUpdate[]): string {
    const runs = (file.source.document.contents as YAMLMap).get('runs', true);
    if (!isSeq(runs)) {
        return renderYamlSource(file.source);
    }
    for (const [index, update] of updates.entries()) {
        const run = runs.items[index];
        if (!isMap(run)) {
            continue;
        }
        setOrdered(run, 'exit', update.exitCode, RUN_KEYS);
        for (const [key, text] of [
            ['stdout', update.stdout],
            ['stderr', update.stderr],
        ] as const) {
            if (text.length === 0) {
                run.delete(key);
                continue;
            }
            setOrdered(run, key, blockScalar(text), RUN_KEYS);
        }
    }
    return renderYamlSource(file.source);
}

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
            description: 'The vitest test title — one lowercase line, no trailing period.',
            type: 'string',
        },
        env: {
            ...STRING_OR_LIST,
            description:
                'A bare word names an env set registered in code; KEY=value is inline. $WORKDIR expands.',
        },
        fixture: {
            description:
                "Fixture paths copied into the working directory, layering in order — each relative to this document (`./…`, `../…`), in the two forms the chain's `file()` and `directory()` take: a trailing `/` names a directory whose contents are spread, without it one file is copied under its own name. The first ground folder a path passes through is _fixtures/ — ./_fixtures/ beside the document, or specs/_shared/_fixtures/ reached by the path that climbs to it.",
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
