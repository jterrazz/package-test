import { ruleTester } from '@jterrazz/test';

import { noSampledValueInTest } from '../no-sampled-value-in-test.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-sampled-value-in-test', noSampledValueInTest, {
    invalid: [
        {
            name: 'Sampled into the Given, read back through the subject.',
            code: `test('stamps', () => {
                const started = Date.now();
                expect(stamp(started).at).toBe(started);
            });`,
            errors: [{ column: 32, line: 2, messageId: 'ambientValue' }],
            filename: TEST_FILE,
        },
        {
            name: 'Entropy anywhere in the body.',
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
        {
            name: "Only a `using` of clock.at or clock.run with an instant pins, and a sample inside a non-structural expectation stays the test's.",
            code: `test('stamps', () => {
                const _ = clock.at('2026-03-04T09:30:00Z');
                using a = clock.advance(5000);
                using b = clock.at();
                const after = new Date();
                expect(x).toBeLessThan(Date.now() + 1);
                expect(Date.now() + 1).toBe(2);
            });`,
            errors: [
                { column: 30, line: 5, messageId: 'ambientValue' },
                { column: 39, line: 6, messageId: 'ambientValue' },
                { column: 23, line: 7, messageId: 'ambientValue' },
            ],
            filename: TEST_FILE,
        },
    ],
    valid: [
        {
            name: 'An awaited using pins too, and so does one of several declarators.',
            code: `test('pins', async () => {
                await using _ = await clock.at('2026-03-04T09:30:00Z');
                expect(stamp(new Date())).toBe(true);
            });
            test('pins', () => {
                using a = other(), b = clock.at('2026-03-04T09:30:00Z');
                expect(stamp(new Date())).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        {
            name: "A sample handed to expect itself, or nested in a structural expectation, is that rule's.",
            code: `test('stamps', () => {
                expect(Date.now()).toBe(1);
                expect(stamp()).toEqual({ at: Date.now() });
            });`,
            filename: TEST_FILE,
        },
        {
            name: 'A call that is no test, a test with no callback, and production code are not judged.',
            code: "run(() => { Date.now(); });\ntest('t');",
            filename: TEST_FILE,
        },
        {
            code: "test('t', () => { Date.now(); });",
            filename: '/repo/src/domain/order.ts',
        },
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
        {
            name: 'Silent where `no-sampled-value-in-expectation` already refuses: one fault, one diagnostic.',
            code: `test('stamps', () => {
                expect(stamp().at).toBe(Date.now());
            });`,
            filename: TEST_FILE,
        },
        {
            name: 'A per-run name is the one sample the framework cannot mint.',
            code: `test('writes', () => {
                const directory = \`run-\${Date.now()}\`;
                expect(write(directory)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        {
            name: 'Pinned time, nothing sampled.',
            code: `test('stamps', () => {
                using _ = clock.at('2026-03-04T09:30:00Z');
                expect(stamp().at).toEqual(new Date('2026-03-04T09:30:00Z'));
            });`,
            filename: TEST_FILE,
        },
    ],
});
