import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The Makefile contract: every repository answers `make install`, `build`,
 * `lint`, `fix`, `test` and `check`, and the flows speak only these six.
 * `makefile.test.ts` holds this repository to the six exactly, and to what
 * its `fix` runs.
 */

/** The six targets, in the order a clone meets them. */
export const MAKE_TARGETS = ['install', 'build', 'lint', 'fix', 'test', 'check'] as const;

/** One target: its prerequisites, and the recipe lines it runs. */
export type MakeTarget = { prerequisites: string[]; recipe: string[] };

/** A rule line — `name: prerequisites` — never a variable assignment (`:=`). */
const RULE = /^(?<name>[^\s:#=]+):(?!=)(?<prerequisites>[^#]*)/u;

/**
 * The targets a Makefile declares, by name: a rule line, then its
 * tab-indented recipe. `.PHONY` is read as a target like any other.
 */
export function makeTargets(text: string): Map<string, MakeTarget> {
    const targets = new Map<string, MakeTarget>();
    let current: MakeTarget | undefined;
    for (const line of text.split('\n')) {
        const rule = RULE.exec(line);
        if (rule?.groups !== undefined) {
            current = {
                prerequisites: (rule.groups.prerequisites ?? '')
                    .trim()
                    .split(/\s+/u)
                    .filter(Boolean),
                recipe: [],
            };
            targets.set(rule.groups.name ?? '', current);
        } else if (line.startsWith('\t') && current !== undefined) {
            current.recipe.push(line.trim());
        } else if (line.trim().length > 0 && !line.startsWith('#')) {
            current = undefined;
        }
    }
    return targets;
}

/** The Makefile at a repository root, read. */
export function makefileAt(root: string): Map<string, MakeTarget> {
    return makeTargets(readFileSync(resolve(root, 'Makefile'), 'utf8'));
}
