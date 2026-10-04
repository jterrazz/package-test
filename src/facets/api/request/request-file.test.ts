import { describe, expect, test } from 'vitest';

import { parseRequestFile } from './request-file.js';

describe('parseRequestFile', () => {
    test('http-files — requests — parses method, path, headers, and body', () => {
        // Given - a complete request file
        const parsed = parseRequestFile(
            'POST /users\ncontent-type: application/json\nx-key: abc\n\n{ "name": "Charlie" }\n',
            '_requests/create-user.http',
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

    test('http-files — requests — parses a body-less request', () => {
        // Given - a GET with no body
        const parsed = parseRequestFile('GET /users\n', '_requests/list.http');

        // Then - body is undefined and headers empty
        expect(parsed.method).toBe('GET');
        expect(parsed.path).toBe('/users');
        expect(parsed.headers).toStrictEqual({});
        expect(parsed.body).toBeUndefined();
    });

    test.each(['not a request line', 'x GET /users', 'GET /users HTTP/1.1', 'GET'])(
        'http-files — requests — rejects a first line that is not METHOD /path: %s',
        (line) => {
            // Given - a malformed request line
            // Then - the error names the file and the line, and the shape it should take
            expect(() => parseRequestFile(`${line}\n`, '_requests/bad.http')).toThrow(
                new Error(
                    [
                        `found: _requests/bad.http: the first line is "${line}"`,
                        'why: A request file opens on `METHOD /path`.',
                        'fix: start the request file with its request line: "POST /users"',
                        'read: docs/guides/api-specs.md#http-request-files--full-format',
                    ].join('\n'),
                ),
            );
        },
    );

    test('http-files — requests — reads a request line spaced loosely', () => {
        // Given - a line indented, spaced twice, and trailed by a space
        // Then - the method and path all the same
        expect(parseRequestFile('  DELETE  /users/1 \n', '_requests/loose.http')).toStrictEqual({
            body: undefined,
            headers: {},
            method: 'DELETE',
            path: '/users/1',
        });
    });

    test('http-files — requests — rejects an empty request file', () => {
        // Given - an empty request file
        // Then - the first-line error fires (there is no request line)
        expect(() => parseRequestFile('', '_requests/empty.http')).toThrow(
            'found: _requests/empty.http: the first line is ""',
        );
    });

    test('http-files — requests — parses CRLF line endings', () => {
        // Given - a request file written with Windows line endings
        const parsed = parseRequestFile(
            'POST /users\r\ncontent-type: application/json\r\n\r\n{ "name": "Eve" }\r\n',
            '_requests/crlf.http',
        );

        // Then - sections are identical to the LF form
        expect(parsed.method).toBe('POST');
        expect(parsed.headers).toStrictEqual({ 'content-type': 'application/json' });
        expect(parsed.body).toBe('{ "name": "Eve" }');
    });

    test('http-files — requests — splits headers on the first colon only', () => {
        // Given - a header whose value itself contains colons
        const parsed = parseRequestFile(
            'GET /now\nx-time: 10:30:00\n',
            '_requests/first-colon.http',
        );

        // Then - the value keeps its colons intact
        expect(parsed.headers).toStrictEqual({ 'x-time': '10:30:00' });
    });

    test('http-files — requests — keeps the query string as part of the path', () => {
        // Given - a request line with a query string
        const parsed = parseRequestFile('GET /users?limit=2&sort=name\n', '_requests/query.http');

        // Then - the path is passed through untouched
        expect(parsed.path).toBe('/users?limit=2&sort=name');
    });

    test('http-files — requests — duplicate headers: the last occurrence wins (pinned)', () => {
        // Given - the same header name twice
        const parsed = parseRequestFile(
            'GET /x\nx-a: first\nx-a: second\n',
            '_requests/dupes.http',
        );

        // Then - pinned: object assignment keeps only the last value
        expect(parsed.headers).toStrictEqual({ 'x-a': 'second' });
    });
});
