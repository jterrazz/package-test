import type { Markers } from '@jterrazz/typescript/rules';

import { rowTable } from '../../engine/catalogue/chapter.js';
import { selfRows } from './manifest.js';

export const SELF_CHAPTER_MARKERS: Markers = {
    end: '<!-- /GENERATED:self-rules -->',
    start: '<!-- GENERATED:self-rules — do not edit by hand; run `npm run docs`. Source: lint/self/catalogue/manifest.ts -->',
};

export function selfChapterTable(): string {
    return rowTable(selfRows);
}
