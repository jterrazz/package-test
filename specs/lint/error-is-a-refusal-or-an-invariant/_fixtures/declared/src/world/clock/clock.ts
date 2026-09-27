import { refusal } from '../../../lint/index.refusal.js';

export function advance(pinned: boolean): void {
    if (!pinned) {
        throw new Error(
            refusal({
                fix: "take one first: using _ = clock.at('<iso>')",
                found: 'clock.advance(), and no clock is pinned',
                read: 'docs/05-module-tests.md#time',
                why: 'Only a pinned clock moves.',
            }),
        );
    }
}
