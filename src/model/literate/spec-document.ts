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
import {
    GROUND_DIRS,
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundName,
} from '../chain/ground.js';
import { isRelativePath } from '../chain/spec-path.js';
import { TOKEN_KINDS } from '../matching/match.js';

/**
 * The `<case>.spec.yaml` document — one scenario, written as data.
 *
 * A spec document states the ground a session stands on (`fixture:`, `env:`,
 * `serve:`) and then the session itself (`runs:`), each run carrying its
 * command, its exit code, its streams and what it left on disk:
 *
 *     description: removes a post and names what is gone
 *     fixture: ../../fixtures/posts-stub/
 *     env:
 *       - frozen
 *     runs:
 *       - command: posts rm post-recap --yes
 *         exit: 0
 *         stdout: |
 *           Removed post-recap.
 *
 * An api or jobs document states the same thing in its facet's words: the
 * ground (`seed:`, `intercept:`, `clock:`, `headers:`), the action (`request:`,
 * or `trigger:`) and what came back (`response:`, `error:`, `tables:`) — one
 * file, one test, and a journey is `steps:` whose named captures later steps
 * send:
 *
 *     kind: api
 *     description: an order created is the order read back
 *     seed: ./seeds/one-customer.sql
 *     steps:
 *       - request: POST /orders
 *         body: { item: book }
 *         capture:
 *           orderId: $.id
 *         response: ./expected/order-created.http
 *       - request: GET /orders/{{orderId}}
 *         response: { status: 200 }
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

/** The facets a document may describe — each one's runner reads the kind it is exported as. */
export const SPEC_KINDS = ['cli', 'api', 'jobs'] as const;

/**
 * Top-level keys of every kind, IN THE ORDER a document is written in: what the
 * case stands on first, then what it does, then what came back. The order is
 * the canonical one the `d4b-spec-key-order` lint pass enforces and rewrites;
 * which of them a kind takes is {@link KIND_KEYS}'s.
 */
export const DOCUMENT_KEYS = [
    'kind',
    'description',
    'fixture',
    'env',
    'serve',
    'seed',
    'intercept',
    'clock',
    'headers',
    'runs',
    'trigger',
    'request',
    'body',
    'response',
    'error',
    'tables',
    'steps',
] as const;

export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

/**
 * The keys each kind reads, a closed set per facet. A key of another kind is
 * refused naming the kind it belongs to: `fixture:` lays files into a working
 * directory, and neither an api nor a jobs chain has one.
 */
export const KIND_KEYS: Readonly<Record<SpecKind, readonly DocumentKey[]>> = {
    api: [
        'kind',
        'description',
        'seed',
        'intercept',
        'clock',
        'headers',
        'request',
        'body',
        'response',
        'tables',
        'steps',
    ],
    cli: ['kind', 'description', 'fixture', 'env', 'serve', 'runs'],
    jobs: ['kind', 'description', 'seed', 'intercept', 'clock', 'trigger', 'error', 'tables'],
};

/** The keys of one api step, in the canonical order: what is sent, then what came back. */
export const STEP_KEYS = ['request', 'headers', 'body', 'capture', 'response', 'tables'] as const;

/** The keys of an inline `response:` — the three parts of a `.http` golden. */
export const RESPONSE_KEYS = ['status', 'headers', 'body'] as const;

/** The keys of one `tables:` entry — what `toMatchRows()` takes, and the database it reads. */
export const TABLE_KEYS = ['database', 'columns', 'rows'] as const;

/** The keys of a `seed:` entry that names its database. */
export const SEED_KEYS = ['file', 'database'] as const;

/** The methods an inline `request:` line may name. */
export const REQUEST_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
] as const;

/** Where a module a document intercepts with sits — TypeScript a spec imports, never ground. */
export const CONTRACTS_FOLDER = 'contracts';

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

/** The mappings a presence law governs: a document of any kind, one kind's, and the entries inside. */
export type PresenceShape =
    | 'api'
    | 'cli'
    | 'document'
    | 'files'
    | 'jobs'
    | 'response'
    | 'run'
    | 'seed'
    | 'step'
    | 'table';

/** Every presence law of the grammar, per shape, in the order the parser checks them. */
export const PRESENCE: Readonly<Record<PresenceShape, readonly PresenceLaw[]>> = {
    api: [
        {
            keys: ['request', 'steps'],
            law: 'some',
            refusal: () => 'an api document sends a request: — or states its journey as steps:',
        },
        {
            keys: ['request', 'body', 'response', 'tables'],
            law: 'apart',
            refusal: (_subject, key) =>
                `"${key}:" belongs to a step when the document states steps: — one test is one shape`,
            with: 'steps',
        },
    ],
    cli: [
        {
            keys: ['runs'],
            law: 'each',
            refusal: () => 'missing "runs:" — description and runs are mandatory',
        },
    ],
    document: [
        {
            keys: ['description'],
            law: 'each',
            refusal: () =>
                'missing "description:" — every document is one test, and this is its title',
        },
    ],
    files: [
        {
            keys: FILE_CONTENT_KEYS,
            law: 'some',
            refusal: (path) => `files: ${path} asserts nothing — give it contains: or equals:`,
        },
    ],
    jobs: [
        {
            keys: ['trigger'],
            law: 'each',
            refusal: () => 'a jobs document names the job it runs — trigger: <name>',
        },
        {
            keys: ['tables', 'error'],
            law: 'some',
            refusal: () =>
                'a jobs document asserts what the job did — give it tables:, error:, or both',
        },
    ],
    response: [
        {
            keys: RESPONSE_KEYS,
            law: 'some',
            refusal: () =>
                `response: asserts nothing — give it ${RESPONSE_KEYS.join(', ')}, or name its ./expected/<name>.http`,
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
    seed: [
        {
            keys: ['file'],
            law: 'each',
            refusal: () =>
                'a seed: entry names its file — `{ file: ./seeds/<name>.sql, database: <key> }`',
        },
    ],
    step: [
        {
            keys: ['request'],
            law: 'each',
            refusal: () => 'a step states its request: — a path under requests/, or METHOD /path',
        },
        {
            keys: ['response', 'tables'],
            law: 'some',
            refusal: () => 'a step asserts what came back — give it response:, tables:, or both',
        },
    ],
    table: [
        {
            keys: ['columns', 'rows'],
            law: 'each',
            refusal: (name) =>
                `tables: ${name} states its columns: and its rows: — [] asserts an empty table`,
        },
    ],
};

// ── Types ──

export type SpecKind = (typeof SPEC_KINDS)[number];

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

/** A path a document names, with the line it names it on — every path key reads as one. */
export type SpecPath = {
    line: number;
    path: string;
};

/** One `seed:` entry: a `.sql` file, and the database it targets when several are declared. */
export type SpecSeed = SpecPath & {
    database: null | string;
};

/** What a step sends: a `./requests/*.http` whole, or an inline `METHOD /path` line. */
export type SpecRequest =
    | { kind: 'file'; line: number; path: string }
    | { kind: 'inline'; line: number; method: string; target: string };

/** A body sent with an inline request: a file under `requests/`, or a value written inline. */
export type SpecBody =
    | { kind: 'file'; line: number; path: string }
    | { kind: 'value'; line: number; value: unknown };

/**
 * What a step expects back: a `./expected/*.http` golden, or the same three
 * parts written inline — status, a subset of headers, the body — each
 * token-aware. `texts` are the inline strings the `{{token}}` grammar governs.
 */
export type SpecResponse =
    | {
          body: null | { value: unknown };
          headers: Record<string, string>;
          kind: 'inline';
          line: number;
          status: null | number | string;
          texts: SpecStream[];
      }
    | { kind: 'file'; line: number; path: string };

/** One `tables:` entry — the rows a table must hold after the action, in order. */
export type SpecTable = {
    columns: string[];
    database: null | string;
    line: number;
    name: string;
    rows: unknown[][];
    /** The string cells, token-aware like any expected text. */
    texts: SpecStream[];
};

/** One named capture: a value read from a response body, sent by a later step as `{{name}}`. */
export type SpecCapture = {
    line: number;
    name: string;
    /** The JSONPath as written — `$.id`, `$.items[0].name`, `$['a key']`. */
    path: string;
    /** The path, read: a key or an index per segment below the root. */
    segments: (number | string)[];
};

/** One api step: a request, and what came back from it. */
export type SpecStep = {
    body: null | SpecBody;
    capture: SpecCapture[];
    headers: Record<string, string>;
    /** 1-based line the step starts on — the frame a failure points at. */
    line: number;
    request: SpecRequest;
    response: null | SpecResponse;
    tables: SpecTable[];
};

/** A parsed `<case>.spec.yaml`. Each kind fills its own keys; the others stay empty. */
export type SpecDocument = {
    clock: null | { iso: string; line: number };
    /** The vitest test title. */
    description: string;
    /** 1-based line of the `description:` key. */
    descriptionLine: number;
    env: SpecEnvToken[];
    /** The rejection a triggered job must end on — `null` asserts it succeeded. */
    error: null | SpecStream;
    fixtures: SpecFixture[];
    /** The headers every request of an api document carries. */
    headers: Record<string, string>;
    intercepts: SpecPath[];
    kind: SpecKind;
    runs: SpecRun[];
    seeds: SpecSeed[];
    serve: SpecServeEntry[];
    /** An api document's requests — the top-level request is its one step. */
    steps: SpecStep[];
    /** A jobs document's tables; an api step carries its own. */
    tables: SpecTable[];
    trigger: null | { line: number; name: string };
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

// ── Fields: api and jobs ──

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
    /** The folder the key reads — a ground name, or `contracts`. */
    folder: string;
    key: string;
};

/**
 * A path a key names, judged by the same law as the chain's `file()` and
 * `directory()`: relative to this document, one file — a directory only where
 * the key spreads one — in the folder its key reads, the first ground folder
 * the path passes through (C24); a contract module under `contracts/`, which
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
    const reaches =
        role.folder === CONTRACTS_FOLDER
            ? found === undefined && value.split('/').includes(CONTRACTS_FOLDER)
            : found === role.folder;
    if (!reaches) {
        const where =
            role.folder === CONTRACTS_FOLDER
                ? 'the folder its key reads'
                : `./${role.folder}/ beside the document, or in specs/${role.folder}/ if several leaves share it`;
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
const SEED_ROLE: PathRole = {
    directories: false,
    extensions: ['.sql'],
    folder: GROUND_SEEDS,
    key: 'seed',
};
const INTERCEPT_ROLE: PathRole = {
    directories: false,
    extensions: ['.ts', '.mts', '.js', '.mjs'],
    folder: CONTRACTS_FOLDER,
    key: 'intercept',
};
const REQUEST_ROLE: PathRole = {
    directories: false,
    extensions: ['.http'],
    folder: GROUND_REQUESTS,
    key: 'request',
};
const BODY_ROLE: PathRole = {
    directories: false,
    extensions: [],
    folder: GROUND_REQUESTS,
    key: 'body',
};
const RESPONSE_ROLE: PathRole = {
    directories: false,
    extensions: ['.http'],
    folder: GROUND_EXPECTED,
    key: 'response',
};

/** `fixture:` — paths of file state, each judged by its first ground folder like every path key. */
function readFixtures(context: Context, node: Node | null): SpecFixture[] {
    return readPaths(context, node, FIXTURE_ROLE);
}

/** One seed: its path, and the database it targets. */
function seedAt({ line, path }: SpecPath, database: null | string): SpecSeed {
    return { database, line, path };
}

/** `seed:` — a path, or `{ file, database }`, or a list of either, applied in order. */
function readSeeds(context: Context, node: Node | null): SpecSeed[] {
    const items: (Node | null)[] = isSeq(node) ? itemsIn(node) : [node];
    return items.map((item) => {
        const line = lineOf(context, item);
        const path = scalarString(item);
        if (path !== null) {
            return seedAt(readPath(context, line, path, SEED_ROLE), null);
        }
        const map = requireMap(context, item, 'a seed: entry');
        const found = keyed(closedPairs(context, map, SEED_KEYS, 'a seed: entry'));
        holdPresence(context, found, { line, shape: 'seed' });
        const file = held(found, 'file');
        const database = found.get('database');
        return seedAt(
            readPath(
                context,
                lineOf(context, file),
                requireString(context, file.value, 'seed: file'),
                SEED_ROLE,
            ),
            database === undefined
                ? null
                : requireString(context, database.value, 'seed: database'),
        );
    });
}

/** `clock:` — the ISO instant the chain's `.clock()` pins. */
function readClock(context: Context, node: Node | null): { iso: string; line: number } {
    const iso = requireString(context, node, 'clock:');
    if (!/^\d{4}-\d{2}-\d{2}T/u.test(iso) || Number.isNaN(Date.parse(iso))) {
        fail(context, node, `clock: "${iso}" is not an ISO instant — write 2026-03-04T09:30:00Z`);
    }
    return { iso, line: lineOf(context, node) };
}

/** A `headers:` mapping, name to text. */
function readHeaders(context: Context, node: Node | null, what: string): Record<string, string> {
    const map = requireMap(context, node, what);
    const headers: Record<string, string> = {};
    for (const pair of pairsIn(map)) {
        const name = scalarString(pair.key);
        if (name === null) {
            fail(context, pair, `${what} — a header name must be a plain word`);
        }
        const { value } = pair;
        headers[name] =
            isScalar(value) && (typeof value.value === 'number' || typeof value.value === 'boolean')
                ? String(value.value)
                : requireString(context, value, `${what} ${name}`);
    }
    return headers;
}

/** The value a YAML node holds, as JSON reads it. */
function valueOf(node: Node | null): unknown {
    if (node === null) {
        return null;
    }
    return isScalar(node) ? node.value : node.toJSON();
}

/** Every string scalar under a node, each with the line it is written on. */
function textsOf(context: Context, node: Node | null): SpecStream[] {
    if (isScalar(node)) {
        return typeof node.value === 'string' ? [readStream(context, node, 'a value')] : [];
    }
    if (isSeq(node)) {
        return itemsIn(node).flatMap((item) => textsOf(context, item));
    }
    if (isMap(node)) {
        return pairsIn(node).flatMap((pair) => textsOf(context, pair.value));
    }
    return [];
}

/** `request:` — a `./requests/*.http` path, or an inline `METHOD /path` line. */
function readRequest(context: Context, node: Node | null): SpecRequest {
    const value = requireString(context, node, 'request:');
    const line = lineOf(context, node);
    if (isRelativePath(value)) {
        return { kind: 'file', ...readPath(context, line, value, REQUEST_ROLE) };
    }
    const match = /^(?<method>[A-Z]+) (?<target>\/\S*)$/u.exec(value);
    const method = match?.groups?.method;
    const target = match?.groups?.target;
    if (
        method === undefined ||
        target === undefined ||
        !(REQUEST_METHODS as readonly string[]).includes(method)
    ) {
        fail(
            context,
            node,
            `request: "${value}" is neither a path (./requests/<name>.http) nor a request line (${REQUEST_METHODS.join('|')} /path)`,
        );
    }
    return { kind: 'inline', line, method, target };
}

/** `body:` — a file under `requests/`, named by its path, or the value itself. */
function readBody(context: Context, node: Node | null): SpecBody {
    const line = lineOf(context, node);
    const text = scalarString(node);
    if (text !== null && isRelativePath(text)) {
        return { kind: 'file', ...readPath(context, line, text, BODY_ROLE) };
    }
    return { kind: 'value', line, value: valueOf(node) };
}

/** `response:` — a `./expected/*.http` golden, or its three parts written inline. */
function readResponse(context: Context, node: Node | null): SpecResponse {
    const line = lineOf(context, node);
    const path = scalarString(node);
    if (path !== null) {
        return { kind: 'file', ...readPath(context, line, path, RESPONSE_ROLE) };
    }
    const map = requireMap(context, node, 'response:');
    const found = keyed(closedPairs(context, map, RESPONSE_KEYS, 'an inline response'));
    holdPresence(context, found, { line, shape: 'response' });
    const status = found.get('status');
    const headers = found.get('headers');
    const body = found.get('body');
    const texts: SpecStream[] = [];
    let statusValue: null | number | string = null;
    if (status !== undefined) {
        const { value } = status;
        if (isScalar(value) && typeof value.value === 'number' && Number.isInteger(value.value)) {
            statusValue = value.value;
        } else {
            statusValue = requireString(context, value, 'response: status');
            texts.push(readStream(context, value, 'response: status'));
        }
    }
    if (headers !== undefined) {
        texts.push(...textsOf(context, headers.value));
    }
    if (body !== undefined) {
        texts.push(...textsOf(context, body.value));
    }
    return {
        body: body === undefined ? null : { value: valueOf(body.value) },
        headers:
            headers === undefined ? {} : readHeaders(context, headers.value, 'response: headers'),
        kind: 'inline',
        line,
        status: statusValue,
        texts,
    };
}

/** `tables:` — table name to the rows it must hold, what `toMatchRows()` takes. */
function readTables(context: Context, node: Node | null): SpecTable[] {
    const map = requireMap(context, node, 'tables:');
    return pairsIn(map).map((pair) => {
        const name = scalarString(pair.key);
        if (name === null) {
            fail(context, pair, 'tables: each key is the name of a table');
        }
        const entry = requireMap(context, pair.value, `tables: ${name}`);
        const found = keyed(closedPairs(context, entry, TABLE_KEYS, `tables: ${name}`));
        holdPresence(context, found, {
            line: lineOf(context, pair),
            shape: 'table',
            subject: name,
        });
        const columnsPair = held(found, 'columns');
        const rowsPair = held(found, 'rows');
        if (!isSeq(columnsPair.value) || columnsPair.value.items.length === 0) {
            fail(context, columnsPair, `tables: ${name}.columns is a list of at least one column`);
        }
        const columns = itemsIn(columnsPair.value).map((item) =>
            requireString(context, item, `tables: ${name}.columns`),
        );
        if (!isSeq(rowsPair.value)) {
            fail(context, rowsPair, `tables: ${name}.rows is a list of rows, each a list of cells`);
        }
        const rows = itemsIn(rowsPair.value).map((row) => {
            if (!isSeq(row) || row.items.length !== columns.length) {
                fail(
                    context,
                    row,
                    `tables: ${name} — each row holds one cell per column (${columns.length})`,
                );
            }
            return itemsIn(row).map((cell) => valueOf(cell));
        });
        const database = found.get('database');
        return {
            columns,
            database:
                database === undefined
                    ? null
                    : requireString(context, database.value, `tables: ${name}.database`),
            line: lineOf(context, pair),
            name,
            rows,
            texts: textsOf(context, rowsPair.value),
        };
    });
}

/** A capture name: a word no `{{token}}` of the grammar already means. */
const CAPTURE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/u;

/** One JSONPath segment below `$`: `.key`, `[0]` or `['a key']`. */
const JSONPATH_SEGMENT = /^(?:\.(?<key>[A-Za-z_][\w-]*)|\[(?<index>\d+)\]|\['(?<quoted>[^']*)'\])/u;

/** Read `$.a[0]['b c']` into its segments, or `undefined` when it is not one. */
export function jsonPathSegments(path: string): (number | string)[] | undefined {
    if (!path.startsWith('$')) {
        return undefined;
    }
    const segments: (number | string)[] = [];
    let rest = path.slice(1);
    while (rest.length > 0) {
        const match = JSONPATH_SEGMENT.exec(rest);
        const groups = match?.groups;
        if (match === null || groups === undefined) {
            return undefined;
        }
        segments.push(
            groups.index === undefined ? (groups.key ?? groups.quoted ?? '') : Number(groups.index),
        );
        rest = rest.slice(match[0].length);
    }
    return segments;
}

/** `capture:` — name to the JSONPath of the response body it reads. */
function readCapture(context: Context, node: Node | null): SpecCapture[] {
    const map = requireMap(context, node, 'capture:');
    return pairsIn(map).map((pair) => {
        const name = scalarString(pair.key);
        if (name === null || !CAPTURE_NAME.test(name)) {
            fail(
                context,
                pair,
                `capture: a name is a word — letters, digits and _, starting with a letter`,
            );
        }
        if ((TOKEN_KINDS as readonly string[]).includes(name)) {
            fail(
                context,
                pair,
                `capture: "${name}" is a {{token}} of the grammar — name the value for what it is (orderId, token)`,
            );
        }
        const path = requireString(context, pair.value, `capture: ${name}`);
        const segments = jsonPathSegments(path);
        if (segments === undefined) {
            fail(
                context,
                pair.value,
                `capture: ${name} — "${path}" is not a JSONPath into the response body ($.id, $.items[0].name)`,
            );
        }
        return { line: lineOf(context, pair), name, path, segments };
    });
}

/** A `{{name}}` an input sends — a capture's name, spelled where its value goes. */
const REFERENCE = /\{\{(?<name>[^{}]*)\}\}/gu;

/** Every `{{name}}` written in a value an input sends, strings at any depth. */
function referencesIn(value: unknown): string[] {
    if (typeof value === 'string') {
        return [...value.matchAll(REFERENCE)].map((match) => match.groups?.name ?? '');
    }
    if (Array.isArray(value)) {
        return value.flatMap((item) => referencesIn(item));
    }
    if (value !== null && typeof value === 'object') {
        return Object.values(value).flatMap((item) => referencesIn(item));
    }
    return [];
}

/** Refuse a `{{name}}` sent before a step's `capture:` has named it. */
function requireCaptured(
    context: Context,
    line: number,
    value: unknown,
    captured: ReadonlySet<string>,
): void {
    for (const name of referencesIn(value)) {
        if (captured.has(name)) {
            continue;
        }
        const token = (TOKEN_KINDS as readonly string[]).includes(name.split('#')[0] ?? '')
            ? ` — {{${name}}} is a token: it matches what comes back, and a request sends values`
            : '';
        throw new SpecSyntaxError(
            context.fileName,
            line,
            `"{{${name}}}" is referenced before it exists — a step sends only what an EARLIER step's capture: named${token}`,
        );
    }
}

/** One api step, read with the captures the steps before it named. */
function readStep(
    context: Context,
    pairs: ReadonlyMap<string, Pair<Node, Node>>,
    line: number,
    captured: ReadonlySet<string>,
): SpecStep {
    holdPresence(context, pairs, { line, shape: 'step' });
    const requestPair = held(pairs, 'request');
    const sent = readSent(context, pairs, readRequest(context, requestPair.value), captured);
    const capturePair = pairs.get('capture');
    const responsePair = pairs.get('response');
    const tablesPair = pairs.get('tables');
    return {
        ...sent,
        capture: capturePair === undefined ? [] : readCapture(context, capturePair.value),
        line,
        response: responsePair === undefined ? null : readResponse(context, responsePair.value),
        tables: tablesPair === undefined ? [] : readTables(context, tablesPair.value),
    };
}

/** What a step sends — its request, its headers, its body — every reference checked. */
function readSent(
    context: Context,
    pairs: ReadonlyMap<string, Pair<Node, Node>>,
    request: SpecRequest,
    captured: ReadonlySet<string>,
): Pick<SpecStep, 'body' | 'headers' | 'request'> {
    const bodyPair = pairs.get('body');
    const headersPair = pairs.get('headers');
    if (bodyPair !== undefined && request.kind === 'file') {
        fail(
            context,
            bodyPair,
            'body: goes with an inline request — a requests/*.http carries its own body',
        );
    }
    const body = bodyPair === undefined ? null : readBody(context, bodyPair.value);
    const headers =
        headersPair === undefined ? {} : readHeaders(context, headersPair.value, 'headers:');
    requireCaptured(
        context,
        request.line,
        request.kind === 'inline' ? request.target : '',
        captured,
    );
    requireCaptured(context, lineOf(context, headersPair), headers, captured);
    requireCaptured(
        context,
        body?.line ?? request.line,
        body?.kind === 'value' ? body.value : null,
        captured,
    );
    return { body, headers, request };
}

/** `steps:` — a journey, each step sending what the steps before it captured. */
function readSteps(context: Context, node: Node | null): SpecStep[] {
    if (!isSeq(node) || node.items.length === 0) {
        fail(context, node, 'steps: is a list of at least one step');
    }
    const captured = new Set<string>();
    return itemsIn(node).map((item) => {
        const map = requireMap(context, item, 'each entry of steps:');
        const pairs = closedPairs(context, map, STEP_KEYS, 'a step');
        const step = readStep(context, keyed(pairs), lineOf(context, item), captured);
        for (const capture of step.capture) {
            captured.add(capture.name);
        }
        return step;
    });
}

/** The article a kind's name reads with: an api, a cli, a jobs. */
function article(kind: SpecKind): string {
    return kind === 'api' ? 'an' : 'a';
}

/**
 * Refuse a key another kind reads, before the closed set would call it unknown:
 * the refusal names the kind it belongs to, and why it cannot mean anything
 * here.
 */
function refuseForeignKeys(context: Context, map: YAMLMap, kind: SpecKind): void {
    for (const pair of pairsIn(map)) {
        const key = scalarString(pair.key) ?? '';
        const owners = SPEC_KINDS.filter(
            (other) =>
                other !== kind &&
                !(KIND_KEYS[kind] as readonly string[]).includes(key) &&
                (KIND_KEYS[other] as readonly string[]).includes(key),
        );
        if (owners.length > 0) {
            const why =
                key === 'fixture'
                    ? ` — it lays files into a working directory, and ${article(kind)} ${kind} chain has none`
                    : '';
            fail(
                context,
                pair,
                `"${key}:" is a key of ${owners.map((owner) => `${article(owner)} ${owner}`).join(' or ')} document, not of ${article(kind)} ${kind} one${why} — ${kind} keys: ${KIND_KEYS[kind].join(', ')}`,
            );
        }
    }
}

/** The kind a document states, read before its keys are — the key set depends on it. */
function readKind(context: Context, map: YAMLMap): SpecKind {
    const pair = pairsIn(map).find((item) => scalarString(item.key) === 'kind');
    if (pair === undefined) {
        return 'cli';
    }
    const kind = requireString(context, pair.value, 'kind:');
    if (!SPEC_KINDS.includes(kind as SpecKind)) {
        fail(
            context,
            pair,
            `kind: "${kind}" is not a facet — known kinds: ${SPEC_KINDS.join(', ')}`,
        );
    }
    return kind as SpecKind;
}

/** What an api document says: its given, then its steps — one, or a journey. */
function readApiFields(
    context: Context,
    map: YAMLMap,
    found: ReadonlyMap<string, Pair<Node, Node>>,
): Pick<SpecDocument, 'steps'> {
    holdPresence(context, found, { line: lineOf(context, map), shape: 'api' });
    const stepsPair = found.get('steps');
    if (stepsPair === undefined) {
        // The top-level `headers:` is the given every request carries, not this step's own.
        const step = new Map([...found].filter(([key]) => key !== 'headers'));
        return {
            steps: [readStep(context, step, lineOf(context, found.get('request')), new Set())],
        };
    }
    return { steps: readSteps(context, stepsPair.value) };
}

/** What a jobs document says: the job it triggers, and what it must have left or thrown. */
function readJobsFields(
    context: Context,
    map: YAMLMap,
    found: ReadonlyMap<string, Pair<Node, Node>>,
): Pick<SpecDocument, 'error' | 'tables' | 'trigger'> {
    holdPresence(context, found, { line: lineOf(context, map), shape: 'jobs' });
    const triggerPair = held(found, 'trigger');
    const errorPair = found.get('error');
    const tablesPair = found.get('tables');
    return {
        error: errorPair === undefined ? null : readStream(context, errorPair.value, 'error:'),
        tables: tablesPair === undefined ? [] : readTables(context, tablesPair.value),
        trigger: {
            line: lineOf(context, triggerPair),
            name: requireString(context, triggerPair.value, 'trigger:'),
        },
    };
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
    const kind = readKind(context, map);
    refuseForeignKeys(context, map, kind);
    const found = keyed(
        closedPairs(
            context,
            map,
            KIND_KEYS[kind],
            kind === 'cli' ? 'a spec document' : `${article(kind)} ${kind} document`,
        ),
    );
    holdPresence(context, found, { line: lineOf(context, map), shape: 'document' });

    const given = {
        description: requireString(context, found.get('description')!.value, 'description:'),
        descriptionLine: lineOf(context, found.get('description')),
        kind,
    };
    const document: SpecDocument =
        kind === 'cli'
            ? { ...emptyDocument(), ...given, ...readCliFields(context, map, found) }
            : {
                  ...emptyDocument(),
                  ...given,
                  ...readGiven(context, found),
                  ...(kind === 'api'
                      ? readApiFields(context, map, found)
                      : readJobsFields(context, map, found)),
              };
    return { document, source };
}

/** A document with every key of every kind empty — each kind fills its own. */
function emptyDocument(): SpecDocument {
    return {
        clock: null,
        description: '',
        descriptionLine: 1,
        env: [],
        error: null,
        fixtures: [],
        headers: {},
        intercepts: [],
        kind: 'cli',
        runs: [],
        seeds: [],
        serve: [],
        steps: [],
        tables: [],
        trigger: null,
    };
}

/** What an api or jobs case stands on: the chain's own setups, as data. */
function readGiven(
    context: Context,
    found: ReadonlyMap<string, Pair<Node, Node>>,
): Pick<SpecDocument, 'clock' | 'headers' | 'intercepts' | 'seeds'> {
    const seed = found.get('seed');
    const intercept = found.get('intercept');
    const clock = found.get('clock');
    const headers = found.get('headers');
    const captured = new Set<string>();
    const document = {
        clock: clock === undefined ? null : readClock(context, clock.value),
        headers: headers === undefined ? {} : readHeaders(context, headers.value, 'headers:'),
        intercepts:
            intercept === undefined ? [] : readPaths(context, intercept.value, INTERCEPT_ROLE),
        seeds: seed === undefined ? [] : readSeeds(context, seed.value),
    };
    if (headers !== undefined) {
        requireCaptured(context, lineOf(context, headers), document.headers, captured);
    }
    return document;
}

/** What a cli document says: its session, run after run. */
function readCliFields(
    context: Context,
    map: YAMLMap,
    found: ReadonlyMap<string, Pair<Node, Node>>,
): Pick<SpecDocument, 'env' | 'fixtures' | 'runs' | 'serve'> {
    holdPresence(context, found, { line: lineOf(context, map), shape: 'cli' });
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
 * comparison judges, and the `files:` texts it judges them with — and, in an
 * api or jobs document, an inline response's texts, a table's string cells
 * and a job's `error:`. `stdin:`, a request and its body are INPUTS — like a
 * `requests/` fixture, never matched — and a description or a command is
 * prose, so none of them appears here.
 */
export function assertedStreams(document: SpecDocument): SpecStream[] {
    const streams: SpecStream[] = [];
    for (const step of document.steps) {
        if (step.response?.kind === 'inline') {
            streams.push(...step.response.texts);
        }
        streams.push(...step.tables.flatMap((table) => table.texts));
    }
    streams.push(...document.tables.flatMap((table) => table.texts));
    if (document.error !== null) {
        streams.push(document.error);
    }
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
    key: 'body' | 'fixture' | 'intercept' | 'request' | 'response' | 'seed';
    /** What the path names: a `fixture:` with a trailing `/` spreads a directory, every other key one file. */
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

/** One file a key names. */
function namedFile(key: DocumentPath['key'], { line, path }: SpecPath): DocumentPath {
    return { key, kind: 'file', line, path };
}

/**
 * Every path a document names, in the order it names them — what the checker's
 * existence (C8), locality (C15) and liveness (C9, C14) passes read, exactly as
 * they read a `file()` or a `directory()`.
 */
export function documentPaths(document: SpecDocument): DocumentPath[] {
    const paths: DocumentPath[] = document.fixtures.map(({ line, path }) => ({
        key: 'fixture',
        kind: path.endsWith('/') ? 'directory' : 'file',
        line,
        path,
    }));
    paths.push(
        ...document.seeds.map((seed) => namedFile('seed', seed)),
        ...document.intercepts.map((intercept) => namedFile('intercept', intercept)),
    );
    for (const step of document.steps) {
        if (step.request.kind === 'file') {
            paths.push(namedFile('request', step.request));
        }
        if (step.body?.kind === 'file') {
            paths.push(namedFile('body', step.body));
        }
        if (step.response?.kind === 'file') {
            paths.push(namedFile('response', step.response));
        }
    }
    return paths;
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

/** What update mode writes back into one inline `response:` — a `.http` golden's three parts. */
export type ResponseRewrite = {
    body: unknown;
    hasBody: boolean;
    headers: Record<string, string>;
    status: string;
    /** The step whose response is rewritten; the top-level one of a one-step document is 0. */
    step: number;
};

/**
 * Rewrite the inline responses of an api document from what the app answered —
 * status, headers and body, placeholders of the previous golden preserved by
 * the caller. A file-form response is its golden's to rewrite, so it is left
 * alone here, and so is every other key: the YAML document is edited, never
 * re-emitted.
 */
export function updateSpecResponses(file: SpecFile, rewrites: readonly ResponseRewrite[]): string {
    const root = file.source.document.contents;
    if (!isMap(root)) {
        return renderYamlSource(file.source);
    }
    const steps = root.get('steps', true);
    for (const rewrite of rewrites) {
        const holder = isSeq(steps) ? steps.items[rewrite.step] : root;
        const response = isMap(holder) ? holder.get('response', true) : undefined;
        if (!isMap(response)) {
            continue;
        }
        const node = (value: unknown): unknown => file.source.document.createNode(value);
        setOrdered(
            response,
            'status',
            /^\d+$/u.test(rewrite.status) ? Number(rewrite.status) : rewrite.status,
            RESPONSE_KEYS,
        );
        if (Object.keys(rewrite.headers).length > 0) {
            setOrdered(response, 'headers', node(rewrite.headers), RESPONSE_KEYS);
        } else {
            response.delete('headers');
        }
        if (rewrite.hasBody) {
            setOrdered(response, 'body', node(rewrite.body), RESPONSE_KEYS);
        } else {
            response.delete('body');
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
 * A relative path whose FIRST ground folder is `folder`, as a pattern — C24's
 * reading, for an editor. `contracts/` is no ground, so a contract path passes
 * through no ground folder at all; `fixtures/` is the one a path may end on,
 * a directory `fixture:` spreads whole.
 */
function pathIn(folder: string, extension = ''): SchemaNode {
    const rest =
        folder === CONTRACTS_FOLDER
            ? `(?:${NOT_GROUND_SEGMENT})*[^/]+`
            : folder === GROUND_FIXTURES
              ? '.*'
              : String.raw`[^/].*`;
    return {
        pattern: String.raw`^\.\.?/(?:${NOT_GROUND_SEGMENT})*?${folder}/${rest}${extension.replaceAll('.', String.raw`\.`)}$`,
        type: 'string',
    };
}

/** One path, or a list of them. */
function oneOrMany(item: SchemaNode): SchemaNode {
    return { oneOf: [item, { items: item, minItems: 1, type: 'array' }] };
}

const HEADERS = { additionalProperties: { type: 'string' }, type: 'object' };

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
 * What a step cannot be, as a schema: its presence laws, and a `body:` beside
 * a request named by its path — the `.http` carries its own body.
 */
function stepLaws(): SchemaNode {
    const { allOf = [], ...laws } = presenceOf('step') as { allOf?: SchemaNode[] };
    return {
        ...laws,
        allOf: [
            ...allOf,
            {
                not: {
                    properties: { request: { pattern: String.raw`^\.\.?/`, type: 'string' } },
                    required: ['request', 'body'],
                },
            },
        ],
    };
}

/** The `if` a kind's own `then` hangs on — a cli document may leave its kind unstated. */
function whenKind(kind: SpecKind): SchemaNode {
    const stated = { properties: { kind: { const: kind } }, required: ['kind'] };
    return kind === 'cli' ? { anyOf: [{ not: { required: ['kind'] } }, stated] } : stated;
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
        step: SchemaNode & { additionalProperties: boolean; properties: SchemaNode };
    };
    $id: string;
    $schema: string;
    additionalProperties: boolean;
    /** One `if`/`then` per kind: the keys it reads, and the ones it cannot do without. */
    allOf: { if: SchemaNode; then: SchemaNode & { propertyNames: { enum: readonly string[] } } }[];
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
        capture: {
            additionalProperties: { pattern: String.raw`^\$`, type: 'string' },
            description:
                'Name → the JSONPath of the response body it reads ($.id, $.items[0].name); a later step sends it as {{name}}.',
            propertyNames: { not: { enum: [...TOKEN_KINDS] }, pattern: CAPTURE_NAME.source },
            type: 'object',
        },
        request: {
            description:
                'A ./requests/<name>.http sent whole, or an inline request line — METHOD /path, {{capture}} references allowed.',
            oneOf: [
                pathIn(GROUND_REQUESTS, '.http'),
                { pattern: `^(?:${REQUEST_METHODS.join('|')}) /`, type: 'string' },
            ],
        },
        response: {
            description:
                'A ./expected/<name>.http golden, or its three parts inline — status, a subset of headers, the body — each token-aware.',
            oneOf: [
                pathIn(GROUND_EXPECTED, '.http'),
                {
                    ...presenceOf('response'),
                    additionalProperties: false,
                    properties: {
                        body: { description: 'The body, compared structurally.' },
                        headers: HEADERS,
                        status: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
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
        seedEntry: {
            oneOf: [
                pathIn(GROUND_SEEDS, '.sql'),
                {
                    ...presenceOf('seed'),
                    additionalProperties: false,
                    properties: {
                        database: { type: 'string' },
                        file: pathIn(GROUND_SEEDS, '.sql'),
                    },
                    type: 'object',
                },
            ],
        },
        step: {
            ...stepLaws(),
            additionalProperties: false,
            properties: {
                body: {
                    description:
                        'The body an inline request sends: a value, or a file under requests/ named by its path.',
                },
                capture: { $ref: '#/$defs/capture' },
                headers: HEADERS,
                request: { $ref: '#/$defs/request' },
                response: { $ref: '#/$defs/response' },
                tables: { $ref: '#/$defs/tables' },
            },
            type: 'object',
        },
        tables: {
            additionalProperties: {
                ...presenceOf('table'),
                additionalProperties: false,
                properties: {
                    columns: { items: { type: 'string' }, minItems: 1, type: 'array' },
                    database: { type: 'string' },
                    rows: { items: { type: 'array' }, type: 'array' },
                },
                type: 'object',
            },
            description:
                'Table name → the rows it holds after the action, in order, as toMatchRows() takes them; rows: [] asserts it is empty.',
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
    allOf: SPEC_KINDS.map((kind) => ({
        if: whenKind(kind),
        // oxlint-disable-next-line unicorn/no-thenable -- JSON Schema's own keyword: an if/then pair is how the schema closes a document on its kind's keys
        then: {
            ...presenceOf(kind),
            // A one-step api document is that step, its laws held at the top level.
            ...(kind === 'api' ? { dependentSchemas: { request: stepLaws() } } : {}),
            propertyNames: { enum: KIND_KEYS[kind] },
        },
    })),
    description:
        'One case of the @jterrazz/test literate format, one file per test: the ground it stands on, what it does, and what came back.',
    properties: {
        body: {
            description:
                'api: the body an inline request sends — a value, or a file under requests/ named by its path.',
        },
        clock: {
            description:
                "api, jobs: the instant the chain's .clock() pins, ISO — 2026-03-04T09:30:00Z.",
            type: 'string',
        },
        description: {
            description: 'The vitest test title — one lowercase line, no trailing period.',
            type: 'string',
        },
        error: {
            description:
                'jobs: the message the triggered job must reject with, token-aware; absent asserts it succeeded.',
            type: 'string',
        },
        headers: {
            ...HEADERS,
            description: 'api: the headers every request of the document carries.',
        },
        intercept: {
            ...oneOrMany(pathIn(CONTRACTS_FOLDER)),
            description:
                'api, jobs: contract modules under contracts/, each default-exporting a contract, a list or a composite — applied in order.',
        },
        request: { $ref: '#/$defs/request' },
        response: { $ref: '#/$defs/response' },
        seed: {
            description:
                'api, jobs: .sql files under seeds/, applied in order — { file, database } targets one database when several are declared.',
            oneOf: [
                { $ref: '#/$defs/seedEntry' },
                { items: { $ref: '#/$defs/seedEntry' }, minItems: 1, type: 'array' },
            ],
        },
        steps: {
            description:
                'api: a journey — each step a request and what came back, sending what earlier steps captured.',
            items: { $ref: '#/$defs/step' },
            minItems: 1,
            type: 'array',
        },
        tables: { $ref: '#/$defs/tables' },
        trigger: { description: 'jobs: the registered job the case runs.', type: 'string' },
        env: {
            ...STRING_OR_LIST,
            description:
                'A bare word names an env set registered in code; KEY=value is inline. $WORKDIR expands.',
        },
        fixture: {
            description:
                "Fixture paths copied into the working directory, layering in order — each relative to this document (`./…`, `../…`), in the two forms the chain's `file()` and `directory()` take: a trailing `/` names a directory whose contents are spread, without it one file is copied under its own name. The first ground folder a path passes through is fixtures/ — ./fixtures/ beside the document, or specs/fixtures/ reached by the path that climbs to it.",
            ...oneOrMany(pathIn(GROUND_FIXTURES)),
        },
        kind: {
            default: 'cli',
            description: 'The facet this document describes.',
            enum: [...SPEC_KINDS],
            type: 'string',
        },
        runs: {
            description:
                'The session: one or more runs, sequential, sharing one working directory.',
            items: { $ref: '#/$defs/run' },
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
