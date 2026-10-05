import type { Preset } from '@jterrazz/typescript/config';
import { fileURLToPath } from 'node:url';

import { presetSeamLawsApartFrom, TEST_COMMENT_OPENINGS } from '../consumer/rulebook/preset.js';
import { ARCHITECTURE } from './checks/architecture.js';
import { sourceRootHoldsKnownEntries } from './checks/source-root-holds-known-entries.js';
import { selfPluginRules } from './rules/plugin.js';

const MSW_ADAPTER_TEST = String.raw`^src/stubs/delivery/msw-handlers\.test\.ts$`;

export function self(): Preset {
    return {
        checker: {
            label: 'Self (@jterrazz/test)',
            module: fileURLToPath(new URL('self.js', import.meta.url)),
        },
        layers: [...ARCHITECTURE, ...presetSeamLawsApartFrom(['network'], MSW_ADAPTER_TEST)],
        name: 'self',
        names: [sourceRootHoldsKnownEntries],
        oxlint: {
            jsPlugins: [fileURLToPath(new URL('plugin.js', import.meta.url))],
            rules: {
                ...selfPluginRules,
                'jterrazz-typescript/comment-states-its-kind': [
                    'error',
                    { openings: [...TEST_COMMENT_OPENINGS, 'env-sanction:', 'RUNTIME '] },
                ],
            },
        },
        package: '@jterrazz/test',
    };
}
