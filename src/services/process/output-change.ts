/** Wakes one waiter when the output of a process grows or the process closes. */
export class OutputChange {
    private waiting: (() => void) | undefined;

    notify(): void {
        this.waiting?.();
    }

    /** Resolves on the next change, or after `withinMs` when none comes. */
    async next(withinMs: number): Promise<void> {
        await new Promise<void>((resolve) => {
            const late = setTimeout(resolve, withinMs);
            this.waiting = () => {
                clearTimeout(late);
                resolve();
            };
        });
    }
}
