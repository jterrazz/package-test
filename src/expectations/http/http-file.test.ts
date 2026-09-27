import { describe, expect, test } from 'vitest';

import { parseResponseFile, readBody, serializeResponseFile } from './http-file.js';

describe('http-file', () => {
    test('http-files — responses — parses status, header subset, and JSON body', () => {
        // Given - a complete response file
        const parsed = parseResponseFile(
            'HTTP/1.1 201 Created\ncontent-type: application/json\n\n{ "id": 1 }\n',
            'responses/created.http',
        );

        // Then - every section is extracted
        expect(parsed.status).toBe('201');
        expect(parsed.headers).toStrictEqual({ 'content-type': 'application/json' });
        expect(parsed.hasBody).toBeTruthy();
        expect(parsed.body).toStrictEqual({ id: 1 });
    });

    test('http-files — responses — parses a body-less response', () => {
        // Given - a status-only fixture
        const parsed = parseResponseFile('HTTP/1.1 204 No Content\n', 'responses/gone.http');

        // Then - no body is asserted
        expect(parsed.status).toBe('204');
        expect(parsed.hasBody).toBeFalsy();
    });

    test('http-files — responses — rejects a first line that is not HTTP/1.1 <status>', () => {
        // Given - a malformed response file
        // Then - the error names the file and the expected shape
        expect(() => parseResponseFile('200 OK\n', 'responses/bad.http')).toThrow(
            'found: responses/bad.http: the first line is "200 OK"',
        );
    });

    test('http-files — responses — rejects an empty response file', () => {
        // Given - an empty response file
        // Then - the first-line error fires (there is no status line)
        expect(() => parseResponseFile('', 'responses/empty.http')).toThrow(
            'found: responses/empty.http: the first line is ""',
        );
    });

    test('http-files — responses — parses a status without reason text', () => {
        // Given - a bare "HTTP/1.1 204" line
        const parsed = parseResponseFile('HTTP/1.1 204\n', 'responses/bare.http');

        // Then - the status token is extracted
        expect(parsed.status).toBe('204');
    });

    test('http-files — responses — parses a {{number}} status placeholder', () => {
        // Given - a tokenized status line (rule `no-unknown-token` applies to status too)
        const parsed = parseResponseFile('HTTP/1.1 {{number}}\n', 'responses/token.http');

        // Then - the placeholder is kept as-is for the matcher to interpret
        expect(parsed.status).toBe('{{number}}');
    });

    test('http-files — responses — falls back to the raw text for a non-JSON body', () => {
        // Given - a plain-text body
        const parsed = parseResponseFile(
            'HTTP/1.1 200 OK\n\nplain text, not JSON\n',
            'responses/raw.http',
        );

        // Then - the body is the raw string
        expect(parsed.hasBody).toBeTruthy();
        expect(parsed.body).toBe('plain text, not JSON');
    });

    test('http-files — responses — serialize/parse round-trip keeps a {{number}} status placeholder', () => {
        // Given - a fixture serialized with a tokenized status
        const text = serializeResponseFile({
            body: { ok: true },
            hasBody: true,
            headers: {},
            status: '{{number}}',
        });

        // Then - no bogus reason text is invented and the token survives parsing
        expect(text.startsWith('HTTP/1.1 {{number}}\n')).toBeTruthy();
        expect(parseResponseFile(text, 'responses/roundtrip.http').status).toBe('{{number}}');
    });

    test('http-files — responses — serializes back to the .http format', () => {
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

    test('http-files — a body read by its content-type — a text type keeps its text, even one that would parse as JSON', () => {
        // Given - bodies that parse as JSON, labelled as text
        const read = ['42', 'true', 'null'].map((text) =>
            readBody(text, 'text/plain; charset=UTF-8'),
        );

        // Then - each is its text
        expect(read).toStrictEqual(['42', 'true', 'null']);
    });

    test('http-files — a body read by its content-type — a JSON type, or no type, is the value its text parses to, or the text when it does not parse', () => {
        // Given - the same bodies, labelled JSON, labelled nothing, and a JSON label on a text
        const read = [
            readBody('42', 'application/json'),
            readBody('{"ok":true}', 'application/problem+json'),
            readBody('42'),
            readBody('not json', 'application/json'),
        ];

        // Then - the values, and the text that did not parse
        expect(read).toStrictEqual([42, { ok: true }, 42, 'not json']);
    });

    test('http-files — a body read by its content-type — its surrounding whitespace is dropped, and a blank text holds no body', () => {
        // Given - a text padded with spaces and blank lines, and a blank one
        const read = [readBody('  \n  hello \n\n', 'text/plain'), readBody(' \n ', 'text/plain')];

        // Then - the text alone, then nothing
        expect(read).toStrictEqual(['hello', undefined]);
    });

    test('http-files — a body read by its content-type — a fixture is read by its own content-type first, then by the actual one', () => {
        // Given - a text fixture stating its type, one stating none, and a JSON type stated over a text actual
        const own = parseResponseFile('HTTP/1.1 200\ncontent-type: text/plain\n\n42\n', 'own.http');
        const borrowed = parseResponseFile('HTTP/1.1 200\n\n42\n', 'borrowed.http', 'text/plain');
        const stated = parseResponseFile(
            'HTTP/1.1 200\nContent-Type: application/json\n\n42\n',
            'stated.http',
            'text/plain',
        );

        // Then - the text, the text, and the stated JSON value
        expect([own.body, borrowed.body, stated.body]).toStrictEqual(['42', '42', 42]);
    });

    test('http-files — a body read by its content-type — a text body is written as it is when its type is text, and reads back the same', () => {
        // Given - the text "42" recorded from a text/plain reply whose fixture states no type
        const text = serializeResponseFile(
            { body: '42', hasBody: true, headers: {}, status: '200' },
            'text/plain',
        );

        // Then - written bare, and read back as the text under the same actual type
        expect(text).toBe('HTTP/1.1 200 OK\n\n42\n');
        expect(parseResponseFile(text, 'written.http', 'text/plain').body).toBe('42');
    });
});
