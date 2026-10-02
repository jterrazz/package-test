import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const installed = join('node_modules', '@jterrazz', 'test');
const readers = [
    'README.md',
    ...readdirSync(join(installed, 'dist'), { recursive: true })
        .map((path) => join('dist', String(path)))
        .filter((path) => /\.c?js$/u.test(path)),
];
const pages = new Set(
    readers.flatMap((path) =>
        [...readFileSync(join(installed, path), 'utf8').matchAll(/docs\/[\w./-]+\.md/gu)].map(([page]) => page),
    ),
);
for (const page of [...pages].toSorted()) {
    process.stdout.write(`${page}: ${existsSync(join(installed, page)) ? 'held' : 'missing from the install'}\n`);
}
