import type { Preset } from '@jterrazz/typescript/config';

import { COVERAGE_SECTION } from '../../engine/baseline/coverage.js';

export function coveragePreset(): Preset {
    return {
        baseline: [COVERAGE_SECTION],
        floors: [COVERAGE_SECTION],
        name: 'coverage',
        package: '@jterrazz/test',
    };
}
