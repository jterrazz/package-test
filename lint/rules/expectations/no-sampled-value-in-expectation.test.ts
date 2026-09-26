import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { noSampledValueInExpectation } from './no-sampled-value-in-expectation.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-sampled-value-in-expectation', asOxlintRule(noSampledValueInExpectation), {
    invalid: [
        // The oracle IS a second reading of the clock.
        {
            code: `test('stamps', () => {
                expect(stamp().at).toBe(Date.now());
            });`,
            errors: [{ messageId: 'sampledOracle' }],
            filename: TEST_FILE,
        },
        // The subject side reads the machine.
        {
            code: `test('stamps', () => {
                expect(new Date()).toEqual(stamp().at);
            });`,
            errors: [{ messageId: 'sampledOracle' }],
            filename: TEST_FILE,
        },
        // Buried inside a structural matcher's expected shape.
        {
            code: `test('stamps', () => {
                expect(stamp()).toStrictEqual({ at: Date.now(), id: randomUUID() });
            });`,
            errors: [{ messageId: 'sampledOracle' }, { messageId: 'sampledOracle' }],
            filename: TEST_FILE,
        },
        // Entropy under the oracle.
        {
            code: `test('rolls', () => {
                expect(roll()).toBe(Math.random());
            });`,
            errors: [{ messageId: 'sampledOracle' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // A pinned instant is not a sample.
        {
            code: `test('stamps', () => {
                expect(stamp().at).toEqual(new Date('2026-03-04T09:30:00Z'));
            });`,
            filename: TEST_FILE,
        },
        // The clock primitive answers the same need, and the token the golden's.
        {
            code: `test('stamps', () => {
                using _ = clock.at('2026-03-04T09:30:00Z');
                expect(stamp().at).toEqual(new Date('2026-03-04T09:30:00Z'));
            });`,
            filename: TEST_FILE,
        },
        // Sampled OUTSIDE the oracle: `no-sampled-value-in-test`'s net, not this one's.
        {
            code: `test('stamps', () => {
                const started = Date.now();
                expect(stamp().at).toBeInstanceOf(Date);
            });`,
            filename: TEST_FILE,
        },
        // A specification samples at startup and is out of reach by role.
        {
            code: `test('stamps', () => {
                expect(label()).toBe(Date.now());
            });`,
            filename: '/repo/specs/api/api.specification.ts',
        },
        // Under a pinned clock a reading is the constant the test chose —
        // which is what this rule's own message asks the author to do.
        {
            code: `test('stamps', () => {
                using _ = clock.at('2026-03-04T09:30:00Z');
                expect(stamp().at).toEqual(new Date());
                expect(Date.now()).toBe(1772616600000);
            });`,
            filename: TEST_FILE,
        },
    ],
});
