import { CaptureScope } from '../../expectations/tokens/capture-scope.js';
import {
    hasPlaceholders,
    placeholderPatternSource,
} from '../../expectations/tokens/placeholders.js';
import { textEquals } from '../../expectations/tokens/structural.js';
import type { StubRequest } from '../exchange.js';

const RELATIVE_BASE = 'http://stub.invalid';

// Stryker disable next-line StringLiteral: the pattern a URL compiles to escapes no character the unicode flag reads otherwise
const UNICODE = 'u';

/** Never through `new URL()`, which would percent-encode `{{token}}` braces. */
function splitDeclared(url: string): { base: string; query: URLSearchParams } {
    const separator = url.indexOf('?');
    if (separator === -1) {
        return { base: url, query: new URLSearchParams() };
    }
    return { base: url.slice(0, separator), query: new URLSearchParams(url.slice(separator + 1)) };
}

// Stryker disable BlockStatement: an escape that decodes to nothing reads as sent, which the raw comparison before it already made
function safeDecode(text: string): string {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}
// Stryker restore BlockStatement

/** A URL from its start, its query and fragment free. */
function wholeUrl(prefix: string, base: string): RegExp {
    return new RegExp(
        String.raw`^${prefix}${placeholderPatternSource(base)}(?:\?[^#]*)?(?:#.*)?$`,
        UNICODE,
    );
}

function valueMatches(declared: string, observed: string): boolean {
    return textEquals(declared, observed, new CaptureScope());
}

/** A RegExp tests the full URL, a path form ignores the origin; `{{token}}` segments compare structurally and declared query params are a subset. */
export function urlMatches(declared: RegExp | string, observed: string): boolean {
    if (declared instanceof RegExp) {
        return declared.test(observed);
    }

    let url: URL;
    try {
        url = new URL(observed, RELATIVE_BASE);
    } catch {
        return false;
    }

    const { base, query } = splitDeclared(declared);
    const observedBase = base.startsWith('/') ? url.pathname : `${url.origin}${url.pathname}`;
    const decodedBase = base.startsWith('/')
        ? safeDecode(url.pathname)
        : `${url.origin}${safeDecode(url.pathname)}`;
    if (!valueMatches(base, observedBase) && !valueMatches(base, decodedBase)) {
        return false;
    }

    for (const key of new Set(query.keys())) {
        const observedValues = url.searchParams.getAll(key);
        const everyDeclaredFound = query
            .getAll(key)
            .every((value) => observedValues.some((actual) => valueMatches(value, actual)));
        if (!everyDeclaredFound) {
            return false;
        }
    }

    return true;
}

/** No narrower than `stubMatches`, which stays the authority on what matches. */
export function routePatternOf(declared: RegExp | string): RegExp | string {
    if (declared instanceof RegExp) {
        return declared;
    }
    const { base } = splitDeclared(declared);
    if (base.startsWith('/')) {
        return wholeUrl(String.raw`https?:\/\/[^/?#]+`, base);
    }
    if (hasPlaceholders(base)) {
        return wholeUrl('', base);
    }
    return base;
}

export function routeKeyOf({ method, url }: StubRequest): string {
    return url instanceof RegExp ? `${method} re:${url.source}` : `${method} str:${url}`;
}

function describeAbsent(absentHeaders: StubRequest['absentHeaders']): string {
    if (absentHeaders === undefined || absentHeaders.length === 0) {
        return '';
    }
    return ` (without header${absentHeaders.length > 1 ? 's' : ''} ${absentHeaders.join(', ')})`;
}

export function describeRoute({ absentHeaders, method, url }: StubRequest): string {
    return `${method === '*' ? 'ANY' : method} ${url instanceof RegExp ? String(url) : url}${describeAbsent(absentHeaders)}`;
}
