/** The standard name is derived, never listed: `GET /events` → `events/list/`, `GET /events/:id` → `events/get/`, `POST` create, `PUT|PATCH` update, `DELETE` delete; a route under an item takes its literal segments; a job is its name, a cli command its first word. `jterrazz.config.ts` corrects the irregular collections and the method-less routes, a cli runner its command words. */

export type SubjectReading = {
    collections?: readonly string[] | undefined;
    commands?: Readonly<Record<string, readonly string[]>> | undefined;
    methodless?: readonly string[] | undefined;
};

export type Method = 'ALL' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export type Subject =
    | { command: string[]; facet: 'cli' }
    | {
          facet: 'api';
          method: Method;
          path: string;
          template?: boolean;
      }
    | { facet: 'job'; job: string }
    | { facet: 'mobile'; journey: string }
    | { facet: 'website'; page: string };

export type SubjectAt = { index: number; subject: Subject };

export const SUBJECT_FACETS = ['api', 'cli', 'job', 'mobile', 'website'] as const;

const HOLE = '\u0000';

const LITERAL_SEGMENT = /^[a-z][a-z._-]*$/u;

/** Every segment that is a value (a hole, a number, an id, a symbol) is written `:id`. */
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

/** `btc` in `/indicators/btc/chart`. The last segment is read as the route's: after a collection it names a sub-route far more often than an item. */
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

/** Nothing for a subject with no standard name: the root route, a cli run with no command word, a page, a journey. */
export function subjectFolder(subject: Subject, reading: SubjectReading = {}): string | undefined {
    if (subject.facet === 'api') {
        return ambiguousSegment(subject, reading) === undefined
            ? routeFolder(subject.method, subject.path, reading.collections ?? [])
            : undefined;
    }
    if (subject.facet === 'cli') {
        return subject.command.length === 0 ? undefined : subject.command.join('/');
    }
    return subject.facet === 'job' ? subject.job : undefined;
}

/** `GET /events/:id`, `trigger digest`, … */
export function subjectName(subject: Subject): string {
    if (subject.facet === 'api') {
        return `${subject.method} ${pathTemplate(subject.path)}`;
    }
    if (subject.facet === 'cli') {
        return subject.command.length === 0
            ? 'exec (no command)'
            : `exec ${subject.command.join(' ')}`;
    }
    if (subject.facet === 'job') {
        return `trigger ${subject.job}`;
    }
    return subject.facet === 'mobile' ? `open ${subject.journey}` : `visit ${subject.page}`;
}

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

const BEFORE_REGEX = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*$/u;

function opensRegex(text: string, start: number): boolean {
    return (
        text[start] === '/' &&
        text[start + 1] !== '/' &&
        text[start + 1] !== '*' &&
        BEFORE_REGEX.test(text.slice(Math.max(0, start - 16), start))
    );
}

function pastFlags(text: string, close: number): number {
    let end = close + 1;
    while (/[a-z]/u.test(text[end] ?? '')) {
        end += 1;
    }
    return end;
}

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

export function literalEnd(text: string, start: number): number {
    const character = text[start];
    if (character === "'" || character === '"' || character === '`') {
        return skipString(text, start);
    }
    return regexEnd(text, start);
}

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

export function literalOf(argument: string | undefined): string | undefined {
    const text = argument?.trim() ?? '';
    const quote = text[0];
    if ((quote !== "'" && quote !== '"' && quote !== '`') || skipString(text, 0) !== text.length) {
        return undefined;
    }
    const body = text.slice(1, -1);
    return quote === '`' ? body.replaceAll(/\$\{[^}]*\}/gu, HOLE) : body;
}

export type ChainCall = { args: string; name: string };

export type Chain = { calls: ChainCall[]; end: number; handle: string; index: number };

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

const SPECIFICATION_IMPORT =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"][^'"]*\.specification(?:\.[jt]s)?['"]/gu;

const SPECIFICATION_DOOR =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

/** `const events = api.with({ … })`. */
const VIEW = /const\s+(?<view>[A-Za-z_$][\w$]*)\s*=\s*(?<from>[A-Za-z_$][\w$]*)\s*\.\s*with\s*\(/gu;

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

const REQUEST_LINE = /^\s*(?<method>DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)\s+(?<path>\S+)/u;

const REQUEST_FILE = /^file\(\s*(?<quote>['"])(?<path>[^'"]*)\k<quote>\s*\)$/u;

const COMMAND_WORD = /^[a-z][a-z0-9-]*$/u;

/** Without the runner's declared list, the first word alone: a positional argument is never read as a subcommand. */
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

const CLI_CONSTRUCTOR = /\bspecification\s*\.\s*cli\s*\(/u;

function wordsOf(text: string, open: number): string[] {
    return argumentsOf(text.slice(open + 1, closingOf(text, open))).flatMap((entry) => {
        const word = literalOf(entry);
        return word === undefined ? [] : [word];
    });
}

function constantWords(text: string, name: string): string[] | undefined {
    const escaped = name.replaceAll('$', String.raw`\$`);
    const binding = new RegExp(String.raw`\bconst\s+${escaped}\s*(?::[^=]+)?=\s*\[`, 'u').exec(
        text,
    );
    return binding === null ? undefined : wordsOf(text, binding.index + binding[0].length - 1);
}

/** Written as an array or bound to a `const` of the same file (`commands: COMMANDS`, `{ commands }`). */
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

/** A view bound to a handle (`const db = cli.with(…)`) comes under the module of that handle. */
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

function requestLineOf(text: string): Subject[] {
    const { method = '', path = '/' } = REQUEST_LINE.exec(text)?.groups ?? {};
    const verb = HTTP_VERBS[method.toLowerCase()];
    // A request file's line is the route: there is no template to write beside it.
    return verb === undefined ? [] : [{ facet: 'api', method: verb, path, template: true }];
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
        ? [{ facet: 'website', page: pathTemplate(literal) }]
        : [];
};

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
        return job === undefined ? [] : [{ facet: 'job', job }];
    },
    visit: pageOf,
};

/** `{ params }` comes second to `get`/`delete`, third to `post`/`put`, after the body. */
function routeOf(method: Method, args: readonly string[]): Subject[] {
    const path = literalOf(args[0]);
    if (path?.startsWith('/') !== true) {
        return [];
    }
    const options = args[method === 'POST' || method === 'PUT' ? 2 : 1] ?? '';
    const template = /\/:[A-Za-z_$]/u.test(path) || /(?<![\w$])params(?![\w$])/u.test(options);
    return [{ facet: 'api', method, path, template }];
}

function declaredMethod(subject: Subject, methodless: readonly string[]): Subject {
    if (subject.facet !== 'api' || methodless.length === 0) {
        return subject;
    }
    const template = pathTemplate(subject.path);
    return methodless.some((path) => pathTemplate(path.replaceAll(/:[^/]+/gu, HOLE)) === template)
        ? { ...subject, method: 'ALL' }
        : subject;
}

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
    const reached =
        method === undefined
            ? (TERMINALS[terminal.name]?.(first, readRequest, reading.commands?.[chain.handle]) ??
              [])
            : routeOf(method, args);
    return reached.map((subject) => declaredMethod(subject, reading.methodless ?? []));
}

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

/** Blanked unit for unit so every offset holds: a chain written in a comment is prose. */
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
