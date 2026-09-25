import {
    blockScalar,
    isMap,
    isScalar,
    isSeq,
    parseYamlSource,
    renderYamlSource,
    yamlSyntaxErrors,
} from '../../seams/yaml/document.js';
import type { Node, Pair, YAMLMap, YAMLSeq, YamlSource } from '../../seams/yaml/document.js';
import { GROUND_DIRS, GROUND_FIXTURES, isGroundName } from '../chain/ground.js';
import { isRelativePath } from '../chain/spec-path.js';

/**
 * The `<case>.spec.yaml` document — one scenario, written as data.
 *
 * A spec document states the ground a session stands on (`fixture:`, `env:`,
 * `serve:`) and then the session itself (`runs:`), each run carrying its
 * command, its exit code, its streams and what it left on disk:
 *
 *     description: removes a post and names what is gone
 *     fixture: ../../shared/fixtures/posts-stub/
 *     env:
 *       - frozen
 *     runs:
 *       - command: posts rm post-recap --yes
 *         exit: 0
 *         stdout: |
 *           Removed post-recap.
 *
 * A document is a cli case alone: an api or a job case is a TypeScript spec,
 * its whole result written in place.
 *
 * This module owns the grammar and NOTHING else: it resolves no path, runs no
 * command, and knows no filesystem. It is read by the runner and by the lint
 * checker alike, so the document the lint accepts is exactly the document the
 * runner executes. The JSON Schema editors validate against is built from the
 * same constants, a few lines down — one vocabulary, three readers.
 */

// ── Grammar ──

/** The extension that makes a file a spec document. */
export const SPEC_EXTENSION = '.spec.yaml';

/**
 * The keys of a document, IN THE ORDER it is written in: what the case stands
 * on first, then what it does. The order is the canonical one the
 * `d4b-spec-key-order` lint pass enforces and rewrites.
 */
export const DOCUMENT_KEYS = ['description', 'fixture', 'env', 'serve', 'runs'] as const;

export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

/** The keys of one run, in the canonical order: what is given, then what came back. */
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

/** The keys of a `files:` content assertion. */
export const FILE_CONTENT_KEYS = ['contains', 'equals'] as const;

/** The bare states a `files:` entry may name instead of a content assertion. */
export const FILE_STATES = ['absent', 'exists'] as const;

/** The stream keys — the three block scalars an author writes as text. */
export const STREAM_KEYS = ['stdin', 'stdout', 'stderr'] as const;

// ── Presence ──

/**
 * A law on which keys a mapping of the grammar holds, read by BOTH readers:
 * the parser refuses a mapping that breaks one with its sentence, and the
 * schema states it — `each` as `required`, `some` as an `anyOf` of them,
 * `apart` as a `not` of the pair — so an editor refuses what the runner does.
 * `subject` is what the refusal names the mapping by: a table's name, a
 * `files:` path; `key` is the key missing, or the one that may not stand
 * beside `with`.
 */
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

/** The mappings a presence law governs: a document, a run, and a `files:` assertion. */
export type PresenceShape = 'document' | 'files' | 'run';

/** Every presence law of the grammar, per shape, in the order the parser checks them. */
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

// ── Types ──

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
    /** Only ever on the LAST run — a long-running command ends the session. */
    waitFor: null | string;
};

/** A path a document names, with the line it names it on. */
export type SpecPath = {
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

/** A document plus the YAML source it was read from — what update mode rewrites. */
export type SpecFile = {
    document: SpecDocument;
    source: YamlSource;
};

/** The three fields update mode refreshes on one run. */
export type SpecRunUpdate = {
    exitCode: number;
    stderr: string;
    stdout: string;
};

// ── Refusals ──

/** A refusal from the grammar, carrying the line it happened on. */
export class SpecSyntaxError extends Error {
    readonly line: number;
    /** The refusal alone, without the position the message leads with. */
    readonly reason: string;

    constructor(fileName: string, line: number, message: string) {
        super(`${fileName}:${line}: ${message}`);
        this.line = line;
        this.reason = message;
        this.name = 'SpecSyntaxError';
    }
}

// ── Reading ──

/** The reading context threaded through the walk: where we are, and what to call it. */
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

/** The line a scalar's CONTENT starts on — one past the `|` for a block scalar. */
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

/** The pairs of a mapping, refusing any key outside the closed set. */
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

/** The pairs of a mapping — the YAML library types them loosely, so the one cast lives here. */
function pairsIn(map: YAMLMap): Pair<Node, Node>[] {
    return map.items as Pair<Node, Node>[];
}

/** The items of a sequence — the one cast, as for {@link pairsIn}. */
function itemsIn(seq: YAMLSeq): Node[] {
    return seq.items as Node[];
}

/** Pairs keyed by the plain word each is written under. */
function keyed(pairs: readonly Pair<Node, Node>[]): Map<string, Pair<Node, Node>> {
    return new Map(pairs.map((pair) => [scalarString(pair.key) ?? '', pair]));
}

/**
 * Refuse a mapping that breaks a presence law of its shape — at `line`, the
 * mapping's, for a key it lacks; at the pair, for a key that may not stand
 * where it does.
 */
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

/** A pair a presence law has already required of `found`. */
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

/** A `string | list of strings` field, flattened to its entries with their lines. */
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

// ── Fields ──

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

// ── Paths ──

/** The first ground folder a path passes through, if any — C24's reading. */
function groundOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundName(segment));
}

/** Where a path key reads, and what it may name there. */
type PathRole = {
    /** May the path name a directory — a trailing `/`? Only `fixture:` spreads one. */
    directories: boolean;
    /** The extensions the file may carry; empty takes any. */
    extensions: readonly string[];
    /** The ground folder the key reads. */
    folder: string;
    key: string;
};

/**
 * A path a key names, judged by the same law as the chain's `file()` and
 * `directory()`: relative to this document, one file — a directory only where
 * the key spreads one — in the folder its key reads, the first ground folder
 * the path passes through (C24); a stub module under `stubs/`, which
 * is no ground.
 */
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
        const where = `./${role.folder}/ beside the document, or in specs/shared/${role.folder}/ if several leaves share it`;
        at(
            `${role.key}: reads ${role.folder}/, and "${value}" names ${found === undefined ? `no ${role.folder}/ folder` : `${found}/`} — put the file in ${where} (C24)`,
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

/** A key holding one path or a list of them, each judged on its own line. */
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
/** `fixture:` — paths of file state, each judged by its first ground folder like every path key. */
function readFixtures(context: Context, node: Node | null): SpecFixture[] {
    return readPaths(context, node, FIXTURE_ROLE);
}

// ── Entry ──

/**
 * Read a `<case>.spec.yaml`. `fileName` is used verbatim in refusals, so pass
 * the path a reader would open. The YAML source comes back beside the document:
 * update mode rewrites THAT, never a re-serialisation of this structure.
 */
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

/** What a cli document says: its session, run after run. */
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

/**
 * Every text of a document the `{{token}}` grammar governs: the streams a
 * comparison judges, and the `files:` texts it judges them with. `stdin:` is
 * an INPUT — like a fixture, never matched — and a description or a command
 * is prose, so none of them appears here.
 */
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

/** One path a document names — the entry the path passes read it through. */
export type DocumentPath = {
    /** The key that names it — the role C24 read it for. */
    key: 'fixture';
    /** What the path names: a `fixture:` with a trailing `/` spreads a directory, every other key one file. */
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

/**
 * Every path a document names, in the order it names them — what the checker's
 * existence (C8), locality (C15) and liveness (C9, C14) passes read, exactly as
 * they read a `file()` or a `directory()`.
 */
export function documentPaths(document: SpecDocument): DocumentPath[] {
    return document.fixtures.map(({ line, path }) => ({
        key: 'fixture',
        kind: path.endsWith('/') ? 'directory' : 'file',
        line,
        path,
    }));
}

/** Read a `<case>.spec.yaml` for its content alone — the shape passes and C9's scan. */
export function parseSpecDocument(content: string, fileName: string): SpecDocument {
    return readSpecFile(content, fileName).document;
}

// ── Update ──

/** Insert (or replace) a key at its canonical position in a mapping. */
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
        // `set` appended; move the new pair to where the canonical order puts it.
        const added = (map.items as Pair<Node, Node>[]).pop()!;
        map.items.splice(at, 0, added);
    }
}

/**
 * Rewrite the runs of a spec file from what the commands actually did — exit
 * code and both streams, and nothing else. `files:`, the commands and the
 * header come back byte-identical, comments and key order included, because
 * the YAML DOCUMENT is edited rather than re-emitted from the parsed shape.
 *
 * An empty stream removes its key: absence already asserts emptiness, so a
 * rewritten document says the same thing in fewer words and still passes.
 */
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

// ── Schema ──

const STRING_OR_LIST = {
    oneOf: [{ type: 'string' }, { items: { type: 'string' }, minItems: 1, type: 'array' }],
};

/** A folder segment that is not ground — what a path may pass through before the folder it reads. */
const NOT_GROUND_SEGMENT = String.raw`(?!(?:${GROUND_DIRS.join('|')})/)[^/]+/`;

/**
 * A relative path whose FIRST ground folder is `fixtures/`, as a pattern — C24's
 * reading, for an editor. It may end on the folder: `fixture:` spreads a
 * directory whole.
 */
function fixturePath(): SchemaNode {
    return {
        pattern: String.raw`^\.\.?/(?:${NOT_GROUND_SEGMENT})*?${GROUND_FIXTURES}/.*$`,
        type: 'string',
    };
}

/** One path, or a list of them. */
function oneOrMany(item: SchemaNode): SchemaNode {
    return { oneOf: [item, { items: item, minItems: 1, type: 'array' }] };
}

/** The presence laws of a shape, as JSON Schema states them — {@link PRESENCE}'s, never restated. */
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

/**
 * The JSON Schema editors validate a `<case>.spec.yaml` against, built from the
 * constants above so it cannot describe a grammar the parser does not read. It
 * is committed as `schema/spec.schema.json` by `npm run docs` and published as
 * the `@jterrazz/test/schema` export.
 *
 * A schema states which keys exist, not which ORDER they come in — JSON Schema
 * has no vocabulary for the sequence of an object's members. The canonical
 * order is the `d4b-spec-key-order` lint pass's, which also rewrites it.
 */
/**
 * A JSON Schema subtree — the vocabulary is JSON Schema's, not this package's,
 * so the shape is stated only where a reader of {@link SPEC_SCHEMA} navigates it.
 */
type SchemaNode = Record<string, unknown>;

/** The document schema, as far as its own freshness test walks it. */
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
                "Fixture paths copied into the working directory, layering in order — each relative to this document (`./…`, `../…`), in the two forms the chain's `file()` and `directory()` take: a trailing `/` names a directory whose contents are spread, without it one file is copied under its own name. The first ground folder a path passes through is fixtures/ — ./fixtures/ beside the document, or specs/shared/fixtures/ reached by the path that climbs to it.",
            ...oneOrMany(fixturePath()),
        },
        runs: {
            // Only the last run may wait; no keyword addresses the last item, so the schema holds that one run at most does.
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

/** {@link SPEC_SCHEMA} in the exact form `schema/spec.schema.json` is committed in. */
export function renderSchema(): string {
    return `${JSON.stringify(SPEC_SCHEMA, null, 4)}\n`;
}
