import type { Markers } from '../../engine/catalogue/chapter.js';

export const CATALOGUE_CHAPTER = 'docs/19-linting.md';

export const CATALOGUE_MARKERS: Markers = {
    end: '<!-- /GENERATED:catalogue -->',
    start: '<!-- GENERATED:catalogue — do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/manifest.ts -->',
};
