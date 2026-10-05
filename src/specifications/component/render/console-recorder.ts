/** `raised` is the message of an `Error` logged alone: how vitest's browser client relays a window `error` event. */
type ConsoleEntry = { raised?: string; text: string; type: string };

const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const;

type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

export function recordConsole(): { entries: ConsoleEntry[]; stop: () => void } {
    const entries: ConsoleEntry[] = [];
    const originals = new Map<ConsoleMethod, typeof console.log>();
    for (const method of CONSOLE_METHODS) {
        const original = console[method];
        originals.set(method, original);
        console[method] = (...args: unknown[]): void => {
            const [only] = args;
            const raised = args.length === 1 && only instanceof Error ? only.message : undefined;
            entries.push({
                text: args.map(String).join(' '),
                type: method,
                ...(raised === undefined ? {} : { raised }),
            });
            original(...args);
        };
    }
    // outside: Vitest's own listener relays the event as `console.error(new Error(message))` in the same dispatch: one exception is one line.
    const onError = (event: ErrorEvent): void => {
        const last = entries.at(-1);
        if (last?.type === 'error' && last.raised === event.message) {
            entries.pop();
        }
        entries.push({ text: event.message, type: 'error' });
    };
    globalThis.addEventListener('error', onError);
    let stopped = false;
    return {
        entries,
        stop: () => {
            if (stopped) {
                return;
            }
            stopped = true;
            for (const method of CONSOLE_METHODS) {
                const original = originals.get(method);
                if (original !== undefined) {
                    console[method] = original;
                }
            }
            globalThis.removeEventListener('error', onError);
        },
    };
}
