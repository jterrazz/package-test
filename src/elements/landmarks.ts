import type { LandmarkKind } from './descriptor.js';

/**
 * The landmarks of a page as the adapters locate them: the element that
 * carries each without a `role`, and the element or role an evidence context
 * names, read back as the landmark it is.
 */

/** The HTML element that carries each landmark of the vocabulary without a `role`. */
const LANDMARK_ELEMENTS: Record<LandmarkKind, string> = {
    banner: 'header',
    complementary: 'aside',
    contentinfo: 'footer',
    form: 'form',
    main: 'main',
    navigation: 'nav',
    region: 'section',
    search: 'search',
};

/**
 * The ancestors a candidate's evidence names as its landmark, in both
 * adapters: every landmark's element, and any element that spells a role.
 */
export const LANDMARK_SELECTOR = [...Object.values(LANDMARK_ELEMENTS), '[role]'].join(', ');

/** The landmark a context string — an element or a role — maps back to. */
export const CONTEXT_LANDMARKS: Record<string, LandmarkKind> = {
    aside: 'complementary',
    banner: 'banner',
    complementary: 'complementary',
    contentinfo: 'contentinfo',
    footer: 'contentinfo',
    form: 'form',
    header: 'banner',
    main: 'main',
    nav: 'navigation',
    navigation: 'navigation',
    region: 'region',
    search: 'search',
    section: 'region',
};
