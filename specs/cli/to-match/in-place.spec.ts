import { directory, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../vitest-cli.specification.js';

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('in-place', () => {
    test('a scratch test holding empty values is filled with what it compared, and the next run reads them back', async () => {
        // Given - a scratch test comparing a stream and a json to empty values, run twice under update mode
        const result = await vitestCli
            .fixture(directory('./_fixtures/in-place/'))
            .env({ TEST_UPDATE: '1' })
            .exec(['run', 'run']);

        // Then - both runs passed, and the test now states the whole of each result, indented with its call
        expect(result.exitCode).toBe(0);
        expect(text(result.file('recorded.test.mjs').content)).toMatch(`
            import { expect, test } from 'vitest';

            const { specification, text } = await import(process.env.IN_PLACE_ENTRY);
            const { integration } = await specification.integration({});

            test('records the results in place', async () => {
                const result = await integration.call(() => ({ id: 'order-1', lines: 2 }));
                expect(text('built 3 files in 12ms\\ndone\\n')).toMatch(\`
                    built 3 files in 12ms
                    done
                \`);
                expect(result.value).toMatch({
                    "id": "order-1",
                    "lines": 2
                });
            });
        `);
    });

    test('a failure after a value was written in place frames its own line, and the value lands once the run is reported', async () => {
        // Given - a scratch test recording a value of several lines, then failing below it, run under update mode and the preset's setup
        const result = await vitestCli
            .fixture(directory('./_fixtures/in-place-failure/'))
            .env({ TEST_UPDATE: '1' })
            .exec('run');

        // Then - the failure's code frame is the failing expect, not the lines the recorded value pushed down
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toMatch(/13\|\s+expect\(marker\)\.toBe\('another line'\);/u);
        // And - the value is written in place all the same
        expect(result.file('recorded.test.mjs').content).toContain('"lines": 2');
    });
});
