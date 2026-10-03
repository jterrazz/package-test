import { relative } from 'node:path';

import { isNodeTestFileName } from '../../kit/project/role.js';
import {
    argumentsAt,
    importedRunners,
    runnerBindings,
    specificationModels,
} from '../../kit/project/spec-model.js';
import type { SpecModel } from '../../kit/project/spec-model.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { lineAt, listFiles, readSource, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

/** The object is read when the call hangs off a plain name: `local.seed(…)`, never `api.with({}).seed(…)`. */
const SEED_OR_TABLE = /(?<object>[A-Za-z_$][\w$]*)?\s*\.(?<verb>seed|table)\s*\(/gu;

const NAMES_A_DATABASE = /\bdatabase\s*:/u;

/** invariant: enforced only when exactly one imported spec applies: mixed database configurations are ambiguous. */
function onlyApplicable(
    testFile: string,
    text: string,
    enforced: ReadonlyMap<string, SpecModel>,
): SpecModel | undefined {
    const applicable = new Set(importedRunners(testFile, text, enforced).map(({ model }) => model));
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
    const locals = new Set(runnerBindings(text).map(({ local }) => local));
    const suppressed = suppressedLines(readText(testFile), 'database-named-only-when-several');
    const violations: Spotted[] = [];
    for (const match of text.matchAll(SEED_OR_TABLE)) {
        // Stryker disable next-line StringLiteral: a call match always carries its verb
        const { object, verb = '' } = match.groups ?? {};
        const line = lineAt(text, match.index);
        const args = argumentsAt(text, match.index + match[0].length - 1);
        const spotted = misnamed(verb, count, NAMES_A_DATABASE.test(args));
        if (
            !(locals as ReadonlySet<unknown>).has(object) &&
            !suppressed.has(line) &&
            spotted !== null
        ) {
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
    const enforced = specificationModels(
        rootDir,
        ({ sqlDatabaseCount }) => (sqlDatabaseCount ?? 0) >= 1,
    );
    return listFiles(rootDir, isNodeTestFileName).flatMap((testFile) => {
        const model = onlyApplicable(testFile, readSource(testFile), enforced);
        return model === undefined ? [] : checkTestFile(testFile, model, rootDir);
    });
}
