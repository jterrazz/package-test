import { describe, expect, test } from 'vitest';

import { bodyKind, parseResponseFile, readBody, serializeResponseFile } from './http-file.js';

const parse = (content: string) => parseResponseFile(content, 'r.http');

const refusalOf = (content: string): string => {
    try {
        parseResponseFile(content, 'r.http');
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
};
const READ_LINK = 'read: docs/guides/api-specs.md#http-request-files--full-format';

const write = (body: unknown, headers: Record<string, string>, contentType?: string): string =>
    serializeResponseFile({ body, hasBody: true, headers, status: '200' }, contentType);

describe('http-file', () => {
    test('http-files — responses — parses each section as written: blank lines before the status, header names and values trimmed, the headers ended by a blank line, a body of many lines', () => {
        // Given - files of each shape

        // Then - each parsed whole
        expect([
            parse('HTTP/1.1 201 Created\ncontent-type: application/json\n\n{ "id": 1 }\n'),
            parse('\n  \n  HTTP/1.1 204  \nx-a : 1\nx-b:  two  \n   \nline one\nline two\n'),
            parse('HTTP/1.1 {{number}}\n'),
        ]).toStrictEqual([
            {
                body: { id: 1 },
                hasBody: true,
                headers: { 'content-type': 'application/json' },
                status: '201',
            },
            {
                body: 'line one\nline two',
                hasBody: true,
                headers: { 'x-a': '1', 'x-b': 'two' },
                status: '204',
            },
            { body: undefined, hasBody: false, headers: {}, status: '{{number}}' },
        ]);
    });

    test('http-files — responses — refuses a file that does not open on HTTP/1.1 <status>, and a header line with no colon', () => {
        // Given - a malformed start line, an empty file, and a header with no colon

        // Then - each refusal whole
        expect([
            refusalOf('200 OK\n'),
            refusalOf(''),
            refusalOf('HTTP/1.1 200\nbroken header\n'),
        ]).toStrictEqual([
            [
                'found: r.http: the first line is "200 OK"',
                'why: A response file opens on `HTTP/1.1 <status>`.',
                'fix: start the response file with its status line: "HTTP/1.1 200 OK"',
                READ_LINK,
            ].join('\n'),
            [
                'found: r.http: the first line is ""',
                'why: A response file opens on `HTTP/1.1 <status>`.',
                'fix: start the response file with its status line: "HTTP/1.1 200 OK"',
                READ_LINK,
            ].join('\n'),
            [
                'found: r.http: the header line "broken header" has no colon',
                'why: An `.http` file’s header is a `Name: value` line.',
                'fix: write the header as `Name: value`',
                READ_LINK,
            ].join('\n'),
        ]);
    });

    test('http-files — responses — a body is written by the content-type the file states first, then the actual one: JSON for a JSON type even from text, text for a text type, a JSON-like text kept a string', () => {
        // Given - responses with a body of each kind, and one with none

        // Then - each file written
        expect([
            write('plain', { 'Content-Type': 'application/json' }),
            write('{"a":1}', {}),
            write('plain', {}),
            write('{"a":1}', { 'x-a': 'text/plain' }, 'text/plain'),
            write('plain', { 'x-kind': 'text/plain' }, 'application/json'),
            serializeResponseFile({ body: undefined, hasBody: false, headers: {}, status: '599' }),
        ]).toStrictEqual([
            'HTTP/1.1 200 OK\nContent-Type: application/json\n\n"plain"\n',
            'HTTP/1.1 200 OK\n\n"{\\"a\\":1}"\n',
            'HTTP/1.1 200 OK\n\nplain\n',
            'HTTP/1.1 200 OK\nx-a: text/plain\n\n{"a":1}\n',
            'HTTP/1.1 200 OK\nx-kind: text/plain\n\n"plain"\n',
            'HTTP/1.1 599\n',
        ]);
    });

    test('http-files — responses — falls back to the raw text for a non-JSON body', () => {
        // Given - a plain-text body
        const parsed = parseResponseFile(
            'HTTP/1.1 200 OK\n\nplain text, not JSON\n',
            'responses/raw.http',
        );

        // Then - the body is the raw string
        expect(parsed.hasBody).toBe(true);
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
        expect(text.startsWith('HTTP/1.1 {{number}}\n')).toBe(true);
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

    test('http-files — a body read by its content-type — a type is read by its essence alone, whatever its case or parameters', () => {
        // Given - one type of every kind, spelled as servers send them: capitals, a charset, a suffix
        const types = [
            'Application/Vnd.Api+Json',
            'TEXT/CSV; charset=utf-8',
            'image/svg+xml',
            'application/x-ndjson',
            'IMAGE/PNG',
            'application/octet-stream',
            'application/gzip',
            'application/x-unknown',
            ' Text/Plain ; charset=utf-8',
            'application/json; charset=utf-8',
        ];

        // Then - each is the kind its essence names, and an unknown one is sniffed
        expect(types.map((type) => bodyKind(type))).toStrictEqual([
            'json',
            'text',
            'text',
            'text',
            'binary',
            'binary',
            'binary',
            'sniffed',
            'text',
            'json',
        ]);
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
