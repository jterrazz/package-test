/**
 * One console line, as the page emitted it. `raised` is the message of the one
 * `Error` a call logged alone — how vitest's browser client relays a window
 * `error` event it leaves to a listener the page holds.
 */
type ConsoleEntry = { raised?: string; text: string; type: string };

/** The console methods a render records; everything else is left alone. */
const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const;

/** One of the five, as a type — what the restore map is keyed by. */
type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

/** Record what the page writes to the console for the length of the render. */
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
    // Vitest's own `error` listener runs first and, since this one exists, logs
    // the event as `console.error(new Error(message))` in the same dispatch: that
    // relay is the entry just pushed, and one exception is one line.
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
