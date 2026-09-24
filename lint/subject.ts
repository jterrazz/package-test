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
 * its segments; a job is its name, a cli command its first word.
 *
 * Two readings a repository may correct, each where it is declared: the
 * plural test that tells a collection (`events`) from a singleton (`status`)
 * takes the irregular collections `jterrazz.config.ts` names
 * (`test: { collections: ['data', 'people'] }`); and a command's words stop at
 * the first word not in the list the chain's own runner declares
 * (`specification.cli(bin, { commands: ['db', 'migrate'] })`, the list written
 * there or bound to a `const` of the runner's file), or after the first word
 * when it declares none.
 */

/** What a repository declared that the reading takes: its runner's commands, its irregular collections. */
export type SubjectReading = {
    /** The collections no plural test recognises, by their segment. */
    collections?: readonly string[] | undefined;
    /** The words each cli runner declares its commands with, by the handle a spec holds it by. */
    commands?: Readonly<Record<string, readonly string[]>> | undefined;
};

/** A method an api chain sends, or `ALL` for a route that takes any. */
export type Method = 'ALL' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

/** What a chain reaches — one per facet that has a subject. */
export type Subject =
    | { command: string[]; facet: 'cli' }
    | {
          facet: 'api';
          method: Method;
          path: string;
          /** Did the chain write the route's template — a `:name` segment, or `{ params }` beside the path? */
          template?: boolean;
      }
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

/** Is this word a collection's name — a plural noun (`events`, never `status`), or one the repository declares? */
function isCollection(word: string, collections: readonly string[]): boolean {
    return collections.includes(word) || (word.endsWith('s') && !/(?:ss|us|is)$/u.test(word));
}

/** The action a route's single resource segment is filed under. */
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

/**
 * The segment of a literal path that may be a value or the route's own —
 * `btc` in `/indicators/btc/chart`: a word right after a collection, with
 * more of the path after it. A template settles it, and so does a segment
 * that is plainly a value (a number, an id). The last segment is read as the
 * route's: after a collection it names a sub-route (`/map/pois/detail`) far
 * more often than an item.
 */
export function ambiguousSegment(
    subject: Subject,
    reading: SubjectReading = {},
): string | undefined {
    if (subject.facet !== 'api' || subject.template === true) {
        return undefined;
    }
    const segments = (subject.path.split(/[?#]/u)[0] ?? '')
        .split('/')
        .filter((segment) => segment !== '');
    const collections = reading.collections ?? [];
    return segments.find(
        (segment, index) =>
            index > 0 &&
            index < segments.length - 1 &&
            LITERAL_SEGMENT.test(segment) &&
            !segment.includes(HOLE) &&
            isCollection(segments[index - 1] ?? '', collections),
    );
}

/** The folder an api route is filed under — see {@link subjectFolder}. */
function routeFolder(
    method: Method,
    path: string,
    collections: readonly string[],
): string | undefined {
    const segments = pathTemplate(path).split('/').slice(1);
    const literals = segments.filter((segment) => segment !== '' && segment !== ':id');
    if (literals.length === 0) {
        return undefined;
    }
    if (method === 'ALL' || literals.length > 1) {
        return literals.join('/');
    }
    const [resource = ''] = literals;
    return `${resource}/${actionOf(method, resource, segments.at(-1) === ':id', collections)}`;
}

/**
 * The folder a subject is filed under, relative to its facet folder — or
 * nothing, where the subject has no standard name: the root route, a cli run
 * with no command word, a page, a journey.
 */
export function subjectFolder(subject: Subject, reading: SubjectReading = {}): string | undefined {
    if (subject.facet === 'api') {
        return ambiguousSegment(subject, reading) === undefined
            ? routeFolder(subject.method, subject.path, reading.collections ?? [])
            : undefined;
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
export function skipString(text: string, start: number): number {
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

/** The characters after which a `/` opens a regular expression rather than divides. */
const BEFORE_REGEX = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*$/u;

/** Does a `/` at `start` open a regular expression — no comment, and the code before it expects a value? */
function opensRegex(text: string, start: number): boolean {
    return (
        text[start] === '/' &&
        text[start + 1] !== '/' &&
        text[start + 1] !== '*' &&
        BEFORE_REGEX.test(text.slice(Math.max(0, start - 16), start))
    );
}

/** The offset past a regular expression's closing `/` and its flags, from the one past its body. */
function pastFlags(text: string, close: number): number {
    let end = close + 1;
    while (/[a-z]/u.test(text[end] ?? '')) {
        end += 1;
    }
    return end;
}

/** The offset past the regular expression that opens at `start`, or `start` when none does. */
function regexEnd(text: string, start: number): number {
    if (!opensRegex(text, start)) {
        return start;
    }
    let inClass = false;
    for (let index = start + 1; index < text.length; index += 1) {
        const character = text[index];
        if (character === '\\') {
            index += 1;
        } else if (character === '\n') {
            return start;
        } else if (character === '[' || character === ']') {
            inClass = character === '[';
        } else if (character === '/' && !inClass) {
            return pastFlags(text, index);
        }
    }
    return start;
}

/** The offset past the string, template or regular expression that opens at `start` — `start` when none does. */
export function literalEnd(text: string, start: number): number {
    const character = text[start];
    if (character === "'" || character === '"' || character === '`') {
        return skipString(text, start);
    }
    return regexEnd(text, start);
}

/** The offset of the bracket closing the one that opens at `open`. */
export function closingOf(text: string, open: number): number {
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];
    let index = open;
    while (index < text.length) {
        const character = text[index] ?? '';
        const past = index === open ? index : literalEnd(text, index);
        if (past !== index) {
            index = past;
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
        const past = literalEnd(text, index);
        if (past !== index) {
            index = past;
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

/** The same import, its specifier kept. */
const SPECIFICATION_DOOR =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

/** A view bound to a handle: `const events = api.with({ … })`. */
const VIEW = /const\s+(?<view>[A-Za-z_$][\w$]*)\s*=\s*(?<from>[A-Za-z_$][\w$]*)\s*\.\s*with\s*\(/gu;

/** The facet handles an import clause names, under their local names — of one facet, or of all. */
function importedHandles(names: string, facet?: string): string[] {
    return names.split(',').flatMap((name) => {
        const [imported = '', local = imported] = name.trim().split(/\s+as\s+/u);
        const wanted =
            facet === undefined
                ? (SUBJECT_FACETS as readonly string[]).includes(imported)
                : imported === facet;
        return wanted ? [local] : [];
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

/** A word that may name a command: lowercase, never a flag or a value. */
const COMMAND_WORD = /^[a-z][a-z0-9-]*$/u;

/**
 * The words of a command line that name the command: with the runner's
 * declared list, every leading word in it; without one, the first word alone —
 * a positional argument is never read as a subcommand.
 */
export function commandWords(line: string, commands?: readonly string[]): string[] {
    const words = line.trim().split(/\s+/u);
    if (commands === undefined) {
        const [first = ''] = words;
        return COMMAND_WORD.test(first) ? [first] : [];
    }
    const named: string[] = [];
    for (const word of words) {
        if (!commands.includes(word)) {
            break;
        }
        named.push(word);
    }
    return named;
}

/** A runner's constructor call and the options it opens: `specification.cli(bin, {`. */
const CLI_CONSTRUCTOR = /\bspecification\s*\.\s*cli\s*\(/u;

/** The words of an array literal, from the text just past its `[`. */
function wordsOf(text: string, open: number): string[] {
    return argumentsOf(text.slice(open + 1, closingOf(text, open))).flatMap((entry) => {
        const word = literalOf(entry);
        return word === undefined ? [] : [word];
    });
}

/** The array a `const` of the file binds to `name`, as its words. */
function constantWords(text: string, name: string): string[] | undefined {
    const escaped = name.replaceAll('$', String.raw`\$`);
    const binding = new RegExp(String.raw`\bconst\s+${escaped}\s*(?::[^=]+)?=\s*\[`, 'u').exec(
        text,
    );
    return binding === null ? undefined : wordsOf(text, binding.index + binding[0].length - 1);
}

/**
 * The command list a specification module declares for its cli runner — the
 * `commands` of its `specification.cli(bin, { … })`, written there as an array
 * or bound to a `const` of the same file (`commands: COMMANDS`, or the
 * shorthand `{ commands }`) — or nothing when it declares none.
 */
export function declaredCommands(door: string): string[] | undefined {
    const text = withoutComments(door);
    const call = CLI_CONSTRUCTOR.exec(text);
    if (call === null) {
        return undefined;
    }
    const open = call.index + call[0].length - 1;
    const [, options = ''] = argumentsOf(text.slice(open + 1, closingOf(text, open)));
    const list = /(?:^|[{,\s])commands\s*:\s*\[/u.exec(options);
    if (list !== null) {
        return wordsOf(options, list.index + list[0].length - 1);
    }
    const named =
        /(?:^|[{,\s])commands\s*:\s*(?<name>[A-Za-z_$][\w$]*)/u.exec(options)?.groups?.name ??
        (/(?:^|[{,\s])commands\s*(?=[,}])/u.test(options) ? 'commands' : undefined);
    return named === undefined ? undefined : constantWords(text, named);
}

/**
 * The specification module each of a facet's handles comes from, by the
 * local name a spec holds it by — a view bound to one (`const db =
 * cli.with(…)`) included, under the module of the handle it was made from.
 */
export function doorsOf(
    text: string,
    facet: (typeof SUBJECT_FACETS)[number],
): Record<string, string> {
    const doors = new Map<string, string>();
    for (const { groups } of text.matchAll(SPECIFICATION_DOOR)) {
        for (const handle of importedHandles(groups?.names ?? '', facet)) {
            doors.set(handle, groups?.from ?? '');
        }
    }
    const views = [...text.matchAll(VIEW)].map(({ groups }) => ({
        from: groups?.from ?? '',
        view: groups?.view ?? '',
    }));
    for (let size = -1; size !== doors.size;) {
        ({ size } = doors);
        for (const { from, view } of views) {
            const door = doors.get(from);
            if (door !== undefined) {
                doors.set(view, door);
            }
        }
    }
    return Object.fromEntries(doors);
}

/** The route a `.http`'s request line sends. */
function requestLineOf(text: string): Subject[] {
    const { method = '', path = '/' } = REQUEST_LINE.exec(text)?.groups ?? {};
    const verb = HTTP_VERBS[method.toLowerCase()];
    // A request file's line is written as the route: there is no template to write beside it.
    return verb === undefined ? [] : [{ facet: 'api', method: verb, path, template: true }];
}

/** Reads a `.http` a chain names by `file()`, from the spec's directory. */
type RequestReader = (path: string) => string | undefined;

/** What one terminal action reaches, from its first argument — and, for a cli one, its runner's command list. */
type TerminalReader = (
    first: string | undefined,
    readRequest: RequestReader,
    commands: readonly string[] | undefined,
) => Subject[];

/** A page a website chain visits or fetches. */
const pageOf: TerminalReader = (first) => {
    const literal = literalOf(first);
    return literal?.startsWith('/') === true
        ? [{ facet: 'website', page: pathTemplate(literal) }]
        : [];
};

/** The terminal actions that reach a subject, by name — the HTTP verbs apart. */
const TERMINALS: Record<string, TerminalReader> = {
    exec: (first, _readRequest, commands) => {
        // A sequence is one session of the binary, opened by its first command.
        const line =
            first?.trim().startsWith('[') === true
                ? literalOf(argumentsOf(first.trim().slice(1, -1))[0])
                : literalOf(first);
        return line === undefined ? [] : [{ command: commandWords(line, commands), facet: 'cli' }];
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
 * The route an HTTP verb sends: its path, and whether the chain wrote it as
 * the route's template — a `:name` segment, or `{ params }` handed beside it
 * (second to `get`/`delete`, third to `post`/`put`, after the body).
 */
function routeOf(method: Method, args: readonly string[]): Subject[] {
    const path = literalOf(args[0]);
    if (path?.startsWith('/') !== true) {
        return [];
    }
    const options = args[method === 'POST' || method === 'PUT' ? 2 : 1] ?? '';
    const template = /\/:[A-Za-z_$]/u.test(path) || /(?<![\w$])params(?![\w$])/u.test(options);
    return [{ facet: 'api', method, path, template }];
}

/**
 * The subject a chain's terminal action reaches — a cli sequence is one
 * session, opened by its first command.
 */
export function subjectsOfChain(
    chain: Chain,
    readRequest: RequestReader = () => '',
    reading: SubjectReading = {},
): Subject[] {
    const terminal = chain.calls.at(-1);
    if (terminal === undefined) {
        return [];
    }
    const args = argumentsOf(terminal.args);
    const [first] = args;
    const method = HTTP_VERBS[terminal.name];
    if (method !== undefined) {
        return routeOf(method, args);
    }
    return TERMINALS[terminal.name]?.(first, readRequest, reading.commands?.[chain.handle]) ?? [];
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
        const comment = commentEnd(text, index);
        if (comment !== index) {
            out += text.slice(index, comment).replaceAll(/[^\n]/gu, ' ');
            index = comment;
            continue;
        }
        const end = literalEnd(text, index);
        out += end === index ? character : text.slice(index, end);
        index = end === index ? index + 1 : end;
    }
    return out;
}

/** Every subject a spec's source reaches, where it reaches it. */
export function subjectsOf(
    source: string,
    readRequest?: RequestReader,
    reading: SubjectReading = {},
): SubjectAt[] {
    const text = withoutComments(source);
    return chainsOf(text, handlesOf(text)).flatMap((chain) =>
        subjectsOfChain(chain, readRequest, reading).map((subject) => ({
            index: chain.index,
            subject,
        })),
    );
}
