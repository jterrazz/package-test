import { relative } from 'node:path';

import { isNodeTestFileName } from '../../engine/project/role.js';
import {
    balancedParens,
    CONSTRUCTORS,
    modelSpecFile,
    namedImports,
    NON_RUNNER_BINDINGS,
    resolveRelativeImport,
} from '../../engine/project/spec-model.js';
import type { SpecModel } from '../../engine/project/spec-model.js';
import { suppressedLines } from '../../engine/project/suppression.js';
import { lineAt, listFiles, readSource, readText } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

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

export function checkDatabaseNamedOnlyWhenSeveral(rootDir: string): Finding[] {
    const violations: Finding[] = [];
    const enforced = new Map<string, SpecModel>();
    for (const file of listFiles(rootDir, (path) => path.endsWith('.specification.ts'))) {
        const model = modelSpecFile(file);
        if (
            model.sqlDatabaseCount !== null &&
            model.sqlDatabaseCount >= 1 &&
            model.runnerExports.size > 0
        ) {
            enforced.set(file, model);
        }
    }
    if (enforced.size === 0) {
        return violations;
    }

    for (const testFile of listFiles(rootDir, isNodeTestFileName)) {
        const text = readSource(testFile);
        // Enforced only when exactly one imported spec applies: mixed database configurations are ambiguous.
        const applicable = new Set<SpecModel>();
        for (const binding of namedImports(text)) {
            const target = resolveRelativeImport(testFile, binding.source);
            const model = target === undefined ? undefined : enforced.get(target);
            if (model?.runnerExports.has(binding.name) === true) {
                applicable.add(model);
            }
        }
        const [onlyApplicable] = applicable;
        if (applicable.size !== 1 || onlyApplicable === undefined) {
            continue;
        }
        const count = onlyApplicable.sqlDatabaseCount ?? 0;
        const locals = localRunnerBindings(text);
        const suppressed = suppressedLines(readText(testFile), 'database-named-only-when-several');
        const rel = relative(rootDir, testFile);

        for (const match of text.matchAll(/\.(?<verb>seed|table)\s*\(/gu)) {
            const verb = match.groups?.verb ?? '';
            const object = memberObjectIdentifier(text, match.index);
            if (object !== null && locals.has(object)) {
                continue;
            }
            const args = balancedParens(text, text.indexOf('(', match.index));
            const hasDatabase = /\bdatabase\s*:/u.test(args);
            const line = lineAt(text, match.index);
            if (suppressed.has(line)) {
                continue;
            }
            if (count >= 2 && !hasDatabase) {
                violations.push({
                    file: rel,
                    line,
                    fix: `pass \`.${verb}(…, { database: '<key>' })\`, naming one of the ${count} databases the services record declares`,
                    found: `\`.${verb}()\` with no \`{ database }\`, while ${count} SQL databases are declared`,
                    rule: 'database-named-only-when-several',
                    severity: 'error',
                });
            } else if (count === 1 && hasDatabase) {
                violations.push({
                    file: rel,
                    line,
                    fix: `delete the \`{ database }\` option of \`.${verb}()\``,
                    found: `\`.${verb}()\` passes \`{ database }\`, while a single SQL database is declared`,
                    rule: 'database-named-only-when-several',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}
