import { useEffect } from 'react';

/** A panel that talks to the console — the two streams' subject. */
export function NoisyPanel() {
    useEffect(() => {
        // oxlint-disable-next-line no-console -- the console IS this fixture's subject: it exists so a spec can read `result.console` and `result.errors`
        console.warn('the panel is deprecated');
        // oxlint-disable-next-line no-console -- same: the error stream is what the spec beside this file asserts on
        console.error('the panel could not reach the cache');
    }, []);
    return <p>Panel</p>;
}
