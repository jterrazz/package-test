import { forgetTree, moveKeepingHistory } from '@jterrazz/typescript/rules';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
    readSpec,
    shown,
    silenced,
    splitPlan,
    subjectSpecs,
} from '../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../kit/project/spec-subjects.js';
import { liftGround } from './spec-in-subject-folder.lift.js';
import { splitRefusal } from './spec-in-subject-folder.refusal.js';
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

/** A spec of one subject moves whole to the folder its subject names; a spec of several is reported with its plan and split by its author, and a file whose target is taken is left alone. */
export function fixSpecInSubjectFolder(specsRoot: string): string[] {
    const done: string[] = [];
    // invariant: each spec is read again before it is planned, so a lift an earlier move made to it is the text it moves.
    for (const listed of subjectSpecs(specsRoot)) {
        const spec = readSpec(specsRoot, listed.file);
        // invariant: a spec of several subjects is split by its author, who names each file; only a spec of one subject is moved, whole, to the folder its subject names.
        // Stryker disable next-line ConditionalExpression: a spec of no subject plans no target, and is skipped below
        if (spec.subjects.size !== 1 || silenced(spec, 'spec-in-subject-folder')) {
            continue;
        }
        const plan = splitPlan(specsRoot, spec);
        const targets = [...plan.values()];
        // Stryker disable next-line ConditionalExpression,ArrowFunction,BlockStatement: a spec in its folder splits into itself, which the writes leave byte for byte
        if (targets.every((target) => target === spec.file)) {
            continue;
        }
        if (
            targets.some((target) => target !== spec.file && existsSync(target)) ||
            splitRefusal(specsRoot, spec, plan) !== undefined
        ) {
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
