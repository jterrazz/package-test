import { describe, expect, test } from 'vitest';

import { formatStartupReport } from '../startup-report.js';

// oxlint-disable-next-line no-control-regex -- the ANSI escape IS the control character: dropping it is the point
const plain = (text: string): string[] => text.replaceAll(/\u001B\[[0-9;]*m/gu, '').split('\n');

const HEADER = ['', ' INFRA  Starting infrastructure...', ''];

describe('formatStartupReport', () => {
    test('formatStartupReport — one shape of world, reported in one block — names every declared service, its connection or its error and last logs, then the app the subject is', () => {
        // Given - services up with and without a connection, one refused with twelve lines of logs, one refused with none, one whose error is empty
        const logs = [
            '',
            ...Array.from({ length: 12 }, (_, index) => `line ${index + 1}`),
            '  ',
        ].join('\n');
        const report = formatStartupReport(
            [
                {
                    connectionString: 'postgres://db',
                    durationMs: 120,
                    name: 'db',
                    type: 'postgres',
                },
                { connectionString: '', durationMs: 5, name: 'files', type: 'sqlite' },
                { durationMs: 6, name: 'queue', type: 'redis' },
                { durationMs: 30, error: 'port taken', logs, name: 'cache', type: 'redis' },
                { durationMs: 31, error: 'refused', logs: '', name: 'search', type: 'elastic' },
                { durationMs: 32, error: 'gone', name: 'blob', type: 's3' },
                { durationMs: 7, error: '', name: 'mail', type: 'smtp' },
            ],
            { type: 'in-process' },
        );

        // Then - the whole block: a line per service, its last ten log lines under a refusal, and the app line
        expect(plain(report)).toStrictEqual([
            ...HEADER,
            '  ✓ postgres (db)  postgres://db  120ms',
            '  ✓ sqlite (files)    5ms',
            '  ✓ redis (queue)    6ms',
            '  × redis (cache)  port taken  30ms',
            ...Array.from({ length: 10 }, (_, index) => `    line ${index + 3}`),
            '  × elastic (search)  refused  31ms',
            '  × s3 (blob)  gone  32ms',
            '  ✓ smtp (mail)    7ms',
            '',
            '  → app: in-process (Hono)',
            '',
        ]);
    });

    test('formatStartupReport — one shape of world, reported in one block — the app line names a url, a command, a child process, or nothing for a subject that is no app', () => {
        // Given - each kind of subject, and none
        const apps = [
            { type: 'http', url: 'http://site.test:4000' },
            { type: 'http' },
            { command: 'bun run src/main.ts', type: 'process' },
            { type: 'process' },
            { type: 'none' },
            undefined,
        ] as const;

        // Then - the lines after the header, for each
        expect(
            apps.map((app) => plain(formatStartupReport([], app)).slice(HEADER.length)),
        ).toStrictEqual([
            ['', '  → app: http://site.test:4000', ''],
            ['', '  → app: ', ''],
            ['', '  → app: bun run src/main.ts (child process)', ''],
            ['', '  → app: a child process', ''],
            [''],
            [''],
        ]);
    });
});
