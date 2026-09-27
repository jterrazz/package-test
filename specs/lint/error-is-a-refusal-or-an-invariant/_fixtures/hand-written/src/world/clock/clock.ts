export function advance(pinned: boolean): void {
    if (!pinned) {
        throw new Error('clock.advance(): no clock is pinned');
    }
}

class PinError extends Error {}

export function pin(pinned: boolean): void {
    if (pinned) {
        throw new PinError('clock.at(): a clock is pinned already');
    }
}
