import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

const [config = 'vitest.config.mjs'] = process.argv.slice(2);
const listed = spawnSync('vitest', ['list', '--config', config], { encoding: 'utf8' });
const collected = stripVTControlCharacters(listed.stdout)
    .split('\n')
    .filter((line) => line.startsWith('['));
const refused = stripVTControlCharacters(listed.stderr)
    .split('\n')
    .map((line) => line.replace(/^Error: /u, '').replaceAll(`${process.cwd()}/`, ''))
    .filter((line) => /^(found|why|fix|read): /u.test(line));
process.stdout.write(`${[...collected.toSorted(), ...refused].join('\n')}\n`);
process.exitCode = listed.status ?? 1;
