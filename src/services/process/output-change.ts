/** Wakes one waiter when the output of a process grows or the process closes. */
export class OutputChange {
    private waiting: (() => void) | undefined;

    notify(): void {
        this.waiting?.();
    }

    /** Resolves on the next change, or at `deadline` (epoch ms) when none comes. */
    async next(deadline: number): Promise<void> {
        await new Promise<void>((resolve) => {
            const late = setTimeout(resolve, deadline - Date.now());
            this.waiting = () => {
                clearTimeout(late);
                resolve();
            };
        });
    }
}
