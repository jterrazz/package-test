import { refusal } from '../chain/refusals/refusal.js';

export function advance(pinned: boolean): void {
    if (!pinned) {
        throw new Error(
            refusal({
                fix: "take one first: using _ = clock.at('<iso>')",
                found: 'clock.advance(), and no clock is pinned',
                read: 'docs/reference/time-and-doubles.md#the-clock',
                why: 'Only a pinned clock moves.',
            }),
        );
    }
}
