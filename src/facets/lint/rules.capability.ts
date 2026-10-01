import { defineCapability } from '../../chain/capability.js';
import type { ChainSignature } from '../../chain/capability.js';
import type { LintRules } from './lint.port.js';

export type RulesChain<Self> = {
    /** Rules and their options for this chain, over the specification's `config`; a later call wins. */
    rules: (rules: LintRules) => Self;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface RulesSignature extends ChainSignature {
    readonly chain: RulesChain<this['self']>;
}

export const rules = defineCapability<'rules', LintRules, [rules: LintRules], RulesSignature>({
    initial: {},
    name: 'rules',
    phase: 0,
    reduce: (merged, [added]) => ({ ...merged, ...added }),
    row: { group: 'Setup', name: '.rules()', probe: '.rules(' },
});
