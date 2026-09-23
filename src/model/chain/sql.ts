import { dedent } from '../matching/dedent.js';

/**
 * A seed written in the test: `sql` tags the statements a chain lays before
 * its action, where they are read — a test's own state, visible on its line.
 * A file stays the form for state several tests share.
 *
 * The text is dedented, so a block indents with the test. It takes no hole:
 * a seed states its rows, and a value computed into SQL is a quoting defect
 * waiting for its first apostrophe.
 *
 * The value is BRANDED, like `file()`: `.seed()` accepts it and a string is
 * still a value it refuses. The brand is a registry symbol (`Symbol.for`), so
 * every build of the package reads the same one.
 */

/** The registry key the brand is stored under. */
const SQL: unique symbol = Symbol.for('@jterrazz/test:sql');

/** SQL statements written in place, as `sql\`…\`` states them. */
export type SqlText = {
    readonly [SQL]: true;
    readonly text: string;
};

/**
 * Tag SQL statements written in the test.
 *
 * @example
 *   await api
 *       .seed(sql`
 *           INSERT INTO users (name) VALUES ('Ada');
 *       `)
 *       .get('/users');
 */
export function sql(strings: TemplateStringsArray, ...holes: readonly never[]): SqlText {
    if (holes.length > 0 || strings.length !== 1) {
        throw new TypeError(
            'sql`…` takes no hole: a seed states its rows — write the value into the text.',
        );
    }
    return Object.freeze({ [SQL]: true as const, text: dedent(strings[0] ?? '') });
}

/** Is this a `sql\`…\`` value? */
export function isSqlText(value: unknown): value is SqlText {
    return (
        value !== null && typeof value === 'object' && (value as { [SQL]?: unknown })[SQL] === true
    );
}
