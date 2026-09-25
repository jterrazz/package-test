import type { MatrixRow } from '../kernel/chain/capability.js';

export const DRAWN_VERBS: readonly MatrixRow[] = [
    { group: 'Verb', name: 'see', probe: '.see(' },
    { group: 'Verb', name: 'fill', probe: '.fill(' },
];

export const BROWSER_VERBS: readonly MatrixRow[] = [
    { group: 'Verb', name: 'click', probe: '.click(' },
    { group: 'Verb', name: 'gone', probe: '.gone(' },
    { group: 'Verb', name: 'press', probe: '.press(' },
    { group: 'Verb', name: 'hover', probe: '.hover(' },
    { group: 'Verb', name: 'check', probe: '.check(' },
    { group: 'Verb', name: 'select', probe: '.select(' },
];

export const DRAWN_DESCRIPTORS: readonly MatrixRow[] = [
    { group: 'Descriptor', name: 'button', probe: 'button(' },
    { group: 'Descriptor', name: 'field', probe: 'field(' },
    { group: 'Descriptor', member: 'content', name: 'content', probe: 'content(' },
    { group: 'Descriptor', name: 'testId', probe: 'testId(' },
];

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

export const WITHIN: MatrixRow = { group: 'Descriptor', name: 'within', probe: 'within(' };

export const BROWSER_STATES: readonly MatrixRow[] = [
    { group: 'Descriptor', name: 'focused', probe: 'focused(' },
    { group: 'Descriptor', name: 'selected', probe: 'selected(' },
    { group: 'Descriptor', name: 'valued', probe: 'valued(' },
    { group: 'Descriptor', name: 'disabled', probe: 'disabled(' },
    { group: 'Descriptor', name: 'enabled', probe: 'enabled(' },
];
