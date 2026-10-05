export type Disconnectable = { on: (event: 'disconnected', listener: () => void) => unknown };

/** Launched on the first ask, again once disconnected; a failed launch is not kept. */
export function createSharedBrowser<T extends Disconnectable>(
    launch: () => Promise<T>,
): () => Promise<T> {
    let shared: Promise<T> | undefined;
    const attempt = async (): Promise<T> => {
        try {
            const browser = await launch();
            browser.on('disconnected', () => {
                shared = undefined;
            });
            return browser;
        } catch (error) {
            shared = undefined;
            throw error;
        }
    };
    return async () => {
        shared ??= attempt();
        return await shared;
    };
}
