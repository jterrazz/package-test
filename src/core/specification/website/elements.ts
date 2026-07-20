import type { ElementRef } from '../../ports/browser.port.js';

/**
 * The element vocabulary — user-facing descriptors for visit scenarios.
 * Reads like English (`click(link('Articles'))`), translates to
 * accessibility-first locators in the browser integration. CSS/XPath is
 * deliberately not expressible; `testId()` is the single escape hatch.
 */

/** A button (or element with the button role), by accessible name. */
export const button = (name: string): ElementRef => ({ kind: 'button', name });

/** A form field, by label. */
export const field = (label: string): ElementRef => ({ kind: 'field', name: label });

/** A heading, by accessible name. */
export const heading = (name: string): ElementRef => ({ kind: 'heading', name });

/** A link, by accessible name. */
export const link = (name: string): ElementRef => ({ kind: 'link', name });

/** An element containing the given text. */
export const content = (value: string): ElementRef => ({ kind: 'text', name: value });

/** The escape hatch: an element by `data-testid`. Prefer user-facing elements. */
export const testId = (id: string): ElementRef => ({ kind: 'testId', name: id });
