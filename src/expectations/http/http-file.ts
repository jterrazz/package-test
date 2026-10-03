import { refusal } from '../../chain/refusals/refusal.js';

/** Responses hold the status, a subset of headers and the body; each supports `{{placeholder}}` forms. */

export type ParsedResponseFile = {
    /** Parsed JSON body — or the raw text when the body is not valid JSON. */
    body: unknown;
    hasBody: boolean;
    headers: Record<string, string>;
    /** Status token as written — usually numeric, may be a placeholder. */
    status: string;
};

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

export function parseHeaders(headerLines: string[], fileName: string): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of headerLines) {
        const separator = line.indexOf(':');
        if (separator === -1) {
            throw new Error(
                refusal({
                    fix: 'write the header as `Name: value`',
                    found: `${fileName}: the header line "${line}" has no colon`,
                    read: 'docs/12-api.md#http-request-files--full-format',
                    why: 'An `.http` file’s header is a `Name: value` line.',
                }),
            );
        }
        headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return headers;
}

export type BodyKind = 'binary' | 'json' | 'sniffed' | 'text';

const TEXT_MEDIA_TYPES = new Set([
    'application/javascript',
    'application/x-ndjson',
    'application/x-www-form-urlencoded',
    'application/x-yaml',
    'application/xml',
    'application/yaml',
]);

const BINARY_TOP_LEVEL_TYPES = ['audio/', 'font/', 'image/', 'video/'];

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

/** A blank text holds no body: `undefined`. */
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

function statedContentType(headers: Record<string, string>): string | undefined {
    return Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
}

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
            refusal({
                fix: 'start the response file with its status line: "HTTP/1.1 200 OK"',
                found: `${fileName}: the first line is "${startLine}"`,
                read: 'docs/12-api.md#http-request-files--full-format',
                why: 'A response file opens on `HTTP/1.1 <status>`.',
            }),
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

/** A body is written as text or JSON by its `content-type`, the actual response's when the fixture states none. */
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
