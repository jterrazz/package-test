import { labelOf, refusal } from '@jterrazz/typescript/rules';
import type { Counts } from '@jterrazz/typescript/rules';

import { COVERAGE_SECTION, drops } from '../../kit/baseline/coverage.js';

export function checkCoverageFloor(
    floor: Counts | undefined,
    now: Counts,
    scope: string,
): string[] {
    if (floor === undefined) {
        return [
            refusal({
                fix: 'run `npm run coverage`, which records the floor the suite reached',
                found: `${labelOf(COVERAGE_SECTION)} holds no \`${scope}\` floor`,
                read: 'docs/03-testing.md#coverage-is-a-ratchet-not-a-threshold',
                why: 'a scope with no floor is held to nothing, so its coverage could fall unseen',
            }),
        ];
    }

    return drops(floor, now).map(({ teaching }) =>
        refusal({ ...teaching, read: 'docs/03-testing.md#coverage-is-a-ratchet-not-a-threshold' }),
    );
}
