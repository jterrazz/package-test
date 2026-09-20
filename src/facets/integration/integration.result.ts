import { JsonAccessor } from '../../model/result/json.js';
import { BaseResult } from '../../model/result/result.js';
import type { BaseResultOptions } from '../../model/result/result.js';
import { TextAccessor } from '../../model/result/text.js';

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
 *
 * Three answers, because a type has three ways of relating to `string`:
 *
 * - EXACTLY a string — a `TextAccessor`, and nothing to narrow;
 * - it MAY be a string (`string | undefined`, `string | number`, `any`) — the
 *   UNION, which the test narrows. The type used to read the static type only
 *   while the accessor was built from the RUNTIME value, so a subject typed
 *   `string | undefined` was handed back as a `JsonAccessor`: `.value.value`
 *   compiled, the runtime had built a `TextAccessor`, and the read silently
 *   answered `undefined`;
 * - never a string — a `JsonAccessor<Returned>`.
 *
 * `Returned` there is what the value CLAIMS, not what survived the crossing:
 * the accessor is built from `JSON.stringify`, so a `Map`, a `Date` or a class
 * instance arrives as the plain JSON it serialises to (`{}`, an ISO string, an
 * object of its own fields). A subject whose answer is one of those is
 * projected to plain data inside the call, where the test can see it happen.
 */
export type CallValue<Returned> = [Returned] extends [string]
    ? TextAccessor
    : [Extract<Returned, string>] extends [never]
      ? JsonAccessor<Returned>
      : JsonAccessor<Exclude<Returned, string>> | TextAccessor;

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
     * other facet's results are built from, chosen on the value in hand and
     * typed by {@link CallValue}, which answers for the three ways a type can
     * relate to `string`.
     *
     * A call that threw has no value to choose an accessor on, so `value` is
     * the JSON reading of `null` whatever the declared type promises: what a
     * refusal produced is {@link CallResult.error}, and that is where a spec
     * reads it.
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
