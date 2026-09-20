import { JsonAccessor } from '../../core/result/json.js';
import { BaseResult } from '../../core/result/result.js';
import type { BaseResultOptions } from '../../core/result/result.js';
import { TextAccessor } from '../../core/result/text.js';

/** What `.call()` produced: the value it returned, or the error it threw. */
export type CallOutcome = {
    error: unknown;
    threw: boolean;
    value: unknown;
};

export type CallResultOptions = BaseResultOptions & {
    outcome: CallOutcome;
};

/**
 * What `result.value` is, decided by what the call returned: a string reads as
 * a stream, anything else as JSON. `.call<T>()` already knows T, so the test
 * reads one field (`result.value.value.ok`) without narrowing a union first.
 */
export type CallValue<Returned> = Returned extends string ? TextAccessor : JsonAccessor<Returned>;

/**
 * The result of an in-process call — the integration facet's whole surface.
 *
 * Two readings, never both: `value` is what the call RETURNED, `error` is
 * what it THREW. A module that refuses is specified the same way a module
 * that answers is, and neither needs a `try`/`catch` in the test — a shape
 * that costs a refusal spec three times the size of the happy one, and that
 * quietly passes when nothing throws at all.
 *
 * Both are the package's ordinary accessors, so the golden mechanism reaches
 * them, and `Returned` is what `.call<T>()` returned — `result.value.value` is
 * that type, not `unknown`, so a one-field reading needs no golden file: `toMatch('<name>.json'|'<name>.txt')`, the `{{token}}` grammar,
 * `{ frozen }` and `TEST_UPDATE=1` all work here exactly as on an HTTP
 * response or a command's stdout.
 */
export class CallResult<Returned = unknown> extends BaseResult {
    private readonly outcome: CallOutcome;

    constructor(options: CallResultOptions) {
        super(options);
        this.outcome = options.outcome;
    }

    /**
     * What the call THREW, as text — the message of an `Error`, the value
     * itself when something else was thrown, and empty when it returned.
     *
     * Empty rather than absent on purpose: `await expect(result.error).toBeEmpty()`
     * is how a spec says "and it did not refuse" — awaited, because the
     * matcher answers a promise on every subject it takes, and a dropped one
     * passes the test while the failure surfaces as an unhandled rejection
     * (D2 refuses the bare form).
     */
    get error(): TextAccessor {
        return new TextAccessor(describeError(this.outcome), 'error', this.testDir, {
            captures: this.captures,
        });
    }

    /**
     * What the call RETURNED. A string reads as a stream (`<name>.txt`),
     * anything else as JSON (`<name>.json`) — the same two subjects every
     * other facet's results are built from.
     *
     * A call that threw returns the empty value: what it produced is
     * {@link CallResult.error}.
     */
    get value(): CallValue<Returned> {
        const produced = this.outcome.threw ? null : this.outcome.value;
        const accessor =
            typeof produced === 'string'
                ? new TextAccessor(produced, 'value', this.testDir, { captures: this.captures })
                : new JsonAccessor(
                      JSON.stringify(produced ?? null),
                      this.testDir,
                      undefined,
                      this.captures,
                  );
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the branch above IS the conditional type, chosen on the same runtime shape the type reads
        return accessor as CallValue<Returned>;
    }
}

/** The thrown thing, as the text a golden compares. */
function describeError(outcome: CallOutcome): string {
    if (!outcome.threw) {
        return '';
    }
    const { error } = outcome;
    return error instanceof Error ? error.message : String(error);
}
