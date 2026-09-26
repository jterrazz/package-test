import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import type { Teaching } from '../../engine/catalogue/lesson.js';
import { treeKind } from '../../engine/project/git-tree.js';
import { SHARED_GROUND } from '../../engine/project/ground.js';
import { SPEC_EXTENSION } from '../../engine/project/spec-document.js';
import { suppressedLines } from '../../engine/project/suppression.js';
import {
    anchoredPaths,
    collectFixtureReferences,
    DISK_CALL,
    findSpecsRoots,
    listReferrers,
    readText,
} from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

/** Inside a git work tree a path names only what git keeps: an ignored target exists on this workstation and on no checkout. */
function missingTarget(named: string, target: string, onDisk: boolean): Teaching {
    return onDisk
        ? {
              fix: `track ${target} (it is ignored by git), or name a file that is`,
              found: `${named} names nothing — ${target} is ignored by git`,
          }
        : {
              fix: `create ${target}, or correct the path`,
              found: `${named} names nothing — ${target} does not exist`,
          };
}

function crossedTarget(
    named: string,
    { found, key, path }: { found: 'directory' | 'file'; key: string | undefined; path: string },
): Teaching {
    const bare = path.replace(/\/+$/u, '');
    const spelled = found === 'directory' ? `${bare}/` : bare;
    if (key === undefined) {
        return { fix: `write ${found}('${spelled}')`, found: `${named} names a ${found}` };
    }
    return {
        fix: key === 'fixture' ? `write "${spelled}"` : `${key}: reads one file — name one`,
        found: `${named} names a ${found}`,
    };
}

export function checkNamedPathExistsIn(file: string, rootDir: string): Finding[] {
    const violations: Finding[] = [];
    const suppressed = file.endsWith(SPEC_EXTENSION)
        ? new Set<number>()
        : suppressedLines(readText(file), 'named-path-exists');
    if (!file.endsWith(SPEC_EXTENSION)) {
        for (const { column, line, named, target } of anchoredPaths(file)) {
            if (treeKind(target) !== undefined || suppressed.has(line)) {
                continue;
            }
            violations.push({
                column,
                file: relative(rootDir, file),
                line,
                ...missingTarget(named, relative(rootDir, target), existsSync(target)),
                rule: 'named-path-exists',
                severity: 'error',
            });
        }
    }
    for (const { column, key, kind, line, path } of collectFixtureReferences(
        file,
        DISK_CALL,
        true,
    )) {
        const target = resolve(dirname(file), path);
        const found = treeKind(target);
        if (found === kind || suppressed.has(line)) {
            continue;
        }
        const named = key === undefined ? `${kind}('${path}')` : `${key}: "${path}"`;
        violations.push({
            column,
            file: relative(rootDir, file),
            line,
            ...(found === undefined
                ? missingTarget(named, relative(rootDir, target), existsSync(target))
                : crossedTarget(named, { found, key, path })),
            rule: 'named-path-exists',
            severity: 'error',
        });
    }
    return violations;
}

export function checkNamedPathExists(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        listReferrers(specsRoot, join(specsRoot, SHARED_GROUND)).flatMap((file) =>
            checkNamedPathExistsIn(file, rootDir),
        ),
    );
}
