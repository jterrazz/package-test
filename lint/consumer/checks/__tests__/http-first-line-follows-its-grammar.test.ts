import { describe, expect, test } from 'vitest';

import { checkHttpFirstLineFollowsItsGrammar } from '../http-first-line-follows-its-grammar.js';

describe('checkHttpFirstLineFollowsItsGrammar', () => {
    test('a request opens on its request line and a response on its status line, past blank lines and indentation', () => {
        // Given - requests and responses whose first written line is right, wrong, indented, or missing
        const judged = [
            ['request', 'POST /users HTTP/1.1\nHost: x\n'],
            ['request', '\n  \n   GET /\n'],
            ['request', 'FETCH /users\n'],
            ['request', 'GET users\n'],
            ['request', '\n  \n'],
            ['response', 'HTTP/1.1 201 Created\n'],
            ['response', '\n HTTP/2 404\n'],
            ['response', 'HTTP/1.1 2000\n'],
            ['response', 'status 200\n'],
        ] as const;

        // Then - the ones that open on no such line, each told what to write
        expect(
            judged.flatMap(([side, text], at) =>
                checkHttpFirstLineFollowsItsGrammar(`${at}.http`, `${at}.http`, text, side).map(
                    ({ fix, found, line, path, rule }) =>
                        `${rule} ${path}:${line} ${found} — ${fix}`,
                ),
            ),
        ).toStrictEqual([
            'http-first-line-follows-its-grammar 2.http:1 the first line of 2.http is no request line — start 2.http with its request line, `GET /path` or another method',
            'http-first-line-follows-its-grammar 3.http:1 the first line of 3.http is no request line — start 3.http with its request line, `GET /path` or another method',
            'http-first-line-follows-its-grammar 4.http:1 the first line of 4.http is no request line — start 4.http with its request line, `GET /path` or another method',
            'http-first-line-follows-its-grammar 7.http:1 the first line of 7.http is no status line — start 7.http with its status line, `HTTP/1.1 200 OK` or the status it expects',
            'http-first-line-follows-its-grammar 8.http:1 the first line of 8.http is no status line — start 8.http with its status line, `HTTP/1.1 200 OK` or the status it expects',
        ]);
    });
});
