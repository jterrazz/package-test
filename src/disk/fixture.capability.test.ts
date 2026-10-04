import { describe, expect, test } from 'vitest';

import { fixture } from './fixture.capability.js';
import type { FixturePort } from './fixture.port.js';
import { directory, file } from './spec-path.js';

/** A port that logs each fixture it lays. */
function layingInto(log: string[]): { workdir: FixturePort } {
    return {
        workdir: {
            layer: (path, testDir, workDir) => {
                log.push(`${path} ${testDir} ${workDir}`);
            },
        },
    };
}

const SETUP = { adapters: layingInto([]), config: {} };

describe('fixture', () => {
    test('fixture.capability — .fixture() — lays each fixture stated, in order, into the working directory, and none when the chain has none', async () => {
        // Given - a file and a directory stated in turn
        const log: string[] = [];
        const stated = fixture.reduce(
            fixture.reduce(fixture.initial, [file('./_fixtures/config.json')], SETUP),
            [directory('./_fixtures/shop/')],
            SETUP,
        );

        // When - a chain with a working directory arms, then one without
        await fixture.arm?.(stated, layingInto(log), {
            config: {},
            testDir: '/spec',
            workDir: '/work',
        });
        await fixture.arm?.(stated, layingInto(log), {
            config: {},
            testDir: '/spec',
            workDir: null,
        });

        // Then - each laid once, from the spec's folder
        expect(log).toStrictEqual([
            './_fixtures/config.json /spec /work',
            './_fixtures/shop/ /spec /work',
        ]);
    });

    test('fixture.capability — .fixture() — refuses a value that is no file or directory, in the words of the call', () => {
        // Given - a bare string where a file goes
        // Then - refused by its name
        expect(() =>
            // @ts-expect-error -- a bare path: the type refuses it at every typed site
            fixture.reduce(fixture.initial, ['./_fixtures/config.json'], SETUP),
        ).toThrow(/^found: fixture\("\.\/_fixtures\/config\.json"\)/u);
    });
});
