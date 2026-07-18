import { describe, expect, test } from 'vitest';

import { parseRequestFile, parseResponseFile, serializeResponseFile } from './http-file.js';

describe('http-files — requests', () => {
    test('parses method, path, headers, and body', () => {
        // Given - a complete request file
        const parsed = parseRequestFile(
            'POST /users\ncontent-type: application/json\nx-key: abc\n\n{ "name": "Charlie" }\n',
            'requests/create-user.http',
        );

        // Then - every section is extracted
        expect(parsed.method).toBe('POST');
        expect(parsed.path).toBe('/users');
        expect(parsed.headers).toEqual({ 'content-type': 'application/json', 'x-key': 'abc' });
        expect(parsed.body).toBe('{ "name": "Charlie" }');
    });

    test('parses a body-less request', () => {
        // Given - a GET with no body
        const parsed = parseRequestFile('GET /users\n', 'requests/list.http');

        // Then - body is undefined and headers empty
        expect(parsed.method).toBe('GET');
        expect(parsed.path).toBe('/users');
        expect(parsed.headers).toEqual({});
        expect(parsed.body).toBeUndefined();
    });

    test('rejects a first line that is not METHOD /path', () => {
        // Given - a malformed request file
        // Then - the error names the file and the expected shape
        expect(() => parseRequestFile('not a request line\n', 'requests/bad.http')).toThrow(
            'requests/bad.http: first line must be "METHOD /path"',
        );
    });

    test('rejects an empty request file', () => {
        // Given - an empty request file
        // Then - the first-line error fires (there is no request line)
        expect(() => parseRequestFile('', 'requests/empty.http')).toThrow(
            'requests/empty.http: first line must be "METHOD /path"',
        );
    });

    test('parses CRLF line endings', () => {
        // Given - a request file written with Windows line endings
        const parsed = parseRequestFile(
            'POST /users\r\ncontent-type: application/json\r\n\r\n{ "name": "Eve" }\r\n',
            'requests/crlf.http',
        );

        // Then - sections are identical to the LF form
        expect(parsed.method).toBe('POST');
        expect(parsed.headers).toEqual({ 'content-type': 'application/json' });
        expect(parsed.body).toBe('{ "name": "Eve" }');
    });

    test('splits headers on the first colon only', () => {
        // Given - a header whose value itself contains colons
        const parsed = parseRequestFile(
            'GET /now\nx-time: 10:30:00\n',
            'requests/first-colon.http',
        );

        // Then - the value keeps its colons intact
        expect(parsed.headers).toEqual({ 'x-time': '10:30:00' });
    });

    test('keeps the query string as part of the path', () => {
        // Given - a request line with a query string
        const parsed = parseRequestFile('GET /users?limit=2&sort=name\n', 'requests/query.http');

        // Then - the path is passed through untouched
        expect(parsed.path).toBe('/users?limit=2&sort=name');
    });

    test('duplicate headers: the last occurrence wins (pinned)', () => {
        // Given - the same header name twice
        const parsed = parseRequestFile('GET /x\nx-a: first\nx-a: second\n', 'requests/dupes.http');

        // Then - pinned: object assignment keeps only the last value
        expect(parsed.headers).toEqual({ 'x-a': 'second' });
    });
});

describe('http-files — responses', () => {
    test('parses status, header subset, and JSON body', () => {
        // Given - a complete response file
        const parsed = parseResponseFile(
            'HTTP/1.1 201 Created\ncontent-type: application/json\n\n{ "id": 1 }\n',
            'responses/created.http',
        );

        // Then - every section is extracted
        expect(parsed.status).toBe('201');
        expect(parsed.headers).toEqual({ 'content-type': 'application/json' });
        expect(parsed.hasBody).toBe(true);
        expect(parsed.body).toEqual({ id: 1 });
    });

    test('parses a body-less response', () => {
        // Given - a status-only fixture
        const parsed = parseResponseFile('HTTP/1.1 204 No Content\n', 'responses/gone.http');

        // Then - no body is asserted
        expect(parsed.status).toBe('204');
        expect(parsed.hasBody).toBe(false);
    });

    test('rejects a first line that is not HTTP/1.1 <status>', () => {
        // Given - a malformed response file
        // Then - the error names the file and the expected shape
        expect(() => parseResponseFile('200 OK\n', 'responses/bad.http')).toThrow(
            'responses/bad.http: first line must be "HTTP/1.1 <status>"',
        );
    });

    test('rejects an empty response file', () => {
        // Given - an empty response file
        // Then - the first-line error fires (there is no status line)
        expect(() => parseResponseFile('', 'responses/empty.http')).toThrow(
            'responses/empty.http: first line must be "HTTP/1.1 <status>"',
        );
    });

    test('parses a status without reason text', () => {
        // Given - a bare "HTTP/1.1 204" line
        const parsed = parseResponseFile('HTTP/1.1 204\n', 'responses/bare.http');

        // Then - the status token is extracted
        expect(parsed.status).toBe('204');
    });

    test('parses a {{number}} status placeholder', () => {
        // Given - a tokenized status line (CONVENTIONS D4 applies to status too)
        const parsed = parseResponseFile('HTTP/1.1 {{number}}\n', 'responses/token.http');

        // Then - the placeholder is kept as-is for the matcher to interpret
        expect(parsed.status).toBe('{{number}}');
    });

    test('falls back to the raw text for a non-JSON body', () => {
        // Given - a plain-text body
        const parsed = parseResponseFile(
            'HTTP/1.1 200 OK\n\nplain text, not JSON\n',
            'responses/raw.http',
        );

        // Then - the body is the raw string
        expect(parsed.hasBody).toBe(true);
        expect(parsed.body).toBe('plain text, not JSON');
    });

    test('serialize/parse round-trip keeps a {{number}} status placeholder', () => {
        // Given - a fixture serialized with a tokenized status
        const text = serializeResponseFile({
            body: { ok: true },
            hasBody: true,
            headers: {},
            status: '{{number}}',
        });

        // Then - no bogus reason text is invented and the token survives parsing
        expect(text.startsWith('HTTP/1.1 {{number}}\n')).toBe(true);
        expect(parseResponseFile(text, 'responses/roundtrip.http').status).toBe('{{number}}');
    });

    test('serializes back to the .http format', () => {
        // Given - a response description
        const text = serializeResponseFile({
            body: { id: '{{uuid}}' },
            hasBody: true,
            headers: { 'content-type': 'application/json' },
            status: '200',
        });

        // Then - status line + headers + blank line + pretty JSON body
        expect(text).toBe(
            'HTTP/1.1 200 OK\ncontent-type: application/json\n\n{\n    "id": "{{uuid}}"\n}\n',
        );
    });
});
