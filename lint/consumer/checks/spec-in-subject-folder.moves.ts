import { forgetTree, moveKeepingHistory } from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { shown, silenced, splitPlan, subjectSpecs } from '../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../kit/project/spec-subjects.js';
import { liftGround } from './spec-in-subject-folder.lift.js';
import { splitFiles } from './spec-in-subject-folder.split.js';
import type { Draft } from './spec-in-subject-folder.split.js';

function writeSplit(
    specsRoot: string,
    spec: SpecRead,
    keepsFile: boolean,
    written: readonly Draft[],
): string[] {
    const [opening] = written;
    // Stryker disable next-line ConditionalExpression,BlockStatement,ArrayDeclaration: a split always writes its opening subject's file
    if (opening === undefined) {
        return [];
    }
    // invariant: a split that keeps no file in place has no target equal to it.
    if (!keepsFile) {
        mkdirSync(dirname(opening.target), { recursive: true });
        moveKeepingHistory(spec.file, opening.target);
    }
    for (const { target, text } of written) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
    }
    return written
        .filter(({ target }) => target !== spec.file)
        .map(({ target }) => `${shown(specsRoot, spec.file)} → ${shown(specsRoot, target)}`);
}

/** A test reaching two subjects goes with the one its chain opens on; a file whose target is taken is left for its author. */
export function fixSpecInSubjectFolder(specsRoot: string): string[] {
    const done: string[] = [];
    for (const spec of subjectSpecs(specsRoot)) {
        const rule = spec.subjects.size > 1 ? 'one-subject-per-spec' : 'spec-in-subject-folder';
        // Stryker disable next-line ConditionalExpression: a spec of no subject plans no target, and is skipped below
        if (spec.subjects.size === 0 || silenced(spec, rule)) {
            continue;
        }
        const plan = splitPlan(specsRoot, spec);
        const targets = [...plan.values()];
        // Stryker disable next-line ConditionalExpression,ArrowFunction,BlockStatement: a spec in its folder splits into itself, which the writes leave byte for byte
        if (targets.every((target) => target === spec.file)) {
            continue;
        }
        if (targets.some((target) => target !== spec.file && existsSync(target))) {
            continue;
        }
        done.push(
            ...writeSplit(
                specsRoot,
                spec,
                targets.includes(spec.file),
                splitFiles(specsRoot, spec, plan),
            ),
        );
        // Stryker disable next-line CallExpression: outside a git work tree the walk reads the disk afresh
        forgetTree();
        done.push(...liftGround(specsRoot, dirname(spec.file)));
        removeEmptied(specsRoot, dirname(spec.file));
    }
    return done;
}

function removeEmptied(specsRoot: string, folder: string): void {
    let current = folder;
    // Stryker disable next-line ConditionalExpression,LogicalOperator: the climb starts at a folder inside the specs root, which a moved spec never empties
    while (current !== specsRoot && existsSync(current)) {
        if (readdirSync(current).length > 0) {
            break;
        }
        rmSync(current, { recursive: true });
        current = dirname(current);
    }
    // Stryker disable next-line CallExpression: outside a git work tree the walk reads the disk afresh
    forgetTree();
}
