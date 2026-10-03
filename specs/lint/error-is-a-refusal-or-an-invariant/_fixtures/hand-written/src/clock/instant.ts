import { refusal } from '../chain/refusals/refusal.js';

export function instantOf(iso: string): Date {
    throw new TypeError(
        refusal({
            fix: "pass an ISO-8601 string: clock.at('2026-03-04T09:30:00Z')",
            found: `clock.at(${JSON.stringify(iso)}), and it is not an instant`,
            read: 'docs/19-time-and-doubles.md#instants',
            why: 'A clock is pinned at an instant.',
        }),
    );
}
