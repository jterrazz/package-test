import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { d17wDoubleOnlyOracle } from './d17w-double-only-oracle.js';

const MODULE_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('d17w-double-only-oracle', asOxlintRule(d17wDoubleOnlyOracle), {
    invalid: [
        // The whole proof is the call log of a port the test built.
        {
            code: `test('notifies', () => {
                const mailer = mockOf<Mailer>();
                notify(mailer);
                expect(mailer.send).toHaveBeenCalledOnce();
            });`,
            errors: [{ messageId: 'doubleOnly' }],
            filename: MODULE_FILE,
        },
        // Two assertions, both on doubles.
        {
            code: `test('notifies', () => {
                const send = vi.fn();
                notify({ send });
                expect(send).toHaveBeenCalledOnce();
                expect(send).toHaveBeenCalledWith('hello');
            });`,
            errors: [{ messageId: 'doubleOnly' }],
            filename: MODULE_FILE,
        },
    ],
    valid: [
        // A double beside something the subject produced.
        {
            code: `test('notifies', () => {
                const mailer = mockOf<Mailer>();
                const result = notify(mailer);
                expect(result).toBe('sent');
                expect(mailer.send).toHaveBeenCalledOnce();
            });`,
            filename: MODULE_FILE,
        },
        // No double at all.
        {
            code: `test('notifies', () => {
                expect(notify()).toBe('sent');
            });`,
            filename: MODULE_FILE,
        },
        // A component reads its callback prop this way by design.
        {
            code: `test('closes', () => {
                const onClose = vi.fn();
                render(<Host onClose={onClose} />);
                expect(onClose).toHaveBeenCalledOnce();
            });`,
            filename: '/repo/src/web/host.test.tsx',
        },
    ],
});
