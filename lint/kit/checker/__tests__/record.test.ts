import { sectionOf } from '@jterrazz/typescript/rules';
import type { Checker } from '@jterrazz/typescript/rules';
import { describe, expect, test, vi } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { recordBaseline } from '../record.js';
import type { CheckerRegistry } from '../registry.js';

const SILENT: CheckerRegistry = {
    chapter: 'docs/probe.md',
    fixes: [],
    measured: () => ({}),
    member: () => [],
    memberPassIds: [],
    rootPassIds: [],
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
            ['.studio/baseline.json › test written: 0 finding(s) across 0 rule(s)\n'],
        ]);
        written.mockRestore();
    });

    test('records each measured quantity beside the counts, and none the tree holds nothing of', async () => {
        // Given - a project whose registry measures one quantity and holds none of another
        const root = packageWith({ '.studio/baseline.json': '{}\n' });
        const written = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
        const measuring = { ...SILENT, measured: () => ({ 'gone/bytes': 0, 'probe/bytes': 160 }) };

        // When - the command records the project
        await recordBaseline(measuring)([root], CHECKER);
        written.mockRestore();

        // Then - the section holds the measured quantity alone
        expect(sectionOf(root, 'test')).toStrictEqual({ 'probe/bytes': 160 });
    });

    test('reads the project root off the first argument that is no flag, and refuses one that is no directory', () => {
        // Given - a root handed after a flag, and a root that does not exist
        const root = packageWith({ 'src/a.ts': 'export const a = 1;\n' });
        const written = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

        // Then - the flag is skipped, and the missing root is refused with 1
        expect(recordBaseline(SILENT)(['--quiet', root], CHECKER)).toBe(0);
        expect(recordBaseline(SILENT)([`${root}/gone`], CHECKER)).toBe(1);
        expect(written.mock.calls.map(([line]) => String(line).split('\n')[0])).toStrictEqual([
            '.studio/baseline.json › test written: 0 finding(s) across 0 rule(s)',
            `found: no such project root: ${root}/gone · why: a path that names nothing holds no spec to judge, and a run over it would read as a clean tree · fix: name an existing project root, or run from inside one · read: docs/reference/linting.md#the-conventions-checker`,
        ]);
        written.mockRestore();
    });
});
