import { lessonBlock } from './lesson.js';

export const CATALOGUE_CHAPTER = 'docs/19-linting.md';

/** `lint/manifest.ts` reads each sentence from here, so a refusal and its catalogue row say one thing. */
export const REFUSAL_WHY = {
    'a7-database-runtime':
        'With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
    'b12-route-params-runtime':
        'A request written as its route template is handed exactly the parameters the template names.',
    'b2-relative-path-runtime':
        'A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
    'd14-one-verb-per-meaning':
        '`toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.',
    'd7-strict-intercepts':
        'From its first stub, a chain’s network is strict: every outgoing request matches a declared stub.',
    'w3-unambiguous-element':
        'A verb acts on exactly ONE element: a descriptor that matches several is refused, never settled by the first.',
    'w4-no-landmarks-on-mobile':
        'An iOS screen has no ARIA landmark: a mobile verb is scoped with `within(testId(…), …)`.',
} as const;

export type RefusalRow = keyof typeof REFUSAL_WHY;

export function refusal(row: RefusalRow, { fix, found }: { fix: string; found: string }): string {
    return lessonBlock({
        fix,
        found,
        read: `${CATALOGUE_CHAPTER}#${row}`,
        why: REFUSAL_WHY[row],
    });
}
