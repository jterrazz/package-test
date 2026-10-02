import { spawnSync } from 'node:child_process';
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

function counted(count, noun) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
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
        return spawnSync(process.execPath, ['--conditions=browser', 'browser-graph.mjs', path], {
            encoding: 'utf8',
        }).stdout;
    }
    const loaded =
        condition === 'require'
            ? require(specifier)
            : target.endsWith('.json')
              ? (await import(specifier, { with: { type: 'json' } })).default
              : await import(specifier);
    return `loads, ${counted(Object.keys(loaded).length, 'name')}`;
}

for (const [subpath, node] of Object.entries(exports)) {
    const specifier = join('@jterrazz/test', subpath);
    for (const { condition, target } of targetsOf(node)) {
        process.stdout.write(`${specifier} (${condition}) → ${target}: ${await load(specifier, condition, target)}\n`);
    }
}
