import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const installed = join('node_modules', '@jterrazz', 'test');
const { exports } = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
const require = createRequire(join(process.cwd(), 'package.json'));

function targetsOf(node, condition = 'default') {
    if (typeof node === 'string') {
        return [{ condition, target: node }];
    }
    return Object.entries(node).flatMap(([key, child]) =>
        targetsOf(child, key === 'default' ? condition : key),
    );
}

async function load(specifier, condition, target) {
    const path = join(installed, target);
    if (!existsSync(path)) {
        return 'missing from the install';
    }
    if (condition === 'types') {
        return 'held';
    }
    if (condition === 'browser') {
        const imported = [...readFileSync(path, 'utf8').matchAll(/from\s*"([^".][^"]*)"/gu)];
        const packages = [...new Set(imported.map(([, name]) => name))].toSorted();
        const unresolved = packages.filter((name) => {
            try {
                import.meta.resolve(name);
                return false;
            } catch {
                return true;
            }
        });
        return unresolved.length === 0
            ? `imports ${packages.join(', ')}, each resolved`
            : `imports ${unresolved.join(', ')}, which the install lacks`;
    }
    const loaded =
        condition === 'require'
            ? require(specifier)
            : target.endsWith('.json')
              ? (await import(specifier, { with: { type: 'json' } })).default
              : await import(specifier);
    return `loads, ${Object.keys(loaded).length} names`;
}

for (const [subpath, node] of Object.entries(exports)) {
    const specifier = join('@jterrazz/test', subpath);
    for (const { condition, target } of targetsOf(node)) {
        process.stdout.write(`${specifier} (${condition}) → ${target}: ${await load(specifier, condition, target)}\n`);
    }
}
