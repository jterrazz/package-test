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

export const LANDMARK_SELECTOR = Object.entries(LANDMARK_ELEMENTS)
    .flatMap(([kind, tag]) => [tag, `[role="${kind}"]`])
    .join(', ');

function isLandmarkKind(value: string): value is LandmarkKind {
    return Object.hasOwn(LANDMARK_ELEMENTS, value);
}

export function landmarkOfTagOrRole(value: string): LandmarkKind | undefined {
    const kind = Object.entries(LANDMARK_ELEMENTS).find(([, tag]) => tag === value)?.[0] ?? value;
    return isLandmarkKind(kind) ? kind : undefined;
}
