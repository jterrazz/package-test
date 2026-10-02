import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/gu;

const modules = new Set();
const packages = new Set();
function walk(file) {
    if (modules.has(file)) {
        return;
    }
    modules.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
        if (specifier.startsWith('.')) {
            walk(join(dirname(file), specifier));
        } else {
            packages.add(specifier);
        }
    }
}
walk(process.argv[2]);

const imported = [...packages].toSorted();
const unresolved = imported.filter((name) => {
    try {
        import.meta.resolve(name);
        return false;
    } catch {
        return true;
    }
});
process.stdout.write(
    unresolved.length === 0
        ? `reaches ${modules.size} ${modules.size === 1 ? 'module' : 'modules'}, imports ${imported.join(', ')}, each resolved under the browser condition`
        : `imports ${unresolved.join(', ')}, which the install lacks under the browser condition`,
);
