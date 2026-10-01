import type { NamesRule } from '@jterrazz/typescript/config';
import { firstSentence, readAt, rowNamed } from '@jterrazz/typescript/rules';

import { SELF_CHAPTER, selfRows } from '../catalogue/manifest.js';

const TREES = [
    'chain',
    'clock',
    'disk',
    'expectations',
    'facets',
    'mocks',
    'services',
    'stubs',
    'visitor',
    'vitest',
];

const ENTRIES: Readonly<Record<string, string>> = {
    '.browser.ts': 'index',
    '.test-d.ts': 'index',
    '.test.ts': 'index',
    '.ts': 'index',
    '.vitest.test.ts': 'index',
    '.vitest.ts': 'index',
};

const row = rowNamed(selfRows, 'source-root-holds-known-entries');

export const sourceRootHoldsKnownEntries: NamesRule = {
    fix: 'move it into the tree whose concept it is — what is tested (`facets/`), how a screen is touched (`visitor/`), how a result is judged (`expectations/`), what surrounds the subject (`stubs/`, `services/`, `disk/`, `clock/`, `mocks/`), the machinery (`chain/`) or the runner config (`vitest/`)',
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
    why: firstSentence(row.sentence),
};
