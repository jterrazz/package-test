import type { NamedTarget, OptionallyNamedTarget, Target, TargetOptions } from './target.js';

const stated = (options?: TargetOptions): Pick<Target, 'exact'> =>
    options?.exact === undefined ? {} : { exact: options.exact };

const named =
    (kind: Target['kind']): NamedTarget =>
    (name, options) => ({ kind, name, ...stated(options) });

const optionallyNamed =
    (kind: Target['kind']): OptionallyNamedTarget =>
    (name, options) => ({ kind, ...(name === undefined ? {} : { name }), ...stated(options) });

/** A button (or element with the button role), by accessible name. */
export const button: NamedTarget = named('button');

/** A form field, by label. */
export const field: NamedTarget = named('field');

/** A heading, by accessible name. */
export const heading: NamedTarget = named('heading');

/** A link, by accessible name. */
export const link: NamedTarget = named('link');

/** An element containing the given text. */
export const content: NamedTarget = named('text');

/** An option of a select or listbox, by label; asserted by presence, since a collapsed select's options have no box. */
export const option: NamedTarget = named('option');

/** A modal or non-modal `<dialog>`, by accessible name. A closed one is absent. */
export const dialog: OptionallyNamedTarget = optionallyNamed('dialog');

/** A live region announcing a result — `role="status"`, an `<output>`. */
export const status: OptionallyNamedTarget = optionallyNamed('status');

/** A table, by its caption or accessible name. */
export const table: OptionallyNamedTarget = optionallyNamed('table');

/** A row of a table or grid, by the text of its cells. */
export const row: OptionallyNamedTarget = optionallyNamed('row');

/** An item of a list, by its text. Retires the `.first()` of an unnamed `<li>`. */
export const listitem: OptionallyNamedTarget = optionallyNamed('listitem');

/** The escape hatch: an element by `data-testid`. Prefer user-facing targets. */
export const testId = (id: string): Target => ({ kind: 'testId', name: id });
