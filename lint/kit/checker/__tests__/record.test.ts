import type { Checker } from '@jterrazz/typescript/rules';
import { describe, expect, test, vi } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { recordBaseline } from '../record.js';
import type { CheckerRegistry } from '../registry.js';

const SILENT: CheckerRegistry = {
    chapter: 'docs/probe.md',
    fixes: [],
    member: () => [],
    memberPassIds: [],
    rows: [],
    tree: [],
    treePassIds: [],
};

// invariant: the command reads no part of the checker it is handed.
const CHECKER: Checker = { base: () => [], passes: {} };

describe('recordBaseline', () => {
    test('records where the project stands and says so in one line', () => {
        // Given - a project the passes find nothing in
        const root = packageWith({ 'src/a.ts': 'export const a = 1;\n' });
        const written = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

        // Then - the command succeeds, naming the section, the findings and the rules
        expect(recordBaseline(SILENT)([root], CHECKER)).toBe(0);
        expect(written.mock.calls).toStrictEqual([
            ['.jterrazz/baseline.json › test written: 0 finding(s) across 0 rule(s)\n'],
        ]);
        written.mockRestore();
    });
});
