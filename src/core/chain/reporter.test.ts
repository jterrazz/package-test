import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../matching/match.js';
import { textEquals } from '../matching/structural.js';
import { formatStartupReport, formatStdoutDiff } from './reporter.js';

/** The diff as a reader sees it, ANSI stripped. */
const plain = (text: string): string[] => text.replaceAll(/\u001B\[[0-9;]*m/gu, '').split('\n');

const tokenAware = (expected: string, actual: string): boolean =>
    textEquals(expected, actual, new CaptureScope());

describe('formatStdoutDiff — only the real cause is marked', () => {
    test('a token line that matched renders as equal, keeping its token', () => {
        // Given - a golden whose first line is a {{url}} the run satisfied, and whose second line is the genuine mismatch
        const expected = 'backend {{url}}\nstatus ready';
        const actual = 'backend http://127.0.0.1:63810/mcp\nstatus degraded';

        // Then - the url line is unmarked and shows the TOKEN; only the status line carries the - / + pair
        const lines = plain(formatStdoutDiff('stdout', expected, actual, { equals: tokenAware }));
        expect(lines).toContain('  backend {{url}}');
        expect(lines).toContain('- status ready');
        expect(lines).toContain('+ status degraded');
        expect(lines).not.toContain('- backend {{url}}');
    });

    test('without a token-aware equality every differing line is marked (pinned)', () => {
        // Given - the same pair, compared strictly (the default)
        const lines = plain(
            formatStdoutDiff('stdout', 'backend {{url}}', 'backend http://127.0.0.1:1/'),
        );

        // Then - strict equality has no notion of a token
        expect(lines).toContain('- backend {{url}}');
    });

    test('a diff that would mark nothing falls back to strict rendering', () => {
        // Given - two texts every line of which the token-aware pass accepts, which happens when the real cause is a cross-line #ref conflict
        const lines = plain(
            formatStdoutDiff('stdout', 'id {{int#a}}\nid {{int#a}}', 'id 1\nid 2', {
                equals: tokenAware,
            }),
        );

        // Then - the reader is shown something rather than a clean block
        expect(lines).toContain('- id {{int#a}}');
        expect(lines).toContain('+ id 1');
    });
});

describe('formatStartupReport — one shape of world, reported in one block', () => {
    test('names every declared service, then the app the subject is', () => {
        // Given - one service that came up and one that refused, with the app running in this process
        const report = plain(
            formatStartupReport(
                [
                    {
                        durationMs: 120,
                        name: 'db',
                        type: 'postgres',
                        connectionString: 'postgres://db',
                    },
                    { durationMs: 30, error: 'port taken', name: 'cache', type: 'redis' },
                ],
                { type: 'in-process' },
            ),
        );

        // Then - the block carries the two services and the app line, and says nothing about a mode: compose mode left with ADR-007
        expect(report.join('\n')).toContain('postgres (db)');
        expect(report.join('\n')).toContain('redis (cache)');
        expect(report.join('\n')).toContain('port taken');
        expect(report.join('\n')).toContain('app: in-process (Hono)');
        expect(report.join('\n')).not.toContain('e2e');
    });

    test('an app reached over HTTP is reported by its url', () => {
        // Given - a world with no service and an app the run did not start
        const report = formatStartupReport([], { type: 'http', url: 'http://site.test:4000' });

        // Then - the url is what the reader is given
        expect(plain(report).join('\n')).toContain('app: http://site.test:4000');
    });

    test('a site started as a child process is not called an app in this process', () => {
        // Given - a website runner whose server is a shell command
        const report = formatStartupReport([], {
            command: 'bun run src/main.ts',
            type: 'process',
        });

        // Then - the line names the command and what it is, not Hono
        expect(report).toContain('app: bun run src/main.ts (child process)');
        expect(report).not.toContain('in-process');
    });

    test('a subject that is not an app gets no app line at all', () => {
        // Given - a cli, a pipeline, a module: nothing served over HTTP
        const report = formatStartupReport([], { type: 'none' });

        // Then - the report says nothing rather than something wrong
        expect(report).not.toContain('app:');
    });
});
