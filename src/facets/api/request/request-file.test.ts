import { describe, expect, test } from 'vitest';

import { parseRequestFile } from './request-file.js';

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
        expect(parsed.headers).toStrictEqual({
            'content-type': 'application/json',
            'x-key': 'abc',
        });
        expect(parsed.body).toBe('{ "name": "Charlie" }');
    });

    test('parses a body-less request', () => {
        // Given - a GET with no body
        const parsed = parseRequestFile('GET /users\n', 'requests/list.http');

        // Then - body is undefined and headers empty
        expect(parsed.method).toBe('GET');
        expect(parsed.path).toBe('/users');
        expect(parsed.headers).toStrictEqual({});
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
        expect(parsed.headers).toStrictEqual({ 'content-type': 'application/json' });
        expect(parsed.body).toBe('{ "name": "Eve" }');
    });

    test('splits headers on the first colon only', () => {
        // Given - a header whose value itself contains colons
        const parsed = parseRequestFile(
            'GET /now\nx-time: 10:30:00\n',
            'requests/first-colon.http',
        );

        // Then - the value keeps its colons intact
        expect(parsed.headers).toStrictEqual({ 'x-time': '10:30:00' });
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
        expect(parsed.headers).toStrictEqual({ 'x-a': 'second' });
    });
});
