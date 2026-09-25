import { describe, expect, test } from 'vitest';

import { defineAction } from './action.js';
import { defineCapability } from './capability.js';
import type { Sharing } from './capability.js';
import { defineFacet } from './define-facet.js';

/** A setup that appends what it is told. */
const note = defineCapability({
    initial: [] as readonly string[],
    name: 'note',
    phase: 10,
    reduce: (notes, [text]: [text: string]) => [...notes, text],
    row: { group: 'Setup', name: '.note()', probe: '.note(' },
});

/** A setup a file may share, under the `clock` key. */
const stamp = defineCapability({
    context: 'clock',
    initial: null as null | string,
    name: 'stamp',
    phase: 20,
    reduce: (_stamp, [iso]: [iso: string]) => iso,
    row: { group: 'Setup', name: '.stamp()', probe: '.stamp(' },
});

const sharing: Sharing = {
    kind: 'context',
    name: 'with',
    row: { group: 'Setup', name: '.with()', probe: '.with({' },
};

/** What the action hands back: what the chain was told, and where its paths start. */
type Told = { notes: readonly string[]; stamp: null | string; testDir: string };

const read = defineAction({
    accessors: [],
    name: 'read',
    perform: async (_args: [], slice, _engines, { testDir }) =>
        await Promise.resolve<Told>({ notes: slice(note), stamp: slice(stamp), testDir }),
    row: { group: 'Terminal action', name: '.read()', probe: '.read(' },
});

/** The chain the toy facet publishes. */
type Toy = {
    note: (text: string) => Toy;
    read: () => Promise<Told>;
    stamp: (iso: string) => Toy;
    with: (context: { clock?: string; headers?: Record<string, string> }) => Toy;
};

const composition = {
    actions: [read],
    capabilities: [note, stamp, sharing],
    options: {},
} as const;

/** A toy facet whose `locate` answers a new directory on every call, and counts them. */
function toyFacet(): { located: () => number; toy: Toy } {
    let calls = 0;
    const facet = defineFacet<Toy>()({
        ...composition,
        engines: () => ({}),
        locate: () => {
            calls += 1;
            return `/specs/call-${calls}`;
        },
    });
    return { located: () => calls, toy: facet.open({}) };
}

describe('defineFacet', () => {
    test('defineFacet — the chain a composition opens — every setup hands back a new chain, and the chain it came from keeps what it was told', async () => {
        // Given - a chain told one thing, and a branch of it told another
        const { toy } = toyFacet();
        const base = toy.note('seeded');
        const branch = base.note('stamped');

        const told = {
            base: await base.read(),
            branch: await branch.read(),
            fresh: await toy.read(),
        };

        // Then - the branch carries both, the chain it forked from only its own
        expect({
            base: told.base.notes,
            branch: told.branch.notes,
            fresh: told.fresh.notes,
        }).toStrictEqual({ base: ['seeded'], branch: ['seeded', 'stamped'], fresh: [] });
    });

    test('defineFacet — the chain a composition opens — the first call that is not with() fixes where the chain’s paths start', async () => {
        // Given - a file-wide view, then a chain of it told two things
        const { located, toy } = toyFacet();
        const shared = toy.with({ clock: '2026-03-04T09:30:00Z' });
        const lookedUpByWith = located();
        const told = await shared.note('first').note('second').read();

        // Then - with() looked nothing up; the first setup did, once, for the whole chain
        expect({ lookedUpByWith, testDir: told.testDir, lookups: located() }).toStrictEqual({
            lookedUpByWith: 0,
            lookups: 1,
            testDir: '/specs/call-1',
        });
    });

    test('defineFacet — the chain a composition opens — with() folds each setting through the setup that states it, and ignores the rest', async () => {
        // Given - a context naming the shared setup, and a key this facet composes no setup for
        const { toy } = toyFacet();
        const shared = toy.with({ clock: '2026-03-04T09:30:00Z', headers: { 'x-a': '1' } });

        const own = await shared.stamp('2027-01-01T00:00:00Z').read();
        const plain = await shared.read();

        // Then - its chains start from the setting, and a chain's own setup wins over it
        expect({ own: own.stamp, shared: plain.stamp }).toStrictEqual({
            own: '2027-01-01T00:00:00Z',
            shared: '2026-03-04T09:30:00Z',
        });
    });
});
