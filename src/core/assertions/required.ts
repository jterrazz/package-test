/**
 * The value, or a failure that says what was missing and why it mattered.
 *
 * A test reaching into a captured structure — a row, a header, the third
 * element of a list — meets `T | undefined` and has to do something about it.
 * The two things it usually does are both wrong: `!` erases the question, and
 * an `if (!x) throw new Error('missing')` re-states the same three lines in
 * every repository (the estate had two hand-written copies of exactly this).
 * `required` is that gesture with the reason attached, so the failure reads as
 * a sentence rather than as a `TypeError` two frames further down.
 *
 * @example
 *   const id = required(result.response.body.id, 'the creation reply carries the new id');
 */
export function required<T>(value: null | T | undefined, why: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `required(): ${why} — got ${value === null ? 'null' : 'undefined'}. ` +
                'State it in the Given, or assert on what the subject actually produced.',
        );
    }
    return value;
}
