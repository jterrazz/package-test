import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import { requireDiskTarget } from '../../../kernel/files/spec-path.js';
import type { DiskTarget } from '../../../kernel/files/spec-path.js';
import type { FixturePort } from './fixture.port.js';

/** `.fixture(target)`, handing back the chain it was called on. */
export type FixtureMethod<Self> = (source: DiskTarget) => Self;

/** What `.fixture()` puts on a chain, handing back the chain it was called on. */
export type FixtureChain<Self> = {
    /**
     * Lay file state into the working directory before execution: a
     * `directory()`'s CONTENTS are spread into it, a `file()` is copied under
     * its own name. The shared pool is reached by the path that climbs to it.
     * Chained calls layer.
     */
    fixture: FixtureMethod<Self>;
};

/** The signature `ChainOf` reads off `fixture`. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface FixtureSignature extends ChainSignature {
    readonly chain: FixtureChain<this['self']>;
}

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
    FixtureSignature,
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
