import type { Preset } from '@jterrazz/typescript/config';
import { fileURLToPath } from 'node:url';

import { COVERAGE_SECTION } from '../kit/baseline/coverage.js';
import { ARCHITECTURE } from './checks/architecture.js';
import { sourceRootHoldsKnownEntries } from './checks/source-root-holds-known-entries.js';
import { selfPluginRules } from './rules/plugin.js';

export function self(): Preset {
    return {
        baseline: [COVERAGE_SECTION],
        checker: {
            label: 'Self (@jterrazz/test)',
            module: fileURLToPath(new URL('self.js', import.meta.url)),
        },
        floors: [COVERAGE_SECTION],
        layers: ARCHITECTURE,
        name: 'self',
        names: [sourceRootHoldsKnownEntries],
        oxlint: {
            jsPlugins: [fileURLToPath(new URL('self-oxlint.js', import.meta.url))],
            rules: selfPluginRules,
        },
        package: '@jterrazz/test',
    };
}
