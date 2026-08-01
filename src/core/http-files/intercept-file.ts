/**
 * Parser / matcher for `intercepts/*.http` files — declared HTTP exchanges.
 *
 * A file is a sequence of `###`-separated exchanges. Each exchange is a
 * REQUEST block (method + path line, optional headers — never a body), a
 * blank line, then a RESPONSE block (status line, headers, body):
 *
 *     ### two events
 *
 *     GET /events
 *
 *     HTTP/1.1 200 OK
 *     content-type: application/json
 *
 *     { "items": [] }
 *
 * Both halves reuse the request/response grammar of `http-file.ts`. Matching
 * semantics (shared by the MSW engine on api/jobs and the stub backend on
 * website/mobile): method exact; pathname exact — `{{token}}` segments match
 * structurally (`GET /articles/{{uuid}}`); declared query params are a
 * SUBSET of the observed ones (the app may add extras, ignored); declared
 * headers subset-match, names case-insensitive.
 */

import type { InterceptEntry, InterceptResponse } from '../contracts/types.js';
import { CaptureScope } from '../matching/match.js';
import { placeholderPatternSource, textEquals } from '../matching/structural.js';
import { parseRequestFile, parseResponseFile } from './http-file.js';

// ── Types ──

/** The declared request half of an exchange — the matching trigger. */
export interface ExchangeRequest {
    /** Declared header subset — names case-insensitive, values may carry `{{token}}`s. */
    headers: Record<string, string>;
    method: string;
    /** Path as written, query string included (`/articles?event_id=…`). */
    path: string;
}

/** The declared response half of an exchange — the stubbed reply. */
export interface ExchangeResponse {
    /** Parsed JSON body — or the raw text when the body is not valid JSON. */
    body: unknown;
    /** True when a body section is present. */
    hasBody: boolean;
    headers: Record<string, string>;
    status: number;
}

/** One declared request/response pair of an `intercepts/*.http` file. */
export interface InterceptExchange {
    request: ExchangeRequest;
    response: ExchangeResponse;
}

/** The observed request, reduced to what exchange matching inspects. */
export interface ObservedExchangeRequest {
    /** Request headers, keyed by lowercased header name. */
    headers: Record<string, string>;
    method: string;
    /** Full URL or origin-relative path (`/articles?x=1`) — both accepted. */
    url: string;
}

// ── Parsing ──

/** Split a declared path into its pathname and query halves — never through
 * `new URL()`, which would percent-encode `{{token}}` braces away. */
function splitPath(path: string): { pathname: string; query: URLSearchParams } {
    const separator = path.indexOf('?');
    if (separator === -1) {
        return { pathname: path, query: new URLSearchParams() };
    }
    return {
        pathname: path.slice(0, separator),
        query: new URLSearchParams(path.slice(separator + 1)),
    };
}

/**
 * Parse an `intercepts/*.http` file into its declared exchanges. Malformed
 * files refuse with the exchange number and the expected shape.
 */
export function parseInterceptFile(content: string, fileName: string): InterceptExchange[] {
    // A `###` line opens a new exchange; text on the same line is a comment.
    const segments = content
        .split(/^###.*$/m)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
        throw new Error(
            `${fileName}: no exchanges found — expected "###"-separated request/response pairs`,
        );
    }

    return segments.map((segment, index) => {
        const ordinal = index + 1;
        const lines = segment.split(/\r?\n/);
        const statusIndex = lines.findIndex((line) => /^HTTP\/1\.1\s/.test(line.trim()));
        if (statusIndex === -1) {
            throw new Error(
                `${fileName}: exchange ${ordinal} has no response block — expected an "HTTP/1.1 <status>" line after the request`,
            );
        }

        const request = parseRequestFile(lines.slice(0, statusIndex).join('\n'), fileName);
        if (request.body !== undefined) {
            throw new Error(
                `${fileName}: exchange ${ordinal} declares a request body — matching is method + path + headers only`,
            );
        }

        const response = parseResponseFile(lines.slice(statusIndex).join('\n'), fileName);
        const status = Number(response.status);
        if (!Number.isInteger(status)) {
            throw new Error(
                `${fileName}: exchange ${ordinal} has a non-numeric status "${response.status}" — an intercept file states the stubbed reply, not an expectation`,
            );
        }

        return {
            request: { headers: request.headers, method: request.method, path: request.path },
            response: {
                body: response.body,
                hasBody: response.hasBody,
                headers: response.headers,
                status,
            },
        };
    });
}

// ── Matching ──

/** Token-aware comparison of one declared value against an observed one. */
function valueMatches(declared: string, observed: string): boolean {
    return textEquals(declared, observed, new CaptureScope());
}

/**
 * Does an observed request satisfy a declared exchange request? Method exact,
 * pathname exact (`{{token}}` segments match structurally), declared query
 * params and headers subset-match — extras on the observed side are ignored.
 */
export function exchangeMatches(
    declared: ExchangeRequest,
    observed: ObservedExchangeRequest,
): boolean {
    if (declared.method !== observed.method.toUpperCase()) {
        return false;
    }

    const { pathname, query } = splitPath(declared.path);
    let observedUrl: URL;
    try {
        observedUrl = new URL(observed.url, 'http://stub.invalid');
    } catch {
        return false;
    }

    if (
        !valueMatches(pathname, observedUrl.pathname) &&
        !valueMatches(pathname, safeDecode(observedUrl.pathname))
    ) {
        return false;
    }

    for (const key of new Set(query.keys())) {
        const observedValues = observedUrl.searchParams.getAll(key);
        const everyDeclaredFound = query
            .getAll(key)
            .every((value) => observedValues.some((actual) => valueMatches(value, actual)));
        if (!everyDeclaredFound) {
            return false;
        }
    }

    return Object.entries(declared.headers).every(([name, value]) => {
        const actual = observed.headers[name.toLowerCase()];
        return actual !== undefined && valueMatches(value, actual);
    });
}

/** Decode percent-escapes, falling back to the raw text on malformed input. */
function safeDecode(text: string): string {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}

// ── Conversion to intercept entries (api/jobs — MSW engine) ──

/**
 * A URL pattern routing any-origin requests whose pathname is the declared
 * one — `{{token}}` segments expanded to their grammars. Deliberately no
 * wider than {@link exchangeMatches}: the predicate stays the authority.
 */
function urlPatternOf(path: string): RegExp {
    const { pathname } = splitPath(path);
    return new RegExp(
        String.raw`^https?:\/\/[^/?#]+${placeholderPatternSource(pathname)}(?:\?[^#]*)?(?:#.*)?$`,
    );
}

/**
 * Convert parsed exchanges into generic-http intercept entries for the MSW
 * engine — each exchange becomes one FIFO-consumed contract (CONVENTIONS D7
 * strictness applies unchanged on api/jobs chains).
 */
export function interceptEntriesOf(exchanges: InterceptExchange[]): InterceptEntry[] {
    return exchanges.map((exchange) => {
        const response: InterceptResponse = {
            body: exchange.response.hasBody ? exchange.response.body : null,
            headers:
                Object.keys(exchange.response.headers).length > 0
                    ? exchange.response.headers
                    : undefined,
            status: exchange.response.status,
        };
        return {
            response,
            trigger: {
                adapter: 'http',
                // A MatchableRequest carries no method — the MSW queue already
                // Enforced `trigger.method`, so the declared one is passed.
                match: (request) =>
                    exchangeMatches(exchange.request, {
                        headers: request.headers,
                        method: exchange.request.method,
                        url: request.url,
                    }),
                method: exchange.request.method,
                url: urlPatternOf(exchange.request.path),
                wrap: (data) => ({ body: data, status: 200 }),
            },
        };
    });
}
