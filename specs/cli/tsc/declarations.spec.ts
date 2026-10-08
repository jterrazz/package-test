import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('declarations', () => {
    test('a consumer module compiles against the installed declarations, and every call they must refuse is refused', async () => {
        // Given - a consumer's project, compiled with `strict` alone: each row of the type channel an `@ts-expect-error` over a call the declarations refuse
        const result = await cli
            .link('@jterrazz/test', packed())
            .fixture(directory('./__fixtures__/consumer/'))
            .link('typescript')
            .exec('node_modules/typescript/bin/tsc --project .');

        // Then - nothing is reported: no unmarked line fails, and no marked one compiles
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('');
    });

    test('a row whose call the declarations accept fails the compilation', async () => {
        // Given - a consumer's project marking as refused a call that compiles
        const result = await cli
            .link('@jterrazz/test', packed())
            .fixture(directory('./__fixtures__/consumer-compiling-row/'))
            .link('typescript')
            .exec('node_modules/typescript/bin/tsc --project .');

        // Then - the compiler names the marker that no longer holds
        expect(result.exitCode).toBe(2);
        expect(result.stdout).toMatch(`
            consumer.ts(3,1): error TS2578: Unused '@ts-expect-error' directive.
        `);
    });
});
