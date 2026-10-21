import { existsSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';

const helpers = await import('@jterrazz/test/vitest');
const installed = realpathSync(join('node_modules', '@jterrazz', 'test'));
for (const name of ['api', 'cli', 'component', 'integration', 'job', 'lint', 'mobile', 'unit', 'website']) {
    // invariant: called directly, `component()` is handed the root it reads its paths against.
    const setups = [helpers[name](name === 'component' ? { root: process.cwd() } : undefined).test?.globalSetup ?? []].flat();
    const named = setups.map((setup) => `${relative(installed, setup)} (${existsSync(setup) ? 'held' : 'missing'})`);
    process.stdout.write(`${name}: ${named.length === 0 ? 'none' : named.join(', ')}\n`);
}
