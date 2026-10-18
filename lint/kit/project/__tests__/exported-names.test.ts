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
        "export type * from './three.js';",
        'export default 1;',
        '',
    ].join('\n'),
    'src/one.ts': 'export const a = 1, c = 2;\nexport type B = 1;\nexport type E = 1;\n',
    'src/three.ts': 'export type J = 1;\n',
    'src/two.ts': 'export interface H {}\nexport const i = 1;\n',
});

describe('exportedNames', () => {
    test('reads every name a module publishes: its lists, its declarations, and a module it re-exports whole', () => {
        // Given - an entry exporting by list, by declaration, by `export *` and by default
        const names = exportedNames(join(ROOT, 'src/entry.ts'));

        // Then - each name under the name it is published as, the default named by no one
        expect([...names].toSorted()).toStrictEqual(['B', 'E', 'H', 'J', 'a', 'd', 'f', 'g', 'i']);
    });

    test('namesOf reads `type` and `as` off a list, whatever its spacing, and drops what binds no name', () => {
        // Given - a list as written by hand, with an entry of two words and a trailing comma
        // Then - the bound names
        expect(namesOf('x, type   B,  c  as  d , e f, ')).toStrictEqual(['x', 'B', 'd']);
    });
});
