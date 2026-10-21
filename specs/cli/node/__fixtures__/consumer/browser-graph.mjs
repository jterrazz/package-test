import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// outside: a bundler's browser set, never node's: node adds `node` to every resolution, and an export that maps `node` to null is closed to it.
const CONDITIONS = new Set(['browser', 'default', 'import', 'module']);

function targetOf(node) {
    if (typeof node === 'string' || node === null) {
        return node;
    }
    for (const [condition, child] of Object.entries(node)) {
        if (CONDITIONS.has(condition)) {
            return targetOf(child);
        }
    }
    return null;
}

// outside: the directory is found as node finds the package, so a link the runner lays resolves; only its exports are read under the browser set.
function packageDirectory(name, specifier) {
    let entry = null;
    for (const candidate of [name, specifier]) {
        try {
            entry = fileURLToPath(import.meta.resolve(candidate));
            break;
        } catch {
            // invariant: a package may open its subpath and not its root, or the reverse.
        }
    }
    for (let directory = entry === null ? null : dirname(entry); directory !== null; ) {
        const manifest = join(directory, 'package.json');
        if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) {
            return directory;
        }
        directory = dirname(directory) === directory ? null : dirname(directory);
    }
    return null;
}

function resolves(specifier) {
    const parts = specifier.split('/');
    const scoped = specifier.startsWith('@') ? 2 : 1;
    const directory = packageDirectory(parts.slice(0, scoped).join('/'), specifier);
    if (directory === null) {
        return false;
    }
    const subpath = ['.', ...parts.slice(scoped)].join('/');
    const { exports } = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    if (exports === undefined) {
        return true;
    }
    const map =
        typeof exports === 'string' || !Object.keys(exports).some((key) => key.startsWith('.'))
            ? { '.': exports }
            : exports;
    const target = targetOf(map[subpath] ?? null);
    return target !== null && existsSync(join(directory, target));
}

const imported = [...packages].toSorted();
const unresolved = imported.filter((name) => !resolves(name));
process.stdout.write(
    unresolved.length === 0
        ? `reaches ${modules.size} ${modules.size === 1 ? 'module' : 'modules'}, imports ${imported.join(', ')}, each resolved under the browser condition`
        : `imports ${unresolved.join(', ')}, which the install lacks under the browser condition`,
);
