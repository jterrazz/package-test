import type { NamesRule } from '@jterrazz/typescript/config';

import { readAt, rowNamed, whyOf } from '../../engine/catalogue/lesson.js';
import { SELF_CHAPTER, selfRows } from '../catalogue/manifest.js';

const TREES = ['elements', 'expectations', 'facets', 'kernel', 'vitest', 'world'];

const ENTRIES: Readonly<Record<string, string>> = {
    '.browser.ts': 'index',
    '.test-d.ts': 'type-channel',
    '.test.ts': 'index',
    '.ts': 'index',
    '.vitest.test.ts': 'index',
    '.vitest.ts': 'index',
};

const row = rowNamed(selfRows, 'source-root-holds-known-entries');

export const sourceRootHoldsKnownEntries: NamesRule = {
    fix: 'move it into the tree whose concept it is — what is tested (`facets/`), what surrounds it (`world/`), how a screen is touched (`elements/`), how a result is judged (`expectations/`), the machinery (`kernel/`) or the runner config (`vitest/`)',
    ls: {
        src: {
            ...Object.fromEntries(['.*', '.*.*', '.*.*.*'].map((key) => [key, 'exists:0'])),
            ...Object.fromEntries(
                Object.entries(ENTRIES).map(([extension, name]) => [extension, `regex:${name}`]),
            ),
        },
        'src/*': { '.dir': `regex:${TREES.join('|')}` },
        'src/*/*': { '.dir': 'regex:.+' },
    },
    name: 'source-root-holds-known-entries',
    read: readAt(row, SELF_CHAPTER),
    why: whyOf(row.convention),
};
