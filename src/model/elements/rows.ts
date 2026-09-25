import type { MatrixRow } from '../chain/capability.js';

/*
 * The capability-matrix rows of the vocabulary a scenario is written in —
 * chapter 13's words. An action that hands a scenario a visitor states the
 * rows of its visitor's verbs and of the descriptors its surface resolves.
 */

/** What every drawing surface's visitor hands out. */
export const DRAWN_VERBS: readonly MatrixRow[] = [
    { group: 'Verb', name: 'see', probe: '.see(' },
    { group: 'Verb', name: 'fill', probe: '.fill(' },
];

/** What a browser's visitor hands out beyond the drawn verbs — website and component alike. */
export const BROWSER_VERBS: readonly MatrixRow[] = [
    { group: 'Verb', name: 'click', probe: '.click(' },
    { group: 'Verb', name: 'gone', probe: '.gone(' },
    { group: 'Verb', name: 'press', probe: '.press(' },
    { group: 'Verb', name: 'hover', probe: '.hover(' },
    { group: 'Verb', name: 'check', probe: '.check(' },
    { group: 'Verb', name: 'select', probe: '.select(' },
];

/** The verbs one visitor alone hands out. */
export const OWN_VERBS = {
    goto: { group: 'Verb', name: 'goto', probe: '.goto(' },
    rerender: { group: 'Verb', name: 'rerender', probe: '.rerender(' },
    tap: { group: 'Verb', name: 'tap', probe: '.tap(' },
    unmount: { group: 'Verb', name: 'unmount', probe: '.unmount(' },
} as const satisfies Record<string, MatrixRow>;

/** What every drawing surface resolves: the four kinds a device has. */
export const DRAWN_DESCRIPTORS: readonly MatrixRow[] = [
    { group: 'Descriptor', name: 'button', probe: 'button(' },
    { group: 'Descriptor', name: 'field', probe: 'field(' },
    { group: 'Descriptor', member: 'content', name: 'content', probe: 'content(' },
    { group: 'Descriptor', name: 'testId', probe: 'testId(' },
];

/** What a browser resolves beyond the drawn kinds: its roles and landmarks. */
export const BROWSER_DESCRIPTORS: readonly MatrixRow[] = [
    { group: 'Descriptor', name: 'heading', probe: 'heading(' },
    { group: 'Descriptor', name: 'link', probe: 'link(' },
    { group: 'Descriptor', name: 'dialog', probe: 'dialog(' },
    { group: 'Descriptor', name: 'status', probe: 'status(' },
    { group: 'Descriptor', name: 'table', probe: 'table(' },
    { group: 'Descriptor', name: 'row', probe: 'row(' },
    { group: 'Descriptor', name: 'listitem', probe: 'listitem(' },
    { group: 'Descriptor', name: 'option', probe: 'option(' },
    { group: 'Descriptor', name: 'banner', probe: 'banner(' },
    { group: 'Descriptor', name: 'complementary', probe: 'complementary(' },
    { group: 'Descriptor', name: 'contentinfo', probe: 'contentinfo(' },
    { group: 'Descriptor', name: 'form', probe: 'form(' },
    { group: 'Descriptor', name: 'main', probe: 'main(' },
    { group: 'Descriptor', name: 'navigation', probe: 'navigation(' },
    { group: 'Descriptor', name: 'region', probe: 'region(' },
    { group: 'Descriptor', name: 'search', probe: 'search(' },
];

/** The scope every drawing surface resolves a descriptor within. */
export const WITHIN: MatrixRow = { group: 'Descriptor', name: 'within', probe: 'within(' };

/** The states a browser reads off an element. */
export const BROWSER_STATES: readonly MatrixRow[] = [
    { group: 'Descriptor', name: 'focused', probe: 'focused(' },
    { group: 'Descriptor', name: 'selected', probe: 'selected(' },
    { group: 'Descriptor', name: 'valued', probe: 'valued(' },
    { group: 'Descriptor', name: 'disabled', probe: 'disabled(' },
    { group: 'Descriptor', name: 'enabled', probe: 'enabled(' },
];
