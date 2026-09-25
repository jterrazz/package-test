/** The value, or a failure naming what was missing and why it mattered. */
export function required<T>(value: null | T | undefined, why: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `required(): ${why} — got ${value === null ? 'null' : 'undefined'}. ` +
                'State it in the Given, or assert on what the subject actually produced.',
        );
    }
    return value;
}
