import { refusalBlock } from '@jterrazz/typescript/rules';
import type { Lesson } from '@jterrazz/typescript/rules';

import { CATALOGUE_CHAPTER } from './consumer/catalogue/chapter.js';
import { REFUSAL_WHY } from './consumer/catalogue/refusals.js';
import type { RefusalRow } from './consumer/catalogue/refusals.js';

export { REFUSAL_WHY } from './consumer/catalogue/refusals.js';
export type { RefusalRow } from './consumer/catalogue/refusals.js';

export type ChapterAnchor = `docs/${string}.md#${string}`;

export type ChapterLesson = Lesson & { read: ChapterAnchor };

export function invariant(broken: string): Error {
    return new Error(
        `@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: ${broken}`,
    );
}

export function refusal(row: RefusalRow, teaching: { fix: string; found: string }): string;
export function refusal(lesson: ChapterLesson): string;
export function refusal(
    rowOrLesson: ChapterLesson | RefusalRow,
    teaching?: { fix: string; found: string },
): string {
    if (typeof rowOrLesson !== 'string') {
        return refusalBlock(rowOrLesson);
    }
    if (teaching === undefined) {
        throw invariant(`refusal('${rowOrLesson}') was handed no found and no fix for its case`);
    }
    return refusalBlock({
        fix: teaching.fix,
        found: teaching.found,
        read: `${CATALOGUE_CHAPTER}#${rowOrLesson}`,
        why: REFUSAL_WHY[rowOrLesson],
    });
}
