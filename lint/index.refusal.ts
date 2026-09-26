import { CATALOGUE_CHAPTER } from './consumer/catalogue/chapter.js';
import { REFUSAL_WHY } from './consumer/catalogue/refusals.js';
import type { RefusalRow } from './consumer/catalogue/refusals.js';
import { lessonBlock } from './engine/catalogue/lesson-parts.js';

export { REFUSAL_WHY } from './consumer/catalogue/refusals.js';
export type { RefusalRow } from './consumer/catalogue/refusals.js';

export function refusal(row: RefusalRow, { fix, found }: { fix: string; found: string }): string {
    return lessonBlock({
        fix,
        found,
        read: `${CATALOGUE_CHAPTER}#${row}`,
        why: REFUSAL_WHY[row],
    });
}
