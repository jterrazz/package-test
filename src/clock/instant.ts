import { refusal } from '../chain/refusals/refusal.js';

export function instantOf(method: string, iso: string): Date {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) {
        throw new TypeError(
            refusal({
                fix: `pass an ISO-8601 string: clock.${method}('2026-03-04T09:30:00Z')`,
                found: `clock.${method}(${JSON.stringify(iso)}), and "${iso}" is not an instant`,
                read: 'docs/19-time-and-doubles.md#the-clock',
                why: 'A clock is pinned at an instant, written as an ISO-8601 string.',
            }),
        );
    }
    return at;
}
