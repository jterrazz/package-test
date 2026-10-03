import { relative } from 'node:path';

import { isNodeTestFileName } from '../../kit/project/role.js';
import {
    modelSpecFile,
    namedImports,
    resolveRelativeImport,
} from '../../kit/project/spec-model.js';
import type { SpecModel } from '../../kit/project/spec-model.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { lineAt, listFiles, readSource, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

function dockerSpecifications(rootDir: string): Map<string, SpecModel> {
    const dockerSpecs = new Map<string, SpecModel>();
    for (const file of listFiles(rootDir, (path) => path.endsWith('.specification.ts'))) {
        const model = modelSpecFile(file);
        if (model.dockerAware && model.runnerExports.size > 0) {
            dockerSpecs.set(file, model);
        }
    }
    return dockerSpecs;
}

function importedRunners(
    testFile: string,
    text: string,
    dockerSpecs: ReadonlyMap<string, SpecModel>,
): Set<string> {
    const runners = new Set<string>();
    for (const binding of namedImports(text)) {
        const target = resolveRelativeImport(testFile, binding.source);
        const model = target === undefined ? undefined : dockerSpecs.get(target);
        if (model?.runnerExports.has(binding.name) === true) {
            runners.add(binding.local);
        }
    }
    return runners;
}

/** invariant: the `await using` form is matched and exempt. */
const RESULT_BINDING =
    /\b(?<kind>await\s+using|const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+(?<runner>[A-Za-z_$][\w$]*)\b[^;]*?\.exec\s*\(/gu;

function checkTestFile(testFile: string, runners: ReadonlySet<string>, rootDir: string): Spotted[] {
    const text = readSource(testFile);
    const suppressed = suppressedLines(readText(testFile), 'docker-exec-bound-with-await-using');
    const violations: Spotted[] = [];
    for (const match of text.matchAll(RESULT_BINDING)) {
        const runner = match.groups?.runner ?? '';
        const line = lineAt(text, match.index);
        const unbound = !(match.groups?.kind ?? '').startsWith('await using');
        if (unbound && runners.has(runner) && !suppressed.has(line)) {
            violations.push({
                path: relative(rootDir, testFile),
                line,
                fix: `bind it with \`await using result = await ${runner}…\`, so the containers it started are removed at the end of the scope`,
                found: `a result of the docker-aware runner "${runner}" bound without \`await using\``,
                rule: 'docker-exec-bound-with-await-using',
            });
        }
    }
    return violations;
}

/** The runners are inferred from the `docker:` option of the imported spec files, where the oxlint rule needs them spelled by hand. */
export function checkDockerExecBoundWithAwaitUsing(rootDir: string): Spotted[] {
    const dockerSpecs = dockerSpecifications(rootDir);
    if (dockerSpecs.size === 0) {
        return [];
    }
    return listFiles(rootDir, isNodeTestFileName).flatMap((testFile) => {
        const runners = importedRunners(testFile, readSource(testFile), dockerSpecs);
        return runners.size === 0 ? [] : checkTestFile(testFile, runners, rootDir);
    });
}
