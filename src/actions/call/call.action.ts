import { defineAction } from '../../model/chain/action.js';
import { CallResult } from '../../results/call.result.js';
import type { CallOutcome } from '../../results/call.result.js';

/** The services a module is constructed against — the record the constructor started. */
export type ServicesPort = Readonly<Record<string, unknown>>;

/** The module under test, handed the started services. */
type Subject = (services: never) => unknown;

/**
 * `.call(subject)`: call the module with the started services and resolve
 * with what it produced — the value it returned, or the error it threw. A
 * refusal is a reading, never a rejection: `result.error` carries it, so a
 * spec of a module that says no needs no `try`/`catch`.
 */
export const call = defineAction<
    'call',
    [subject: Subject],
    CallResult,
    { services: ServicesPort }
>({
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
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the record's TYPE is the facet's `Services` parameter, which the signature index states; the definition holds it as the record it is at run time
            outcome = { error: null, threw: false, value: await subject(services as never) };
        } catch (error) {
            outcome = { error, threw: true, value: null };
        }
        return new CallResult({ config, outcome, testDir });
    },
    row: { group: 'Terminal action', name: '.call()', probe: '.call(' },
});
