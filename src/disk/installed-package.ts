import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** The directory of the package `name`, found as Node finds it from `from`: in the nearest `node_modules` holding it. */
export function installedPackage(name: string, testDir: string): null | string {
    let dir = testDir;
    for (;;) {
        const candidate = resolve(dir, 'node_modules', name);
        if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            return candidate;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}
