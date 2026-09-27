import { refusal } from '@jterrazz/typescript/rules';

import { COVERAGE_SECTION, drops } from '../../engine/baseline/coverage.js';
import type { CoverageMetrics } from '../../engine/baseline/coverage.js';

export function checkCoverageFloor(
    floor: CoverageMetrics | undefined,
    now: CoverageMetrics,
    scope: string,
): string[] {
    if (floor === undefined) {
        return [
            `jterrazz.baseline.json › ${COVERAGE_SECTION} has no \`${scope}\` floor — run \`npm run coverage\` to record one.`,
        ];
    }
    return drops(floor, now, scope).map(({ teaching }) =>
        refusal({ ...teaching, read: 'docs/03-testing.md#coverage-is-a-ratchet-not-a-threshold' }),
    );
}
