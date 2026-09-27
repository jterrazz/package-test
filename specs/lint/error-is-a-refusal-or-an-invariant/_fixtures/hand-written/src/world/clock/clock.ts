export function advance(pinned: boolean): void {
    if (!pinned) {
        throw new Error('clock.advance(): no clock is pinned');
    }
}
