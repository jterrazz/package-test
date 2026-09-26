/* oxlint-disable vitest/expect-expect, vitest/valid-describe-callback, vitest/valid-title -- this module DECLARES no suite of its own: it hands the runner's primitives to oxlint's RuleTester, which declares one per rule case, so a literal title and an assertion are the CALLER's to carry */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { it as declareCase, describe as declareSuite } from 'vitest';

import type { LintRule } from './rule.js';

/** A `*.fixtures.ts`: importable only from a test (`fixtures-imported-by-tests-only`), out of the reach of `no-test-code-in-production` and `import-within-declared-layers`. */

type OxlintRule = Parameters<RuleTester['run']>[1];

export function ruleTester(): RuleTester {
    // Aliased: the runner's hygiene rules would read `describe(…)`/`it(…)` as a suite being declared here.
    RuleTester.describe = (name, body) => {
        declareSuite(name, body);
    };
    RuleTester.it = (name, body) => {
        declareCase(name, body);
    };
    return new RuleTester();
}

/** A `LintRule` reads every node as an `AstNode`, oxlint types each handler with its node's interface, and neither is assignable to the other. */
export function asOxlintRule(rule: LintRule): OxlintRule {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the two shapes describe the same object; only the node each handler is typed with differs
    return rule as unknown as OxlintRule;
}

/** What a rule reads of a path starts at the package root, so the folder above must answer for nothing. */
export function checkoutUnder(folder: string, folders: string[] = []): string {
    const scratch = mkdtempSync(join(tmpdir(), 'checkout-'));
    const root = join(scratch, folder, 'checkout');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}\n');
    for (const inside of folders) {
        mkdirSync(join(root, inside), { recursive: true });
    }
    return root;
}

export function repositoryUnder(
    folder: string,
    folders: string[] = [],
    git: 'directory' | 'file' = 'directory',
): string {
    const scratch = mkdtempSync(join(tmpdir(), 'repository-'));
    const root = join(scratch, folder, 'repository');
    mkdirSync(root, { recursive: true });
    for (const inside of folders) {
        mkdirSync(join(root, inside), { recursive: true });
    }
    if (git === 'directory') {
        mkdirSync(join(root, '.git'));
    } else {
        writeFileSync(join(root, '.git'), 'gitdir: /elsewhere/.git/worktrees/repository\n');
    }
    return root;
}

export function packageWith(files: Record<string, string>): string {
    const root = checkoutUnder('work');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    return root;
}
