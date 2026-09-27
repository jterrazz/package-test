import { defineInvariant, refusalBlock } from '@jterrazz/typescript/rules';
import type { Lesson } from '@jterrazz/typescript/rules';

import { CATALOGUE_CHAPTER } from './consumer/catalogue/chapter.js';
import { REFUSAL_WHY } from './consumer/catalogue/refusals.js';
import type { RefusalRow } from './consumer/catalogue/refusals.js';

export { REFUSAL_WHY } from './consumer/catalogue/refusals.js';
export type { RefusalRow } from './consumer/catalogue/refusals.js';
export type { Lesson } from '@jterrazz/typescript/rules';

export const invariant: (broken: string) => Error = defineInvariant({
    bugOf: 'the framework',
    notOf: 'the test',
    package: '@jterrazz/test',
});

export function refusal(row: RefusalRow, teaching: { fix: string; found: string }): string;
export function refusal(lesson: Lesson): string;
export function refusal(
    rowOrLesson: Lesson | RefusalRow,
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
