import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { exportedNames, namesOf } from '../exported-names.js';

const ROOT = packageWith({
    'src/entry.ts': [
        "export { a, type B, c as d } from './one.js';",
        "export type { E } from './one.js';",
        'export const f = 1;',
        'export declare function g(): void;',
        "export * from './two.js';",
        '',
    ].join('\n'),
    'src/two.ts': 'export interface H {}\nexport { i };\n',
});

describe('exportedNames', () => {
    test('reads every name a module publishes: its lists, its declarations, and a module it re-exports whole', () => {
        // Given - an entry exporting by list, by declaration and by `export *`
        const names = exportedNames(join(ROOT, 'src/entry.ts'));

        // Then - each name under the name it is published as
        expect([...names].toSorted()).toStrictEqual(['B', 'E', 'H', 'a', 'd', 'f', 'g', 'i']);
    });

    test('namesOf reads `type` and `as` off a list, and drops an empty entry', () => {
        // Given - a list as written, with a trailing comma
        // Then - the bound names
        expect(namesOf(' a, type B, c as d, ')).toStrictEqual(['a', 'B', 'd']);
    });
});
