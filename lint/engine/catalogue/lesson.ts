import { lessonLine } from '../../../src/kernel/refusals/lesson.js';
import type { Lesson } from '../../../src/kernel/refusals/lesson.js';
import { CATALOGUE_CHAPTER } from '../../../src/kernel/refusals/refusal.js';
import type { Row } from './row.js';

/** `why` and `read` come from the row, so a message and the catalogue never say two things. */
export type Teaching = Pick<Lesson, 'fix' | 'found'>;

const ABBREVIATIONS = ['e.g', 'i.e', 'vs', 'etc'];

/** Never a period inside a code span (`*.spec.ts`), nor an abbreviation's. */
export function whyOf(convention: string): string {
    let inCode = false;
    for (let index = 0; index < convention.length; index += 1) {
        const character = convention[index];
        if (character === '`') {
            inCode = !inCode;
            continue;
        }
        if (inCode || (character !== '.' && character !== '!' && character !== '?')) {
            continue;
        }
        const before = convention.slice(0, index);
        if (ABBREVIATIONS.some((abbreviation) => before.endsWith(abbreviation))) {
            continue;
        }
        const after = convention.slice(index + 1);
        if (after === '' || /^\s+[\p{Lu}`*("'\d]/u.test(after)) {
            return convention.slice(0, index + 1);
        }
    }
    return convention;
}

export function rowNamed<Entry extends Row>(rows: readonly Entry[], name: string): Entry {
    const row = rows.find((entry) => entry.name === name);
    if (row === undefined) {
        throw new Error(`no catalogue row is named ${name}`);
    }
    return row;
}

export function readAt(row: Row, chapter = CATALOGUE_CHAPTER): string {
    return `${chapter}#${row.name}`;
}

export function lessonAt(row: Row, teaching: Teaching, chapter = CATALOGUE_CHAPTER): string {
    return lessonLine({ ...teaching, read: readAt(row, chapter), why: whyOf(row.convention) });
}

/** A `{{data}}` placeholder is oxlint's, filled at report time. */
export function lessonsAt<Key extends string>(
    row: Row,
    messages: Record<Key, Teaching>,
    chapter = CATALOGUE_CHAPTER,
): Record<Key, string> {
    return Object.fromEntries(
        Object.entries<Teaching>(messages).map(([key, teaching]) => [
            key,
            lessonAt(row, teaching, chapter),
        ]),
    ) as Record<Key, string>;
}
