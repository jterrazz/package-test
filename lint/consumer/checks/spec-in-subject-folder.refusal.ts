import { blankComments } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { isRelativePath } from '../../kit/project/relative-path.js';
import { openersAt } from '../../kit/project/source-scan.js';
import { openedSubjects, shown, testCallCount, testsIn } from '../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../kit/project/spec-subjects.js';
import { literalSpans } from '../../kit/project/spec-values.js';
import { codeOnly } from './spec-in-subject-folder.prune.js';
import { hooksOf, splitFiles } from './spec-in-subject-folder.split.js';
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

// invariant: a hook is known by its code, its strings blanked, since a split rebases the paths they hold.
function hookKeysOf(text: string): string[] {
    return hooksOf(text).map((hook) =>
        // Stryker disable next-line StringLiteral: a key is only ever compared with keys built alike
        codeOnly(text.slice(hook.start, hook.end)).replaceAll(/\s+/gu, ' '),
    );
}

function lostHook(spec: SpecRead, drafts: readonly Draft[]): string | undefined {
    const written = new Set(drafts.flatMap((draft) => hookKeysOf(draft.text)));
    const missing = hookKeysOf(spec.text).find((key) => !written.has(key));
    return missing === undefined
        ? undefined
        : `the split would lose the hook \`${missing.slice(0, missing.indexOf('('))}\` the tests it keeps may need`;
}

/** Every test the spec holds is written once, under the title it had: each title is found in a draft, and the drafts hold as many test calls as the source, so none is written twice; and every hook is written in one draft at least. */
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
        ? lostHook(spec, drafts)
        : `the split would write ${kept} test calls of the ${read} it read`;
}

// invariant: a relative literal that names a path beside the spec and none beside its new place was written for the folder it leaves, and no lead the rebase reads carries it.
function strandedPath(
    specsRoot: string,
    spec: SpecRead,
    drafts: readonly Draft[],
): string | undefined {
    for (const { target, text } of drafts) {
        const blank = blankComments(text);
        for (const { end, start } of literalSpans(blank)) {
            const path = text.slice(start + 1, end - 1);
            if (
                isRelativePath(path) &&
                existsSync(resolve(dirname(spec.file), path)) &&
                !existsSync(resolve(dirname(target), path))
            ) {
                return `\`${path}\` names a path beside the spec that no rebase carries to ${shown(specsRoot, target)}: its author writes it from there`;
            }
        }
    }
    return undefined;
}

/** Why `typescript fix` leaves this spec to its author, or `undefined` when its split writes every test whole, once, under its title. */
export function splitRefusal(
    specsRoot: string,
    spec: SpecRead,
    plan: Map<string, string>,
): string | undefined {
    const cuts = new Set(plan.values()).size > 1;
    const refused =
        unnamed(spec, plan) ??
        sharedTarget(specsRoot, plan) ??
        (cuts ? nestedTest(spec) : undefined);
    if (refused !== undefined) {
        return refused;
    }
    const drafts = splitFiles(specsRoot, spec, plan);
    return lostInSplit(spec, drafts) ?? strandedPath(specsRoot, spec, drafts);
}
