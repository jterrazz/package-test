import { lessonParts, refusalBlock } from '@jterrazz/typescript/rules';
import type { ChapterAnchor, Lesson } from '@jterrazz/typescript/rules';

import { refusal } from './refusal.js';

export type ScenarioVerb = 'open' | 'visit';

const SURFACE_OF: Record<ScenarioVerb, string> = { open: 'screen', visit: 'page' };

const CHAPTER_ANCHOR = /^docs\/[^#]+\.md#.+$/u;

const isAnchor = (read: string): read is ChapterAnchor => CHAPTER_ANCHOR.test(read);

function finishedLesson(error: unknown): Lesson | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }
    // Stryker disable next-line ObjectLiteral: outside: lessonParts answers parts for any text
    const { fix = '', found = '', read, why = '' } = lessonParts(error.message) ?? {};
    const anchor = String(read);
    return [fix, found, why].includes('') || !isAnchor(anchor)
        ? undefined
        : { fix, found, read: anchor, why };
}

export function scenarioFailure(
    error: unknown,
    evidence: null | string,
    verb: ScenarioVerb,
): Error {
    const suffix = evidence === null ? '' : `\nEvidence: ${evidence}`;
    const lesson = finishedLesson(error);
    if (error instanceof Error && lesson !== undefined) {
        error.message = refusalBlock({ ...lesson, found: `${lesson.found}${suffix}` });
        return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const surface = SURFACE_OF[verb];
    return new Error(
        refusal({
            fix: `correct the step that failed, or the ${surface} it drives`,
            found: `the ${verb} scenario failed:\n  ${message.replaceAll('\n', '\n  ')}${suffix}`,
            read:
                verb === 'visit'
                    ? 'docs/10-website.md#visit-scenarios--the-when'
                    : 'docs/11-mobile.md#open-scenarios--the-when',
            why: `${verb === 'visit' ? 'A' : 'An'} ${verb} scenario drives the ${surface} step by step, and the first step that fails ends it.`,
        }),
        { cause: error },
    );
}
