import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMember, runMembers } from './member-run.js';
import type { CheckerRegistry, MemberRead, Spotted } from './registry.js';

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/_shared/_fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

type Seen = Pick<MemberRead, 'label' | 'subject'> & { config: null | string; findingAt: string };

function recording(): { registry: CheckerRegistry; seen: Seen[] } {
    const seen: Seen[] = [];
    const probe: Spotted = {
        path: 'package.json',
        fix: '',
        found: '',
        line: 1,
        rule: 'probe',
    };
    const registry: CheckerRegistry = {
        chapter: 'docs/probe.md',
        fixes: [],
        member: (read) => {
            const [anchored] = read.anchored([probe]);
            seen.push({
                config: read.config === null ? null : read.config.slice(read.memberDir.length + 1),
                findingAt: anchored?.path ?? '',
                label: read.label,
                subject: read.subject,
            });
            return [];
        },
        memberPassIds: [],
        rows: [],
        tree: [],
        treePassIds: [],
    };
    return { registry, seen };
}

describe('member-run', () => {
    test('hands the member pass the member as the root sees it: its label, its config, and findings anchored under it', () => {
        // Given - a member carrying its settings file, read from the workspace root
        const { registry, seen } = recording();
        runMember(memberAt('simulated-dom'), WORKSPACE, registry);

        // Then - the member is named by its path from the root, and so is every finding it makes
        expect(seen).toStrictEqual([
            {
                config: 'jterrazz.config.ts',
                findingAt: 'packages/simulated-dom/package.json',
                label: 'packages/simulated-dom',
                subject: 'packages/simulated-dom',
            },
        ]);
    });

    test('names the root run by its package, and hands no config where none is written', () => {
        // Given - a member read from itself, with no settings file
        const { registry, seen } = recording();
        runMember(memberAt('tested-no-config'), memberAt('tested-no-config'), registry);

        // Then - the subject is the package name, and the findings stay where the member wrote them
        expect(seen).toStrictEqual([
            {
                config: null,
                findingAt: 'package.json',
                label: '.',
                subject: '@fixture/tested-no-config',
            },
        ]);
    });

    test('judges nothing where no package.json is written', () => {
        // Given - a folder that is no package
        const { registry, seen } = recording();

        // Then - the pass is never handed it
        expect(runMember(resolve(WORKSPACE, 'nowhere'), WORKSPACE, registry)).toStrictEqual([]);
        expect(seen).toStrictEqual([]);
    });

    test('runMembers hands the pass every member of the workspace once', () => {
        // Given - the whole fixture workspace
        const { registry, seen } = recording();
        runMembers(WORKSPACE, registry);

        // Then - each member is read exactly once
        const labels = seen.map(({ label }) => label);
        expect(labels).toHaveLength(new Set(labels).size);
        expect(labels).toContain('packages/clean');
        expect(labels).toContain('packages/seam-dependency');
    });
});
