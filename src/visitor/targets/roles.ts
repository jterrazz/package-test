import { named, optionallyNamed } from './named.js';
import type { NamedTargetFactory, OptionallyNamedTargetFactory, Target } from './target.js';

/** A button (or element with the button role), by accessible name. */
export const button: NamedTargetFactory = named('button');

/** A form field, by label. */
export const field: NamedTargetFactory = named('field');

/** A heading, by accessible name. */
export const heading: NamedTargetFactory = named('heading');

/** A link, by accessible name. */
export const link: NamedTargetFactory = named('link');

/** An element containing the given text. */
export const content: NamedTargetFactory = named('text');

/** An option of a select or listbox, by label; asserted by presence, since a collapsed select's options have no box. */
export const option: NamedTargetFactory = named('option');

/** A modal or non-modal `<dialog>`, by accessible name. A closed one is absent. */
export const dialog: OptionallyNamedTargetFactory = optionallyNamed('dialog');

/** A live region announcing a result — `role="status"`, an `<output>`. */
export const status: OptionallyNamedTargetFactory = optionallyNamed('status');

/** A table, by its caption or accessible name. */
export const table: OptionallyNamedTargetFactory = optionallyNamed('table');

/** A row of a table or grid, by the text of its cells. */
export const row: OptionallyNamedTargetFactory = optionallyNamed('row');

/** An item of a list, by its text. */
export const listitem: OptionallyNamedTargetFactory = optionallyNamed('listitem');

/** The escape hatch: an element by `data-testid`. Prefer user-facing targets. */
export const testId = (id: string): Target => ({ kind: 'testId', name: id });
