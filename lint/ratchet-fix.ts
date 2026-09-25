import { ROUTES_KEY } from '../src/facets/api/routes/baseline.js';

/**
 * The section a fix records: every entry lowered to the count that fell below
 * it, an entry at zero dropped — never an entry raised, never a key added,
 * which would record debt that grew. `undefined` when nothing fell. The run's
 * own key is the run's, and stays as it is held.
 */
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
