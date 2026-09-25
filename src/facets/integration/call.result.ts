import { BaseResult } from '../../expectations/result.js';
import type { BaseResultOptions } from '../../expectations/result.js';
import { JsonAccessor } from '../../expectations/text/json.js';
import { TextAccessor } from '../../expectations/text/text.js';

export type CallOutcome = {
    error: unknown;
    threw: boolean;
    value: unknown;
};

export type CallResultOptions = BaseResultOptions & {
    outcome: CallOutcome;
};

/** Exactly a string gives a `TextAccessor`, never a string a `JsonAccessor`, maybe a string the union. Built from `JSON.stringify`: a `Map` or `Date` arrives as its JSON. */
export type CallValue<Returned> = [Returned] extends [string]
    ? TextAccessor
    : [Extract<Returned, string>] extends [never]
      ? JsonAccessor<Returned>
      : JsonAccessor<Exclude<Returned, string>> | TextAccessor;

/** The result of an in-process call: `value` is what it returned, `error` what it threw. */
export class CallResult<Returned = unknown> extends BaseResult {
    private readonly outcome: CallOutcome;

    constructor(options: CallResultOptions) {
        super(options);
        this.outcome = options.outcome;
    }

    /** What the call threw, as text; empty when it returned. */
    get error(): TextAccessor {
        return new TextAccessor(describeError(this.outcome), 'error', this.testDir, {
            captures: this.captures,
        });
    }

    /** What the call returned; `null` as JSON when it threw. */
    get value(): CallValue<Returned> {
        const produced = this.outcome.threw ? null : this.outcome.value;
        const accessor =
            typeof produced === 'string'
                ? new TextAccessor(produced, 'value', this.testDir, { captures: this.captures })
                : new JsonAccessor(JSON.stringify(produced ?? null), 'value', this.testDir, {
                      captures: this.captures,
                  });
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the branch above IS the conditional type, chosen on the same runtime shape the type reads
        return accessor as CallValue<Returned>;
    }
}

function describeError(outcome: CallOutcome): string {
    if (!outcome.threw) {
        return '';
    }
    const { error } = outcome;
    return error instanceof Error ? error.message : String(error);
}
