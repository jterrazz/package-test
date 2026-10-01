import type { MatrixRow } from '../kernel/chain/capability.js';

export const EVERY_SURFACE_VERBS: readonly MatrixRow[] = [
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

export const EVERY_SURFACE_TARGETS: readonly MatrixRow[] = [
    { group: 'Target', name: 'button', probe: 'button(' },
    { group: 'Target', name: 'field', probe: 'field(' },
    { group: 'Target', member: 'content', name: 'content', probe: 'content(' },
    { group: 'Target', name: 'testId', probe: 'testId(' },
];

export const BROWSER_TARGETS: readonly MatrixRow[] = [
    { group: 'Target', name: 'heading', probe: 'heading(' },
    { group: 'Target', name: 'link', probe: 'link(' },
    { group: 'Target', name: 'dialog', probe: 'dialog(' },
    { group: 'Target', name: 'status', probe: 'status(' },
    { group: 'Target', name: 'table', probe: 'table(' },
    { group: 'Target', name: 'row', probe: 'row(' },
    { group: 'Target', name: 'listitem', probe: 'listitem(' },
    { group: 'Target', name: 'option', probe: 'option(' },
    { group: 'Target', name: 'banner', probe: 'banner(' },
    { group: 'Target', name: 'complementary', probe: 'complementary(' },
    { group: 'Target', name: 'contentinfo', probe: 'contentinfo(' },
    { group: 'Target', name: 'form', probe: 'form(' },
    { group: 'Target', name: 'main', probe: 'main(' },
    { group: 'Target', name: 'navigation', probe: 'navigation(' },
    { group: 'Target', name: 'region', probe: 'region(' },
    { group: 'Target', name: 'search', probe: 'search(' },
];

export const WITHIN: MatrixRow = { group: 'Target', name: 'within', probe: 'within(' };

export const BROWSER_STATES: readonly MatrixRow[] = [
    { group: 'Target', name: 'focused', probe: 'focused(' },
    { group: 'Target', name: 'selected', probe: 'selected(' },
    { group: 'Target', name: 'valued', probe: 'valued(' },
    { group: 'Target', name: 'disabled', probe: 'disabled(' },
    { group: 'Target', name: 'enabled', probe: 'enabled(' },
];
