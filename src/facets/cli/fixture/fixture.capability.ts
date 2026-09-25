import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import { requireDiskTarget } from '../../../kernel/files/spec-path.js';
import type { DiskTarget } from '../../../kernel/files/spec-path.js';
import type { FixturePort } from './fixture.port.js';

export type FixtureMethod<Self> = (source: DiskTarget) => Self;

export type FixtureChain<Self> = {
    /** Lay file state into the working directory: a `directory()`'s contents spread, a `file()` copied by name. */
    fixture: FixtureMethod<Self>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface FixtureSignature extends ChainSignature {
    readonly chain: FixtureChain<this['self']>;
}

/** Judged when stated, resolved on disk when armed; a later fixture overwrites an earlier one. */
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
