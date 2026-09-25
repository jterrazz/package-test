import { lessonLine } from '../src/model/lesson/lesson.js';
import type { Lesson } from '../src/model/lesson/lesson.js';
import { consumerCatalog } from './manifest.js';
import type { CatalogEntry, RULE_DOCS } from './manifest.js';
import { CATALOGUE_CHAPTER, SELF_CHAPTER } from './rule-code.js';

/**
 * The two parts of a lesson a message writes for its case — what it found, and
 * the gesture that fixes it. The other two are the row's: `why` is its
 * convention's first sentence and `read` its heading, so a message and the
 * catalogue can never say two things.
 */
export type Teaching = Pick<Lesson, 'fix' | 'found'>;

/** Abbreviations whose period ends no sentence. */
const ABBREVIATIONS = ['e.g', 'i.e', 'vs', 'etc'];

/**
 * The first sentence of a convention: up to the first `.`, `!` or `?` that is
 * followed by the end or by a space and a new sentence — never one inside a
 * code span (`*.spec.ts`), nor an abbreviation's.
 */
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

/**
 * The `consumer` row a name designates — a static rule, a checker pass. A
 * `self` row is not found here: the published code reads the consumer
 * catalogue alone, and a self rule hands its own row to {@link lessonsAt}.
 */
export function rowOf(name: string): CatalogEntry {
    const row = consumerCatalog.find((entry) => entry.name === name);
    if (row === undefined) {
        throw new Error(`no consumer row is named ${name}`);
    }
    return row;
}

/**
 * The heading a row is read at: `docs/19-linting.md#<row>` for a `consumer`
 * row, `docs/03-testing.md#<row>` for a `self` one.
 */
export function readAt(row: CatalogEntry): string {
    const chapter = row.audience === 'self' ? SELF_CHAPTER : CATALOGUE_CHAPTER;
    return `${chapter}#${row.name}`;
}

/** The heading a consumer row is read at. */
export function readOf(name: string): string {
    return readAt(rowOf(name));
}

/** One finding of a row as the line a reader acts on. */
export function lessonAt(row: CatalogEntry, teaching: Teaching): string {
    return lessonLine({ ...teaching, read: readAt(row), why: whyOf(row.convention) });
}

/** One finding of a consumer row as the line a reader acts on. */
export function lessonOf(name: string, teaching: Teaching): string {
    return lessonAt(rowOf(name), teaching);
}

/**
 * A static rule's `meta.messages`, from its row: each message keyed as the
 * rule reports it, rendered whole. A `{{data}}` placeholder in `found` or
 * `fix` is oxlint's, and filled at report time with the case's values.
 */
export function lessonsAt<Key extends string>(
    row: CatalogEntry,
    messages: Record<Key, Teaching>,
): Record<Key, string> {
    return Object.fromEntries(
        Object.entries<Teaching>(messages).map(([key, teaching]) => [key, lessonAt(row, teaching)]),
    ) as Record<Key, string>;
}

/** A consumer rule's `meta.messages`. */
export function lessons<Key extends string>(
    rule: keyof typeof RULE_DOCS,
    messages: Record<Key, Teaching>,
): Record<Key, string> {
    return lessonsAt(rowOf(rule), messages);
}
