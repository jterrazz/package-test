import { relative } from 'node:path';

import { isNodeTestFileName } from '../../kit/project/role.js';
import {
    balancedParens,
    CONSTRUCTORS,
    modelSpecFile,
    namedImports,
    NON_RUNNER_BINDINGS,
    resolveRelativeImport,
} from '../../kit/project/spec-model.js';
import type { SpecModel } from '../../kit/project/spec-model.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { lineAt, listFiles, readSource, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

function localRunnerBindings(text: string): Set<string> {
    const locals = new Set<string>();
    const decl = new RegExp(
        String.raw`\{(?<names>[^}]*)\}\s*=\s*await\s+specification\.(?:${CONSTRUCTORS})\s*\(`,
        'gu',
    );
    for (const match of text.matchAll(decl)) {
        for (const raw of (match.groups?.names ?? '').split(',')) {
            const part = raw.trim();
            const local = (part.includes(':') ? (part.split(':')[1] ?? '') : part).trim();
            if (local.length > 0 && !NON_RUNNER_BINDINGS.has((part.split(':')[0] ?? '').trim())) {
                locals.add(local);
            }
        }
    }
    return locals;
}

function memberObjectIdentifier(text: string, dotIndex: number): null | string {
    const before = text.slice(0, dotIndex);
    const match = /(?<name>[A-Za-z_$][\w$]*)\s*$/u.exec(before);
    return match === null ? match : (match.groups?.name ?? null);
}

function enforcedSpecifications(rootDir: string): Map<string, SpecModel> {
    const enforced = new Map<string, SpecModel>();
    for (const file of listFiles(rootDir, (path) => path.endsWith('.specification.ts'))) {
        const model = modelSpecFile(file);
        if ((model.sqlDatabaseCount ?? 0) >= 1 && model.runnerExports.size > 0) {
            enforced.set(file, model);
        }
    }
    return enforced;
}

/** invariant: enforced only when exactly one imported spec applies: mixed database configurations are ambiguous. */
function onlyApplicable(
    testFile: string,
    text: string,
    enforced: ReadonlyMap<string, SpecModel>,
): SpecModel | undefined {
    const applicable = new Set<SpecModel>();
    for (const binding of namedImports(text)) {
        const target = resolveRelativeImport(testFile, binding.source);
        const model = target === undefined ? undefined : enforced.get(target);
        if (model?.runnerExports.has(binding.name) === true) {
            applicable.add(model);
        }
    }
    const [only] = applicable;
    return applicable.size === 1 ? only : undefined;
}

function misnamed(
    verb: string,
    count: number,
    hasDatabase: boolean,
): null | Pick<Spotted, 'fix' | 'found'> {
    if (count >= 2 && !hasDatabase) {
        return {
            fix: `pass \`.${verb}(…, { database: '<key>' })\`, naming one of the ${count} databases the services record declares`,
            found: `\`.${verb}()\` with no \`{ database }\`, while ${count} SQL databases are declared`,
        };
    }
    if (count === 1 && hasDatabase) {
        return {
            fix: `delete the \`{ database }\` option of \`.${verb}()\``,
            found: `\`.${verb}()\` passes \`{ database }\`, while a single SQL database is declared`,
        };
    }
    return null;
}

function checkTestFile(testFile: string, model: SpecModel, rootDir: string): Spotted[] {
    const text = readSource(testFile);
    const count = model.sqlDatabaseCount ?? 0;
    const locals = localRunnerBindings(text);
    const suppressed = suppressedLines(readText(testFile), 'database-named-only-when-several');
    const violations: Spotted[] = [];
    for (const match of text.matchAll(/\.(?<verb>seed|table)\s*\(/gu)) {
        const object = memberObjectIdentifier(text, match.index);
        const line = lineAt(text, match.index);
        const args = balancedParens(text, text.indexOf('(', match.index));
        const spotted = misnamed(match.groups?.verb ?? '', count, /\bdatabase\s*:/u.test(args));
        if ((object === null || !locals.has(object)) && !suppressed.has(line) && spotted !== null) {
            violations.push({
                ...spotted,
                line,
                path: relative(rootDir, testFile),
                rule: 'database-named-only-when-several',
            });
        }
    }
    return violations;
}

export function checkDatabaseNamedOnlyWhenSeveral(rootDir: string): Spotted[] {
    const enforced = enforcedSpecifications(rootDir);
    if (enforced.size === 0) {
        return [];
    }
    return listFiles(rootDir, isNodeTestFileName).flatMap((testFile) => {
        const model = onlyApplicable(testFile, readSource(testFile), enforced);
        return model === undefined ? [] : checkTestFile(testFile, model, rootDir);
    });
}
