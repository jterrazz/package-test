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

/** The runners are inferred from the `docker:` option of the imported spec files, where the oxlint rule needs them spelled by hand. */
export function checkDockerExecBoundWithAwaitUsing(rootDir: string): Spotted[] {
    const violations: Spotted[] = [];
    const specFiles = listFiles(rootDir, (path) => path.endsWith('.specification.ts'));
    const dockerSpecs = new Map<string, SpecModel>();
    for (const file of specFiles) {
        const model = modelSpecFile(file);
        if (model.dockerAware && model.runnerExports.size > 0) {
            dockerSpecs.set(file, model);
        }
    }
    if (dockerSpecs.size === 0) {
        return violations;
    }

    for (const testFile of listFiles(rootDir, isNodeTestFileName)) {
        const text = readSource(testFile);
        const runners = new Set<string>();
        for (const binding of namedImports(text)) {
            const target = resolveRelativeImport(testFile, binding.source);
            const model = target === undefined ? undefined : dockerSpecs.get(target);
            if (model?.runnerExports.has(binding.name) === true) {
                runners.add(binding.local);
            }
        }
        if (runners.size === 0) {
            continue;
        }
        const suppressed = suppressedLines(
            readText(testFile),
            'docker-exec-bound-with-await-using',
        );
        // invariant: the `await using` form matches group 1 and is exempt.
        const binding =
            /\b(?<kind>await\s+using|const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+(?<runner>[A-Za-z_$][\w$]*)\b[^;]*?\.exec\s*\(/gu;
        for (const match of text.matchAll(binding)) {
            const kind = match.groups?.kind ?? '';
            const runner = match.groups?.runner ?? '';
            if (kind.startsWith('await using') || !runners.has(runner)) {
                continue;
            }
            const line = lineAt(text, match.index);
            if (suppressed.has(line)) {
                continue;
            }
            const rel = relative(rootDir, testFile);
            violations.push({
                path: rel,
                line,
                fix: `bind it with \`await using result = await ${runner}…\`, so the containers it started are removed at the end of the scope`,
                found: `a result of the docker-aware runner "${runner}" bound without \`await using\``,
                rule: 'docker-exec-bound-with-await-using',
            });
        }
    }
    return violations;
}
