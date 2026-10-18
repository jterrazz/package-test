import { defineCapability } from '../chain/capability.js';
import type { ChainSignature } from '../chain/capability.js';
import { refusal } from '../chain/refusals/refusal.js';
import type { PreparePort, PrepareStep } from './prepare.port.js';

export type PrepareChain<Self> = {
    /** Lay in the working directory what no fixture can carry (a `.git`, an empty folder, a file a repository ignores), after every fixture and link, in the order stated. */
    prepare: (step: PrepareStep) => Self;
};

export interface PrepareSignature extends ChainSignature {
    readonly chain: PrepareChain<this['self']>;
}

function requireStep(step: unknown): PrepareStep {
    if (typeof step === 'function') {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a function is all JavaScript can check of a step: its parameters and its return are the type's to hold
        return step as PrepareStep;
    }
    throw new TypeError(
        refusal({
            fix: "hand it a function of the working directory: .prepare((workdir) => { execFileSync('git', ['init'], { cwd: workdir }); })",
            found: `prepare(${JSON.stringify(step) ?? typeof step}), no step to run`,
            read: 'docs/guides/cli-specs.md#prepare-what-no-fixture-can-carry',
            why: 'A step is run over the working directory once the fixtures are laid; only a function can be run.',
        }),
    );
}

/** Armed after `.fixture()` and `.link()`: a step shapes the tree they laid, never the reverse. */
export const prepare = defineCapability<
    'prepare',
    readonly PrepareStep[],
    [step: PrepareStep],
    PrepareSignature,
    { steps: PreparePort }
>({
    arm: async (prepared, { steps }, { workDir }) => {
        if (workDir !== null) {
            await steps.run(prepared, workDir);
        }
        return {};
    },
    initial: [],
    name: 'prepare',
    phase: 26,
    reduce: (steps, [step]) => [...steps, requireStep(step)],
    row: { group: 'Setup', name: '.prepare()', probe: '.prepare(' },
});
