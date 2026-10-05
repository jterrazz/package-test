/** The standard name is derived, never listed: `GET /events` → `events/list/`, `GET /events/:id` → `events/get/`, `POST` create, `PUT|PATCH` update, `DELETE` delete; a route under an item takes its literal segments; a job is its name, a cli command its first word. `jterrazz.config.ts` corrects the irregular collections and the method-less routes, a cli runner its command words. */

import { blankComments } from '@jterrazz/typescript/rules';

import { commandWords } from './command-words.js';
import { argumentsOf, HOLE, literalOf } from './source-scan.js';
import { chainsOf, handlesOf } from './spec-chains.js';
import type { Chain } from './spec-chains.js';

export type SubjectReading = {
    collections: readonly string[];
    commands?: Readonly<Record<string, readonly string[]>> | undefined;
    methodless: readonly string[];
};

export const NO_READING: SubjectReading = Object.freeze({ collections: [], methodless: [] });

export type Method = 'ALL' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export type Subject =
    | { command: string[]; specification: 'cli' }
    | {
          specification: 'api';
          method: Method;
          path: string;
          template?: boolean;
      }
    | { specification: 'job'; job: string }
    | { specification: 'mobile'; journey: string }
    | { specification: 'website'; page: string };

export type SubjectAt = { index: number; subject: Subject };

const LITERAL_SEGMENT = /^[a-z][a-z._-]*$/u;

function segmentsOf(path: string): string[] {
    // Stryker disable next-line StringLiteral: a split always has a first piece
    const bare = path.split(/[?#]/u)[0] ?? '';
    return bare.split('/').filter((segment) => segment !== '');
}

function isLiteral(segment: string): boolean {
    return LITERAL_SEGMENT.test(segment) && !segment.includes(HOLE);
}

/** Every segment that is a value (a hole, a number, an id, a symbol) is written `:id`. */
export function pathTemplate(path: string): string {
    const segments = segmentsOf(path).map((segment) => (isLiteral(segment) ? segment : ':id'));
    return `/${segments.join('/')}`;
}

/** A plural noun (`events`, never `status`), or one the repository declares. */
function isCollection(word: string, collections: readonly string[]): boolean {
    return collections.includes(word) || (word.endsWith('s') && !/(?:ss|us|is)$/u.test(word));
}

function actionOf(
    method: Method,
    resource: string,
    item: boolean,
    collections: readonly string[],
): string {
    if (method === 'GET') {
        return !item && isCollection(resource, collections) ? 'list' : 'get';
    }
    if (method === 'POST') {
        return 'create';
    }
    if (method === 'PUT' || method === 'PATCH') {
        return 'update';
    }
    return method.toLowerCase();
}

function followsACollection(
    segments: string[],
    index: number,
    collections: readonly string[],
): boolean {
    // Stryker disable next-line StringLiteral: the first segment follows nothing, and no text standing for nothing is a collection
    return isCollection(segments[index - 1] ?? '', collections);
}

/** `btc` in `/indicators/btc/chart`. The last segment is read as the route's: after a collection it names a sub-route far more often than an item. */
export function ambiguousSegment(
    subject: Subject,
    reading: SubjectReading = NO_READING,
): string | undefined {
    if (subject.specification !== 'api' || subject.template === true) {
        return undefined;
    }
    const segments = segmentsOf(subject.path);
    const { collections } = reading;
    return segments.find(
        (segment, index) =>
            index < segments.length - 1 &&
            isLiteral(segment) &&
            followsACollection(segments, index, collections),
    );
}

function routeFolder(
    method: Method,
    path: string,
    collections: readonly string[],
): string | undefined {
    const segments = segmentsOf(pathTemplate(path));
    const literals = segments.filter((segment) => segment !== ':id');
    if (literals.length === 0) {
        return undefined;
    }
    if (method === 'ALL' || literals.length > 1) {
        return literals.join('/');
    }
    const [resource = ''] = literals;
    return `${resource}/${actionOf(method, resource, segments.at(-1) === ':id', collections)}`;
}

/** Nothing for a subject with no standard name: the root route, a cli run with no command word, a page, a journey. */
export function subjectFolder(
    subject: Subject,
    reading: SubjectReading = NO_READING,
): string | undefined {
    if (subject.specification === 'api') {
        return ambiguousSegment(subject, reading) === undefined
            ? routeFolder(subject.method, subject.path, reading.collections)
            : undefined;
    }
    if (subject.specification === 'cli') {
        return subject.command.length === 0 ? undefined : subject.command.join('/');
    }
    // Stryker disable next-line ConditionalExpression: a page or a journey has no job to read either
    return subject.specification === 'job' ? subject.job : undefined;
}

/** `GET /events/:id`, `trigger digest`, … */
export function subjectName(subject: Subject): string {
    if (subject.specification === 'api') {
        return `${subject.method} ${pathTemplate(subject.path)}`;
    }
    if (subject.specification === 'cli') {
        return subject.command.length === 0
            ? 'exec (no command)'
            : `exec ${subject.command.join(' ')}`;
    }
    if (subject.specification === 'job') {
        return `trigger ${subject.job}`;
    }
    return subject.specification === 'mobile' ? `open ${subject.journey}` : `visit ${subject.page}`;
}

const HTTP_VERBS: Record<string, Method> = {
    delete: 'DELETE',
    get: 'GET',
    patch: 'PATCH',
    post: 'POST',
    put: 'PUT',
};

const REQUEST_LINE = /^\s*(?<method>DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)\s+(?<path>\S+)/u;

const REQUEST_FILE = /^file\(\s*(?<quote>['"])(?<path>[^'"]*)\k<quote>\s*\)$/u;

function requestLineOf(text: string): Subject[] {
    // Stryker disable next-line StringLiteral: an unmatched line has no method, so no verb, whatever path stands for it
    const { method = '', path = '/' } = REQUEST_LINE.exec(text)?.groups ?? {};
    const verb = HTTP_VERBS[method.toLowerCase()];
    // invariant: a request file's line is the route: there is no template to write beside it.
    return verb === undefined ? [] : [{ specification: 'api', method: verb, path, template: true }];
}

type RequestReader = (path: string) => string | undefined;

type TerminalReader = (
    first: string | undefined,
    readRequest: RequestReader,
    commands: readonly string[] | undefined,
) => Subject[];

const pageOf: TerminalReader = (first) => {
    const literal = literalOf(first);
    return literal?.startsWith('/') === true
        ? [{ specification: 'website', page: pathTemplate(literal) }]
        : [];
};

const TERMINALS: Record<string, TerminalReader> = {
    exec: (first, _readRequest, commands) => {
        // invariant: a sequence is one session of the binary, opened by its first command.
        const line =
            first?.startsWith('[') === true
                ? literalOf(argumentsOf(first.slice(1, -1))[0])
                : literalOf(first);
        return line === undefined
            ? []
            : [{ command: commandWords(line, commands), specification: 'cli' }];
    },
    fetch: pageOf,
    open: (first) => [{ specification: 'mobile', journey: literalOf(first) ?? '(launch)' }],
    request: (first, readRequest) => {
        // Stryker disable next-line OptionalChaining: a match always carries its named groups
        const path = REQUEST_FILE.exec(first ?? '')?.groups?.path;
        // Stryker disable next-line ConditionalExpression,StringLiteral: a reader finds no request where no path is named, and no text it stands in for is a request line
        return path === undefined ? [] : requestLineOf(readRequest(path) ?? '');
    },
    trigger: (first) => {
        const job = literalOf(first);
        return job === undefined ? [] : [{ specification: 'job', job }];
    },
    visit: pageOf,
};

/** `{ params }` comes second to `get`/`delete`, third to `post`/`put`, after the body. */
function routeOf(method: Method, args: readonly string[]): Subject[] {
    const path = literalOf(args[0]);
    if (path?.startsWith('/') !== true) {
        return [];
    }
    const at = method === 'POST' || method === 'PUT' ? 2 : 1;
    // Stryker disable next-line StringLiteral: no text standing for absent options names params
    const options = args[at] ?? '';
    const template = /\/:[A-Za-z_$]/u.test(path) || /(?<![\w$])params(?![\w$])/u.test(options);
    return [{ specification: 'api', method, path, template }];
}

function declaredMethod(subject: Subject, methodless: readonly string[]): Subject {
    if (subject.specification !== 'api') {
        return subject;
    }
    const template = pathTemplate(subject.path);
    return methodless.some((path) => pathTemplate(path) === template)
        ? { ...subject, method: 'ALL' }
        : subject;
}

export function subjectsOfChain(
    chain: Chain,
    // Stryker disable next-line ArrowFunction: no reader reads no request, as one reading nothing
    readRequest: RequestReader = () => '',
    reading: SubjectReading = NO_READING,
): Subject[] {
    const terminal = chain.calls.at(-1);
    if (terminal === undefined) {
        return [];
    }
    const args = argumentsOf(terminal.args);
    const [first] = args;
    const method = HTTP_VERBS[terminal.name];
    const reached =
        method === undefined
            ? (TERMINALS[terminal.name]?.(first, readRequest, reading.commands?.[chain.handle]) ??
              [])
            : routeOf(method, args);
    return reached.map((subject) => declaredMethod(subject, reading.methodless));
}

export function subjectsOf(
    source: string,
    readRequest?: RequestReader,
    reading: SubjectReading = NO_READING,
): SubjectAt[] {
    const text = blankComments(source);
    return chainsOf(text, handlesOf(text)).flatMap((chain) =>
        subjectsOfChain(chain, readRequest, reading).map((subject) => ({
            index: chain.index,
            subject,
        })),
    );
}
