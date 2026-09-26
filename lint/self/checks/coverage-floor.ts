import { BASELINE_FILE, drops } from '../../engine/baseline/coverage.js';
import type { CoverageMetrics } from '../../engine/baseline/coverage.js';

export function checkCoverageFloor(
    floor: CoverageMetrics | undefined,
    now: CoverageMetrics,
    scope: string,
): string[] {
    if (floor === undefined) {
        return [
            `${BASELINE_FILE} has no \`${scope}\` floor — run \`npm run coverage\` to record one.`,
        ];
    }
    const fell = drops(floor, now);
    return fell.length === 0
        ? []
        : [
              ...fell,
              'the ratchet only rises. Cover what the change left bare, or lower the floor in a commit that says why.',
          ];
}
