/**
 * Parser / serializer for `.http` fixture files.
 *
 * Requests (`requests/*.http`) hold a COMPLETE request:
 *
 *     POST /users
 *     content-type: application/json
 *
 *     { "name": "Charlie" }
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

export interface ParsedRequestFile {
    /** Raw body text (already serialized), or undefined when absent. */
    body?: string;
    headers: Record<string, string>;
    method: string;
    path: string;
}

export interface ParsedResponseFile {
    /** Parsed JSON body — or the raw text when the body is not valid JSON. */
    body: unknown;
    /** True when a body section is present. */
    hasBody: boolean;
    headers: Record<string, string>;
    /** Status token as written — usually numeric, may be a placeholder. */
    status: string;
}

function splitSections(content: string): {
    body: string;
    headerLines: string[];
    startLine: string;
} {
    const lines = content.split(/\r?\n/);

    let index = 0;
    while (index < lines.length && lines[index].trim() === '') {
        index++;
    }
    const startLine = lines[index] ?? '';
    index++;

    const headerLines: string[] = [];
    while (index < lines.length && lines[index].trim() !== '') {
        headerLines.push(lines[index]);
        index++;
    }

    const body = lines
        .slice(index + 1)
        .join('\n')
        .trim();

    return { body, headerLines, startLine };
}

function parseHeaders(headerLines: string[], fileName: string): Record<string, string> {
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

/** Parse a `requests/*.http` file. First line must be `METHOD /path`. */
export function parseRequestFile(content: string, fileName: string): ParsedRequestFile {
    const { body, headerLines, startLine } = splitSections(content);

    const start = /^(?<method>[A-Z]+)\s+(?<path>\S+)$/.exec(startLine.trim());
    if (!start?.groups) {
        throw new Error(
            `${fileName}: first line must be "METHOD /path" (e.g. "POST /users"), got "${startLine}"`,
        );
    }

    return {
        body: body.length > 0 ? body : undefined,
        headers: parseHeaders(headerLines, fileName),
        method: start.groups.method,
        path: start.groups.path,
    };
}

/** Parse a response `.http` file. First line must be `HTTP/1.1 <status>`. */
export function parseResponseFile(content: string, fileName: string): ParsedResponseFile {
    const { body, headerLines, startLine } = splitSections(content);

    const start = /^HTTP\/1\.1\s+(?<status>\S+)(?:\s+.*)?$/.exec(startLine.trim());
    if (!start?.groups) {
        throw new Error(
            `${fileName}: first line must be "HTTP/1.1 <status>" (e.g. "HTTP/1.1 200 OK"), got "${startLine}"`,
        );
    }

    let parsedBody: unknown;
    if (body.length > 0) {
        try {
            parsedBody = JSON.parse(body);
        } catch {
            parsedBody = body;
        }
    }

    return {
        body: parsedBody,
        hasBody: body.length > 0,
        headers: parseHeaders(headerLines, fileName),
        status: start.groups.status,
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

/** Serialize a response fixture (used by update mode). */
export function serializeResponseFile(response: {
    body: unknown;
    hasBody: boolean;
    headers: Record<string, string>;
    status: string;
}): string {
    const statusNumber = Number(response.status);
    const statusText = STATUS_TEXT[statusNumber];
    const lines = [`HTTP/1.1 ${response.status}${statusText ? ` ${statusText}` : ''}`];

    for (const [name, value] of Object.entries(response.headers)) {
        lines.push(`${name}: ${value}`);
    }

    if (response.hasBody) {
        lines.push('');
        lines.push(
            typeof response.body === 'string' && !isJsonLike(response.body)
                ? response.body
                : JSON.stringify(response.body, null, 4),
        );
    }

    return `${lines.join('\n')}\n`;
}

function isJsonLike(text: string): boolean {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}
