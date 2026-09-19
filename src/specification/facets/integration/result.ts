import { JsonAccessor } from '../_common/result/json.js';
import { BaseResult } from '../_common/result/result.js';
import type { BaseResultOptions } from '../_common/result/result.js';
import { TextAccessor } from '../_common/result/text.js';

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
 * The result of an in-process call — the integration facet's whole surface.
 *
 * Two readings, never both: `value` is what the call RETURNED, `error` is
 * what it THREW. A module that refuses is specified the same way a module
 * that answers is, and neither needs a `try`/`catch` in the test — which is
 * the shape that used to make a refusal spec three times the size of the
 * happy one, and the shape that quietly passes when nothing throws at all.
 *
 * Both are the package's ordinary accessors, so the golden mechanism reaches
 * them: `toMatch('<name>.json'|'<name>.txt')`, the `{{token}}` grammar,
 * `{ frozen }` and `TEST_UPDATE=1` all work here exactly as on an HTTP
 * response or a command's stdout.
 */
export class CallResult extends BaseResult {
    private readonly outcome: CallOutcome;

    constructor(options: CallResultOptions) {
        super(options);
        this.outcome = options.outcome;
    }

    /**
     * What the call THREW, as text — the message of an `Error`, the value
     * itself when something else was thrown, and empty when it returned.
     *
     * Empty rather than absent on purpose: `expect(result.error).toBeEmpty()`
     * is how a spec says "and it did not refuse".
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
    get value(): JsonAccessor | TextAccessor {
        const produced = this.outcome.threw ? null : this.outcome.value;
        if (typeof produced === 'string') {
            return new TextAccessor(produced, 'value', this.testDir, { captures: this.captures });
        }
        return new JsonAccessor(
            JSON.stringify(produced ?? null),
            this.testDir,
            undefined,
            this.captures,
        );
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
