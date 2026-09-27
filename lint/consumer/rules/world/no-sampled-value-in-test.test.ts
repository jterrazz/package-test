import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noSampledValueInTest } from './no-sampled-value-in-test.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-sampled-value-in-test', noSampledValueInTest, {
    invalid: [
        // Sampled into the Given, read back through the subject.
        {
            code: `test('stamps', () => {
                const started = Date.now();
                expect(stamp(started).at).toBe(started);
            });`,
            errors: [{ column: 32, line: 2, messageId: 'ambientValue' }],
            filename: TEST_FILE,
        },
        // Entropy anywhere in the body.
        {
            code: `test('rolls', () => {
                const seed = Math.random();
                expect(roll(seed)).toBeLessThan(7);
            });`,
            errors: [{ column: 29, line: 2, messageId: 'ambientValue' }],
            filename: TEST_FILE,
        },
        {
            code: `test('stamps', () => {
                const before = Date.now();
                {
                    using _ = clock.at('2026-03-04T09:30:00Z');
                }
                const after = new Date();
                using _ = clock.at('2026-03-04T09:30:00Z');
                expect(stamp(before, after)).toBe(true);
            });`,
            errors: [
                { column: 31, line: 2, messageId: 'ambientValue' },
                { column: 30, line: 6, messageId: 'ambientValue' },
            ],
            filename: TEST_FILE,
        },
        {
            code: `test('mints', () => {
                using _ = clock.at('2026-03-04T09:30:00Z');
                const id = randomUUID();
                const roll = Math.random();
                const started = performance.now();
                expect(make(id, roll, started)).toBe(true);
            });`,
            errors: [
                { column: 27, line: 3, messageId: 'ambientValue' },
                { column: 29, line: 4, messageId: 'ambientValue' },
                { column: 32, line: 5, messageId: 'ambientValue' },
            ],
            filename: TEST_FILE,
        },
        {
            code: `test('runs', async () => {
                using _ = clock.run();
                const started = new Date();
                expect(stamp(started)).toBe(true);
            });`,
            errors: [{ column: 32, line: 3, messageId: 'ambientValue' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        {
            code: `test('pins', async () => {
                using _ = clock.at('2026-03-04T09:30:00Z');
                const now = Date.now();
                expect(new Date().toISOString()).toBe('2026-03-04T09:30:00.000Z');
                expect(stamp(now)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        {
            code: `test('runs', async () => {
                using _ = clock.run('2026-03-04T09:30:00Z');
                await clock.advance(5000);
                expect(stamp(new Date())).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        // Silent where `no-sampled-value-in-expectation` already refuses: one fault, one diagnostic.
        {
            code: `test('stamps', () => {
                expect(stamp().at).toBe(Date.now());
            });`,
            filename: TEST_FILE,
        },
        // A per-run name is the one sample the framework cannot mint.
        {
            code: `test('writes', () => {
                const directory = \`run-\${Date.now()}\`;
                expect(write(directory)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        // Pinned time, nothing sampled.
        {
            code: `test('stamps', () => {
                using _ = clock.at('2026-03-04T09:30:00Z');
                expect(stamp().at).toEqual(new Date('2026-03-04T09:30:00Z'));
            });`,
            filename: TEST_FILE,
        },
    ],
});
