import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Every repository answers these six targets, and the flows speak only them. */

export const MAKE_TARGETS = ['install', 'build', 'lint', 'fix', 'test', 'check'] as const;

export type MakeTarget = { prerequisites: string[]; recipe: string[] };

/** Never a variable assignment (`:=`). */
const RULE = /^(?<name>[^\s:#=]+):(?!=)(?<prerequisites>[^#]*)/u;

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

export function makefileAt(root: string): Map<string, MakeTarget> {
    return makeTargets(readFileSync(resolve(root, 'Makefile'), 'utf8'));
}
