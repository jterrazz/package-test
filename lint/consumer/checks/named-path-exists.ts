import { treeKind } from '@jterrazz/typescript/rules';
import type { Teaching } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { anchoredPaths, collectFixtureReferences } from '../../kit/project/named-paths.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { DISK_CALL, findSpecsRoots, listReaders, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

// invariant: a path under a unit's build output, `dist/` or `.artifacts/<tool>/`, is made by the build the spec runs after: it exists once the kind's test has built, and in no clean checkout before.
const BUILD_OUTPUT = /(?:^|\/)(?:dist|\.artifacts\/[^/]+)\//u;

const isBuilt = (rootDir: string, target: string): boolean =>
    BUILD_OUTPUT.test(relative(rootDir, target));

// outside: inside a git work tree a path names only what git keeps: an ignored target exists on this workstation and on no checkout.
function missingTarget(named: string, target: string, onDisk: boolean): Teaching {
    return onDisk
        ? {
              fix: `track ${target} (it is ignored by git), or name a file that is`,
              found: `${named} names nothing: ${target} is ignored by git`,
          }
        : {
              fix: `create ${target}, or correct the path`,
              found: `${named} names nothing: ${target} does not exist`,
          };
}

// invariant: a document's `fixture:` entry is a bare path; a call names its kind.
function crossedTarget(
    named: string,
    { found, key, path }: { found: 'directory' | 'file'; key: string | undefined; path: string },
): Teaching {
    const bare = path.replace(/\/$/u, '');
    const spelled = found === 'directory' ? `${bare}/` : bare;
    return {
        fix: key === undefined ? `write ${found}('${spelled}')` : `write "${spelled}"`,
        found: `${named} names a ${found}`,
    };
}

function fixtureViolations(
    file: string,
    rootDir: string,
    suppressed: ReadonlySet<number>,
): Spotted[] {
    const violations: Spotted[] = [];
    for (const { column, key, kind, line, path } of collectFixtureReferences(
        file,
        DISK_CALL,
        true,
    )) {
        const target = resolve(dirname(file), path);
        const found = treeKind(target);
        if (
            found === kind ||
            suppressed.has(line) ||
            (found === undefined && isBuilt(rootDir, target))
        ) {
            continue;
        }
        const named = key === undefined ? `${kind}('${path}')` : `${key}: "${path}"`;
        violations.push({
            column,
            path: relative(rootDir, file),
            line,
            ...(found === undefined
                ? missingTarget(named, relative(rootDir, target), existsSync(target))
                : crossedTarget(named, { found, key, path })),
            rule: 'named-path-exists',
        });
    }
    return violations;
}

export function checkNamedPathExistsIn(file: string, rootDir: string): Spotted[] {
    const violations: Spotted[] = [];
    const suppressed = suppressedLines(readText(file), 'named-path-exists');
    // Stryker disable next-line ConditionalExpression,MethodExpression: a spec document parses as no module, so it names no anchored path either way
    const anchored = file.endsWith(SPEC_EXTENSION) ? [] : anchoredPaths(file);
    for (const { column, line, named, target } of anchored) {
        if (treeKind(target) !== undefined || suppressed.has(line) || isBuilt(rootDir, target)) {
            continue;
        }
        violations.push({
            column,
            path: relative(rootDir, file),
            line,
            ...missingTarget(named, relative(rootDir, target), existsSync(target)),
            rule: 'named-path-exists',
        });
    }
    violations.push(...fixtureViolations(file, rootDir, suppressed));
    return violations;
}

export function checkNamedPathExists(rootDir: string): Spotted[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) =>
        listReaders(specsRoot).flatMap((file) => checkNamedPathExistsIn(file, rootDir)),
    );
}
