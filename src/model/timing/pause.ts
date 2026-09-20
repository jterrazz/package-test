/**
 * One answer to "wait" — the only `setTimeout` the model owns.
 *
 * Two things in the framework genuinely have to wait: the spacing between the
 * pieces of a declared stream, and the poll behind `waitUntil`. Everything
 * else that waits is a spec doing it by hand, which is what J2 refuses. Stated
 * once so there is one place to look when time stops behaving.
 */
export async function pause(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}
