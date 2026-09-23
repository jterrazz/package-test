import { lessonBlock } from './lesson.js';

/** The chapter whose catalogue holds every row a message reads at. */
export const CATALOGUE_CHAPTER = 'docs/19-linting.md';

/**
 * The runtime rows that REFUSE a call, each with its convention's first
 * sentence — the `why` a refusal states. The catalogue row opens on the same
 * sentence (`lint/manifest.ts` reads it from here), so the error a spec meets
 * and the row it is sent to say one thing.
 */
export const REFUSAL_WHY = {
    'a7-database-runtime':
        'With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
    'b2-relative-path-runtime':
        'A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
    'd14-one-verb-per-meaning':
        '`toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.',
    'd7-strict-intercepts':
        'From its first contract, a chain’s network is strict: every outgoing request matches a declared contract.',
    'w3-unambiguous-element':
        'A verb acts on exactly ONE element: a descriptor that matches several is refused, never settled by the first.',
    'w4-no-landmarks-on-mobile':
        'An iOS screen has no ARIA landmark: a mobile verb is scoped with `within(testId(…), …)`.',
} as const;

/** A runtime row that refuses. */
export type RefusalRow = keyof typeof REFUSAL_WHY;

/**
 * The message of a refusal: what the call was handed and the gesture for this
 * case, from the caller; the row's sentence and heading, from the row.
 */
export function refusal(row: RefusalRow, { fix, found }: { fix: string; found: string }): string {
    return lessonBlock({
        fix,
        found,
        read: `${CATALOGUE_CHAPTER}#${row}`,
        why: REFUSAL_WHY[row],
    });
}
