import { describe, expect, test } from 'vitest';

import { commandSpec } from '../../setup/command.specification.js';

describe('command assertions', () => {
    describe('exitCode', () => {
        test('passes on correct exit code', async () => {
            const result = await commandSpec('exit 0').project('cli-app').exec('build').run();
            expect(result.exitCode).toBe(0);
        });
    });

    describe('stdout', () => {
        test('passes when stdout contains string', async () => {
            const result = await commandSpec('stdout match').project('cli-app').exec('build').run();
            expect(result.stdout.text).toContain('Build completed');
        });
    });

    describe('stderr', () => {
        test('passes when stderr contains string', async () => {
            const result = await commandSpec('stderr match').project('cli-app').exec('fail').run();
            expect(result.stderr.text).toContain('Fatal: something went wrong');
        });
    });

    describe('fixture setup', () => {
        test('copies fixture file into working dir before exec', async () => {
            // Given - fixture file that triggers check failure
            const result = await commandSpec('fixture check')
                .project('cli-app')
                .fixture('invalid.ts')
                .exec('check')
                .run();

            // Then - check detected the invalid file
            expect(result.exitCode).toBe(1);
            expect(result.stderr.text).toContain('unused-var');
        });

        test('clean project has no invalid files', async () => {
            const result = await commandSpec('clean check').project('cli-app').exec('check').run();

            expect(result.exitCode).toBe(0);
            expect(result.stdout.text).toContain('All checks passed');
        });
    });

    describe('chaining', () => {
        test('chains multiple assertions', async () => {
            const result = await commandSpec('chained').project('cli-app').exec('build').run();

            expect(result.exitCode).toBe(0);
            expect(result.stdout.text).toContain('Build completed');
            expect(result.file('dist/index.js').exists).toBe(true);
            expect(result.file('dist/manifest.json').exists).toBe(true);
            expect(result.file('dist/index.cjs').exists).toBe(false);
            expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
        });
    });
});
