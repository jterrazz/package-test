import { blankComments } from '@jterrazz/typescript/rules';

import { openersAt } from '../../kit/project/source-scan.js';
import { openedSubjects, shown, testCallCount, testsIn } from '../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../kit/project/spec-subjects.js';
import { splitFiles } from './spec-in-subject-folder.split.js';
import type { Draft } from './spec-in-subject-folder.split.js';

// invariant: the brackets around a test that stands in groups alone pair up, outermost first: a `describe` call's parenthesis, then the body its callback opens (`=> {` or `function () {`).
function standsInGroups(blank: string, brackets: number[], calls: ReadonlySet<number>): boolean {
    return brackets.every((at, depth) =>
        depth % 2 === 0
            ? calls.has(at)
            : blank[at] === '{' && /(?:=>|\))\s*$/u.test(blank.slice(0, at)),
    );
}

function nestedTest(spec: SpecRead): string | undefined {
    const blank = blankComments(spec.text);
    const calls = new Set(
        [...blank.matchAll(/(?<![.\w$])describe(?:\.\w+(?:\([^()]*\))?)*\s*\(/gu)].map(
            (found) => found.index + found[0].length - 1,
        ),
    );
    const nested = spec.tests.find(
        (test) => !standsInGroups(blank, openersAt(blank, test.start), calls),
    );
    return nested === undefined
        ? undefined
        : `the test "${nested.title}" stands inside a loop or a block that is no \`describe\`: a cut cannot tell how many tests it moves, nor leave the block whole`;
}

function sharedTarget(specsRoot: string, plan: Map<string, string>): string | undefined {
    const byTarget = new Map<string, string>();
    for (const [name, target] of plan) {
        const other = byTarget.get(target);
        if (other !== undefined) {
            return `${other} and ${name} are both filed at ${shown(specsRoot, target)}: the split cannot tell them apart`;
        }
        byTarget.set(target, name);
    }
    return undefined;
}

function unnamed(spec: SpecRead, plan: Map<string, string>): string | undefined {
    const left = openedSubjects(spec).filter((name) => !plan.has(name));
    return left.length === 0
        ? undefined
        : `${left.join(', ')} ${left.length === 1 ? 'has' : 'have'} no standard folder: the file ${left.length === 1 ? 'it goes' : 'they go'} to is its author's to name`;
}

function testCalls(text: string): number {
    return testCallCount(blankComments(text));
}

/** Every test the spec holds is written once, under the title it had: each title is found in a draft, and the drafts hold as many test calls as the source, so none is written twice. */
export function lostInSplit(spec: SpecRead, drafts: readonly Draft[]): string | undefined {
    const written = drafts.flatMap((draft) => testsIn(draft.text).map(({ title }) => title));
    const remaining = [...written];
    const missing = spec.tests.find(({ title }) => {
        const at = remaining.indexOf(title);
        if (at === -1) {
            return true;
        }
        remaining.splice(at, 1);
        return false;
    });
    if (missing !== undefined) {
        return `the split would lose the test "${missing.title}"`;
    }
    const read = testCalls(spec.text);
    const kept = drafts.reduce((sum, draft) => sum + testCalls(draft.text), 0);
    return kept === read
        ? undefined
        : `the split would write ${kept} test calls of the ${read} it read`;
}

/** Why `typescript fix` leaves this spec to its author, or `undefined` when its split writes every test whole, once, under its title. */
export function splitRefusal(
    specsRoot: string,
    spec: SpecRead,
    plan: Map<string, string>,
): string | undefined {
    const cuts = new Set(plan.values()).size > 1;
    return (
        unnamed(spec, plan) ??
        sharedTarget(specsRoot, plan) ??
        (cuts ? nestedTest(spec) : undefined) ??
        lostInSplit(spec, splitFiles(specsRoot, spec, plan))
    );
}
