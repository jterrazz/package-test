import { ROUTES_KEY } from './ratchet.js';

/** Never an entry raised nor a key added, which would record debt that grew; the run's own key stays as held. */
export function tightened(
    counts: Readonly<Record<string, number>>,
    baseline: Readonly<Record<string, number>>,
): Record<string, number> | undefined {
    const next: Record<string, number> = {};
    let fell = false;
    for (const [key, allowed] of Object.entries(baseline)) {
        const count = key === ROUTES_KEY ? allowed : Math.min(counts[key] ?? 0, allowed);
        fell ||= count < allowed;
        if (count > 0) {
            next[key] = count;
        }
    }
    return fell ? next : undefined;
}
