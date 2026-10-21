import type { Markers } from '@jterrazz/typescript/rules';

export const CATALOGUE_MARKERS: Markers = {
    end: '<!-- /GENERATED:catalogue -->',
    start: '<!-- GENERATED:catalogue. Do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/manifest.json -->',
};
