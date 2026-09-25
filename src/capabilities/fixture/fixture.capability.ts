import { defineCapability } from '../../model/chain/capability.js';
import { requireDiskTarget } from '../../model/chain/spec-path.js';
import type { DiskTarget } from '../../model/chain/spec-path.js';
import type { FixturePort } from './fixture.port.js';

/** `.fixture(target)`, handing back the chain it was called on. */
export type FixtureMethod<Self> = (source: DiskTarget) => Self;

/**
 * `.fixture(target)`: file state laid into the working directory before the
 * action — a `directory()`'s contents spread into it, a `file()` copied under
 * its own name. The call is judged when it is stated (a value where the disk
 * is read); what the path names on disk, when the chain is armed. Chained
 * fixtures layer in order: a later one overwrites what an earlier one wrote.
 * An action that runs in no directory lays none.
 */
export const fixture = defineCapability<
    'fixture',
    readonly DiskTarget[],
    [source: DiskTarget],
    { workdir: FixturePort }
>({
    arm: (targets, { workdir }, { testDir, workDir }) => {
        if (workDir !== null) {
            for (const target of targets) {
                workdir.layer(target.path, testDir, workDir);
            }
        }
        return {};
    },
    initial: [],
    name: 'fixture',
    phase: 20,
    reduce: (targets, [source]) => [...targets, requireDiskTarget('fixture', source)],
    row: { group: 'Setup', name: '.fixture()', probe: '.fixture(' },
});
