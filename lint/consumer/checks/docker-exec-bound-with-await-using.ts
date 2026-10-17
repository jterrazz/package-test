import { relative } from 'node:path';

import { isNodeTestFileName } from '../../kit/project/role.js';
import { importedRunners, specificationModels } from '../../kit/project/spec-model.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { lineAt, listFiles, readSource, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

/** invariant: the `await using` form is matched and exempt. */
const RESULT_BINDING =
    /\b(?<kind>await\s+using|const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+(?<runner>[A-Za-z_$][\w$]*)\b[^;]*?\.exec\s*\(/gu;

function checkTestFile(testFile: string, runners: ReadonlySet<string>, rootDir: string): Spotted[] {
    const text = readSource(testFile);
    const suppressed = suppressedLines(readText(testFile), 'docker-exec-bound-with-await-using');
    const violations: Spotted[] = [];
    for (const match of text.matchAll(RESULT_BINDING)) {
        // Stryker disable next-line StringLiteral: a binding match always carries its kind and runner
        const { kind = '', runner = '' } = match.groups ?? {};
        const line = lineAt(text, match.index);
        const unbound = !kind.startsWith('await');
        if (unbound && runners.has(runner) && !suppressed.has(line)) {
            violations.push({
                path: relative(rootDir, testFile),
                line,
                fix: `bind it with \`await using result = await ${runner}...\`, so the containers it started are removed at the end of the scope`,
                found: `a result of the docker-aware runner "${runner}" bound without \`await using\``,
                rule: 'docker-exec-bound-with-await-using',
            });
        }
    }
    return violations;
}

/** The runners are inferred from the `docker:` option of the imported spec files, where the oxlint rule needs them spelled by hand. */
export function checkDockerExecBoundWithAwaitUsing(rootDir: string): Spotted[] {
    const dockerSpecs = specificationModels(rootDir, ({ dockerAware }) => dockerAware);
    return listFiles(rootDir, isNodeTestFileName).flatMap((testFile) => {
        const runners = new Set(
            importedRunners(testFile, readSource(testFile), dockerSpecs).map(({ local }) => local),
        );
        return checkTestFile(testFile, runners, rootDir);
    });
}
