import type { ElementRef } from './element.js';
import { named, optionallyNamed } from './named.js';
import type { NamedFactory, OptionallyNamedFactory } from './named.js';

/** A button (or element with the button role), by accessible name. */
export const button: NamedFactory = named('button');

/** A form field, by label. */
export const field: NamedFactory = named('field');

/** A heading, by accessible name. */
export const heading: NamedFactory = named('heading');

/** A link, by accessible name. */
export const link: NamedFactory = named('link');

/** An element containing the given text. */
export const content: NamedFactory = named('text');

/** An option of a select or listbox, by label; asserted by presence, since a collapsed select's options have no box. */
export const option: NamedFactory = named('option');

/** A modal or non-modal `<dialog>`, by accessible name. A closed one is absent. */
export const dialog: OptionallyNamedFactory = optionallyNamed('dialog');

/** A live region announcing a result — `role="status"`, an `<output>`. */
export const status: OptionallyNamedFactory = optionallyNamed('status');

/** A table, by its caption or accessible name. */
export const table: OptionallyNamedFactory = optionallyNamed('table');

/** A row of a table or grid, by the text of its cells. */
export const row: OptionallyNamedFactory = optionallyNamed('row');

/** An item of a list, by its text. Retires the `.first()` of an unnamed `<li>`. */
export const listitem: OptionallyNamedFactory = optionallyNamed('listitem');

/** The escape hatch: an element by `data-testid`. Prefer user-facing elements. */
export const testId = (id: string): ElementRef => ({ kind: 'testId', name: id });
