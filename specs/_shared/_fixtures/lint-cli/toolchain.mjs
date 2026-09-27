// `report.sh toolchain [self]`: the Architecture and Names passes of @jterrazz/typescript over the working
// directory, held to this package's preset — and to its own name rules under `self` — each finding printed in
// the checker's line convention, `<file>:<line>:<column>: error <pass>(<rule>): <message>`.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const [repository = '', audience = 'consumer'] = process.argv.slice(2);
const built = (file) => pathToFileURL(join(repository, 'dist', file)).href;
const own = audience === 'self' ? `typescript: { names: [sourceRootHoldsKnownEntries] }, ` : '';

writeFileSync(
    'jterrazz.config.ts',
    [
        `import { test } from '${built('config.js')}';`,
        `import { sourceRootHoldsKnownEntries } from '${built('self-oxlint.js')}';`,
        '',
        `export default { ${own}presets: [test()] };`,
        '',
    ].join('\n'),
);

const { main } = await import(
    pathToFileURL(join(repository, 'node_modules/@jterrazz/typescript/dist/command.js')).href
);

let printed = '';
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk) => {
    printed += String(chunk);
    return true;
};
const status = await main(['check'], {
    selected: (pass) => pass === 'architecture' || pass === 'names',
});
process.stdout.write = write;

const FINDING = /^(?<pass>architecture|names)\/(?<rule>\S+) {2}(?<path>\S+) {2}(?<message>.*)$/u;
for (const line of printed.split('\n')) {
    const found = FINDING.exec(line)?.groups;
    if (found === undefined) {
        if (line.startsWith('found: ')) {
            write(`jterrazz.config.ts:1:1: error toolchain(refused): ${line}\n`);
        }
        continue;
    }
    const at = /:\d+:\d+$/u.test(found.path) ? found.path : `${found.path}:1:1`;
    write(`${at}: error ${found.pass}(${found.rule}): ${found.message}\n`);
}
process.exitCode = status;
