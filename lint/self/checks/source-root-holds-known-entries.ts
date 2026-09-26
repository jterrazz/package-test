import { resolve } from 'node:path';

import type { Finding } from '../../checks/checker.js';
import type { SelfPassId } from './checker.js';
import { byPosition, finding, listed } from './source.js';

export const SOURCE_ROOT = [
    'elements',
    'expectations',
    'facets',
    'index.browser.ts',
    'index.test.ts',
    'index.ts',
    'kernel',
    'type-channel.test-d.ts',
    'vitest',
    'world',
];

export function checkSourceRootHoldsKnownEntries(root: string): Finding<SelfPassId>[] {
    return listed(resolve(root, 'src'), 'src')
        .filter(({ path }) => path.split('/').length === 2)
        .filter(({ path }) => !SOURCE_ROOT.includes(path.slice('src/'.length)))
        .map(({ directory, path }) =>
            finding('source-root-holds-known-entries', path, {
                fix: 'move it into the tree whose concept it is — what is tested (`facets/`), what surrounds it (`world/`), how a screen is touched (`elements/`), how a result is judged (`expectations/`), the machinery (`kernel/`) or the runner config (`vitest/`)',
                found: `the ${directory ? 'folder' : 'file'} \`${path}\` at the source root, which holds the two entries and the six trees alone`,
            }),
        )
        .toSorted(byPosition);
}
