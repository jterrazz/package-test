import { refusal } from '../../chain/refusals/refusal.js';

/** The value, or a failure naming what was missing and why it mattered. */
export function required<T>(value: null | T | undefined, why: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            refusal({
                fix: 'state it in the Given, or assert on what the subject actually produced',
                found: `required(): ${why} — got ${value === null ? 'null' : 'undefined'}`,
                read: 'docs/21-assertions.md#two-helpers-that-are-not-matchers',
                why: '`required()` answers a present value, and `null` and `undefined` are the two it refuses.',
            }),
        );
    }
    return value;
}
