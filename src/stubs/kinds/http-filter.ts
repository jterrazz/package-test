import { refusal } from '../../chain/refusals/refusal.js';
import { CaptureScope } from '../../expectations/tokens/capture-scope.js';
import { structuralSubset } from '../../expectations/tokens/structural.js';
import type { MatchableRequest, StubRequest } from '../exchange.js';

/** Request filters; a request matches when every provided field matches. */
export type HttpStubFilter = {
    /** An object is a deep subset match (leaves may be `match.*`); a string is containment, a RegExp `test()`s the raw body. */
    body?: object | RegExp | string;
    /** Header subset. Names are case-insensitive; string = exact value, RegExp = `test()`. */
    headers?: Record<string, RegExp | string>;
    /** Query-param subset. string = exact value, RegExp = `test()`. */
    query?: Record<string, RegExp | string>;
    /** Headers the request must not carry; a name present with any value keeps the stub from firing. */
    without?: { headers?: readonly string[] };
};

/** The raw body a string or RegExp filter reads: a text as it is, any other value as its JSON. */
function rawOf(body: unknown): string {
    return typeof body === 'string' ? body : JSON.stringify(body ?? '');
}

function matchesBody(body: unknown, expected: NonNullable<HttpStubFilter['body']>): boolean {
    if (typeof expected === 'string') {
        return rawOf(body).includes(expected);
    }
    if (expected instanceof RegExp) {
        return expected.test(rawOf(body));
    }
    return structuralSubset(expected, body, new CaptureScope());
}

function matchesEntries(
    expected: Record<string, RegExp | string>,
    lookup: (key: string) => string | undefined,
): boolean {
    return Object.entries(expected).every(([key, value]) => {
        const actual = lookup(key);
        if (actual === undefined) {
            return false;
        }
        return value instanceof RegExp ? value.test(actual) : actual === value;
    });
}

export function buildMatch(filter?: HttpStubFilter): StubRequest['match'] {
    if (!filter) {
        return undefined;
    }
    return (request: MatchableRequest): boolean => {
        if (filter.body !== undefined && !matchesBody(request.body, filter.body)) {
            return false;
        }
        if (
            filter.headers &&
            !matchesEntries(filter.headers, (key) => request.headers[key.toLowerCase()])
        ) {
            return false;
        }
        if (filter.query) {
            let params: URLSearchParams;
            try {
                params = new URL(request.url, 'http://stub.invalid').searchParams;
            } catch {
                return false;
            }
            if (!matchesEntries(filter.query, (key) => params.get(key) ?? undefined)) {
                return false;
            }
        }
        return true;
    };
}

export function absentHeadersOf(filter: HttpStubFilter = {}): string[] | undefined {
    const absent = filter.without?.headers?.map((name) => name.toLowerCase()) ?? [];
    if (absent.length === 0) {
        return undefined;
    }
    const required = new Set(Object.keys(filter.headers ?? {}).map((name) => name.toLowerCase()));
    const contradicted = absent.filter((name) => required.has(name));
    if (contradicted.length > 0) {
        const names = contradicted.join(', ');
        throw new Error(
            refusal({
                fix: `state ${names} in \`headers\` or in \`without.headers\`, never both`,
                found: `an http stub filter that both requires and forbids the header(s) ${names}`,
                read: 'docs/reference/stubs.md#http--any-url',
                why: 'A header both required and absent matches no request, so the stub could never fire.',
            }),
        );
    }
    return absent;
}
