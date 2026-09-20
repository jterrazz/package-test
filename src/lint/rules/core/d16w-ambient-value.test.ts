import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { d16wAmbientValue } from './d16w-ambient-value.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('d16w-ambient-value', asOxlintRule(d16wAmbientValue), {
    invalid: [
        // Sampled into the Given, read back through the subject.
        {
            code: `test('stamps', () => {
                const started = Date.now();
                expect(stamp(started).at).toBe(started);
            });`,
            errors: [{ messageId: 'ambientValue' }],
            filename: TEST_FILE,
        },
        // Entropy anywhere in the body.
        {
            code: `test('rolls', () => {
                const seed = Math.random();
                expect(roll(seed)).toBeLessThan(7);
            });`,
            errors: [{ messageId: 'ambientValue' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // Silent where D16 already refuses: one fault, one diagnostic.
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
