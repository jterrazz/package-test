import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from './rule-tester.fixtures.js';
import { subjectOfSource, testTitle } from './test-title.js';

describe('testTitle', () => {
    test('names the default export when it declares a name', () => {
        // Given - a module whose default export is a named function beside a helper
        const source = 'export default function judgeLedgers() {}\nexport const helper = 1;\n';

        // Then - the default export's name, whatever else the module exports
        expect(subjectOfSource('route-judge', source, 'route-judge.ts')).toBe('judgeLedgers');
    });

    test('names the one value export, types not counted', () => {
        // Given - a module exporting one function and two types
        const source =
            'export type Ledger = {};\nexport interface Route {}\nexport function judgeLedgers() {}\n';

        // Then - the function, the one thing a test can call
        expect(subjectOfSource('route-judge', source, 'route-judge.ts')).toBe('judgeLedgers');
    });

    test('names the export spelling the base name when several run', () => {
        // Given - a component module exporting its component and a constant
        const source = 'export const LABELS = {};\nexport function LocaleNote() {}\n';

        // Then - the export whose name is the base name in PascalCase
        expect(subjectOfSource('locale-note', source, 'locale-note.tsx')).toBe('LocaleNote');
    });

    test('falls back to the base name when no export answers', () => {
        // Given - two value exports, neither spelling the base name
        const source = 'export const a = 1;\nexport const b = 2;\n';

        // Then - the file's own base name
        expect(subjectOfSource('route-judge', source, 'route-judge.ts')).toBe('route-judge');
    });

    test('reads the module beside the test, its own extension first', () => {
        // Given - a rendered test beside its component, and a same-named plain module
        const root = packageWith({
            'src/locale-note.ts': 'export const other = 1;\n',
            'src/locale-note.tsx': 'export function LocaleNote() {}\n',
        });

        // Then - the .tsx answers for a .test.tsx; a test with no module beside it keeps its base name
        expect(testTitle(join(root, 'src/locale-note.test.tsx'), 'component')).toStrictEqual({
            named: 'LocaleNote',
            what: 'subject',
        });
        expect(testTitle(join(root, 'src/alone.test.ts'), 'module').named).toBe('alone');
    });
});
