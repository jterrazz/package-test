import type { LandmarkKind } from '../descriptors/element.js';

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

export const LANDMARK_SELECTOR = [...Object.values(LANDMARK_ELEMENTS), '[role]'].join(', ');

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
