/**
 * One answer to "wait" — the framework's one timed pause.
 *
 * The framework waits for four reasons, each through here: the spacing
 * between the pieces of a declared stream, a stub's declared reply delay, a
 * poll for something to become ready (a served process answering, a template
 * lock freed), and the poll behind `waitUntil`. A spec that waits by hand is
 * what J2 refuses. Stated once so there is one place to look when time stops
 * behaving.
 */
export async function pause(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}
