import { lessonParts, refusalBlock } from '@jterrazz/typescript/rules';
import type { ChapterAnchor, Lesson } from '@jterrazz/typescript/rules';

import { refusal } from '../../../lint/refusal.js';

export type ScenarioVerb = 'open' | 'visit';

const SURFACE_OF: Record<ScenarioVerb, string> = { open: 'screen', visit: 'page' };

const isAnchor = (read: string): read is ChapterAnchor => /^docs\/[^#]+\.md#.+$/u.test(read);

function finishedLesson(error: unknown): Lesson | undefined {
    if (!(error instanceof Error)) {
        return undefined;
    }
    const { fix = '', found = '', read = '', why = '' } = lessonParts(error.message) ?? {};
    return [fix, found, why].includes('') || !isAnchor(read)
        ? undefined
        : { fix, found, read, why };
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
                    ? 'docs/08-website.md#visit-scenarios--the-when'
                    : 'docs/09-mobile.md#open-scenarios--the-when',
            why: `${verb === 'visit' ? 'A' : 'An'} ${verb} scenario drives the ${surface} step by step, and the first step that fails ends it.`,
        }),
        { cause: error },
    );
}
