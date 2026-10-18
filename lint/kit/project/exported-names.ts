import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { parsedModule } from './module-parser.js';

const LISTED = /^\s*(?:type\s+)?(?:[\w$]+\s+as\s+)?(?<name>[\w$]+)\s*$/u;

/** The names an export or import list binds, `type` and `as` read: `a, type B, c as d` binds `a`, `B`, `d`. */
export function namesOf(list: string): string[] {
    return list.split(',').flatMap((entry) => {
        // Stryker disable next-line OptionalChaining: a list that matches carries its group
        const name = LISTED.exec(entry)?.groups?.name;
        return name === undefined ? [] : [name];
    });
}

/** Every name a module publishes, read off its parsed exports: by name, and through each module it re-exports whole. */
export function exportedNames(file: string): Set<string> {
    const { module } = parsedModule(file, readFileSync(file, 'utf8'));
    const names = new Set<string>();
    for (const { entries } of module.staticExports) {
        for (const { exportName, moduleRequest } of entries) {
            // invariant: a name the module publishes, or an `export *` re-exporting a module whole.
            if (exportName.name !== null) {
                names.add(exportName.name);
            } else if (moduleRequest !== null) {
                // Stryker disable next-line Regex: a specifier holds `.js` once, at its end
                const from = resolve(dirname(file), moduleRequest.value.replace(/\.js$/u, '.ts'));
                for (const name of exportedNames(from)) {
                    names.add(name);
                }
            }
        }
    }
    return names;
}
