/**
 * The `.http` grammar — a start line, headers, a blank line, a body — and the
 * response files the goldens judge by. The request files the api facet sends
 * are parsed by `facets/api/request/request-file.ts` on the same sections.
 *
 * Responses (`expected/*.http`) hold the expected status, a SUBSET of
 * headers, and the expected JSON body. Status, headers, and body support
 * `{{placeholder}}` forms:
 *
 *     HTTP/1.1 201 Created
 *     content-type: {{string}}
 *
 *     { "id": "{{uuid#user}}" }
 */

export type ParsedResponseFile = {
    /** Parsed JSON body — or the raw text when the body is not valid JSON. */
    body: unknown;
    /** True when a body section is present. */
    hasBody: boolean;
    headers: Record<string, string>;
    /** Status token as written — usually numeric, may be a placeholder. */
    status: string;
};

/** A message's three sections: its start line, its header lines, its body. */
export function splitSections(content: string): {
    body: string;
    headerLines: string[];
    startLine: string;
} {
    const lines = content.split(/\r?\n/u);

    let index = 0;
    while (lines[index]?.trim() === '') {
        index++;
    }
    const startLine = lines[index] ?? '';
    index++;

    const headerLines: string[] = [];
    let header = lines[index];
    while (header !== undefined && header.trim() !== '') {
        headerLines.push(header);
        index++;
        header = lines[index];
    }

    const body = lines
        .slice(index + 1)
        .join('\n')
        .trim();

    return { body, headerLines, startLine };
}

/** The header lines as a record — each `Name: value`, refused otherwise. */
export function parseHeaders(headerLines: string[], fileName: string): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of headerLines) {
        const separator = line.indexOf(':');
        if (separator === -1) {
            throw new Error(`${fileName}: invalid header line "${line}" (expected "Name: value")`);
        }
        headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return headers;
}

/** How a body is read, by the media type that labels it. */
export type BodyKind = 'binary' | 'json' | 'sniffed' | 'text';

/** The media types outside `text/*` and `+xml` whose bodies are text. */
const TEXT_MEDIA_TYPES = new Set([
    'application/javascript',
    'application/x-ndjson',
    'application/x-www-form-urlencoded',
    'application/x-yaml',
    'application/xml',
    'application/yaml',
]);

/** The top-level types whose bodies are bytes. */
const BINARY_TOP_LEVEL_TYPES = ['audio/', 'font/', 'image/', 'video/'];

/** The media types outside those top-level types whose bodies are bytes. */
const BINARY_MEDIA_TYPES = new Set([
    'application/gzip',
    'application/octet-stream',
    'application/pdf',
    'application/protobuf',
    'application/vnd.google.protobuf',
    'application/wasm',
    'application/x-gzip',
    'application/x-protobuf',
    'application/x-tar',
    'application/zip',
]);

/**
 * The kind a `content-type` labels: JSON (`application/json`, `+json`),
 * text (`text/*`, `+xml`, and the text media types above), binary (`audio/*`,
 * `font/*`, `image/*`, `video/*` and the binary media types above), or
 * sniffed — any other type, and no type at all.
 */
export function bodyKind(contentType: string | undefined): BodyKind {
    const media = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (media === 'application/json' || media.endsWith('+json')) {
        return 'json';
    }
    if (media.startsWith('text/') || media.endsWith('+xml') || TEXT_MEDIA_TYPES.has(media)) {
        return 'text';
    }
    if (
        BINARY_MEDIA_TYPES.has(media) ||
        BINARY_TOP_LEVEL_TYPES.some((type) => media.startsWith(type))
    ) {
        return 'binary';
    }
    return 'sniffed';
}

/**
 * The value a body's text holds, read by its `content-type`: the surrounding
 * whitespace dropped, then a text type's body as its text, and any other
 * body as the JSON value it parses to — or its text when it is not JSON. A
 * blank text holds no body: `undefined`.
 */
export function readBody(text: string, contentType?: string): unknown {
    const body = text.trim();
    if (body.length === 0) {
        return undefined;
    }
    if (bodyKind(contentType) === 'text') {
        return body;
    }
    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}

/** The `content-type` a header map states, whatever the case of its name. */
function statedContentType(headers: Record<string, string>): string | undefined {
    return Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
}

/**
 * Parse a response `.http` file. First line must be `HTTP/1.1 <status>`. Its
 * body is read by the `content-type` the file states, or by `contentType` —
 * the actual response's — when it states none.
 */
export function parseResponseFile(
    content: string,
    fileName: string,
    contentType?: string,
): ParsedResponseFile {
    const { body, headerLines, startLine } = splitSections(content);

    const start = /^HTTP\/1\.1\s+(?<status>\S+)(?:\s+.*)?$/u.exec(startLine.trim());
    const status = start?.groups?.status;
    if (status === undefined) {
        throw new Error(
            `${fileName}: first line must be "HTTP/1.1 <status>" (e.g. "HTTP/1.1 200 OK"), got "${startLine}"`,
        );
    }

    const headers = parseHeaders(headerLines, fileName);
    return {
        body: readBody(body, statedContentType(headers) ?? contentType),
        hasBody: body.length > 0,
        headers,
        status,
    };
}

const STATUS_TEXT: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
};

/**
 * Serialize a response fixture (used by update mode). A text body is written
 * as it is when the fixture's `content-type` — or `contentType`, the actual
 * response's, when it states none — labels it text, as JSON when it labels
 * it JSON, and as it is otherwise unless the text would read back as JSON.
 */
export function serializeResponseFile(
    response: {
        body: unknown;
        hasBody: boolean;
        headers: Record<string, string>;
        status: string;
    },
    contentType?: string,
): string {
    const statusNumber = Number(response.status);
    const statusText = STATUS_TEXT[statusNumber];
    const lines = [`HTTP/1.1 ${response.status}${statusText ? ` ${statusText}` : ''}`];

    for (const [name, value] of Object.entries(response.headers)) {
        lines.push(`${name}: ${value}`);
    }

    if (response.hasBody) {
        const kind = bodyKind(statedContentType(response.headers) ?? contentType);
        lines.push(
            '',
            writtenAsText(response.body, kind)
                ? response.body
                : JSON.stringify(response.body, null, 4),
        );
    }

    return `${lines.join('\n')}\n`;
}

/** Is this body written as its own text, rather than as JSON? */
function writtenAsText(body: unknown, kind: BodyKind): body is string {
    if (typeof body !== 'string' || kind === 'json') {
        return false;
    }
    return kind === 'text' || !isJsonLike(body);
}

function isJsonLike(text: string): boolean {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}
