import { refusal } from '../chain/refusals/refusal.js';

/** `written` spells the call that stated the instant around a value, so the refusal speaks the words the test wrote. */
export function instantOf(iso: string, written: (value: string) => string): Date {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) {
        const stated = written(JSON.stringify(iso));
        throw new TypeError(
            refusal({
                fix: `pass an ISO-8601 string: ${written("'2026-03-04T09:30:00Z'")}`,
                found: `${stated}, and "${iso}" is not an instant`,
                read: 'docs/19-time-and-doubles.md#the-clock',
                why: 'A clock is pinned at an instant, written as an ISO-8601 string.',
            }),
        );
    }
    return at;
}
