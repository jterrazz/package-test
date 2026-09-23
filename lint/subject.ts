/**
 * The subject a spec reaches, read from its source — and the folder a subject
 * is filed under.
 *
 * A spec file is about ONE subject (C29), and its folder is that subject's
 * standard name (C30): the route an api chain sends, the job a jobs chain
 * triggers, the command a cli chain runs, the page a website chain visits, the
 * journey a mobile chain opens. Both rules read the subject here, statically:
 * the chains of a file are the calls hanging off a runner handle the file
 * imports from a `*.specification` module (`api`, `jobs`, `cli`, `website`,
 * `mobile`), or off a `const` bound to one's `.with(…)`.
 *
 * The standard name is DERIVED, never listed: `GET /events` is
 * `events/list/`, `GET /events/:id` `events/get/`, `POST /events`
 * `events/create/`, `PUT|PATCH /events/:id` `events/update/`, `DELETE
 * /events/:id` `events/delete/`, a route under an item
 * (`GET /events/:id/timeline`) its literal segments (`events/timeline/`), a
 * singleton (`GET /health`) `health/get/`, a method-less route (`ALL /mcp`)
 * its segments; a job is its name, a cli command its words.
 */

/** A method an api chain sends, or `ALL` for a route that takes any. */
export type Method = 'ALL' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

/** What a chain reaches — one per facet that has a subject. */
export type Subject =
    | { command: string[]; facet: 'cli' }
    | { facet: 'api'; method: Method; path: string }
    | { facet: 'jobs'; job: string }
    | { facet: 'mobile'; journey: string }
    | { facet: 'website'; page: string };

/** A subject where a file reaches it: the offset of the chain that does. */
export type SubjectAt = { index: number; subject: Subject };

/** The facets whose chains reach a subject. */
export const SUBJECT_FACETS = ['api', 'cli', 'jobs', 'mobile', 'website'] as const;

/** A path segment written as a hole: a template's `${…}`. */
const HOLE = '\u0000';

/** A segment that names a resource: lowercase words, never a value. */
const LITERAL_SEGMENT = /^[a-z][a-z._-]*$/u;

/**
 * A request path as its route template: the query dropped, every segment that
 * is a value — a hole, a number, an id, a symbol — written `:id`.
 */
export function pathTemplate(path: string): string {
    const bare = path.split(/[?#]/u)[0] ?? '';
    const segments = bare
        .split('/')
        .filter((segment) => segment !== '')
        .map((segment) =>
            LITERAL_SEGMENT.test(segment) && !segment.includes(HOLE) ? segment : ':id',
        );
    return `/${segments.join('/')}`;
}

/** Is this word a collection's name — a plural noun (`events`, never `status`)? */
function isCollection(word: string): boolean {
    return word.endsWith('s') && !/(?:ss|us|is)$/u.test(word);
}

/** The action a route's single resource segment is filed under. */
function actionOf(method: Method, resource: string, item: boolean): string {
    if (method === 'GET') {
        return !item && isCollection(resource) ? 'list' : 'get';
    }
    if (method === 'POST') {
        return 'create';
    }
    if (method === 'PUT' || method === 'PATCH') {
        return 'update';
    }
    return method.toLowerCase();
}

/** The folder an api route is filed under — see {@link subjectFolder}. */
function routeFolder(method: Method, path: string): string | undefined {
    const segments = pathTemplate(path).split('/').slice(1);
    const literals = segments.filter((segment) => segment !== '' && segment !== ':id');
    if (literals.length === 0) {
        return undefined;
    }
    if (method === 'ALL' || literals.length > 1) {
        return literals.join('/');
    }
    const [resource = ''] = literals;
    return `${resource}/${actionOf(method, resource, segments.at(-1) === ':id')}`;
}

/**
 * The folder a subject is filed under, relative to its facet folder — or
 * nothing, where the subject has no standard name: the root route, a cli run
 * with no command word, a page, a journey.
 */
export function subjectFolder(subject: Subject): string | undefined {
    if (subject.facet === 'api') {
        return routeFolder(subject.method, subject.path);
    }
    if (subject.facet === 'cli') {
        return subject.command.length === 0 ? undefined : subject.command.join('/');
    }
    return subject.facet === 'jobs' ? subject.job : undefined;
}

/** How a subject reads in a message: `GET /events/:id`, `trigger digest`, … */
export function subjectName(subject: Subject): string {
    if (subject.facet === 'api') {
        return `${subject.method} ${pathTemplate(subject.path)}`;
    }
    if (subject.facet === 'cli') {
        return subject.command.length === 0
            ? 'exec (no command)'
            : `exec ${subject.command.join(' ')}`;
    }
    if (subject.facet === 'jobs') {
        return `trigger ${subject.job}`;
    }
    return subject.facet === 'mobile' ? `open ${subject.journey}` : `visit ${subject.page}`;
}

// ── Reading the source ──

/** The offset past the string literal that opens at `start`, template holes included. */
function skipString(text: string, start: number): number {
    const quote = text[start];
    let index = start + 1;
    while (index < text.length) {
        const character = text[index];
        if (character === '\\') {
            index += 2;
            continue;
        }
        if (character === quote) {
            return index + 1;
        }
        if (quote === '`' && character === '$' && text[index + 1] === '{') {
            index = closingOf(text, index + 1) + 1;
            continue;
        }
        index += 1;
    }
    return index;
}

/** The offset of the bracket closing the one that opens at `open`. */
export function closingOf(text: string, open: number): number {
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];
    let index = open;
    while (index < text.length) {
        const character = text[index] ?? '';
        if (character === "'" || character === '"' || character === '`') {
            index = skipString(text, index);
            continue;
        }
        if (character in pairs) {
            stack.push(pairs[character] ?? '');
        } else if (character === stack.at(-1)) {
            stack.pop();
            if (stack.length === 0) {
                return index;
            }
        }
        index += 1;
    }
    return text.length;
}

/** The arguments of a call, split at the commas of its own level. */
export function argumentsOf(text: string): string[] {
    const parts: string[] = [];
    let start = 0;
    let index = 0;
    while (index < text.length) {
        const character = text[index] ?? '';
        if (character === "'" || character === '"' || character === '`') {
            index = skipString(text, index);
            continue;
        }
        if (character === '(' || character === '[' || character === '{') {
            index = closingOf(text, index) + 1;
            continue;
        }
        if (character === ',') {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
        index += 1;
    }
    const last = text.slice(start).trim();
    return last === '' ? parts : [...parts, last];
}

/** The value a literal states — a template's holes kept as {@link HOLE} — or nothing. */
export function literalOf(argument: string | undefined): string | undefined {
    const text = argument?.trim() ?? '';
    const quote = text[0];
    if ((quote !== "'" && quote !== '"' && quote !== '`') || skipString(text, 0) !== text.length) {
        return undefined;
    }
    const body = text.slice(1, -1);
    return quote === '`' ? body.replaceAll(/\$\{[^}]*\}/gu, HOLE) : body;
}

/** One call of a chain: its member name and its arguments' text. */
export type ChainCall = { args: string; name: string };

/** A chain off a handle: where it starts, and its calls in order. */
export type Chain = { calls: ChainCall[]; end: number; handle: string; index: number };

/** The member calls hanging off `handle` at `start`, `.a(…).b(…)`, as long as they go. */
function chainAt(text: string, handle: string, start: number): Chain {
    const calls: ChainCall[] = [];
    let index = start + handle.length;
    for (;;) {
        const member = /^\s*\.\s*(?<name>[A-Za-z_$][\w$]*)\s*\(/u.exec(text.slice(index));
        if (member?.groups?.name === undefined) {
            return { calls, end: index, handle, index: start };
        }
        const open = index + member[0].length - 1;
        const close = closingOf(text, open);
        calls.push({ args: text.slice(open + 1, close), name: member.groups.name });
        index = close + 1;
    }
}

/** A runner a spec imports from a specification module: `import { api } from '../api.specification.js'`. */
const SPECIFICATION_IMPORT =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"][^'"]*\.specification(?:\.[jt]s)?['"]/gu;

/** A view bound to a handle: `const events = api.with({ … })`. */
const VIEW = /const\s+(?<view>[A-Za-z_$][\w$]*)\s*=\s*(?<from>[A-Za-z_$][\w$]*)\s*\.\s*with\s*\(/gu;

/** The facet handles an import clause names, under their local names. */
function importedHandles(names: string): string[] {
    return names.split(',').flatMap((name) => {
        const [imported = '', local = imported] = name.trim().split(/\s+as\s+/u);
        return (SUBJECT_FACETS as readonly string[]).includes(imported) ? [local] : [];
    });
}

/** The runner handles a spec imports from a specification module, and the views bound to them. */
export function handlesOf(text: string): string[] {
    const handles = new Set<string>(
        [...text.matchAll(SPECIFICATION_IMPORT)].flatMap((found) =>
            importedHandles(found.groups?.names ?? ''),
        ),
    );
    const views = [...text.matchAll(VIEW)].map((found) => ({
        from: found.groups?.from ?? '',
        view: found.groups?.view ?? '',
    }));
    for (let size = -1; size !== handles.size;) {
        ({ size } = handles);
        for (const { from, view } of views) {
            if (handles.has(from)) {
                handles.add(view);
            }
        }
    }
    return [...handles];
}

/** Every chain the file hangs off one of `handles`. */
export function chainsOf(text: string, handles: readonly string[]): Chain[] {
    if (handles.length === 0) {
        return [];
    }
    const pattern = new RegExp(String.raw`(?<![.\w$])(?:${handles.join('|')})(?=\s*\.)`, 'gu');
    return [...text.matchAll(pattern)].map((found) => chainAt(text, found[0], found.index));
}

const HTTP_VERBS: Record<string, Method> = {
    delete: 'DELETE',
    get: 'GET',
    patch: 'PATCH',
    post: 'POST',
    put: 'PUT',
};

/** The request line of a `.http` a chain sends: `POST /events`. */
const REQUEST_LINE = /^\s*(?<method>DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)\s+(?<path>\S+)/u;

/** A request named by `file()`, the one argument `request()` takes. */
const REQUEST_FILE = /^file\(\s*(?<quote>['"])(?<path>[^'"]*)\k<quote>\s*\)$/u;

/** The words of a command line that name the command, before its first argument. */
export function commandWords(line: string): string[] {
    const words: string[] = [];
    for (const word of line.trim().split(/\s+/u)) {
        if (!/^[a-z][a-z0-9-]*$/u.test(word)) {
            break;
        }
        words.push(word);
    }
    return words;
}

/** The route a `.http`'s request line sends. */
function requestLineOf(text: string): Subject[] {
    const { method = '', path = '/' } = REQUEST_LINE.exec(text)?.groups ?? {};
    const verb = HTTP_VERBS[method.toLowerCase()];
    return verb === undefined ? [] : [{ facet: 'api', method: verb, path }];
}

/** Reads a `.http` a chain names by `file()`, from the spec's directory. */
type RequestReader = (path: string) => string | undefined;

/** What one terminal action reaches, from its first argument. */
type TerminalReader = (first: string | undefined, readRequest: RequestReader) => Subject[];

/** A page a website chain visits or fetches. */
const pageOf: TerminalReader = (first) => {
    const literal = literalOf(first);
    return literal?.startsWith('/') === true
        ? [{ facet: 'website', page: pathTemplate(literal) }]
        : [];
};

/** The terminal actions that reach a subject, by name — the HTTP verbs apart. */
const TERMINALS: Record<string, TerminalReader> = {
    exec: (first) => {
        const lines =
            first?.trim().startsWith('[') === true
                ? argumentsOf(first.trim().slice(1, -1)).map((entry) => literalOf(entry))
                : [literalOf(first)];
        return lines.flatMap((line) =>
            line === undefined ? [] : [{ command: commandWords(line), facet: 'cli' as const }],
        );
    },
    fetch: pageOf,
    open: (first) => [{ facet: 'mobile', journey: literalOf(first) ?? '(launch)' }],
    request: (first, readRequest) => {
        const path = REQUEST_FILE.exec(first ?? '')?.groups?.path;
        return path === undefined ? [] : requestLineOf(readRequest(path) ?? '');
    },
    trigger: (first) => {
        const job = literalOf(first);
        return job === undefined ? [] : [{ facet: 'jobs', job }];
    },
    visit: pageOf,
};

/**
 * The subjects a chain's terminal action reaches — one, or several for a cli
 * sequence.
 */
export function subjectsOfChain(chain: Chain, readRequest: RequestReader = () => ''): Subject[] {
    const terminal = chain.calls.at(-1);
    if (terminal === undefined) {
        return [];
    }
    const [first] = argumentsOf(terminal.args);
    const method = HTTP_VERBS[terminal.name];
    if (method !== undefined) {
        const path = literalOf(first);
        return path?.startsWith('/') === true ? [{ facet: 'api', method, path }] : [];
    }
    return TERMINALS[terminal.name]?.(first, readRequest) ?? [];
}

/** Where the comment that opens at `index` ends, or `index` when none opens there. */
function commentEnd(text: string, index: number): number {
    if (text[index] !== '/') {
        return index;
    }
    if (text[index + 1] === '/') {
        const end = text.indexOf('\n', index);
        return end === -1 ? text.length : end;
    }
    if (text[index + 1] === '*') {
        const end = text.indexOf('*/', index);
        return end === -1 ? text.length : end + 2;
    }
    return index;
}

/**
 * The source with its comments blanked, unit for unit so every offset holds:
 * a chain written in a comment is prose.
 */
export function withoutComments(text: string): string {
    let out = '';
    let index = 0;
    while (index < text.length) {
        const character = text[index] ?? '';
        if (character === "'" || character === '"' || character === '`') {
            const end = skipString(text, index);
            out += text.slice(index, end);
            index = end;
            continue;
        }
        const end = commentEnd(text, index);
        if (end === index) {
            out += character;
            index += 1;
            continue;
        }
        out += text.slice(index, end).replaceAll(/[^\n]/gu, ' ');
        index = end;
    }
    return out;
}

/** Every subject a spec's source reaches, where it reaches it. */
export function subjectsOf(source: string, readRequest?: RequestReader): SubjectAt[] {
    const text = withoutComments(source);
    return chainsOf(text, handlesOf(text)).flatMap((chain) =>
        subjectsOfChain(chain, readRequest).map((subject) => ({ index: chain.index, subject })),
    );
}
