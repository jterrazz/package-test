import { describe, expect, test } from 'vitest';

import { formatStartupReport } from './startup-report.js';

// oxlint-disable-next-line no-control-regex -- the ANSI escape IS the control character: dropping it is the point
const plain = (text: string): string[] => text.replaceAll(/\u001B\[[0-9;]*m/gu, '').split('\n');

describe('formatStartupReport', () => {
    test('formatStartupReport — one shape of world, reported in one block — names every declared service, then the app the subject is', () => {
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

    test('formatStartupReport — one shape of world, reported in one block — an app reached over HTTP is reported by its url', () => {
        // Given - a world with no service and an app the run did not start
        const report = formatStartupReport([], { type: 'http', url: 'http://site.test:4000' });

        // Then - the url is what the reader is given
        expect(plain(report).join('\n')).toContain('app: http://site.test:4000');
    });

    test('formatStartupReport — one shape of world, reported in one block — a site started as a child process is not called an app in this process', () => {
        // Given - a website runner whose server is a shell command
        const report = formatStartupReport([], {
            command: 'bun run src/main.ts',
            type: 'process',
        });

        // Then - the line names the command and what it is, not Hono
        expect(report).toContain('app: bun run src/main.ts (child process)');
        expect(report).not.toContain('in-process');
    });

    test('formatStartupReport — one shape of world, reported in one block — a subject that is not an app gets no app line at all', () => {
        // Given - a cli, a pipeline, a module: nothing served over HTTP
        const report = formatStartupReport([], { type: 'none' });

        // Then - the report says nothing rather than something wrong
        expect(report).not.toContain('app:');
    });
});
