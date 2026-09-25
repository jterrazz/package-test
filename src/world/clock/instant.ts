/**
 * The instant `iso` names, or a refusal that says what an instant looks like —
 * the one check a stated instant passes, whichever calendar pins it: this
 * process's, a mounted component's page, or a visited site's.
 */
export function instantOf(method: string, iso: string): Date {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) {
        throw new TypeError(
            `clock.${method}(): "${iso}" is not an instant — pass an ISO-8601 string ` +
                `(e.g. '2026-03-04T09:30:00Z').`,
        );
    }
    return at;
}
