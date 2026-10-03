import { defineAction } from '../../chain/action.js';
import type { ChainSignature, FacetParams } from '../../chain/capability.js';
import { CallResult } from './call.result.js';
import type { CallOutcome } from './call.result.js';

type Needs = { services: Readonly<Record<string, unknown>> };

type Subject = (services: never) => unknown;

export type CallChain<P extends FacetParams> = {
    /** Call the module with the started services and resolve with what it produced. */
    call: <T>(subject: (services: P['services']) => Promise<T> | T) => Promise<CallResult<T>>;
};

export interface CallSignature extends ChainSignature {
    readonly chain: CallChain<this['params']>;
}

/** A refusal is a reading, never a rejection: `result.error` carries it. */
export const call = defineAction<'call', [subject: Subject], CallResult, CallSignature, Needs>({
    accessors: [
        { group: 'Result accessor', name: '.value', probe: 'result.value' },
        { group: 'Result accessor', name: '.error', probe: 'result.error' },
        { group: 'Result accessor', member: 'table', name: '.table()', probe: 'result.table(' },
        { group: 'Result accessor', member: 'file', name: '.file()', probe: '.file(' },
        {
            group: 'Result accessor',
            member: 'directory',
            name: '.directory()',
            probe: '.directory(',
        },
    ],
    name: 'call',
    perform: async ([subject], _read, { services }, { config, testDir }) => {
        let outcome: CallOutcome;
        try {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the record's TYPE is the facet's `Services` parameter, which `CallSignature` reads through `this['params']`; the definition holds it as the record it is at run time
            outcome = { error: null, threw: false, value: await subject(services as never) };
        } catch (error) {
            outcome = { error, threw: true, value: null };
        }
        return new CallResult({ config, outcome, testDir });
    },
    row: { group: 'Terminal action', name: '.call()', probe: '.call(' },
});
